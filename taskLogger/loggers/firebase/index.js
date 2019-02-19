const Q       = require('q');
const logger  = require('cf-logs').Logger('codefresh:containerLogger');
const _       = require('lodash');
const CFError = require('cf-errors');
const Index   = require('firebase');
const assert  = require('assert').strict;
const Logger = require('../Logger');

class Firebase extends Logger {

    constructor(opts) {
        super();
        this.firebaseAuthUrl  = opts.firebaseConfig.authUrl;
        this.firebaseSecret = opts.firebaseConfig.secret;
        this.firebaseMetricsLogsUrl = opts.firebaseConfig.metricsLogsUrl;
    }

    async validate() {
        //TODO validate job id here
        if (!this.firebaseAuthUrl) {
            return this._error(new CFError('firebase auth url is missing'));
        }
        if (!this.firebaseSecret) {
            return this._error(new CFError('firebase secret is missing'));
        }

    }

    async start() {
        const authRef = new Firebase(this.firebaseAuthUrl);
        try {
            await Q.ninvoke(authRef, 'authWithCustomToken', this.firebaseSecret);
        } catch (err) {
            this._error(new CFError({ // TODO fix this
                cause: err,
                message: `Failed to authenticate to firebase url ${this.firebaseAuthUrl}`
            }));
            return;
        }

        logger.info(`Authenticated to firebase url: ${this.firebaseAuthUrl}`);
        if (this.firebaseMetricsLogsUrl) {
            this.firebaseMetricsLogs = new Firebase(this.firebaseMetricsLogsUrl);
        }
        if (jobId) {
            this.firebaseDefaultLogger = new Firebase(this.firebaseAuthUrl + jobId);
        }
    }


    attachStep(step) {

        let firebaseLogger;
        try {
            firebaseLogger = new Firebase(`${this.firebaseAuthUrl}${this.jobId}/steps`);
        } catch (err) {
            const error = new CFError({
                cause: err,
                message: `Failed to create a new firebase logger ref`
            });
            logger.error(error.toString());
            return;
        }

        return {
            push: (obj) => {
                firebaseLogger.push(obj);
            },
            child: (name) => {
                return firebaseLogger.child(name);
            },
            update: (value) => {
                firebaseLogger.update(value);
            }

        }

    }

    child (name) {
        assert(this.firebaseDefaultLogger, 'No default logger');
        return this.firebaseDefaultLogger.child(name);
    }

}

module.exports = Firebase;
