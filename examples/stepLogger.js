const Q = require('q');
const { StepLogger, TYPES } = require('../ndex');
const Firebase = require('firebase');

const main = async () => {
    const stepLogger = await StepLogger({
        accountId: 'accountId',
        jobId: 'jobId',
        name: 'stepId'
    }, {
        type: TYPES.FIREBASE,
        FirebaseLib: Firebase,
        baseFirebaseUrl: 'https://codefresh-dev.firebaseio.com/development-docker/build-logs',
        firebaseSecret: 'rmxPCB0YOyRdA0ohVUlkbGaQsSmXlARBIXbfnXoM'
    });
    stepLogger.reportName();
    stepLogger.clearLogs();
    stepLogger.setStatus('pending');
    stepLogger.start();
    stepLogger.write('write');
    stepLogger.debug('debug');
    stepLogger.warn('warn');
    stepLogger.info('info');

    stepLogger.markPreviouslyExecuted();
    await stepLogger.markPendingApproval();

    stepLogger.updateMemoryUsage(new Date().getTime(), 'mem');
    stepLogger.updateCpuUsage(new Date().getTime(), 'cpu');

    //await stepLogger.markTerminating();

    //await stepLogger.finish(new Error('err'));
    //await stepLogger.finish();

    //stepLogger.delete();

    const restoredStepLogger = await StepLogger({
        accountId: 'accountId',
        jobId: 'jobId',
        name: 'stepId'
    }, {
        type: TYPES.FIREBASE,
        FirebaseLib: Firebase,
        baseFirebaseUrl: 'https://codefresh-dev.firebaseio.com/development-docker/build-logs',
        firebaseSecret: 'rmxPCB0YOyRdA0ohVUlkbGaQsSmXlARBIXbfnXoM'
    });
    await restoredStepLogger.restore();
    console.log(restoredStepLogger.getStatus());
    console.log(restoredStepLogger.pendingApproval);
};

main();
