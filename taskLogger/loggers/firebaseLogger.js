const logger = require('cf-logs').Logger('codefresh:containerLogger');
const _      = require('lodash');
const CFError                 = require('cf-errors');
const Firebase                = require('firebase');

class FirebaseLogger {

    constructor(opts) {
        this.firebaseAuthUrl  = opts.firebaseConfig.authUrl;
        this.firebaseSecret = opts.firebaseConfig.secret;
        this.firebaseMetricsLogsUrl = opts.firebaseConfig.metricsLogsUrl;

    }

    validate() {
        if (!this.firebaseAuthUrl) {
            return this._error(new CFError('firebase auth url is missing'));
        }
        if (!this.firebaseSecret) {
            return this._error(new CFError('firebase secret is missing'));
        }

    }

    start() {

        const authRef = new Firebase(this.firebaseAuthUrl);
        authRef.authWithCustomToken(this.firebaseSecret, (err) => {
            if (err) {
                this._error(new CFError({
                    cause: err,
                    message: `Failed to authenticate to firebase url ${this.firebaseAuthUrl}`
                }));
                return;
            }
            logger.info(`Authenticated to firebase url: ${this.firebaseAuthUrl}`);
            this.firebaseMetricsLogs = new Firebase(this.firebaseMetricsLogsUrl);

        });
    }

    attach(container) {

        const containerId                   = container.Id || container.id;
        const receivedFirebaseLogsUrl = _.get(container,
            'Labels',
            _.get(container, 'Actor.Attributes'))['io.codefresh.logger.firebase.logsUrl'];
        const receivedFirebaseLastUpdateUrl = _.get(container,
            'Labels',
            _.get(container, 'Actor.Attributes'))['io.codefresh.logger.firebase.lastUpdateUrl'];
        const receivedFirebaseMetricsLogsUrl = _.get(container,
            'Labels',
            _.get(container, 'Actor.Attributes'))['io.codefresh.logger.firebase.metricsLogs'];

        if (!receivedFirebaseLogsUrl) {
            logger.error(`Container: ${containerId} does contain a firebaseUrl label`);
            return;
        }

        if (!receivedFirebaseLastUpdateUrl) {
            logger.error(`Container: ${containerId} does contain a loggerFirebaseLastUpdateUrl label`);
            return;
        }

        if (!receivedFirebaseMetricsLogsUrl) {
            logger.error(`Container: ${containerId} does contain a loggerFirebaseMetricsLogsUrl label`);
            return;
        }
        let firebaseLogger;
        try {
            firebaseLogger = new Firebase(receivedFirebaseLogsUrl);
        } catch (err) {
            const error = new CFError({
                cause: err,
                message: `Failed to create a new firebase logger ref`
            });
            logger.error(error.toString());
            return;
        }

        let firebaseLastUpdate;
        try {
            firebaseLastUpdate = new Firebase(receivedFirebaseLastUpdateUrl);
        } catch (err) {
            const error = new CFError({
                cause: err,
                message: `Failed to create a new firebase lastUpdate ref`
            });
            logger.error(error.toString());
            return;
        }

        let firebaseMetricsLogs;
        try {
            firebaseMetricsLogs = new Firebase(receivedFirebaseMetricsLogsUrl);
        } catch (err) {
            const error = new CFError({
                cause: err,
                message: `Failed to create a new firebase metricsLogs ref`
            });
            logger.error(error.toString());
            return;
        }
        return {

            push: (message) => {
                firebaseLogger.push(message);
            },
            setLastUpdate: (date) => {
                firebaseLastUpdate.set(date);
            },
            updateMetric: (path, size) => {
                firebaseMetricsLogs.child(path).set(size);
            }            
        };
    }

}

module.exports = FirebaseLogger;