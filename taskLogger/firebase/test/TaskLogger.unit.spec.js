const _ = require('lodash');
const proxyquire = require('proxyquire').noCallThru();
const Q          = require('q');
const chai       = require('chai');
const expect     = chai.expect;
const sinon      = require('sinon');
const sinonChai  = require('sinon-chai');
chai.use(sinonChai);
const { TYPES, STATUS, VISIBILITY } = require('../../enums');
const createFirebaseStub = require('./FirebaseStub');

let Firebase;

const getTaskLoggerInstance = async (task = { accountId: 'accountId', jobId: 'jobId' },
    opts = { baseFirebaseUrl: 'url', firebaseSecret: 'secret' }) => {
    Firebase = createFirebaseStub();

    const TaskLogger = proxyquire('../TaskLogger', {
        'firebase': Firebase,
    });

    const taskLogger = await TaskLogger.factory(task, opts);
    taskLogger.emit  = sinon.spy(taskLogger.emit);

    return taskLogger;
};

describe('Firebase TaskLogger tests', function () {

    describe('factory', () => {

        describe('positive', () => {

            it('should succeed if all data is passed and authentication succeeded', async () => {
                const Firebase = createFirebaseStub();

                const TaskLogger = proxyquire('../TaskLogger', {
                    'firebase': Firebase,
                });

                const task = {accountId: 'accountId', jobId: 'jobId'};
                const opts = {
                    baseFirebaseUrl: 'url',
                    firebaseSecret: 'secret'
                };
                expect(TaskLogger.authenticated).to.equal(false);
                await TaskLogger.factory(task, opts);
                expect(Firebase.__authWithCustomTokenStub).to.have.been.calledWith('secret');
                expect(TaskLogger.authenticated).to.equal(true);
            });

            it('should perform authentication only once', async () => {
                const Firebase = createFirebaseStub();

                const TaskLogger = proxyquire('../TaskLogger', {
                    'firebase': Firebase,
                });

                const task = {accountId: 'accountId', jobId: 'jobId'};
                const opts = {
                    baseFirebaseUrl: 'url',
                    firebaseSecret: 'secret'
                };
                expect(TaskLogger.authenticated).to.equal(false);
                await TaskLogger.factory(task, opts);
                await TaskLogger.factory(task, opts);
                expect(Firebase.__authWithCustomTokenStub.callCount).to.equal(1);
            });
        });

        describe('negative', () => {

            it('should throw an error in case authentication failed', async () => {
                const Firebase = createFirebaseStub();

                const TaskLogger = proxyquire('../TaskLogger', {
                    'firebase': Firebase,
                });

                const task = {accountId: 'accountId', jobId: 'jobId'};
                const opts = {
                    baseFirebaseUrl: 'url',
                    firebaseSecret: 'secret'
                };
                Firebase.__authWithCustomTokenStub.yields(new Error('my error'));
                try {
                    await TaskLogger.factory(task, opts);
                    throw new Error('should have failed');
                } catch (err) {
                    expect(err.toString()).to.equal('Error: Failed to create taskLogger because authentication to firebase url url/jobId; caused by Error: my error');
                }
            });

            it('should fail in case of a missing baseFirebaseUrl', async () => {
                const Firebase = createFirebaseStub();

                const TaskLogger = proxyquire('../TaskLogger', {
                    'firebase': Firebase,
                });

                const task = {accountId: 'accountId', jobId: 'jobId'};
                const opts = {
                    firebaseSecret: 'secret'
                };

                try {
                    await TaskLogger.factory(task, opts);
                    throw new Error('should have failed');
                } catch (err) {
                    expect(err.toString()).to.equal('Error: failed to create taskLogger because baseFirebaseUrl must be provided');
                }
            });

            it('should fail in case of a missing firebaseSecret', async () => {
                const Firebase = createFirebaseStub();

                const TaskLogger = proxyquire('../TaskLogger', {
                    'firebase': Firebase,
                });

                const task = {accountId: 'accountId', jobId: 'jobId'};
                const opts = {
                    baseFirebaseUrl: 'url',
                };

                try {
                    await TaskLogger.factory(task, opts);
                    throw new Error('should have failed');
                } catch (err) {
                    expect(err.toString()).to.equal('Error: failed to create taskLogger because Firebase secret reference must be provided');
                }
            });

        });
    });

    describe('reporting', () => {
        it('should report memory usage', async () => {
            const taskLogger = await getTaskLoggerInstance();
            const time = new Date();
            const memoryUsage = 'usage';
            taskLogger._reportMemoryUsage(time, memoryUsage);
            expect(Firebase.__pushSpy).to.have.been.calledWith({time, usage: memoryUsage});
        });

        it('should report memory limit', async () => {
            const taskLogger = await getTaskLoggerInstance();
            taskLogger.memoryLimit = 'limit';
            taskLogger._reportMemoryLimit();
            expect(Firebase.__pushSpy).to.have.been.calledWith(taskLogger.memoryLimit);
        });

        it('should report log size', async () => {
            const taskLogger = await getTaskLoggerInstance();
            taskLogger.logSize = 'size';
            taskLogger._reportLogSize();
            expect(Firebase.__setSpy).to.have.been.calledWith(taskLogger.logSize);
        });

        it('should report visibility', async () => {
            const taskLogger = await getTaskLoggerInstance();
            taskLogger.visibility = 'public';
            taskLogger._reportVisibility();
            expect(Firebase.__setSpy).to.have.been.calledWith(taskLogger.visibility);
        });

        it('should report data', async () => {
            const taskLogger = await getTaskLoggerInstance();
            taskLogger.data = {key: 'value'};
            taskLogger._reportData();
            expect(Firebase.__setSpy).to.have.been.calledWith(taskLogger.data);
        });

        it('should report status', async () => {
            const taskLogger = await getTaskLoggerInstance();
            taskLogger.status = 'running';
            taskLogger._reportStatus();
            expect(Firebase.__setSpy).to.have.been.calledWith(taskLogger.status);
        });

        it('should report accountId', async () => {
            const taskLogger = await getTaskLoggerInstance();
            taskLogger.reportAccountId();
            expect(Firebase.__setSpy).to.have.been.calledWith(taskLogger.accountId);
        });

        it('should report job id', async () => {
            const taskLogger = await getTaskLoggerInstance();
            taskLogger.reportId();
            expect(Firebase.__setSpy).to.have.been.calledWith(taskLogger.jobId);
        });
    });
});
