'use strict';

const _            = require('lodash');
const CFError      = require('cf-errors');
const ErrorTypes   = CFError.errorTypes;
const EventEmitter = require('events');
const rp           = require('request-promise');
const jwt          = require('jsonwebtoken');
const { STATUS, VISIBILITY, TYPES } = require('./enums');

const stepClasses = {
    [TYPES.FIREBASE]: require('./firebase/FirebaseStepLogger')
};

/**
 * TaskLogger - logging for build/launch/promote jobs
 * @param jobid - progress job id
 * @param firstStepCreationTime - optional. if provided the first step creationTime will be this value
 * @param baseFirebaseUrl - baseFirebaseUrl (pre-quisite authentication to firebase should have been made)
 * @param FirebaseLib - a reference to Firebase lib because we must use the same singelton for pre-quisite authentication
 * @returns {{create: create, finish: finish}}
 */
class TaskLogger extends EventEmitter {
    constructor({accountId, jobId}, opts) {
        super();
        this.opts = opts;

        if (!accountId) {
            throw new CFError(ErrorTypes.Error, "failed to create taskLogger because accountId must be provided");
        }
        this.accountId = accountId;

        if (!jobId) {
            throw new CFError(ErrorTypes.Error, "failed to create taskLogger because jobId must be provided");
        }
        this.jobId = jobId;

        this.fatal    = false;
        this.finished = false;
        this.steps    = {};
    }

    create(name, eventReporting, resetStatus, runCreationLogic) {

        if (this.fatal || this.finished) {
            return {
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

        var step = this.steps[name];
        if (!step) {

            step = new stepClasses[this.type]({
                accountId: this.accountId,
                jobId: this.jobId,
                name
            }, {
                ...this.opts
            });
            step.on('error', (err) => {
               this.emit('error', err);
            });

            this.steps[name]      = step;
            step.on('finished', () => {
               delete this.steps[name];
            });

            if (runCreationLogic) {
                step.reportName();
                step.clearLogs();
                step.setStatus(STATUS.PENDING);
                this.newStepAdded(step);
            }

            if (eventReporting) {
                var event = { action: "new-progress-step", name: name };
                const headers = {};
                try {
                    jwt.decode(eventReporting.token) ? headers['x-access-token'] = eventReporting.token : headers.Authorization = eventReporting.token;
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

        } else if (resetStatus) {
            step.setStatus(STATUS.PENDING);
            step.setFinishTimestamp('');
            step.setCreationTimestamp('');
        }

        return step;
    };

    finish() { // jshint ignore:line
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
            const errorStep = this.create("Something went wrong");
            errorStep.finish(err);
        }

        _.forEach(this.steps, (step) => {
            step.fatal = true;
        });
        this.fatal = true;
    }

    updateMemoryUsage(time, memoryUsage) {
        this._reportMemoryUsage(time, memoryUsage);
    }

    setMemoryLimit(memoryLimit) {
        this.memoryLimit = memoryLimit.replace('Mi', '');
        this._reportMemoryLimit();
    }

    setLogSize(size) {
        this._reportLogSize(size);
    }

    setVisibility(visibility) {
        if (![VISIBILITY.PRIVATE, VISIBILITY.PUBLIC].includes(visibility)) {
            throw new Error(`Visibility: ${visibility} is not supported. use public/private`);
        }

        this.visibility = visibility;
        this._reportVisibility();
    }

    setData(data) {
        this.data = data;
        this._reportData();
    }

    setStatus(status) {
        this.status = status;
        this._reportStatus();
    }

    getConfiguration() {
        return {
            task: {
                accountId: this.accountId,
                jobId: this.jobId,
            },
            opts: {
                ...this.opts
            }
        }
    }
}

module.exports = TaskLogger;
