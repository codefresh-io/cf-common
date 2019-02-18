'use strict';

const _                                               = require('lodash');
const CFError                                         = require('cf-errors');
const ErrorTypes                                      = CFError.errorTypes;
const EventEmitter                                    = require('events');
const util                                            = require('util');
const rp                                              = require('request-promise');
const Q                                               = require('q');
const jwt                                             = require('jsonwebtoken');
const StepLogger                                      = require('./StepLogger');
const { STATUS, STEPS_REFERENCES_KEY, LOGS_LOCATION } = require('./enums');


/**
 * TaskLogger - logging for build/launch/promote jobs
 * @param jobid - progress job id
 * @param firstStepCreationTime - optional. if provided the first step creationTime will be this value
 * @param loggerImpl - logging implemeations (e.g. : firebase , redis)
 * @returns {{create: create, finish: finish}}
 */
var TaskLogger = function (jobId, loggerImpl) {
    var self = this;
    EventEmitter.call(self);

    if (!jobId) {
        throw new CFError(ErrorTypes.Error, "failed to create taskLogger because jobId must be provided");
    }
    else if (!loggerImpl) {
        throw new CFError(ErrorTypes.Error, "failed to create taskLogger because loggerImpl must be provided");
    }
    this.loggerImpl = loggerImpl;
    this.loggerImpl.start(jobId);


    var fatal    = false;
    var finished = false;
    var steps    = {};

    const restoreExistingSteps = function () {

        return Q.resolve().then(() => {

            //Note !! This is Redis specifc code
            return self.loggerImpl.child(STEPS_REFERENCES_KEY).getHash();

        }).then((keyToStatus) => {
            if (keyToStatus) {
                const stepFromRedis = Object.keys(keyToStatus);
                steps = stepFromRedis.reduce((acc, current) => {
                    acc[current] = {
                        status: keyToStatus[current],
                        name: current,
                        ...(keyToStatus[current] === STATUS.PENDING_APPROVAL && {pendingApproval : true})
                    }
                    return acc;

                },{});
            }
        }).thenResolve();

        // let settled = false;
        // const deferred = Q.defer();
        // progressRef.child(STEPS_REFERENCES_KEY).once("value", function (snapshot) {
        //     const stepsReferences = snapshot.val();
        //     if (!stepsReferences) {
        //         deferred.resolve();
        //     }

        //     Q.all(_.map(stepsReferences, (name, key) => {
        //         const stepRef     = new FirebaseLib(baseFirebaseUrl + jobId + `/steps/${key}`);
        //         const step = {
        //             logs: {},
        //             firebaseRef: stepRef
        //         };

        //         const nameDeferred = Q.defer();
        //         const statusDeferred = Q.defer();

        //         stepRef.child('name').once('value', (snapshot) => {
        //             step.name = snapshot.val();
        //             nameDeferred.resolve();
        //         });
        //         stepRef.child('status').once('value', (snapshot) => {
        //             step.status = snapshot.val();
        //             if (step.status === STATUS.PENDING_APPROVAL) {
        //                 step.pendingApproval = true;
        //             }
        //             statusDeferred.resolve();
        //         });

        //         return Q.all([nameDeferred.promise, statusDeferred.promise])
        //             .then(() => {
        //                 steps[step.name] = step;
        //             });
        //     }))
        //         .then(() => {
        //             settled = true;
        //             deferred.resolve();
        //         })
        //         .done();
        // });

        // setTimeout(() => {
        //     if (!settled) {
        //         deferred.reject(new Error('Failed to restore steps metadata from Firebase'));
        //     }
        // }, 5000);
        // return deferred.promise;

    };

    // var updateCurrentStepReferences = function () {
    //     const stepsReferences = {};
    //     _.forEach(steps, (step) => {
    //         stepsReferences[_.last(step.firebaseRef.toString().split('/'))] = step.name;
    //     });
    //     progressRef.child(STEPS_REFERENCES_KEY).set(stepsReferences);
    // };

    var addErrorMessageToEndOfSteps = function (message) {
        // var deferred = Q.defer();

        // var stepsRef = new FirebaseLib(baseFirebaseUrl + jobId + "/steps/");
        // stepsRef.limitToLast(1).once('value', function (snapshot) {
        //     try {
        //         _.forEach(snapshot.val(), function(step, stepKey) {
        //             var stepRef = new FirebaseLib(baseFirebaseUrl + jobId + "/steps/" + stepKey);
        //             stepRef.child(LOGS_LOCATION).push(`\x1B[31m${message}\x1B[0m\r\n`);
        //         });
        //         deferred.resolve();
        //     } catch (err) {
        //         deferred.reject(err);
        //     }
        // });

        // return deferred.promise;
        return Q.resolve().then(() => {
            const steps = self.loggerImpl.child('steps').children();
            if (steps && steps.length > 0) {
                steps[steps.length -1].child(LOGS_LOCATION).push(`\x1B[31m${message}\x1B[0m\r\n`);
            }
        })
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

        let step = steps[name];

        if (!step) {
            const index = Object.keys(steps).length; //TODO why do we need this index?
            step = new StepLogger(name, this.loggerImpl, index);
            step.init();
            steps[step.name] = step;

            if (eventReporting) {
                var event     = { action: "new-progress-step", name: name };
                const headers = {};
                try {
                    jwt.decode(eventReporting.token) ? headers['x-access-token'] = eventReporting.token :
                        headers.Authorization = eventReporting.token;
                } catch (err) {
                    headers.Authorization = eventReporting.token;
                }
                rp({
                    uri: eventReporting.url,
                    headers,
                    method: 'POST',
                    body: event,
                    json: true
                });
            }

        } else {
            step.init(); //TODO why do we have .init twice
            if (resetStatus) {
                step.reset();
            }
        }

        return step;
    };

    var finish = function (err) { // jshint ignore:line
        if (fatal) {
            return;
        }
        if (_.size(steps)) {
            _.forEach(steps, (step) => {
                step.finish(new Error('Unknown error occurred'));
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

        if (_.size(steps)) {
            _.forEach(steps, (step) => {
                step.finish(new Error('Unknown error occurred'));
            });
        }
        else {
            var errorStep = this.create("Something went wrong");
            errorStep.finish(err);
        }
        fatal = true;
    };

    var getMetricsLogsReference = function () {
        return self.loggerImpl.child('metrics').child(LOGS_LOCATION).toString();
    };

    const updateMemoryUsage = function (time, memoryUsage) {
        self.loggerImpl.child('metrics').child('memory').push({time, usage:memoryUsage});
    };

    const setMemoryLimit = function (limitMemory) {
        const limit = limitMemory.replace('Mi','');
        self.loggerImpl.child('metrics').child('limits').child('memory').push(limit);
    };

    const getLogger = function () {
        return self.loggerImpl;
    }

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
        setMemoryLimit: setMemoryLimit,
        getLogger: getLogger
    };

};

util.inherits(TaskLogger, EventEmitter);

module.exports = TaskLogger;
