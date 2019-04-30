const redis = require('redis');
const CFError = require('cf-errors');
const logger = require('cf-logs').Logger('codefresh:containerLogger');
const _ = require('lodash');
const assert = require('assert').strict;
const {
    RedisFlattenStrategy,
    RedisSetStratry,
    ChainRedisStrategy
} = require("./redisStrategies");

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
    STEP_LOGS_REFERENCE: 'io.codefresh.step.logRef',
    SWARM_ID: 'com.docker.swarm.id'
};

const root = 'build-logs';

class RedisLogger {

    constructor(opts) {
        this.config = opts.redis;
        this.jobId = opts.jobId;
        this.accountId = opts.accountId;
        this.defaultLogKey = `${root}:${this.accountId}:${this.jobId}`;
        this._setStrategies(this.defaultLogKey);
        this.watachedKeys = new Map();
    }

    _setStrategies(baseKey) {
        if (baseKey) {
            this.strategies = new ChainRedisStrategy([
                new RedisFlattenStrategy(new Set(['logs', 'metrics']), baseKey), //TODO:Inject
                new RedisSetStratry()
            ]);
        }
        
    }

    start() {
        if (this.started) { return;}
        this.redisClient =
            redis.createClient({
                host: this.config.url || this.config.host,
                password: this.config.password,
                db: this.config.db || '1',
                port: this.config.port || 6379
            });
            this.cleanConnectionOnexit();

        this.redisClient.on('ready', () => {
            logger.info('Redis client ready');
            this.redisInitialized = true;
        });

        this.redisClient.on('error', (err) => {
            const error = new CFError({
                cause: err,
                message: 'Redis client error'
            });
            logger.error(error.message);
        });
        this.started = true;

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
        const progressId = _.get(container,
            'Labels',
            _.get(container, 'Actor.Attributes'))[ContainerLabels.PROGRESS_ID];
        const logsRefKey = _.get(container,
            'Labels',
            _.get(container, 'Actor.Attributes'))[ContainerLabels.STEP_LOGS_REFERENCE];

        this.jobId = progressId;
        this.defaultLogKey = `${root}:${accountId}:${progressId}`;
        this._setStrategies(this.defaultLogKey);
        const lastUpdateKey = `${root}:${accountId}:${progressId}:lastupdate`;

        return {
            push: (message) => {
                return this._wrapper(logsRefKey, this, []).push(message);
            },
            setLastUpdate: (date) => {
                return this._wrapper(lastUpdateKey, this, []).set(date);
            },
            updateMetric: (path, size) => {
                const metricLogsKey = `${root}:${accountId}:${progressId}:metrics:logs:${path}`;
                return this._wrapper(metricLogsKey, this, []).set(size);
            },
            jobId: () => {
                return this.jobId;
            }
        };
    }
    attachStep(step) {
        assert(this.jobId, 'jobId must be set');
        const key = `${root}:${this.accountId}:${this.jobId}:steps:${step.name}`;
        return this._wrapper(key, this, []);

    }

    //This function wraps repetetive calls to logging (e.g. : logger.child(x).set(y) , logger.child(x).child(y).update(z)
    //the stack is kept as part of the clouse call and an isolated object is created for each call (wrapper object)
    _wrapper(key, thisArg, stack) {
        const wrapper = {
            push: (obj) => {
                //TODO:HIGH:stack is internal data strcture of the logger , don't pass it
                const stackClone = stack.slice(0);
                let fullKey = key;
                while (stackClone.length !== 0) {
                    fullKey = `${fullKey}:${stackClone.shift()}`;
                }
                console.log(`going to push  ${JSON.stringify(obj)} to ${fullKey}`);
                const receveidId = this.strategies.push(obj, key, thisArg.redisClient, stack);
                
                //Watch support:
                if (this.watachedKeys.has(fullKey)) {
                    this.watachedKeys.get(fullKey).call(this, obj);
                }
                return {
                        key: fullKey.substr(thisArg.defaultLogKey.length +1),
                        id: receveidId
                }
            },
            child: (path) => {
                stack.push(path);
                return thisArg._wrapper(`${key}`, thisArg, stack);
            },
            set: (value) => {
                return wrapper.push(value);
            },
            update: (value) => {
                return wrapper.set(value);
            },
            toString() {
                wrapper._updateKeyFromStack();
                return key;
            },
            watch: (fn) => {
                wrapper._updateKeyFromStack();
                this.watachedKeys.set(key, fn);
            },
            getHash: () => {
                wrapper._updateKeyFromStack();
                return new Promise((resolve, reject) => {
                    this.redisClient.hgetall(key, (err, keys) => {
                        if (err) {
                            reject(err);
                        }else {
                            resolve(keys);
                        }
                    });
                }); 
            },
            children: () => {
                //TODO:Implement with scan/keys
                return [];
            },
            _updateKeyFromStack() {
                while (stack.length !== 0) {
                    key = `${key}:${stack.shift()}`;
                }
            }
            
        }
        return wrapper;
    }
    child(name) {
        assert(this.defaultLogKey, 'no default log key');
        return this._wrapper(`${this.defaultLogKey}`, this, [name]);
    }

    cleanConnectionOnexit() {
        process.on('exit', () => {
            this.redisClient.quit();
        })
    }


}
module.exports = RedisLogger;