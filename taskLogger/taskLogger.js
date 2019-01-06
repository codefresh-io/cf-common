'use strict';

var _            = require('lodash');
var CFError      = require('cf-errors');
var ErrorTypes   = CFError.errorTypes;
var EventEmitter = require('events');
var util         = require('util');
var rp           = require('request-promise');
var Q            = require('q');

var STATUS = {
    PENDING: 'pending',
    RUNNING: 'running',
    SUCCESS: 'success',
    ERROR: 'error',
    SKIPPED: 'skipped',
    WARNING: 'warning',
    PENDING_APPROVAL: 'pending-approval',
    APPROVED: 'approved',
    DENIED: 'denied'
};

const STEPS_REFERENCES_KEY = 'stepsReferences';

/**
 * TaskLogger - logging for build/launch/promote jobs
 * @param jobid - progress job id
 * @param firstStepCreationTime - optional. if provided the first step creationTime will be this value
 * @param baseFirebaseUrl - baseFirebaseUrl (pre-quisite authentication to firebase should have been made)
 * @param FirebaseLib - a reference to Firebase lib because we must use the same singelton for pre-quisite authentication
 * @returns {{create: create, finish: finish}}
 */
var TaskLogger = function (jobId, baseFirebaseUrl, FirebaseLib) {
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
    var handlers = {};

    const restoreExistingSteps = function () {
        let settled = false;
        const deferred = Q.defer();
        progressRef.child(STEPS_REFERENCES_KEY).once("value", function (snapshot) {
            const stepsReferences = snapshot.val();
            if (!stepsReferences) {
                deferred.resolve();
            }

            Q.all(_.map(stepsReferences, (name, key) => {
                const stepRef     = new FirebaseLib(baseFirebaseUrl + jobId + `/steps/${key}`);
                const step = {
                    logs: {},
                    firebaseRef: stepRef
                };

                const nameDeferred = Q.defer();
                const statusDeferred = Q.defer();

                stepRef.child('name').once('value', (snapshot) => {
                    step.name = snapshot.val();
                    nameDeferred.resolve();
                });
                stepRef.child('status').once('value', (snapshot) => {
                    step.status = snapshot.val();
                    if (step.status === STATUS.PENDING_APPROVAL) {
                        step.pendingApproval = true;
                    }
                    statusDeferred.resolve();
                });

                return Q.all([nameDeferred.promise, statusDeferred.promise])
                    .then(() => {
                        steps[step.name] = step;
                    });
            }))
                .then(() => {
                    settled = true;
                    deferred.resolve();
                })
                .done();
        });

        setTimeout(() => {
            if (!settled) {
                deferred.reject(new Error('Failed to restore steps metadata from Firebase'));
            }
        }, 5000);
        return deferred.promise;
    };

    var updateCurrentStepReferences = function () {
        const stepsReferences = {};
        _.forEach(steps, (step) => {
            stepsReferences[_.last(step.firebaseRef.toString().split('/'))] = step.name;
        });
        progressRef.child(STEPS_REFERENCES_KEY).set(stepsReferences);
    };

    var addErrorMessageToEndOfSteps = function (message) {
        var deferred = Q.defer();

        var stepsRef = new FirebaseLib(baseFirebaseUrl + jobId + "/steps/");
        stepsRef.limitToLast(1).once('value', function (snapshot) {
            try {
                _.forEach(snapshot.val(), function(step, stepKey) {
                    var stepRef = new FirebaseLib(baseFirebaseUrl + jobId + "/steps/" + stepKey);
                    stepRef.child('logs').push(`\x1B[31m${message}\x1B[0m\r\n`);
                });
                deferred.resolve();
            } catch (err) {
                deferred.reject(err);
            }
        });

        return deferred.promise;
    };

    var create = function (name, eventReporting, resetStatus) {

        if (fatal || finished) {
            return {
                getReference: function () {
                },
                getLogsReference: function () {

                },
                getLastUpdateReference: function () {

                },
                getMetricsLogsReference: function () {

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
                status: STATUS.PENDING,
                logs: {}
            };

            steps[name]      = step;
            var stepsRef     = new FirebaseLib(baseFirebaseUrl + jobId + "/steps");
            step.firebaseRef = stepsRef.push(step);

            step.firebaseRef.on("value", function (snapshot) {
                var val = snapshot.val();
                if (val && val.name === name) {
                    step.firebaseRef.off("value");
                    self.emit("step-pushed", name);
                    updateCurrentStepReferences();
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

        } else if (resetStatus) {
            step.status = STATUS.PENDING;
            step.firebaseRef.child('creationTimeStamp').set('');
            step.firebaseRef.child('finishTimeStamp').set('');
            step.firebaseRef.child('status').set(step.status);
        }

        handlers[name] = {
            start: function () {
                if (fatal) {
                    return;
                }
                if (step.status === STATUS.PENDING) {
                    step.status = STATUS.RUNNING;
                    step.firebaseRef.child('status').set(step.status);
                    step.firebaseRef.child('finishTimeStamp').set('');
                    step.firebaseRef.child('creationTimeStamp').set(+(new Date().getTime() / 1000).toFixed());
                }
            },
            resume: function () {
                if (fatal) {
                    return;
                }
                if (step.status === STATUS.PENDING_APPROVAL) {
                    step.status = STATUS.RUNNING;
                    step.firebaseRef.child('status').set(step.status);
                }
            },
            getReference: function () {
                return step.firebaseRef.toString();
            },
            getLogsReference: function () {
                return step.firebaseRef.child('logs').toString();
            },
            getLastUpdateReference: function () {
                return progressRef.child('lastUpdate').toString();
            },
            getMetricsLogsReference: function () {
                return step.firebaseRef.child('metrics').child('logs').toString();
            },
            write: function (message) {
                if (fatal) {
                    return;
                }
                if (step.status === STATUS.RUNNING || step.status === STATUS.PENDING) {
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
                if (step.status === STATUS.RUNNING || step.status === STATUS.PENDING) {
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
                if (step.status === STATUS.RUNNING || step.status === STATUS.PENDING) {
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
                if (step.status === STATUS.RUNNING || step.status === STATUS.PENDING) {
                    step.firebaseRef.child("logs").push(message + '\r\n');
                    progressRef.child("lastUpdate").set(new Date().getTime());
                }
                else {
                    self.emit("error",
                        new CFError(ErrorTypes.Error, "progress-logs 'info' handler was triggered after the job finished with message: %s", message));
                }
            },
            finish: function (err, skip) {
                if (step.status === STATUS.PENDING && !skip) { // do not close a pending step that should not be skipped
                    return;
                }

                if (fatal) {
                    return;
                }
                if (step.status === STATUS.RUNNING || step.status === STATUS.PENDING || step.status === STATUS.PENDING_APPROVAL) {
                    step.finishTimeStamp = +(new Date().getTime() / 1000).toFixed();
                    if (err) {
                        step.status = step.pendingApproval ? STATUS.DENIED : STATUS.ERROR;
                    } else {
                        step.status = step.pendingApproval ? STATUS.APPROVED : STATUS.SUCCESS;
                    }
                    if (skip) {
                        step.status = STATUS.SKIPPED;
                    }
                    if (err && err.toString() !== 'Error') {
                        step.firebaseRef.child("logs").push(`\x1B[31m${err.toString()}\x1B[0m\r\n`);
                    }
                    if (!err && step.hasWarning) { //this is a workaround to mark a step with warning status. we do it at the end of the step
                        step.status = STATUS.WARNING;
                    }
                    step.firebaseRef.update({ status: step.status, finishTimeStamp: step.finishTimeStamp });
                    progressRef.child("lastUpdate").set(new Date().getTime());
                    delete handlers[name];
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
            },
            getStatus: function() {
                return step.status;
            },
            markPreviouslyExecuted: function() {
                if (fatal) {
                    return;
                }

                step.firebaseRef.child('previouslyExecuted').set(true);
            },
            markPendingApproval: function() {
                if (fatal) {
                    return;
                }

                step.status = STATUS.PENDING_APPROVAL;
                step.pendingApproval = true;
                step.firebaseRef.child('status').set(step.status);
                delete handlers[name];
            },
            updateMemoryUsage: function (time, memoryUsage) {
                step.firebaseRef.child('metrics').child('memory').push({time, usage:memoryUsage});
            },
            updateCpuUsage: function (time, cpuUsage) {
                step.firebaseRef.child('metrics').child('cpu').push({time, usage:cpuUsage});
            },
        };
        return handlers[name];
    };

    var finish = function (err) { // jshint ignore:line
        if (fatal) {
            return;
        }
        if (_.size(handlers)) {
            _.forEach(handlers, (handler) => {
                handler.finish(new Error('Unknown error occurred'));
            });
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

        if (_.size(handlers)) {
            _.forEach(handlers, (handler) => {
                handler.finish(new Error('Unknown error occurred'));
            });
        }
        else {
            var errorStep = this.create("Something went wrong");
            errorStep.finish(err);
        }
        fatal = true;
    };

    var getMetricsLogsReference = function () {
        return progressRef.child('metrics').child('logs').toString();
    };

    const updateMemoryUsage = function (time, memoryUsage) {
        progressRef.child('metrics').child('memory').push({time, usage:memoryUsage});
    };

    const setMemoryLimit = function (limitMemory) {
        const limit = limitMemory.replace('Mi','');
        progressRef.child('metrics').child('limits').child('memory').push(limit);
    };

    return {
        restoreExistingSteps: restoreExistingSteps,
        create: create,
        finish: finish,
        fatalError: fatalError,
        addErrorMessageToEndOfSteps: addErrorMessageToEndOfSteps,
        getMetricsLogsReference: getMetricsLogsReference,
        on: self.on.bind(self),
        steps: steps, // for testing purposes solely
        updateMemoryUsage: updateMemoryUsage,
        setMemoryLimit: setMemoryLimit
    };

};

util.inherits(TaskLogger, EventEmitter);

module.exports = TaskLogger;
