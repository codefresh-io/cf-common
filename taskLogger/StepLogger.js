'use strict';

const _                                                 = require('lodash');
const CFError                                           = require('cf-errors');
const ErrorTypes                                        = CFError.errorTypes;
const { STATUS, STEPS_REFERENCES_KEY, LOGS_LOCATION } = require('./enums');

class StepLogger extends EventEmitter {
    constructor(name, loggerImpl, index) {
        super();
        this.name = name;
        this.index = index;
        this.loggerImpl = loggerImpl;
    }

    init(fullInit) {
        const writter = this.loggerImpl.attachStep(step); // TODO fix this
        if (fullInit) {
            writter.push({
                name: this.name,
                status: STATUS.PENDING,
                index: this.index
            });
            this.loggerImpl.child(STEPS_REFERENCES_KEY).push({ // TODO maybe pass this as event and TaskLogger will do by his own
                [this.name] : this.status
            });
            this.emit("step-pushed", this.name);
        }
        this.writter = writter;
        //Note : watch only watch for local changes , what happen on remote change (e.g. api) ?
        this.writter.child('status').watch((value) => {
            this.loggerImpl.child(STEPS_REFERENCES_KEY).child(this.name).set(value);
        });
    }

    start() {
        if (fatal) {
            return;
        }
        if (step.status === STATUS.PENDING) {
            step.status = STATUS.RUNNING;
            step.writter.child('status').set(step.status);
            step.writter.child('finishTimeStamp').set('');
            step.writter.child('creationTimeStamp').set(+(new Date().getTime() / 1000).toFixed());
        }
    }

    resume() {
        if (fatal) {
            return;
        }
        if (step.status === STATUS.PENDING_APPROVAL) {
            step.status = STATUS.RUNNING;
            step.writter.child('status').set(step.status);
        }
    }

    reset() {
        step.status = STATUS.PENDING;
        step.writter.child('creationTimeStamp').set('');
        step.writter.child('finishTimeStamp').set('');
        step.writter.child('status').set(step.status);
    }

    getReference() {
        return step.writter.toString();
    }

    getLogsReference() {
        return step.writter.child(LOGS_LOCATION).toString();
    }

    getLastUpdateReference() {
        return this.loggerImpl.child('lastUpdate').toString();
    }

    getMetricsLogsReference() {
        return step.writter.child('metrics').child(LOGS_LOCATION).toString();
    }

    write(message) {
        if (fatal) {
            return;
        }
        if ([STATUS.RUNNING, STATUS.PENDING, STATUS.PENDING_APPROVAL, STATUS.TERMINATING].includes(step.status)) {
            step.writter.child(LOGS_LOCATION).push(message);
            this.loggerImpl.child("lastUpdate").set(new Date().getTime());
        }
        else {
            this.emit("error",
                new CFError(ErrorTypes.Error,
                    "progress-logs 'write' handler was triggered after the job finished with message: %s",
                    message));
        }
    }

    debug(message) {
        if (fatal) {
            return;
        }
        if ([STATUS.RUNNING, STATUS.PENDING, STATUS.PENDING_APPROVAL, STATUS.TERMINATING].includes(step.status)) {
            step.writter.child(LOGS_LOCATION).push(message + '\r\n');
            this.loggerImpl.child("lastUpdate").set(new Date().getTime());
        }
        else {
            this.emit("error",
                new CFError(ErrorTypes.Error,
                    "progress-logs 'debug' handler was triggered after the job finished with message: %s",
                    message));
        }
    }

    warn(message) {
        if (fatal) {
            return;
        }
        if ([STATUS.RUNNING, STATUS.PENDING, STATUS.PENDING_APPROVAL, STATUS.TERMINATING].includes(step.status)) {
            step.writter.child(LOGS_LOCATION).push(`\x1B[01;93m${message}\x1B[0m\r\n`);
            this.loggerImpl.child("lastUpdate").set(new Date().getTime());
        }
        else {
            this.emit("error",
                new CFError(ErrorTypes.Error,
                    "progress-logs 'warning' handler was triggered after the job finished with message: %s",
                    message));
        }
    }

    info(message) {
        if (fatal) {
            return;
        }
        if ([STATUS.RUNNING, STATUS.PENDING, STATUS.PENDING_APPROVAL, STATUS.TERMINATING].includes(step.status)) {
            step.writter.child(LOGS_LOCATION).push(message + '\r\n');
            this.loggerImpl.child("lastUpdate").set(new Date().getTime());
        }
        else {
            this.emit("error",
                new CFError(ErrorTypes.Error,
                    "progress-logs 'info' handler was triggered after the job finished with message: %s",
                    message));
        }
    }

    finish(err, skip) {
        if (step.status === STATUS.PENDING && !skip) { // do not close a pending step that should not be skipped
            return;
        }

        if (fatal) {
            return;
        }
        if (step.status === STATUS.RUNNING || step.status === STATUS.PENDING || step.status ===
            STATUS.PENDING_APPROVAL || step.status === STATUS.TERMINATING) {
            step.finishTimeStamp = +(new Date().getTime() / 1000).toFixed();
            if (err) {
                step.status = (step.status === STATUS.TERMINATING ? STATUS.TERMINATED :
                    (step.pendingApproval ? STATUS.DENIED : STATUS.ERROR));
            } else {
                step.status = step.pendingApproval ? STATUS.APPROVED : STATUS.SUCCESS;
            }
            if (skip) {
                step.status = STATUS.SKIPPED;
            }
            if (err && err.toString() !== 'Error') {
                step.writter.child("logs").push(`\x1B[31m${err.toString()}\x1B[0m\r\n`);
            }

            // step.writter.update({ status: step.status, finishTimeStamp: step.finishTimeStamp });
            step.writter.child('status').set(step.status);
            step.writter.child('finishTimeStamp').set(step.finishTimeStamp);
            this.loggerImpl.child("lastUpdate").set(new Date().getTime());
            delete handlers[name];
        }
        else {
            if (err) {
                this.emit("error",
                    new CFError(ErrorTypes.Error,
                        "progress-logs 'finish' handler was triggered after the job finished with err: %s",
                        err.toString()));
            }
            else {
                this.emit("error",
                    new CFError(ErrorTypes.Error,
                        "progress-logs 'finish' handler was triggered after the job finished"));
            }
        }
    }

    getStatus() {
        return step.status;
    }

    getName() {
        return step.name;
    }

    markPreviouslyExecuted() {
        if (fatal) {
            return;
        }

        step.writter.child('previouslyExecuted').set(true);
    }

    markPendingApproval() {
        if (fatal) {
            return;
        }

        step.status          = STATUS.PENDING_APPROVAL;
        step.pendingApproval = true;
        step.writter.child('status').set(step.status);
        delete handlers[name];
    }

    updateMemoryUsage(time, memoryUsage) {
        step.writter.child('metrics').child('memory').push({ time, usage: memoryUsage });
    }

    updateCpuUsage(time, cpuUsage) {
        step.writter.child('metrics').child('cpu').push({ time, usage: cpuUsage });
    }

    markTerminating() {
        if (step.status === STATUS.RUNNING) {
            step.status = STATUS.TERMINATING;
            step.writter.child('status').set(step.status);
        }
        else {
            this.emit("error",
                new CFError(ErrorTypes.Error,
                    `markTerminating is only allowed to step in running state status , current status : ${step.status}`));
        }

    }
}

module.exports = StepLogger;
