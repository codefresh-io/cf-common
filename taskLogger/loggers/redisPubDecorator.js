const NRP  = require('node-redis-pubsub');
const scope = "codefresh";

class RedisPubDecorator {
    constructor(opts, redisLogger) {
        this.redisLogger = redisLogger;
        this.nrp = new NRP( {
            host: opts.redisConfig.url,
            auth: opts.redisConfig.password,
            port: 6379,
            scope: scope

        })

        
    }

    start(jobId) {
        this.jobId = `88fm`;
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
        obj.push = function(message) {
            obj.push(message);
            nrp.emit(this.jobId, message);

        }
    }

    attachStep(step) {

        let wrapper = this.redisLogger.attachStep(step);
        return {
            push: (obj) => {
                wrapper.push(obj);
                console.log(`#Channel : ${this.jobId}`);
                this.nrp.emit(this.jobId, JSON.stringify(obj), (data) => {
                    console.log(`--> called with data: ${data}`);
                });
            },
            child: (path) => {
                return wrapper.child(path);
            },
            set: (path) => {
                wrapper.set(path);
            },
            update: (value) => {
                wrapper.update(value);
            },
            toString: () => {
                return wrapper.toString();
            }

        }

    }
    child(name) {
        return this.redisLogger.child(name);
    }


}
module.exports = RedisPubDecorator;