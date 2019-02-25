const {TaskLogger, TYPES } = require('../index');

const main = async () => {
    const taskLogger = await TaskLogger({
        accountId: 'accountId',
        jobId: 'jobId'
    }, {
        type: TYPES.FIREBASE,
        baseFirebaseUrl: 'https://codefresh-dev.firebaseio.com/development-docker/build-logs',
        firebaseSecret: 'rmxPCB0YOyRdA0ohVUlkbGaQsSmXlARBIXbfnXoM'
    });

    console.log(JSON.stringify(taskLogger.getConfiguration()));
    return;

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
        firebaseSecret: 'rmxPCB0YOyRdA0ohVUlkbGaQsSmXlARBIXbfnXoM'
    });
    await restoredTaskLogger.restore();
    const restoredStepLogger = restoredTaskLogger.create('stepName');
    restoredStepLogger.write('makore');

    restoredTaskLogger.addErrorMessageToEndOfSteps('my error!');

    taskLogger.setStatus('success');
    //await taskLogger.clearSteps();
    //await taskLogger.delete();
    //taskLogger.finish();
    //taskLogger.fatalError(new Error('my error'));
};

main();
