const COUNTER_INDEX = 'counter';
const CONSOLIDATED = 'consolidated';
const MOVE_FORWARD = -1;
class RedisFlattenStrategy {
    constructor(keys, baseKey) {
        this.keys = keys;
        this.baseKey = baseKey;
        this.counter=0;

    }
    push(obj, key, redisClient, stack) {
        if (this.keys.has(stack[0])) {
                while (stack.length !== 0) {
                    key = `${key}:${stack.pop()}`;
                }
                const objToPush = {
                    slot: key.substr(this.baseKey.length+1).replace(new RegExp(':', 'g'), '.'),
                    payload: obj 
                }
                this.counter++;
                redisClient.zadd(`${this.baseKey}:${CONSOLIDATED}`, this.counter, JSON.stringify(objToPush));
            return this.counter;
        }
        return MOVE_FORWARD;
    }
}

class RedisArrayStrategy {
    constructor(keys) {
        this.keys = keys;
    }
    push(obj, key, redisClient, stack) {
        if (this.keys.has(stack[0])) {
            if (stack.length === 1 && typeof(obj) === 'string') {
                redisClient.rpush(`${key}:${stack.pop()}`, obj);
            } else {
                while (stack.length !== 0) {
                    key = `${key}:${stack.pop()}`;
                }
                redisClient.rpush(key, JSON.stringify(obj));
            }
            return 1;
        }
        return MOVE_FORWARD;
    }
}

class RedisSetStratry {

    push(obj, key, redisClient, stack) {

        if (typeof (obj) !== 'object' && stack.length !== 0) {
            obj = {
                [stack.pop()]: obj
            };
        }
        if (typeof (obj) === 'object') {
            while (stack.length !== 0) {
                key = `${key}:${stack.pop()}`;
            }
            const hsetKeysValues = Object.keys(obj).reduce((acc, key) => {
                acc.push(key);
                acc.push(obj[key]);
                return acc;
            }, []);
            redisClient.hmset(key, hsetKeysValues);
        } else {
            redisClient.set(key, obj);
        }
        return 0;

    }
}

class ChainRedisStrategy {

    constructor(strategies) {
        this.strategies = strategies;
    }
    push(obj, key, redisClient, stack) {
        let id;
        
        this.strategies.some(strategy => {
            const result = strategy.push(obj, key, redisClient, stack);
            const strategyExecuted = result > 0;
            if (strategyExecuted) {
                id = result;
               return true;
            }
            return false;
        })
        return id;
    }
}
module.exports = {
    RedisFlattenStrategy,
    RedisSetStratry,
    ChainRedisStrategy,
    RedisArrayStrategy
}