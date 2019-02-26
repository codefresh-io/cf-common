'use strict';

const _                                = require('lodash');
const Firebase                         = require('firebase');
const debug                            = require('debug')('codefresh:taskLogger');
const Q                                = require('q');
const CFError                          = require('cf-errors');
const ErrorTypes                       = CFError.errorTypes;
const TaskLogger                       = require('../taskLogger');
const FirebaseStepLogger               = require('./FirebaseStepLogger');
const { TYPES }                        = require('../enums');

const STEPS_REFERENCES_KEY = 'stepsReferences';

class FirebaseTaskLogger extends TaskLogger {
    constructor(task, opts) {
        super(task, opts);
        this.type = TYPES.FIREBASE;
    }

    static async factory(task, opts) {
        const taskLogger = new FirebaseTaskLogger(task, opts);

        const {baseFirebaseUrl, firebaseSecret} = opts;

        if (!baseFirebaseUrl) {
            throw new CFError(ErrorTypes.Error, "failed to create taskLogger because baseFirebaseUrl must be provided");
        }
        taskLogger.baseFirebaseUrl = baseFirebaseUrl;

        if (!firebaseSecret) {
            throw new CFError(ErrorTypes.Error, "failed to create taskLogger because Firebase secret reference must be provided");
        }
        taskLogger.firebaseSecret = firebaseSecret;

        taskLogger.baseUrl = `${taskLogger.baseFirebaseUrl}/${taskLogger.jobId}`;
        taskLogger.baseRef = new Firebase(taskLogger.baseUrl);

        taskLogger.lastUpdateUrl = `${taskLogger.baseUrl}/lastUpdate`;
        taskLogger.lastUpdateRef = new Firebase(taskLogger.lastUpdateUrl);

        taskLogger.stepsUrl = `${taskLogger.baseUrl}/steps`;
        taskLogger.stepsRef = new Firebase(taskLogger.stepsUrl);

        try {
            if (!FirebaseTaskLogger.authenticated) {
                await Q.ninvoke(taskLogger.baseRef, 'authWithCustomToken', firebaseSecret);
                debug(`TaskLogger created and authenticated to firebase url: ${taskLogger.baseUrl}`);

                // workaround to not authenticate each time
                FirebaseTaskLogger.authenticated = true;
            } else {
                debug('TaskLogger created without authentication');
            }
        } catch (err) {
            throw new CFError({
                cause: err,
                message: `Failed to create taskLogger because authentication to firebase url ${taskLogger.baseUrl}`
            });
        }

        return taskLogger;
    }

    newStepAdded(step) {
        step.stepRef.on("value", (snapshot) => {
            var val = snapshot.val();
            if (val && val.name === step.name) {
                step.stepRef.off("value");
                this.emit("step-pushed", step.name);
                this._updateCurrentStepReferences();
            }
        });
    }

    async restore() {
        let settled = false;
        const deferred = Q.defer();
        this.baseRef.child(STEPS_REFERENCES_KEY).once("value", (snapshot) => {
            const stepsReferences = snapshot.val();
            if (!stepsReferences) {
                deferred.resolve();
            }

            Q.all(_.map(stepsReferences, async (name, key) => {
                const step = new FirebaseStepLogger({
                    accountId: this.accountId,
                    jobId: this.jobId,
                    name: key
                }, {
                    ...this.opts
                });
                step.on('error', (err) => {
                    this.emit('error', err);
                });
                step.on('finished', () => {
                    delete this.steps[name];
                });

                step.logs = {};

                await step.restore();
                this.steps[step.name] = step;
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
    }

    _updateCurrentStepReferences() {
        const stepsReferences = {};
        _.forEach(this.steps, (step) => {
            stepsReferences[_.last(step.stepRef.toString().split('/'))] = step.name;
        });
        this.baseRef.child(STEPS_REFERENCES_KEY).set(stepsReferences);
    }

    async addErrorMessageToEndOfSteps(message) {
        var deferred = Q.defer();

        this.stepsRef.limitToLast(1).once('value', (snapshot) => {
            try {
                _.forEach(snapshot.val(), (step, stepKey) => {
                    const stepRef = new Firebase(`${this.stepsUrl}/${stepKey}`);
                    stepRef.child('logs').push(`\x1B[31m${message}\x1B[0m\r\n`);
                });
                deferred.resolve();
            } catch (err) {
                deferred.reject(err);
            }
        });

        return deferred.promise;
    }

    _reportMemoryUsage(time, memoryUsage) {
        this.baseRef.child('metrics').child('memory').push({time, usage:memoryUsage});
    }

    _reportMemoryLimit() {
        this.baseRef.child('metrics').child('limits').child('memory').push(this.memoryLimit);
    }

    _reportLogSize(size) {
        this.baseRef.child('metrics').child('logs').child('total').set(size);
    }

    _reportVisibility() {
        this.baseRef.child('visibility').set(this.visibility);
    }

    _reportData() {
        this.baseRef.child('data').set(this.data);
    }

    _reportStatus() {
        this.baseRef.child('status').set(this.status);
    }

    reportAccountId() {
        this.baseRef.child('accountId').set(this.accountId);
    }

    reportId() {
        this.baseRef.child('id').set(this.jobId);
    }

    async getLastUpdate() {
        var deferred = Promise.defer();

        this.lastUpdateRef.once("value", function (snapshot) {
            var lastUpdate = snapshot.val();
            deferred.resolve(lastUpdate);
        }, function (errorObject) {
            deferred.reject(new CFError({
                cause: errorObject,
                message: `could not fetch lastUpdate from firebase for jobId: ${this.jobId}`
            }));
        });

        return deferred.promise;
    }

    async clearSteps() {
        return this.stepsRef.remove();
    }

    async delete() {
        return this.baseRef.remove();
    }

    async getRaw() {
        var deferred = Promise.defer();

        this.baseRef.once("value", function (snapshot) {
            var data     = snapshot.val();
            deferred.resolve(data);
        }, function (errorObject) {
            deferred.reject(new CFError({
                cause: errorObject,
                message: `could not fetch logs from firebase for jobId:${this.jobId}`
            }));
        });

        return deferred.promise;
    }
}
FirebaseTaskLogger.TYPE = TYPES.FIREBASE;
FirebaseTaskLogger.authenticated = false;

module.exports = FirebaseTaskLogger;
