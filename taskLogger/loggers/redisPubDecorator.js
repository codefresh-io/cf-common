const NRP = require('node-redis-pubsub');
const scope = "codefresh";

class RedisPubDecorator {
    constructor(opts, redisLogger) {
        this.redisLogger = redisLogger;
        this.nrp = new NRP({
            host: opts.redisConfig.url,
            auth: opts.redisConfig.password,
            port: 6379,
            scope: scope

        })


    }

    start(jobId) {
        this.jobId = jobId;
        // this.jobId = '88fm';
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
        return {
            push: (message) => {
                obj.push(message);
                this.nrp.emit(this.jobId, message);
            },
            setLastUpdate: (date) => {
                obj.setLastUpdate(date);
                this.nrp.emit(this.jobId, date);
            },
            updateMetric: (path, size) => {
                obj.updateMetric(path, size);
                // this.nrp.emit(this.jobId, )
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
        
        if (typeof(obj) === 'object') {
            // const nameKey = Object.keys(obj).find(objKey => objKey === 'name');
            Object.keys(obj).forEach((objKey) => {
                if (objKey === 'name') {
                    return;
                }
                this.nrp.emit(this.jobId, JSON.stringify({
                    slot: key.replace(new RegExp(':', 'g'), '.'),
                    payload: obj[objKey]
                }));        
            })
        }else {
            this.nrp.emit(this.jobId, JSON.stringify( {
                slot: key.replace(new RegExp(':', 'g'), '.'),
                payload:  obj
            }));
        }
        
    }


}
module.exports = RedisPubDecorator;