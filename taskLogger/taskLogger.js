var _        = require('lodash');
var Queue    = require('cf-queue');
var Firebase = require("firebase");

/**
 * TaskLogger - logging for build/launch/promote jobs
 * @param job - job metadata
 * @param baseFirebaseUrl - baseFirebaseUrl (pre-quisite authentication to firebase should have been made)
 * @param queueConfig - optional. if passed will send the build-manager an event whenever a new step is created
 * @returns {{create: create, finish: finish}}
 */
var TaskLogger = function(job, baseFirebaseUrl, queueConfig) {

    var jobId = _.get(job, "request.context.progress_id");

    if (queueConfig){
        var buildManagerQueue = new Queue('BuildManagerEventsQueue', queueConfig);
    }

    var progressRef = new Firebase(baseFirebaseUrl + jobId);

    var steps = {};
    var handler;

    var create = function(name) {

        var step = steps[name];
        if (!step) {
            step = {
                name:name,
                creationTimeStamp: +(new Date().getTime() / 1000).toFixed(),
                status: "running",
                logs: {}
            };
            steps[name] = step;
            var stepRef = new Firebase(baseFirebaseUrl + jobId + "/steps");
            step.firebaseRef = stepRef.push(step);
            if (queueConfig){
                buildManagerQueue.request({action:"new-progress-step", jobId: jobId, name: name}); //update build model
            }


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
                if (step.status !== "terminated"){
                    step.firebaseRef.child("logs").push(message);
                    progressRef.child("lastUpdate").set(new Date().getTime());
                }
            },
            debug: function(message) {
                if (step.status !== "terminated") {
                    step.firebaseRef.child("logs").push(message + '\r\n');
                    progressRef.child("lastUpdate").set(new Date().getTime());
                }
            },
            warning: function(message) {
                if (step.status !== "terminated") {
                    step.status = "warning";
                    step.firebaseRef.child("status").set("warning");
                    step.firebaseRef.child("logs").push(message + '\r\n');
                    progressRef.child("lastUpdate").set(new Date().getTime());
                }
            },
            info: function(message) {
                if (step.status !== "terminated") {
                    step.firebaseRef.child("logs").push(message + '\r\n');
                    progressRef.child("lastUpdate").set(new Date().getTime());
                }
            },
            error: function(message) {
                if (step.status !== "terminated") {
                    step.status = "error";
                    step.firebaseRef.child("status").set("error");
                    step.firebaseRef.child("logs").push(message + '\r\n');
                    progressRef.child("lastUpdate").set(new Date().getTime());
                }
            },
            finish: function(err) {
                if (step.status !== "terminated") {
                    step.finishTimeStamp = +(new Date().getTime() / 1000).toFixed();
                    step.status = err ? "error" : "success";
                    if (err){
                        step.firebaseRef.child("logs").push(err);
                    }
                    step.firebaseRef.update({lastUpdate: new Date().getTime(), status: step.status, finishTimeStamp: step.finishTimeStamp});
                    progressRef.child("lastUpdate").set(new Date().getTime());
                }
            }
        };
        return handler;
    };

    var finish = function(err) {
        handler.finish(err);
    };

    return {
        create:create,
        finish:finish
    };
};

module.exports = TaskLogger;
