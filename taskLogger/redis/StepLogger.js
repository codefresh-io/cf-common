const BaseStepLogger                   = require('../StepLogger');
const { STATUS }                       = require('../enums');
const RedisPubDecorator                = require('./redisPubDecorator');
const RedisLogger                      = require('./RedisLogger');
const RedisTaskLogger                  = require('./TaskLogger');

class RedisStepLogger extends BaseStepLogger {
    constructor(step, opts) {
        super(step, opts);
        const extendOpts = Object.assign({}, step, opts);
        extendOpts.key = `${step.accountId}:${step.jobId}:${step.name}`;
        const redisConnection = RedisTaskLogger.getRedisConnectionFromCache(extendOpts);
        this.writter = new RedisPubDecorator(extendOpts, new RedisLogger(redisConnection, extendOpts));
        this.writter.setStrategies(`${step.accountId}:${step.jobId}`);
    }
    async restore() {

        const keyToStatus = await self.loggerImpl.child(STEPS_REFERENCES_KEY).getHash();
        if (keyToStatus) {
            const stepFromRedis = Object.keys(keyToStatus);
            steps = stepFromRedis.reduce((acc, current) => {
                acc[current] = {
                    status: keyToStatus[current],
                    name: current,
                    ...(keyToStatus[current] === STATUS.PENDING_APPROVAL && {pendingApproval : true})
                }
                return acc;
                
            },{});
        }
    }

    _reportLog(message) {
        this.writter.child("logs").push(message);
    }

    _reportLastUpdate() {
        this.writter.child('lastUpdate').set(this.lastUpdate);
    }

    _reportPrevioulyExecuted() {
        this.writter.child('previouslyExecuted').set(this.previouslyExecuted);
    }

    _reportStatus() {
        this.writter.child('status').set(this.status);
    }

    _reportFinishTimestamp() {
        this.writter.child('finishTimeStamp').set(this.finishTimeStamp);
    }

    _reportCreationTimestamp() {
        this.writter.child('creationTimeStamp').set(this.creationTimeStamp);
    }

    _reportMemoryUsage(time, memoryUsage) {
        this.writter.child('metrics').child('memory').push({ time, usage: memoryUsage });
    }

    _reportCpuUsage(time, cpuUsage) {
        this.writter.child('metrics').child('cpu').push({ time, usage: cpuUsage });
    }

    _reportLogSize(size) {
        this.writter.child('metrics').child('logs').child('total').set(size);
    }

    reportName() {
        this.writter.child('name').set(this.name);
    }

    clearLogs() {
        this.writter.child('logs').set({});
    }

    async delete() {
        return this.writter.remove();
    }
}

module.exports = RedisStepLogger;