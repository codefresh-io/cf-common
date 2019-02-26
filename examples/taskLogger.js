const {TaskLogger, TYPES } = require('../index');

const main = async () => {
    const taskLogger = await TaskLogger({
        accountId: 'accountId',
        jobId: 'jobId'
    }, {
        type: TYPES.FIREBASE,
        baseFirebaseUrl: 'https://codefresh-dev.firebaseio.com/development-docker/build-logs',
        firebaseSecret: process.env["FIREBASE_SECRET"]
    });

    console.log(JSON.stringify(taskLogger.getConfiguration()));

    taskLogger.reportId();
    taskLogger.reportAccountId();
    taskLogger.setVisibility('public');
    taskLogger.setStatus('running');
    taskLogger.setMemoryLimit('2');
    taskLogger.updateMemoryUsage(new Date(), 'sd');
    taskLogger.setData({key: 'value'});

    const stepLogger = taskLogger.create('stepName', undefined, undefined, true);
    stepLogger.start();
    stepLogger.write('hey');
    stepLogger.reportName();
    stepLogger.clearLogs();
    stepLogger.setStatus('pending');
    stepLogger.start();
    stepLogger.write('write');
    stepLogger.debug('debug');
    stepLogger.warn('warn');
    stepLogger.info('info');

    stepLogger.markPreviouslyExecuted();
    stepLogger.markPendingApproval();

    stepLogger.updateMemoryUsage(new Date().getTime(), 'mem');
    stepLogger.updateCpuUsage(new Date().getTime(), 'cpu');

    //stepLogger.markTerminating();

    //stepLogger.finish(new Error('err'));
    //stepLogger.finish();

    //await stepLogger.delete();

    const restoredTaskLogger = await TaskLogger({
        accountId: 'accountId',
        jobId: 'jobId'
    }, {
        type: TYPES.FIREBASE,
        baseFirebaseUrl: 'https://codefresh-dev.firebaseio.com/development-docker/build-logs',
        firebaseSecret: process.env["FIREBASE_SECRET"]
    });
    await restoredTaskLogger.restore();
    const restoredStepLogger = restoredTaskLogger.create('stepName', undefined, undefined, true);
    restoredStepLogger.write('makore');

    restoredTaskLogger.addErrorMessageToEndOfSteps('my error!');

    taskLogger.setStatus('success');
    //await taskLogger.clearSteps();
    //await taskLogger.delete();
    //taskLogger.finish();
    //taskLogger.fatalError(new Error('my error'));


    const redisTaskLogger = await TaskLogger({
        accountId: 'accountId',
        jobId: 'jobId'
    }, {
        type: TYPES.REDIS,
        config: {
            host: 'local.codefresh.io',
            password: 'redisPassword',
            db: 1,
            port: 6379
        }
    });

    redisTaskLogger.reportId();
    redisTaskLogger.reportAccountId();
    redisTaskLogger.setVisibility('public');
    redisTaskLogger.setStatus('running');
    redisTaskLogger.setMemoryLimit('2');
    redisTaskLogger.updateMemoryUsage(new Date(), 'sd');
    redisTaskLogger.setData({key: 'value'});


    const stepLoggerRedis = redisTaskLogger.create('stepName', undefined, undefined, true);
    stepLoggerRedis.start();
    stepLoggerRedis.write('hey');
    stepLoggerRedis.reportName();
    stepLoggerRedis.clearLogs();
    stepLoggerRedis.setStatus('pending');
    stepLoggerRedis.start();
    stepLoggerRedis.write('write');
    stepLoggerRedis.debug('debug');
    stepLoggerRedis.warn('warn');
    stepLoggerRedis.info('info');

    stepLoggerRedis.markPreviouslyExecuted();
    stepLoggerRedis.markPendingApproval();

    stepLoggerRedis.updateMemoryUsage(new Date().getTime(), 'mem');
    stepLoggerRedis.updateCpuUsage(new Date().getTime(), 'cpu');

    //stepLogger.markTerminating();

    //stepLogger.finish(new Error('err'));
    //stepLogger.finish();

    //await stepLogger.delete();


    const redisRestoredTaskLogger = await TaskLogger({
        accountId: 'accountId',
        jobId: 'jobId'
    }, {
        type: TYPES.REDIS,
        config: {
            host: 'local.codefresh.io',
            password: 'redisPassword',
            db: 1,
            port: 6379
        }
    });

    await redisRestoredTaskLogger.restore();
    const redisRestoredStepLogger = redisRestoredTaskLogger.create('stepName', undefined, undefined, true);
    // redisRestoredStepLogger.write('makore');

    // redisRestoredTaskLogger.addErrorMessageToEndOfSteps('my error!');

    // redisTaskLogger.setStatus('success');
};

main();
