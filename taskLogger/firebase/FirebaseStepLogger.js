'use strict';

const Q                  = require('q');
const Firebase           = require('firebase');
const debug              = require('debug')('codefresh:stepLogger');
const CFError            = require('cf-errors');
const ErrorTypes         = CFError.errorTypes;
const { STATUS, TYPES }  = require('../enums');
const BaseStepLogger     = require('../StepLogger');

class FirebaseStepLogger extends BaseStepLogger {
    constructor(step, opts) {
        super(step, opts);
    }

    static async factory(step, {baseFirebaseUrl, firebaseSecret}) {
        const stepLogger = new FirebaseStepLogger(step, {baseFirebaseUrl, firebaseSecret});

        if (!baseFirebaseUrl) {
            throw new CFError(ErrorTypes.Error, "failed to create stepLogger because baseFirebaseUrl must be provided");
        }
        stepLogger.baseFirebaseUrl = baseFirebaseUrl;

        if (!firebaseSecret) {
            throw new CFError(ErrorTypes.Error, "failed to create stepLogger because Firebase secret reference must be provided");
        }
        stepLogger.firebaseSecret = firebaseSecret;

        stepLogger.baseUrl = `${stepLogger.baseFirebaseUrl}/${stepLogger.jobId}`;
        stepLogger.baseRef = new Firebase(stepLogger.baseUrl);

        stepLogger.lastUpdateUrl = `${stepLogger.baseUrl}/lastUpdate`;
        stepLogger.lastUpdateRef = new Firebase(stepLogger.lastUpdateUrl);

        stepLogger.stepUrl = `${stepLogger.baseUrl}/steps/${stepLogger.name}`;
        stepLogger.stepRef = new Firebase(stepLogger.stepUrl);

        try {
            if (!FirebaseStepLogger.authenticated) {
                await Q.ninvoke(stepLogger.baseRef, 'authWithCustomToken', firebaseSecret);
                debug(`TaskLogger created and authenticated to firebase url: ${stepLogger.baseUrl}`);

                // workaround to not authenticate each time
                FirebaseStepLogger.authenticated = true;
            } else {
                debug('StepLogger created without authentication');
            }

        } catch (err) {
            throw new CFError({
                cause: err,
                message: `Failed to create stepLogger becuase authentication to firebase url ${stepLogger.baseUrl}`
            });
        }
        debug(`StepLogger created and authenticated to firebase url: ${stepLogger.baseUrl}`);

        return stepLogger;
    }

    async restore() {
        const nameDeferred = Q.defer();
        const statusDeferred = Q.defer();

        this.stepRef.child('name').once('value', (snapshot) => {
            this.name = snapshot.val();
            nameDeferred.resolve();
        });
        this.stepRef.child('status').once('value', (snapshot) => {
            this.status = snapshot.val();
            if (this.status === STATUS.PENDING_APPROVAL) {
                this.pendingApproval = true;
            }
            statusDeferred.resolve();
        });

        return Q.all([nameDeferred.promise, statusDeferred.promise]);
    }

    async _reportLog(message) {
        this.stepRef.child("logs").push(message);
    }

    async _reportLastUpdate() {
        this.lastUpdateRef.set(this.lastUpdate);
    }

    async _reportPrevioulyExecuted() {
        this.stepRef.child('previouslyExecuted').set(this.previouslyExecuted);
    }

    async _reportStatus() {
        this.stepRef.child('status').set(this.status);
    }

    async _reportFinishTimestamp() {
        this.stepRef.child('finishTimeStamp').set(this.finishTimeStamp);
    }

    async _reportCreationTimestamp() {
        this.stepRef.child('creationTimeStamp').set(this.creationTimeStamp);
    }

    async _reportMemoryUsage(time, memoryUsage) {
        this.stepRef.child('metrics').child('memory').push({ time, usage: memoryUsage });
    }

    async _reportCpuUsage(time, cpuUsage) {
        this.stepRef.child('metrics').child('cpu').push({ time, usage: cpuUsage });
    }

    async reportName() {
        this.stepRef.child('name').set(this.name);
    }

    async clearLogs() {
        this.stepRef.child('logs').set({});
    }

    async delete() {
        this.stepRef.remove();
    }

    // TODO see what to do with these
    _getReference() {
        return this.stepRef.toString();
    }

    _getLogsReference() {
        return this.stepRef.child('logs').toString();
    }

    _getLastUpdateReference() {
        return this.lastUpdateRef.child('lastUpdate').toString();
    }

    _getMetricsLogsReference() {
        return this.stepRef.child('metrics').child('logs').toString();
    }

}
FirebaseStepLogger.TYPE = TYPES.FIREBASE;
FirebaseStepLogger.authenticated = false;


module.exports = FirebaseStepLogger;
