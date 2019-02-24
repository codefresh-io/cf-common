'use strict';

const _                                = require('lodash');
const debug                            = require('debug')('codefresh:taskLogger');
const Q                                = require('q');
const CFError                          = require('cf-errors');
const ErrorTypes                       = CFError.errorTypes;
const TaskLogger                       = require('../taskLogger');
const FirebaseStepLogger               = require('./FirebaseStepLogger');
const { TYPES, STATUS }                = require('../enums');

const STEPS_REFERENCES_KEY = 'stepsReferences';

class FirebaseTaskLogger extends TaskLogger {
    constructor(task) {
        super(task);
    }

    static async factory(task, {baseFirebaseUrl, FirebaseLib, firebaseSecret}) {
        const taskLogger = new FirebaseTaskLogger(task);

        if (!baseFirebaseUrl) {
            throw new CFError(ErrorTypes.Error, "failed to create taskLogger because baseFirebaseUrl must be provided");
        }
        taskLogger.baseFirebaseUrl = baseFirebaseUrl;

        if (!FirebaseLib) {
            throw new CFError(ErrorTypes.Error, "failed to create taskLogger because Firebase lib reference must be provided");
        }
        taskLogger.FirebaseLib = FirebaseLib;

        if (!firebaseSecret) {
            throw new CFError(ErrorTypes.Error, "failed to create taskLogger because firebaseSecret must be provided");
        }
        taskLogger.firebaseSecret = firebaseSecret;

        taskLogger.baseUrl = `${taskLogger.baseFirebaseUrl}/${taskLogger.jobId}`;
        taskLogger.baseRef = new taskLogger.FirebaseLib(taskLogger.baseUrl);

        taskLogger.lastUpdateUrl = `${taskLogger.baseUrl}/lastUpdate`;
        taskLogger.lastUpdateRef = new taskLogger.FirebaseLib(taskLogger.lastUpdateUrl);

        taskLogger.stepsUrl = `${taskLogger.baseUrl}/steps`;
        taskLogger.stepsRef = new taskLogger.FirebaseLib(taskLogger.stepsUrl);

        try {
            await Q.ninvoke(taskLogger.baseRef, 'authWithCustomToken', firebaseSecret);
        } catch (err) {
            throw new CFError({
                cause: err,
                message: `Failed to create taskLogger because authentication to firebase url ${taskLogger.baseUrl}`
            });
        }
        debug(`TaskLogger created and authenticated to firebase url: ${taskLogger.baseUrl}`);

        return taskLogger;
    }

    async createStep(name) {
        const stepLogger = await FirebaseStepLogger.factory({
            accountId: this.accountId,
            jobId: this.jobId,
            name
        }, {
            baseFirebaseUrl: this.baseFirebaseUrl,
            FirebaseLib: this.FirebaseLib,
            firebaseSecret: this.firebaseSecret
        });

        stepLogger.stepRef.on("value", (snapshot) => {
            var val = snapshot.val();
            if (val && val.name === name) {
                stepLogger.stepRef.off("value");
                this.emit("step-pushed", name);
                this._updateCurrentStepReferences();
            }
        });

        await stepLogger.reportName();
        await stepLogger.clearLogs();
        await stepLogger.setStatus(STATUS.PENDING);

        return stepLogger;
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
                const step = await FirebaseStepLogger.factory({
                    accountId: this.accountId,
                    jobId: this.jobId,
                    name: key
                }, {
                    baseFirebaseUrl: this.baseFirebaseUrl,
                    FirebaseLib: this.FirebaseLib,
                    firebaseSecret: this.firebaseSecret
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

    // TODO see what to do with this
    getMetricsLogsReference() {
        return this.baseRef.child('metrics').child('logs').toString();
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
                    const stepRef = new this.FirebaseLib(`${this.stepsUrl}/${stepKey}`);
                    stepRef.child('logs').push(`\x1B[31m${message}\x1B[0m\r\n`);
                });
                deferred.resolve();
            } catch (err) {
                deferred.reject(err);
            }
        });

        return deferred.promise;
    }

    async _reportMemoryUsage(time, memoryUsage) {
        this.baseRef.child('metrics').child('memory').push({time, usage:memoryUsage});
    }

    async _reportMemoryLimit() {
        this.baseRef.child('metrics').child('limits').child('memory').push(this.memoryLimit);
    }

    async _reportVisibility() {
        this.baseRef.child('visibility').set(this.visibility);
    }

    async _reportData() {
        this.baseRef.child('data').set(this.data);
    }

    async _reportStatus() {
        this.baseRef.child('status').set(this.status);
    }

    async reportAccountId() {
        this.baseRef.child('accountId').set(this.accountId);
    }

    async reportId() {
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

module.exports = FirebaseTaskLogger;
