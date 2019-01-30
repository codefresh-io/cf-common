const COUNTER_INDEX = 'counter';
const CONSOLIDATED = 'consolidated';
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
                redisClient.zadd(`${this.baseKey}:${CONSOLIDATED}`, this.counter++, JSON.stringify(objToPush));
            return true;
        }
        return false;
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
            return true;
        }
        return false;
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
        return true;

    }
}

class ChainRedisStrategy {

    constructor(strategies) {
        this.strategies = strategies;
    }
    push(obj, key, redisClient, stack) {
        this.strategies.some((strategy) => {
            return strategy.push(obj, key, redisClient, stack);
        });
    }
}
module.exports = {
    RedisFlattenStrategy,
    RedisSetStratry,
    ChainRedisStrategy,
    RedisArrayStrategy
}