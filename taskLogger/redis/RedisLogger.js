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


const root = 'build-logs';

class RedisLogger {

    constructor(redisClient, opts) {
        this.redisClient = redisClient;
        this.config = opts.redis;
        this.jobId = opts.jobId;
        this.accountId = opts.accountId;
        this.defaultLogKey = `${root}:${opts.key}`;
        this.watachedKeys = new Map();
        this.redisClient.on('error', (err) => {
            const error = new CFError({
                cause: err,
                message: `Redis client error for job ${this.jobId} in account ${this.accountId}`
            });
            logger.error(error.message);
        });
    
    }

    get redisClientIns () {
        return this.redisClient;
    }

    setStrategies(baseKey) {
        if (baseKey) {
            this.strategies = new ChainRedisStrategy([
                new RedisFlattenStrategy(new Set(['logs', 'metrics']), `${root}:${baseKey}`),
                new RedisSetStratry()
            ]);
        }
        
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