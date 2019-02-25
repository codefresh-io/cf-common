'use strict';

const Q                  = require('q');
const Firebase           = require('firebase');
const CFError            = require('cf-errors');
const ErrorTypes         = CFError.errorTypes;
const { STATUS }         = require('../enums');
const BaseStepLogger     = require('../StepLogger');

class FirebaseStepLogger extends BaseStepLogger {
    constructor(step, opts) {
        super(step, opts);

        const {baseFirebaseUrl} = opts;

        if (!baseFirebaseUrl) {
            throw new CFError(ErrorTypes.Error, "failed to create stepLogger because baseFirebaseUrl must be provided");
        }
        this.baseFirebaseUrl = baseFirebaseUrl;

        this.baseUrl = `${this.baseFirebaseUrl}/${this.jobId}`;

        this.lastUpdateUrl = `${this.baseUrl}/lastUpdate`;
        this.lastUpdateRef = new Firebase(this.lastUpdateUrl);

        this.stepUrl = `${this.baseUrl}/steps/${this.name}`;
        this.stepRef = new Firebase(this.stepUrl);
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

    _reportLog(message) {
        this.stepRef.child("logs").push(message);
    }

    _reportLastUpdate() {
        this.lastUpdateRef.set(this.lastUpdate);
    }

    _reportPrevioulyExecuted() {
        this.stepRef.child('previouslyExecuted').set(this.previouslyExecuted);
    }

    _reportStatus() {
        this.stepRef.child('status').set(this.status);
    }

    _reportFinishTimestamp() {
        this.stepRef.child('finishTimeStamp').set(this.finishTimeStamp);
    }

    _reportCreationTimestamp() {
        this.stepRef.child('creationTimeStamp').set(this.creationTimeStamp);
    }

    _reportMemoryUsage(time, memoryUsage) {
        this.stepRef.child('metrics').child('memory').push({ time, usage: memoryUsage });
    }

    _reportCpuUsage(time, cpuUsage) {
        this.stepRef.child('metrics').child('cpu').push({ time, usage: cpuUsage });
    }

    _reportLogSize(size) {
        this.stepRef.child('metrics').child('logs').child('total').set(size);
    }

    reportName() {
        this.stepRef.child('name').set(this.name);
    }

    clearLogs() {
        this.stepRef.child('logs').set({});
    }

    async delete() {
        return this.stepRef.remove();
    }
}

module.exports = FirebaseStepLogger;
