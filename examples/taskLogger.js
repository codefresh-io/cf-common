const {TaskLogger, TYPES } = require('../ndex');
const Firebase = require('firebase');

const main = async () => {
    const taskLogger = await TaskLogger({
        accountId: 'accountId',
        jobId: 'jobId'
    }, {
        type: TYPES.FIREBASE,
        FirebaseLib: Firebase,
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

    const stepLogger = await taskLogger.create('stepName');
    await stepLogger.start();
    stepLogger.write('hey');

    const restoredTaskLogger = await TaskLogger({
        accountId: 'accountId',
        jobId: 'jobId'
    }, {
        type: TYPES.FIREBASE,
        FirebaseLib: Firebase,
        baseFirebaseUrl: 'https://codefresh-dev.firebaseio.com/development-docker/build-logs',
        firebaseSecret: 'rmxPCB0YOyRdA0ohVUlkbGaQsSmXlARBIXbfnXoM'
    });
    await restoredTaskLogger.restore();
    const restoredStepLogger = await restoredTaskLogger.create('stepName');
    restoredStepLogger.write('makore');

    restoredTaskLogger.addErrorMessageToEndOfSteps('my error!');

    //taskLogger.finish();
    taskLogger.fatalError(new Error('my error'));
};

main();
