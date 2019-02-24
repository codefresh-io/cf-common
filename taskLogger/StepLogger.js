const CFError = require('cf-errors');
const EventEmitter = require('events');
const ErrorTypes   = CFError.errorTypes;
const { STATUS } = require('./enums');

class StepLogger extends EventEmitter {
    constructor({accountId, jobId, name}) {
        super();

        if (!accountId) {
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

    async start() {
        if (this.fatal) {
            return;
        }
        if (this.status === STATUS.PENDING) {
            this.status = STATUS.RUNNING;
            await this._reportStatus();

            await this.setFinishTimestamp('');
            await this.setCreationTimestamp(+(new Date().getTime() / 1000).toFixed());
        }
    }

    async write(message) {
        if (this.fatal) {
            return;
        }
        if ([STATUS.RUNNING, STATUS.PENDING, STATUS.PENDING_APPROVAL, STATUS.TERMINATING].includes(this.status)) {
            await this._reportLog(message);
            return this.updateLastUpdate();
        }
        else {
            this.emit("error",
                new CFError(ErrorTypes.Error,
                    "progress-logs 'write' handler was triggered after the job finished with message: %s",
                    message));
        }
    }

    async debug(message) {
        if (this.fatal) {
            return;
        }
        if ([STATUS.RUNNING, STATUS.PENDING, STATUS.PENDING_APPROVAL, STATUS.TERMINATING].includes(this.status)) {
            await this._reportLog(message + '\r\n');
            return this.updateLastUpdate();
        }
        else {
            this.emit("error",
                new CFError(ErrorTypes.Error,
                    "progress-logs 'debug' handler was triggered after the job finished with message: %s",
                    message));
        }
    }

    async warn(message) {
        if (this.fatal) {
            return;
        }
        if ([STATUS.RUNNING, STATUS.PENDING, STATUS.PENDING_APPROVAL, STATUS.TERMINATING].includes(this.status)) {
            await this._reportLog(`\x1B[01;93m${message}\x1B[0m\r\n`);
            return this.updateLastUpdate();
        }
        else {
            this.emit("error",
                new CFError(ErrorTypes.Error,
                    "progress-logs 'warning' handler was triggered after the job finished with message: %s",
                    message));
        }
    }

    async info(message) {
        if (this.fatal) {
            return;
        }
        if ([STATUS.RUNNING, STATUS.PENDING, STATUS.PENDING_APPROVAL, STATUS.TERMINATING].includes(this.status)) {
            await this._reportLog(message + '\r\n');
            return this.updateLastUpdate();
        }
        else {
            this.emit("error",
                new CFError(ErrorTypes.Error,
                    "progress-logs 'info' handler was triggered after the job finished with message: %s",
                    message));
        }
    }

    async finish(err, skip) {
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
                await this._reportLog(`\x1B[31m${err.toString()}\x1B[0m\r\n`);
            }

            await this._reportStatus();
            await this._reportFinishTimestamp();
            return this.updateLastUpdate();
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

    async updateLastUpdate() {
        this.lastUpdate = new Date().getTime();
        return this._reportLastUpdate();
    }

    async setFinishTimestamp(date) {
        this.finishTimeStamp = date;
        this._reportFinishTimestamp();
    }

    async setCreationTimestamp(date) {
        this.creationTimeStamp = date;
        this._reportCreationTimestamp();
    }

    getStatus() {
        return this.status;
    }

    async markPreviouslyExecuted() {
        if (this.fatal) {
            return;
        }

        this.previouslyExecuted = true;
        return this._reportPrevioulyExecuted();
    }

    async markPendingApproval() {
        if (this.fatal) {
            return;
        }

        await this.setStatus(STATUS.PENDING_APPROVAL);
        this.pendingApproval = true;
    }

    async updateMemoryUsage(time, memoryUsage) {
        return this._reportMemoryUsage(time, memoryUsage);
    }

    async updateCpuUsage(time, cpuUsage) {
        return this._reportCpuUsage(time, cpuUsage);
    }

    async markTerminating() {
        if (this.status === STATUS.RUNNING) {
            this.status = STATUS.TERMINATING;
            return this._reportStatus();
        }
        else {
            this.emit("error",
                new CFError(ErrorTypes.Error,
                    `markTerminating is only allowed to step in running state status , current status : ${this.status}`));
        }
    }

    async setStatus(status) {
        this.status = status;
        return this._reportStatus();
    }
}

module.exports = StepLogger;
