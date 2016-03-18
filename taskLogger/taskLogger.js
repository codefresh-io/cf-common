var _            = require('lodash');
var Queue        = require('cf-queue');
var CFError      = require('cf-errors');
var ErrorTypes   = CFError.errorTypes;
var EventEmitter = require('events');
var util         = require('util');

/**
 * TaskLogger - logging for build/launch/promote jobs
 * @param jobid - progress job id
 * @param firstStepCreationTime - optional. if provided the first step creationTime will be this value
 * @param baseFirebaseUrl - baseFirebaseUrl (pre-quisite authentication to firebase should have been made)
 * @param FirebaseLib - a reference to Firebase lib because we must use the same singelton for pre-quisite authentication
 * @param queueConfig - sends the build-manager an event whenever a new step is created
 * @returns {{create: create, finish: finish}}
 */
var TaskLogger = function(jobId, firstStepCreationTime, baseFirebaseUrl, FirebaseLib, queueConfig) {
    var self = this;
    EventEmitter.call(self);

    if (!jobId){
        throw new CFError(ErrorTypes.Error, "failed to create taskLogger because jobId must be provided");
    }
    else if (!baseFirebaseUrl){
        throw new CFError(ErrorTypes.Error, "failed to create taskLogger because baseFirebaseUrl must be provided");
    }
    else if (!FirebaseLib){
        throw new CFError(ErrorTypes.Error, "failed to create taskLogger because Firebase lib reference must be provided");
    }
    else if (!queueConfig){
        throw new CFError(ErrorTypes.Error, "failed to create taskLogger because queue configuration must be provided");
    }

    var buildManagerQueue = new Queue('BuildManagerEventsQueue', queueConfig);

    var progressRef = new FirebaseLib(baseFirebaseUrl + jobId);

    var steps = {};
    var handler;

    self.create = function(name) {

        var step = steps[name];
        if (!step) {
            step = {
                name:name,
                creationTimeStamp: +(new Date().getTime() / 1000).toFixed(),
                status: "running",
                logs: {}
            };
            if (firstStepCreationTime && _.isEmpty({})){ // a workaround so api can provide the first step creation time from outside
                step.creationTimeStamp = firstStepCreationTime;
            }
            steps[name] = step;
            var stepRef = new FirebaseLib(baseFirebaseUrl + jobId + "/steps");
            step.firebaseRef = stepRef.push(step);
            buildManagerQueue.request({action:"new-progress-step", jobId: jobId, name: name}); //update build model


            progressRef.child("status").on("value", function(snapshot){ // this is here to handle termination asked by user to signify stop of the progress and stop accepting additional logs
                var status = snapshot.val();
                if (status === "terminating" || status === "terminated" || status === "success" || status === "error"){
                    progressRef.child("status").off("value");
                    if (status === "terminating" && step.status === "running"){
                        step.finishTimeStamp = +(new Date().getTime() / 1000).toFixed();
                        step.status = "terminated";
                        step.firebaseRef.update({status: step.status, finishTimeStamp: step.finishTimeStamp});
                        step.firebaseRef.child("logs").push("Process terminated");
                        progressRef.child("lastUpdate").set(new Date().getTime());
                    }
                }
            });

        }
        else {
            step.status = "running";
            step.firebaseRef.update({status: step.status, finishTimeStamp: ""}); //this is a workaround because we are creating multiple steps with the same name so we must reset the finishtime so that we won't show it in the ui
        }

        handler = {
            write: function(message) {
                if (step.status === "running") {
                    step.firebaseRef.child("logs").push(message);
                    progressRef.child("lastUpdate").set(new Date().getTime());
                }
                else if (step.status !== "terminated") {
                    self.emit("error", new CFError(ErrorTypes.Error, "progress-logs 'write' handler was triggered after the job finished with message: %s", message));
                }
            },
            debug: function(message) {
                if (step.status === "running") {
                    step.firebaseRef.child("logs").push(message + '\r\n');
                    progressRef.child("lastUpdate").set(new Date().getTime());
                }
                else if (step.status !== "terminated") {
                    self.emit("error", new CFError(ErrorTypes.Error, "progress-logs 'debug' handler was triggered after the job finished with message: %s", message));
                }
            },
            warning: function(message) {
                if (step.status === "running") {
                    step.status = "warning";
                    step.firebaseRef.child("status").set("warning");
                    step.firebaseRef.child("logs").push(message + '\r\n');
                    progressRef.child("lastUpdate").set(new Date().getTime());
                }
                else if (step.status !== "terminated") {
                    self.emit("error", new CFError(ErrorTypes.Error, "progress-logs 'warning' handler was triggered after the job finished with message: %s", message));
                }
            },
            info: function(message) {
                if (step.status === "running") {
                    step.firebaseRef.child("logs").push(message + '\r\n');
                    progressRef.child("lastUpdate").set(new Date().getTime());
                }
                else if (step.status !== "terminated") {
                    self.emit("error", new CFError(ErrorTypes.Error, "progress-logs 'info' handler was triggered after the job finished with message: %s", message));
                }
            },
            error: function(message) {
                if (step.status === "running") {
                    step.status = "error";
                    step.firebaseRef.child("status").set("error");
                    step.firebaseRef.child("logs").push(message + '\r\n');
                    progressRef.child("lastUpdate").set(new Date().getTime());
                }
                else if (step.status !== "terminated") {
                    self.emit("error", new CFError(ErrorTypes.Error, "progress-logs 'error' handler was triggered after the job finished with message: %s", message));
                }
            },
            finish: function(err) {
                if (step.status === "running") {
                    step.finishTimeStamp = +(new Date().getTime() / 1000).toFixed();
                    step.status = err ? "error" : "success";
                    if (err){
                        step.firebaseRef.child("logs").push(err.toString());
                    }
                    step.firebaseRef.update({status: step.status, finishTimeStamp: step.finishTimeStamp});
                    progressRef.child("lastUpdate").set(new Date().getTime());
                }
                else if (step.status !== "terminated") {
                    if (err){
                        self.emit("error", new CFError(ErrorTypes.Error, "progress-logs 'finish' handler was triggered after the job finished with err: %s", err.toString()));
                    }
                    else {
                        self.emit("error", new CFError(ErrorTypes.Error, "progress-logs 'finish' handler was triggered after the job finished"));
                    }
                }
            }
        };
        return handler;
    };

    self.finish = function(err) {
        if (handler){
            handler.finish(err);
        }
    };

};

util.inherits(TaskLogger, EventEmitter);

module.exports = TaskLogger;
