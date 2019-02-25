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
    taskLogger.clearSteps();
    //taskLogger.delete();
    //taskLogger.finish();
    //taskLogger.fatalError(new Error('my error'));
};

main();
