'use strict';

var _            = require('lodash');
var Queue        = require('cf-queue');
var CFError      = require('cf-errors');
var ErrorTypes   = CFError.errorTypes;
var EventEmitter = require('events');
var util         = require('util');
var LogsStreamer = require('./logsStreamer.js');

/**
 * TaskLogger - logging for build/launch/promote jobs
 * @param jobid - progress job id
 * @param firstStepCreationTime - optional. if provided the first step creationTime will be this value
 * @param baseFirebaseUrl - baseFirebaseUrl (pre-quisite authentication to firebase should have been made)
 * @param FirebaseLib - a reference to Firebase lib because we must use the same singelton for pre-quisite authentication
 * @param queueConfig - sends the build-manager an event whenever a new step is created
 * @returns {{create: create, finish: finish}}
 */
var TaskLogger = function (jobId, firstStepCreationTime, baseFirebaseUrl, FirebaseLib, queueConfig, initializeStepReference) {
    var self = this;
    EventEmitter.call(self);

    if (!jobId) {
        throw new CFError(ErrorTypes.Error, "failed to create taskLogger because jobId must be provided");
    }
    else if (!baseFirebaseUrl) {
        throw new CFError(ErrorTypes.Error, "failed to create taskLogger because baseFirebaseUrl must be provided");
    }
    else if (!FirebaseLib) {
        throw new CFError(ErrorTypes.Error, "failed to create taskLogger because Firebase lib reference must be provided");
    }
    else if (!queueConfig) {
        throw new CFError(ErrorTypes.Error, "failed to create taskLogger because queue configuration must be provided");
    }

    var logsStreamer = new LogsStreamer(jobId);

    var buildManagerQueue = new Queue('BuildManagerEventsQueue', queueConfig);

    // Do we need this reference?
    //var progressRef = new FirebaseLib(baseFirebaseUrl + jobId);

    var fatal    = false;
    var finished = false;
    var steps    = {};
    var handler;

    if (initializeStepReference) {
        var initStepName = "Initializing Process";
        var initializeStep            = {
            name: initStepName,
            status: "running",
            id: logsStreamer.genStepId(initStepName),
            //firebaseRef: new FirebaseLib(initializeStepReference)
        };
        steps["Initializing Process"] = initializeStep;
    }

    var create = function (name) {

        if (fatal || finished) {
            return {
                getReference: function () {
                },
                getLogsReference: function () {

                },
                getLastUpdateReference: function () {

                },
                write: function () {
                },
                debug: function () {
                },
                warn: function () {
                },
                info: function () {
                },
                finish: function () {
                }
            };
        }

        var step = steps[name];
        if (!step) {
            step = {
                name: name,
                creationTimeStamp: +(new Date().getTime() / 1000).toFixed(),
                status: "running",
                logs: {}
            };
            if (firstStepCreationTime && _.isEmpty(steps)) { // a workaround so api can provide the first step creation time from outside
                step.creationTimeStamp = firstStepCreationTime;
            }
            steps[name]      = step;

            // push a new step
            //var stepsRef     = new FirebaseLib(baseFirebaseUrl + jobId + "/steps");
            //step.firebaseRef = stepsRef.push(step);

            step.id = logsStreamer.genStepId(name);
            logsStreamer.updateStep(step, function(res) {
              // TODO: Verify we got a valid response
              self.emit("step-pushed", name);
            });

            // emit message when the new step is pushed
            //step.firebaseRef.on("value", function (snapshot) {
                //var val = snapshot.val();
                //if (val && val.name === name) {
                    //step.firebaseRef.off("value");
                    //self.emit("step-pushed", name);
                //}
            //});

            buildManagerQueue.request({ action: "new-progress-step", jobId: jobId, name: name }); //update build model
        }
        else {
            // update the finish time
            step.status = "running";
            //step.firebaseRef.update({ status: step.status, finishTimeStamp: "" }); //this is a workaround because we are creating multiple steps with the same name so we must reset the finishtime so that we won't show it in the ui
            step.finishTimeStamp = "";
            logsStreamer.updateStep(step);
        }

        // All the handlers should be updated to the new UI
        // Important: the firebaseRef is probably used as a unique identifier (!)
        handler = {
            getReference: function () {
                //return step.firebaseRef.toString();
                return logsStreamer.getRef();
            },
            getLogsReference: function () {
                //return step.firebaseRef.child('logs').toString();
                return logsStreamer.getLogRef();
            },
            getLastUpdateReference: function () {
                //return progressRef.child('lastUpdate').toString();
                return '';
            },
            write: function (message) {
                if (fatal) {
                    return;
                }
                if (step.status === "running") {
                    //step.firebaseRef.child("logs").push(message);
                    //progressRef.child("lastUpdate").set(new Date().getTime());
                    logsStreamer.log(message);
                    logsStreamer.updateMetadata({lastUpdate: (new Date().getTime())});
                }
                else {
                    self.emit("error",
                        new CFError(ErrorTypes.Error, "progress-logs 'write' handler was triggered after the job finished with message: %s", message));
                }
            },
            debug: function (message) {
                if (fatal) {
                    return;
                }
                if (step.status === "running") {
                    //step.firebaseRef.child("logs").push(message + '\r\n');
                    //progressRef.child("lastUpdate").set(new Date().getTime());
                    logsStreamer.log(message + '\r\n');
                    logsStreamer.updateMetadata({lastUpdate: (new Date().getTime())});
                }
                else {
                    self.emit("error",
                        new CFError(ErrorTypes.Error, "progress-logs 'debug' handler was triggered after the job finished with message: %s", message));
                }
            },
            warn: function (message) {
                if (fatal) {
                    return;
                }
                if (step.status === "running") {
                    step.hasWarning = true;
                    //step.firebaseRef.child("logs").push(`\x1B[01;93m${message}\x1B[0m\r\n`);
                    //progressRef.child("lastUpdate").set(new Date().getTime());

                    logsStreamer.log(`\x1B[01;93m${message}\x1B[0m\r\n`);
                    logsStreamer.updateMetadata({lastUpdate: (new Date().getTime())});
                }
                else {
                    self.emit("error",
                        new CFError(ErrorTypes.Error, "progress-logs 'warning' handler was triggered after the job finished with message: %s", message));
                }
            },
            info: function (message) {
                if (fatal) {
                    return;
                }
                if (step.status === "running") {
                    //step.firebaseRef.child("logs").push(message + '\r\n');
                    //progressRef.child("lastUpdate").set(new Date().getTime());
                    logsStreamer.log(message + '\r\n');
                    logsStreamer.updateMetadata({lastUpdate: (new Date().getTime())});
                }
                else {
                    self.emit("error",
                        new CFError(ErrorTypes.Error, "progress-logs 'info' handler was triggered after the job finished with message: %s", message));
                }
            },
            finish: function (err) {
                if (fatal) {
                    return;
                }
                if (step.status === "running") {
                    step.finishTimeStamp = +(new Date().getTime() / 1000).toFixed();
                    step.status          = err ? "error" : "success";
                    if (err) {
                        //step.firebaseRef.child("logs").push(`\x1B[31m${err.toString()}\x1B[0m`);
                        logsStreamer.log(`\x1B[31m${err.toString()}\x1B[0m`);
                    }
                    if (!err && step.hasWarning) { //this is a workaround to mark a step with warning status. we do it at the end of the step
                        step.status = "warning";
                    }
                    //step.firebaseRef.update({ status: step.status, finishTimeStamp: step.finishTimeStamp });
                    //progressRef.child("lastUpdate").set(new Date().getTime());

                    logsStreamer.updateStep(step);
                    logsStreamer.updateMetadata({lastUpdate: (new Date().getTime())});

                    handler = undefined;
                }
                else {
                    if (err) {
                        self.emit("error",
                            new CFError(ErrorTypes.Error, "progress-logs 'finish' handler was triggered after the job finished with err: %s", err.toString()));
                    }
                    else {
                        self.emit("error", new CFError(ErrorTypes.Error, "progress-logs 'finish' handler was triggered after the job finished"));
                    }
                }
            }
        };
        return handler;
    };

    var finish = function (err) {
        if (fatal) {
            return;
        }
        if (handler) {
            handler.finish(err);
        }
        finished = true;
    };

    var fatalError = function (err) {
        if (!err) {
            throw new CFError(ErrorTypes.Error, "fatalError was called without an error. not valid.");
        }
        if (fatal) {
            return;
        }

        if (handler) {
            handler.finish(err);
        }
        else {
            var errorStep = this.create("Something went wrong");
            errorStep.finish(err);
        }
        fatal = true;
    };

    return {
        create: create,
        finish: finish,
        fatalError: fatalError,
        on: self.on.bind(self)
    };

};

util.inherits(TaskLogger, EventEmitter);

module.exports = TaskLogger;
