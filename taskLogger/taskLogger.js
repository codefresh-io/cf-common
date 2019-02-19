'use strict';

const _                                                      = require('lodash');
const CFError                                                = require('cf-errors');
const ErrorTypes                                             = CFError.errorTypes;
const EventEmitter                                           = require('events');
const rp                                                     = require('request-promise');
const Q                                                      = require('q');
const jwt                                                    = require('jsonwebtoken');
const StepLogger                                             = require('./StepLogger');
const { Firebase, Redis, RedisPubDecorator }                 = require('./loggers');
const { STATUS, TYPES, STEPS_REFERENCES_KEY, LOGS_LOCATION } = require('./enums');

class TaskLogger extends EventEmitter {
    constructor(jobId, loggerImpl) {
        super();

        if (!jobId) {
            throw new CFError(ErrorTypes.Error, "failed to create taskLogger because jobId must be provided");
        }
        else if (!loggerImpl) {
            throw new CFError(ErrorTypes.Error, "failed to create taskLogger because loggerImpl must be provided");
        }
        this.loggerImpl = loggerImpl;
        this.loggerImpl.start(jobId);


        this.fatal    = false;
        this.finished = false;
        this.steps    = {};
        this.logger = logger;

        this.on('step-pushed', this.updateCurrentStepReferences.bind(this));
    }

    static async factory(opts) {
        let logger;
        switch (opts.type) {
            case TYPES.FIREBASE:
                logger = new Firebase(opts);
            case TYPES.REDIS:
                logger = new RedisPubDecorator(opts, new Redis(opts)); //TODO: move to functional "withPubDecorator"
            default:
                throw new Error(`${opts.key} is not implemented`);
        }

        await logger.validate();
        await logger.start();
    }

    restoreExistingSteps() {
        return Q.resovle();


        return Q.resolve().then(() => {

            //Note !! This is Redis specifc code
            return this.loggerImpl.child(STEPS_REFERENCES_KEY).getHash();

        }).then((keyToStatus) => {
            if (keyToStatus) {
                const stepFromRedis = Object.keys(keyToStatus);
                this.steps = stepFromRedis.reduce((acc, current) => {
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

    }

    // TODO this has some problems
    updateCurrentStepReferences(name) {
        //Note : watch only watch for local changes , what happen on remote change (e.g. api) ?
        this.loggerImpl.child('status').watch((value) => {
            this.loggerImpl.child(STEPS_REFERENCES_KEY).child(name).set(value);
        });
    }

    addErrorMessageToEndOfSteps(message) {
        return Q.resovle();
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
            const steps = this.loggerImpl.child('steps').children();
            if (steps && steps.length > 0) {
                steps[steps.length -1].child(LOGS_LOCATION).push(`\x1B[31m${message}\x1B[0m\r\n`);
            }
        })
    }

    create(name, eventReporting, resetStatus) {

        if (this.fatal || this.finished) {
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

        let step = this.steps[name];

        if (!step) {
            const index = Object.keys(this.steps).length; //TODO why do we need this index?
            step = new StepLogger(name, this.loggerImpl, index);
            step.init();
            this.steps[step.name] = step;

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
    }

    finish(err) { // jshint ignore:line
        if (this.fatal) {
            return;
        }
        if (_.size(this.steps)) {
            _.forEach(this.steps, (step) => {
                step.finish(new Error('Unknown error occurred'));
            });
        }
        this.finished = true;
    }

    fatalError(err) {
        if (!err) {
            throw new CFError(ErrorTypes.Error, "fatalError was called without an error. not valid.");
        }
        if (this.fatal) {
            return;
        }

        if (_.size(this.steps)) {
            _.forEach(this.steps, (step) => {
                step.finish(new Error('Unknown error occurred'));
            });
        }
        else {
            var errorStep = this.create("Something went wrong");
            errorStep.finish(err);
        }
        this.fatal = true;
    }

    getMetricsLogsReference() {
        return this.loggerImpl.child('metrics').child(LOGS_LOCATION).toString();
    }

    updateMemoryUsage(time, memoryUsage) {
        this.loggerImpl.child('metrics').child('memory').push({time, usage:memoryUsage});
    }

    setMemoryLimit(limitMemory) {
        const limit = limitMemory.replace('Mi','');
        this.loggerImpl.child('metrics').child('limits').child('memory').push(limit);
    }

    getLogger() {
        return this.loggerImpl;
    }
}

module.exports = TaskLogger;
