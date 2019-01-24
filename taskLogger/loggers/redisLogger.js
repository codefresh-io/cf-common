const redis = require('redis');
const CFError = require('cf-errors');
const logger = require('cf-logs').Logger('codefresh:containerLogger');
const _ = require('lodash');
const assert = require('assert').strict;


const ContainerLabels = {
    VISIBILITY: 'io.codefresh.visibility',

    // logging service lables
    LOGGER_FIREBASE_LOGS_URL: 'io.codefresh.logger.firebase.logsUrl',
    LOGGER_FIREBASE_LAST_UPDATE_URL: 'io.codefresh.logger.firebase.lastUpdateUrl',
    LOGGER_FIREBASE_METRICS_LOGS_URL: 'io.codefresh.logger.firebase.metricsLogs',
    LOGGER_LOG_SIZE_LIMIT: 'io.codefresh.logger.logSizeLimit',
    LOGGER_ID: 'io.codefresh.logger.id',
    LOGGER_STRATEGY: 'io.codefresh.logger.strategy',
    // logging service labels

    OWNER: 'io.codefresh.owner',
    OPERATION_NAME: 'io.codefresh.operationName',
    STEP_TYPE: 'io.codefresh.stepType',
    ACCOUNT_NAME: 'io.codefresh.accountName',
    ACCOUNT_ID: 'io.codefresh.accountId',
    PIPELINE_NAME: 'io.codefresh.pipelineName',
    COMPOSITION_NAME: 'io.codefresh.compositionName',
    REVISION: 'io.codefresh.revision',
    PROGRESS_ID: 'io.codefresh.progressId',
    PROCESS_ID: 'io.codefresh.processId',
    REQUEST_ID: 'io.codefresh.requestId',
    SERVICE_ID: 'io.codefresh.serviceId',
    COMPOSE_SERVICE: 'com.docker.compose.service',
    APPLICATION_PORT: 'io.codefresh.applicationPort',
    STEP_CONTROLLER: 'io.codefresh.stepController',
    STEP_NAME: 'io.codefresh.stepName',
    SWARM_ID: 'com.docker.swarm.id'
};

const root = 'build-logs';

class RedisLogger {

    constructor(opts) {
        this.config = opts.redisConfig;
        this.jobId = opts.jobId;
    }
    start(jobId) {
        this.redisClient =
            redis.createClient({
                host: this.config.url,
                password: this.config.password,
                db: this.config.db || '1'
            });

        this.redisClient.on('ready', () => {
            logger.info('Redis client ready');
            this.redisInitialized = true;
            if (jobId) {
                this.defaultLogKey = `${root}:${accountId}:${requestId}:${jobId}`;
            }
        });

        this.redisClient.on('error', (err) => {
            const error = new CFError({
                cause: err,
                message: 'Redis client error'
            });
            logger.error(error.message);
        });


    }
    validate() {
        if (!this.config.url) {
            throw new CFError('no redis url');
        }

    }
    attachContainer(container) {

        const accountId = _.get(container,
            'Labels',
            _.get(container, 'Actor.Attributes'))[ContainerLabels.ACCOUNT_ID];
        const requestId = _.get(container,
            'Labels',
            _.get(container, 'Actor.Attributes'))[ContainerLabels.REQUEST_ID];
        const stepName = _.get(container,
            'Labels',
            _.get(container, 'Actor.Attributes'))[ContainerLabels.STEP_NAME];

        const logsKey = `${root}:${accountId}:${requestId}:steps:${stepName}:logs`;
        const lastUpdateKey = `${root}:${accountId}:${requestId}:lastupdate`;

        return {
            push: (message) => {
                this.redisClient.rpush(logsKey, message);
            },
            setLastUpdate: (date) => {
                this.redisClient.set(lastUpdateKey, date);
            },
            updateMetric: (path, size) => {
                const metricLogsKey = `${accountId}:${requestId}:metrics:${path}`;
                this.redisClient.set(metricLogsKey, size);
            }
        };
    }
    attachStep(step) {
        assert(this.jobId, 'jobId must be set');
        const key = `${root}:${accountId}:${requestId}:steps:${step.name}`;
        return wrapper(key);
        
    }

    wrapper(key) {
        return {
            push: (obj) => {
                const hsetKeysValues = Object.keys(obj).reduce((acc, key) => {
                    acc.push(key);
                    acc.push(obj[key]);
                    return acc;
                }, []);
                this.redisClient.hmset(key, hsetKeysValues);
            },
            child: (path) => {
                return wrapper(`${key}/${path}`);
            },
            set: (value) => {
                if (typeof(value) === 'string') {
                    this.redisClient.set(key, value);
                }else {
                    push(value);
                }
            },
            update: (value) => {
                set(value);
            }
        }
    }
    child(name) {
        assert(this.defaultLogKey, 'no default log key');
        return wrapper(`${this.defaultLogKey}:${name}`);
    }

}
module.exports = RedisLogger;