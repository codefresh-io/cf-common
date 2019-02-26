const _ = require('lodash');
const proxyquire = require('proxyquire').noCallThru();
const Q          = require('q');
const chai       = require('chai');
const expect     = chai.expect;
const sinon      = require('sinon');
const sinonChai  = require('sinon-chai');
chai.use(sinonChai);
const createFirebaseStub = require('./FirebaseStub');

let Firebase;

const getStepLoggerInstance = async (step = { accountId: 'accountId', jobId: 'jobId', name: 'name' },
    opts = { baseFirebaseUrl: 'url' }) => {
    Firebase = createFirebaseStub();

    const StepLogger = proxyquire('../StepLogger', {
        'firebase': Firebase,
    });

    const stepLogger = new StepLogger(step, opts);
    stepLogger.emit  = sinon.spy(stepLogger.emit);

    return stepLogger;
};

describe('Firebase StepLogger tests', function () {

    describe('constructor', () => {

        describe('positive', () => {

            it('should succeed if all data is passed and authentication succeeded', async () => {
                const Firebase = createFirebaseStub();

                const StepLogger = proxyquire('../StepLogger', {
                    'firebase': Firebase,
                });

                const task = {accountId: 'accountId', jobId: 'jobId', name: 'name'};
                const opts = { baseFirebaseUrl: 'url' };

                new StepLogger(task, opts);
            });
        });

        describe('negative', () => {

            it('should fail in case of a missing baseFirebaseUrl', async () => {
                const Firebase = createFirebaseStub();

                const StepLogger = proxyquire('../StepLogger', {
                    'firebase': Firebase,
                });

                const task = {accountId: 'accountId', jobId: 'jobId', name: 'name'};
                const opts = { };

                try {
                    new StepLogger(task, opts);
                    throw new Error('should have failed');
                } catch (err) {
                    expect(err.toString()).to.equal('Error: failed to create stepLogger because baseFirebaseUrl must be provided');
                }
            });

        });
    });

    describe('reporting', () => {
        it('should report log message', async () => {
            const stepLogger = await getStepLoggerInstance();
            const message = 'message';
            stepLogger._reportLog(message);
            expect(Firebase.__pushSpy).to.have.been.calledWith(message);
        });

        it('should report last update', async () => {
            const stepLogger = await getStepLoggerInstance();
            stepLogger.lastUpdate = new Date();
            stepLogger._reportLastUpdate();
            expect(Firebase.__setSpy).to.have.been.calledWith(stepLogger.lastUpdate);
        });

        it('should report previously executed', async () => {
            const stepLogger = await getStepLoggerInstance();
            stepLogger.previouslyExecuted = true;
            stepLogger._reportPrevioulyExecuted();
            expect(Firebase.__setSpy).to.have.been.calledWith(stepLogger.previouslyExecuted);
        });

        it('should report status', async () => {
            const stepLogger = await getStepLoggerInstance();
            stepLogger.status = 'running';
            stepLogger._reportStatus();
            expect(Firebase.__setSpy).to.have.been.calledWith(stepLogger.status);
        });

        it('should report finish timestamp', async () => {
            const stepLogger = await getStepLoggerInstance();
            stepLogger.finishTimeStamp = new Date();
            stepLogger._reportFinishTimestamp();
            expect(Firebase.__setSpy).to.have.been.calledWith(stepLogger.finishTimeStamp);
        });

        it('should report creation time', async () => {
            const stepLogger = await getStepLoggerInstance();
            stepLogger.creationTimeStamp = new Date();
            stepLogger._reportCreationTimestamp();
            expect(Firebase.__setSpy).to.have.been.calledWith(stepLogger.creationTimeStamp);
        });

        it('should report memory usage', async () => {
            const stepLogger = await getStepLoggerInstance();
            const time = new Date();
            const usage = 'usage';
            stepLogger._reportMemoryUsage(time, usage);
            expect(Firebase.__pushSpy).to.have.been.calledWith({time, usage});
        });

        it('should report cpu usage', async () => {
            const stepLogger = await getStepLoggerInstance();
            const time = new Date();
            const usage = 'usage';
            stepLogger._reportCpuUsage(time, usage);
            expect(Firebase.__pushSpy).to.have.been.calledWith({time, usage});
        });

        it('should report log size', async () => {
            const stepLogger = await getStepLoggerInstance();
            stepLogger.logSize = 'size';
            stepLogger._reportLogSize();
            expect(Firebase.__setSpy).to.have.been.calledWith(stepLogger.logSize);
        });

        it('should report name', async () => {
            const stepLogger = await getStepLoggerInstance();
            stepLogger.reportName();
            expect(Firebase.__setSpy).to.have.been.calledWith(stepLogger.name);
        });
    });
});
