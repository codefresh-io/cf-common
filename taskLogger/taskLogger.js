'use strict';

var _            = require('lodash');
var CFError      = require('cf-errors');
var ErrorTypes   = CFError.errorTypes;
var EventEmitter = require('events');
var util         = require('util');
var rp           = require('request-promise');

/**
 * TaskLogger - logging for build/launch/promote jobs
 * @param jobid - progress job id
 * @param firstStepCreationTime - optional. if provided the first step creationTime will be this value
 * @param baseFirebaseUrl - baseFirebaseUrl (pre-quisite authentication to firebase should have been made)
 * @param FirebaseLib - a reference to Firebase lib because we must use the same singelton for pre-quisite authentication
 * @returns {{create: create, finish: finish}}
 */
var TaskLogger = function (jobId, firstStepCreationTime, baseFirebaseUrl, FirebaseLib, initializeStepReference) {
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


    var progressRef = new FirebaseLib(baseFirebaseUrl + jobId);

    var fatal    = false;
    var finished = false;
    var steps    = {};
    var handler;

    if (initializeStepReference) {
        var initializeStep            = {
            name: "Initializing Process",
            status: "running",
            firebaseRef: new FirebaseLib(initializeStepReference)
        };
        steps["Initializing Process"] = initializeStep;
    }

    var create = function (name, id, eventReporting) {

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

        var step = steps[id || name];
        if (!step) {
            step = {
                name: name,
                id: id || '',
                creationTimeStamp: +(new Date().getTime() / 1000).toFixed(),
                status: "running",
                logs: {}
            };
            if (firstStepCreationTime && _.isEmpty(steps)) { // a workaround so api can provide the first step creation time from outside
                step.creationTimeStamp = firstStepCreationTime;
            }
            steps[id || name]      = step;
            var stepsRef     = new FirebaseLib(baseFirebaseUrl + jobId + "/steps");
            step.firebaseRef = stepsRef.push(step);

            step.firebaseRef.on("value", function (snapshot) {
                var val = snapshot.val();
                if (val && val.name === name) {
                    step.firebaseRef.off("value");
                    self.emit("step-pushed", name);
                }
            });

            if (eventReporting) {
                var event = { action: "new-progress-step", name: name };
                rp({
                    uri: eventReporting.url,
                    headers: {
                        'x-access-token': eventReporting.token
                    },
                    method: 'POST',
                    body: event,
                    json: true
                });
            }

        }
        else {
            step.status = "running";
            step.firebaseRef.update({ status: step.status, finishTimeStamp: "" }); //this is a workaround because we are creating multiple steps with the same name so we must reset the finishtime so that we won't show it in the ui
        }

        handler = {
            getReference: function () {
                return step.firebaseRef.toString();
            },
            getLogsReference: function () {
                return step.firebaseRef.child('logs').toString();
            },
            getLastUpdateReference: function () {
                return progressRef.child('lastUpdate').toString();
            },
            write: function (message) {
                if (fatal) {
                    return;
                }
                if (step.status === "running") {
                    step.firebaseRef.child("logs").push(message);
                    progressRef.child("lastUpdate").set(new Date().getTime());
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
                    step.firebaseRef.child("logs").push(message + '\r\n');
                    progressRef.child("lastUpdate").set(new Date().getTime());
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
                    step.firebaseRef.child("logs").push(`\x1B[01;93m${message}\x1B[0m\r\n`);
                    progressRef.child("lastUpdate").set(new Date().getTime());
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
                    step.firebaseRef.child("logs").push(message + '\r\n');
                    progressRef.child("lastUpdate").set(new Date().getTime());
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
                        step.firebaseRef.child("logs").push(`\x1B[31m${err.toString()}\x1B[0m`);
                    }
                    if (!err && step.hasWarning) { //this is a workaround to mark a step with warning status. we do it at the end of the step
                        step.status = "warning";
                    }
                    step.firebaseRef.update({ status: step.status, finishTimeStamp: step.finishTimeStamp });
                    progressRef.child("lastUpdate").set(new Date().getTime());
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
