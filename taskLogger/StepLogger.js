const CFError = require('cf-errors');
const EventEmitter = require('events');
const ErrorTypes   = CFError.errorTypes;
const { STATUS } = require('./enums');

class StepLogger extends EventEmitter {
    constructor({accountId, jobId, name}, opts) {
        super();
        this.opts = opts;

        if (!accountId && !opts.skipAccountValidation) {
            throw new CFError(ErrorTypes.Error, "failed to create stepLogger because accountId must be provided");
        }
        this.accountId = accountId;

        if (!jobId) {
            throw new CFError(ErrorTypes.Error, "failed to create stepLogger because jobId must be provided");
        }
        this.jobId = jobId;

        if (!name) {
            throw new CFError(ErrorTypes.Error, "failed to create stepLogger because name must be provided");
        }
        this.name = name;

        this.fatal = false;
    }

    start() {
        if (this.fatal) {
            return;
        }
        if (this.status === STATUS.PENDING) {
            this.status = STATUS.RUNNING;
            this._reportStatus();
            this.setFinishTimestamp('');
            this.setCreationTimestamp(+(new Date().getTime() / 1000).toFixed());
        }
    }

    write(message) {
        if (this.fatal) {
            return;
        }
        if ([STATUS.RUNNING, STATUS.PENDING, STATUS.PENDING_APPROVAL, STATUS.TERMINATING].includes(this.status)) {
            this._reportLog(message);
            this.updateLastUpdate();
        }
        else {
            this.emit("error",
                new CFError(ErrorTypes.Error,
                    "progress-logs 'write' handler was triggered after the job finished with message: %s",
                    message));
        }
    }

    debug(message) {
        if (this.fatal) {
            return;
        }
        if ([STATUS.RUNNING, STATUS.PENDING, STATUS.PENDING_APPROVAL, STATUS.TERMINATING].includes(this.status)) {
            this._reportLog(message + '\r\n');
            this.updateLastUpdate();
        }
        else {
            this.emit("error",
                new CFError(ErrorTypes.Error,
                    "progress-logs 'debug' handler was triggered after the job finished with message: %s",
                    message));
        }
    }

    warn(message) {
        if (this.fatal) {
            return;
        }
        if ([STATUS.RUNNING, STATUS.PENDING, STATUS.PENDING_APPROVAL, STATUS.TERMINATING].includes(this.status)) {
            this._reportLog(`\x1B[01;93m${message}\x1B[0m\r\n`);
            this.updateLastUpdate();
        }
        else {
            this.emit("error",
                new CFError(ErrorTypes.Error,
                    "progress-logs 'warning' handler was triggered after the job finished with message: %s",
                    message));
        }
    }

    info(message) {
        if (this.fatal) {
            return;
        }
        if ([STATUS.RUNNING, STATUS.PENDING, STATUS.PENDING_APPROVAL, STATUS.TERMINATING].includes(this.status)) {
            this._reportLog(message + '\r\n');
            this.updateLastUpdate();
        }
        else {
            this.emit("error",
                new CFError(ErrorTypes.Error,
                    "progress-logs 'info' handler was triggered after the job finished with message: %s",
                    message));
        }
    }

    finish(err, skip) {
        if (this.status === STATUS.PENDING && !skip) { // do not close a pending step that should not be skipped
            return;
        }

        if (this.fatal) {
            return;
        }
        if (this.status === STATUS.RUNNING || this.status === STATUS.PENDING || this.status ===
            STATUS.PENDING_APPROVAL || this.status === STATUS.TERMINATING) {
            this.finishTimeStamp = +(new Date().getTime() / 1000).toFixed();
            if (err) {
                this.status = (this.status === STATUS.TERMINATING ? STATUS.TERMINATED :
                    (this.pendingApproval ? STATUS.DENIED : STATUS.ERROR));
            } else {
                this.status = this.pendingApproval ? STATUS.APPROVED : STATUS.SUCCESS;
            }
            if (skip) {
                this.status = STATUS.SKIPPED;
            }
            if (err && err.toString() !== 'Error') {
                this._reportLog(`\x1B[31m${err.toString()}\x1B[0m\r\n`);
            }

            this._reportStatus();
            this._reportFinishTimestamp();
            this.updateLastUpdate();
            this.emit('finished');
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

    updateLastUpdate() {
        this.lastUpdate = new Date().getTime();
        this._reportLastUpdate();
    }

    setFinishTimestamp(date) {
        this.finishTimeStamp = date;
        this._reportFinishTimestamp();
    }

    setCreationTimestamp(date) {
        this.creationTimeStamp = date;
        this._reportCreationTimestamp();
    }

    getStatus() {
        return this.status;
    }

    markPreviouslyExecuted() {
        if (this.fatal) {
            return;
        }

        this.previouslyExecuted = true;
        this._reportPrevioulyExecuted();
    }

    markPendingApproval() {
        if (this.fatal) {
            return;
        }

        this.setStatus(STATUS.PENDING_APPROVAL);
        this.pendingApproval = true;
        this.emit('finished');
    }

    updateMemoryUsage(time, memoryUsage) {
        this._reportMemoryUsage(time, memoryUsage);
    }

    updateCpuUsage(time, cpuUsage) {
        this._reportCpuUsage(time, cpuUsage);
    }

    setLogSize(size) {
        this._reportLogSize(size);
    }

    markTerminating() {
        if (this.status === STATUS.RUNNING) {
            this.status = STATUS.TERMINATING;
            this._reportStatus();
        }
        else {
            this.emit("error",
                new CFError(ErrorTypes.Error,
                    `markTerminating is only allowed to step in running state status , current status : ${this.status}`));
        }
    }

    setStatus(status) {
        this.status = status;
        this._reportStatus();
    }
}

module.exports = StepLogger;
