const NRP = require('node-redis-pubsub');
const scope = "codefresh";

class RedisPubDecorator {
    constructor(opts, redisLogger) {
        this.redisLogger = redisLogger;
        this.nrp = new NRP({
            host: opts.redisConfig.url,
            auth: opts.redisConfig.password,
            port: opts.redisConfig.port,
            scope: scope

        })


    }

    start(jobId) {
        if (jobId) {
            this.jobId = jobId;
        }
        this.redisLogger.start(this.jobId);
        this.nrp.on(this.jobId, (data) => {
            console.log(`###NRP: ${data}`);
        });
    }
    validate() {
        this.redisLogger.validate();
    }
    attachContainer(container) {
        let obj = this.redisLogger.attachContainer(container);
        this.jobId = obj.jobId();
        return {
            push: (message) => {
                const key = obj.push(message);
                this._emit(key, message);
            },
            setLastUpdate: (date) => {
                const key = obj.setLastUpdate(date);
                this._emit(key, date);
            },
            updateMetric: (path, size) => {
                const key = obj.updateMetric(path, size);
                this._emit(key, size);
            }


        }

    }

    attachStep(step) {

        const toBeWrappedObject = this.redisLogger.attachStep(step);
        return this._wrapper(toBeWrappedObject, this);


    }
    _wrapper(toBeWrappedObject, thisArg) {
        const wrappingObj = {
            push: (obj) => {
                const key = toBeWrappedObject.push(obj);
                this._emit(key, obj);
            },
            child: (path) => {
                const wrappedChild = toBeWrappedObject.child(path);
                return thisArg._wrapper(wrappedChild, thisArg);
            },
            set: (value) => {
                const key = toBeWrappedObject.set(value);
                this._emit(key, value);
            },
            update: (value) => {
                const key = toBeWrappedObject.update(value);
                this._emit(key, value);
            },
            toString: () => {
                return toBeWrappedObject.toString();
            },
            watch: (fn) => {
                toBeWrappedObject.watch(fn);
            }

        }
        return wrappingObj;

    }
    child(name) {
        return this.redisLogger.child(name);

    }
    _emit(key, obj) {
    
            this.nrp.emit(this.jobId, JSON.stringify({
                slot: this._reFormatKey(key.key),
                payload:  obj,
                action:  this._getAction(key.key),
                ...(key.id > 0 && {id : key.id})
            }));

        
    }

    _reFormatKey(key) {
        return key.replace(new RegExp(':', 'g'), '.').replace('.[', '[');
    }
    _getAction(key = "") {
        return key.endsWith('logs') ? 'e' : 'r';
    }


}
module.exports = RedisPubDecorator;