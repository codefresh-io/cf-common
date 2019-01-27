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
        // this.jobId = jobId;
        this.jobId = '88fm';
        this.redisLogger.start(this.jobId);
        this.nrp.on(this.jobId, (data) => {
            console.log(`###NRP: ${data}`);
        });
    }
    validate() {
        this.redisLogger.validate();
    }
    attachContainer(container) {
        let obj = redisLogger.attachContainer(container);
        obj.push = function (message) {
            obj.push(message);
            nrp.emit(this.jobId, message);

        }
    }

    attachStep(step) {

        const toBeWrappedObject = this.redisLogger.attachStep(step);
        return this._wrapper(toBeWrappedObject, this);
        

    }
    _wrapper(toBeWrappedObject, thisArg) {
        const wrappingObj = {
            push: (obj) => {
                toBeWrappedObject.push(obj);
                console.log(`#Channel : ${this.jobId}`);
                this.nrp.emit(this.jobId, JSON.stringify(obj));
            },
            child: (path) => {
                const wrappedChild = toBeWrappedObject.child(path);
                return thisArg._wrapper(wrappedChild, thisArg);
            },
            set: (value) => {
                toBeWrappedObject.set(value);
                this.nrp.emit(this.jobId, JSON.stringify(value));
            },
            update: (value) => {
                toBeWrappedObject.update(value);
                this.nrp.emit(this.jobId, JSON.stringify(value));
            },
            toString: () => {
                return toBeWrappedObject.toString();
            }

        }
        return wrappingObj;

    }
    child(name) {
        return this.redisLogger.child(name);
        
    }


}
module.exports = RedisPubDecorator;