'use strict';

const _            = require('lodash');
const CFError      = require('cf-errors');
const ErrorTypes   = CFError.errorTypes;
const EventEmitter = require('events');
const rp           = require('request-promise');
const jwt          = require('jsonwebtoken');
const { STATUS, VISIBILITY } = require('./enums');

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

    async create(name, eventReporting, resetStatus) {

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

            step = await this.createStep(name);

            this.steps[name]      = step;

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

    async finish() { // jshint ignore:line
        if (this.fatal) {
            return;
        }
        if (_.size(this.steps)) {
            _.forEach(this.steps, async (step) => {
                await step.finish(new Error('Unknown error occurred'));
            });
        }
        this.finished = true;
    }

    async fatalError(err) {
        if (!err) {
            throw new CFError(ErrorTypes.Error, "fatalError was called without an error. not valid.");
        }
        if (this.fatal) {
            return;
        }

        if (_.size(this.steps)) {
            _.forEach(this.steps, async (step) => {
                await step.finish(new Error('Unknown error occurred'));
            });
        }
        else {
            const errorStep = await this.create("Something went wrong");
            await errorStep.finish(err);
        }

        _.forEach(this.steps, (step) => {
            step.fatal = true;
        });
        this.fatal = true;
    }

    async updateMemoryUsage(time, memoryUsage) {
        return this._reportMemoryUsage(time, memoryUsage);
    }

    async setMemoryLimit(memoryLimit) {
        this.memoryLimit = memoryLimit.replace('Mi', '');
        return this._reportMemoryLimit();
    }

    async setVisibility(visibility) {
        if (![VISIBILITY.PRIVATE, VISIBILITY.PUBLIC].includes(visibility)) {
            throw new Error(`Visibility: ${visibility} is not supported. use public/private`);
        }

        this.visibility = visibility;
        return this._reportVisibility();
    }

    async setData(data) {
        this.data = data;
        return this._reportData();
    }

    async setStatus(status) {
        this.status = status;
        return this._reportStatus();
    }

    getConfiguration() {
        return {
            step: {
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
