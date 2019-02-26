const _ = require('lodash');
const proxyquire = require('proxyquire').noCallThru();
const Q          = require('q');
const chai       = require('chai');
const expect     = chai.expect;
const sinon      = require('sinon');
const sinonChai  = require('sinon-chai');
chai.use(sinonChai);
const { TYPES, STATUS, VISIBILITY } = require('../enums');

const createMockedStepClass = () => {
    const StepClass = sinon.spy(function () {
        let onErrorHandler;
        let onFinishedHandler;
        return {
            emit: (event, data) => {
                if (event === 'error') {
                    onErrorHandler(data);
                } else if (event === 'finished') {
                    onFinishedHandler(data);
                }
            },
            on: sinon.spy((event, handler) => {
                if (event === 'error') {
                    onErrorHandler = handler;
                } else if (event === 'finished') {
                    onFinishedHandler = handler;
                }
            }),
            finish: sinon.spy(),
            reportName: sinon.spy(),
            clearLogs: sinon.spy(),
            setStatus: sinon.spy(),
            setFinishTimestamp: sinon.spy(),
            setCreationTimestamp: sinon.spy()
        }
    });
    return StepClass
};

let firebaseStepLoggerMockedClass;
const rpStub = sinon.stub();


const getTaskLoggerInstance = (task = {accountId: 'accountId', jobId: 'jobId'}, opts = {}) => {
    rpStub.reset();
    rpStub.resolves();
    firebaseStepLoggerMockedClass = createMockedStepClass();
    const TaskLogger = proxyquire('../TaskLogger', {
        'request-promise': rpStub,
        './firebase/StepLogger': firebaseStepLoggerMockedClass
    });

    const taskLogger = new TaskLogger(task, opts);
    taskLogger.emit = sinon.spy();
    taskLogger.type = TYPES.FIREBASE;
    taskLogger.create = sinon.spy(taskLogger.create);
    taskLogger.finish = sinon.spy(taskLogger.finish);
    taskLogger.fatalError = sinon.spy(taskLogger.fatalError);
    taskLogger.updateMemoryUsage = sinon.spy(taskLogger.updateMemoryUsage);
    taskLogger.setMemoryLimit = sinon.spy(taskLogger.setMemoryLimit);
    taskLogger.setLogSize = sinon.spy(taskLogger.setLogSize);
    taskLogger.setVisibility = sinon.spy(taskLogger.setVisibility);
    taskLogger.setData = sinon.spy(taskLogger.setData);
    taskLogger.setStatus = sinon.spy(taskLogger.setStatus);
    taskLogger.getConfiguration = sinon.spy(taskLogger.getConfiguration);
    taskLogger.newStepAdded = sinon.spy();
    taskLogger._reportMemoryUsage = sinon.spy();
    taskLogger._reportMemoryLimit = sinon.spy();
    taskLogger._reportLogSize = sinon.spy();
    taskLogger._reportVisibility = sinon.spy();
    taskLogger._reportData = sinon.spy();
    taskLogger._reportStatus = sinon.spy();
    return taskLogger;
};

describe('Base TaskLogger tests', function () {

    describe('constructor', () => {

        describe('positive', () => {
           it('should succeeded instantiating a new TaskLogger instance', () => {
               const taskLogger = getTaskLoggerInstance({accountId: 'accountId', jobId: 'jobId'}, {});
               expect(taskLogger.steps).to.deep.equal({});
           });
        });

        describe('negative', () => {
            it('should fail in case accountId is missing', () => {
                try {
                    getTaskLoggerInstance({}, {});
                    throw new Error('should have failed');
                } catch (err) {
                    expect(err.toString()).to.equal('Error: failed to create taskLogger because accountId must be provided');
                }
            });

            it('should fail in case jobId is missing', () => {
                try {
                    getTaskLoggerInstance({accountId: 'accountId'}, {});
                    throw new Error('should have failed');
                } catch (err) {
                    expect(err.toString()).to.equal('Error: failed to create taskLogger because jobId must be provided');
                }
            });
        });
    });

    describe('get configuration', () => {

        it('should set data', () => {
            const task = {accountId: 'account', jobId: 'job'};
            const opts = {key: 'value'};
            const taskLogger = getTaskLoggerInstance(task, opts);
            expect(taskLogger.getConfiguration()).to.deep.equal({
                opts,
                task
            });
        });

    });

    describe('create', () => {
        it('should create a new step in case it does not exist', () => {
            const taskLogger = getTaskLoggerInstance();
            taskLogger.create('new-step');
            expect(firebaseStepLoggerMockedClass).to.have.been.calledOnce;
        });

        it('should add created step to steps field', () => {
            const taskLogger = getTaskLoggerInstance();
            const stepLogger = taskLogger.create('new-step');
            expect(taskLogger.steps).to.deep.equal({'new-step': stepLogger});
        });

        it('should return an existing step in case it was already created', () => {
            const taskLogger = getTaskLoggerInstance();
            const stepLogger = taskLogger.create('new-step');
            expect(stepLogger).to.equal(taskLogger.create('new-step'));
            expect(firebaseStepLoggerMockedClass).to.have.been.calledOnce;
        });

        it('should listen on errors from step and emit an error in case invoked', () => {
            const taskLogger = getTaskLoggerInstance();
            const stepLogger = taskLogger.create('new-step');
            expect(stepLogger.on).to.have.been.calledWith('error');
            const error = new Error('my error');
            stepLogger.emit('error', error);
            expect(taskLogger.emit).to.have.been.calledWith('error', error);
        });

        it('should listen on finished step and delete it from steps', () => {
            const taskLogger = getTaskLoggerInstance();
            const stepLogger = taskLogger.create('new-step');
            expect(taskLogger.steps).to.deep.equal({'new-step': stepLogger});
            expect(stepLogger.on).to.have.been.calledWith('finished');
            stepLogger.emit('finished');
            expect(taskLogger.steps).to.deep.equal({});
        });

        it('should reset an existing step if asked', () => {
            const taskLogger = getTaskLoggerInstance();
            let stepLogger = taskLogger.create('new-step');
            expect(stepLogger.setStatus).to.not.have.been.called;
            stepLogger = taskLogger.create('new-step', undefined, true);
            expect(stepLogger.setStatus).to.have.been.calledWith(STATUS.PENDING);
            expect(stepLogger.setFinishTimestamp).to.have.been.calledWith('');
            expect(stepLogger.setCreationTimestamp).to.have.been.calledWith('');
        });

        it('should run creation logic in case asked for', () => {
            const taskLogger = getTaskLoggerInstance();
            let stepLogger = taskLogger.create('new-step', undefined, undefined, true);
            expect(stepLogger.setStatus).to.have.been.calledWith(STATUS.PENDING);
            expect(stepLogger.reportName).to.have.been.calledWith();
            expect(stepLogger.clearLogs).to.have.been.calledWith();
            expect(taskLogger.newStepAdded).to.have.been.calledWith(stepLogger);
        });

        it('should report back about a new step if eventReporting is passed', () => {
            const taskLogger = getTaskLoggerInstance();
            const eventReporting = {
                token: 'token',
                url: 'url'
            };
            taskLogger.create('new-step', eventReporting);
            expect(rpStub).to.have.been.calledWith({
                uri: eventReporting.url,
                headers: {Authorization: eventReporting.token},
                method: 'POST',
                body: { action: 'new-progress-step', name: 'new-step'},
                json: true
            });
        });

    });

    describe('finish', () => {
        it('should set finished field with true', () => {
            const taskLogger = getTaskLoggerInstance();
            expect(taskLogger.finished).to.equal(false);
            taskLogger.finish();
            expect(taskLogger.finished).to.equal(true);
        });

        it('should call finish of each created step', () => {
            const taskLogger = getTaskLoggerInstance();
            const stepLogger = taskLogger.create('new-step');
            taskLogger.finish();
            expect(stepLogger.finish.callCount).to.equal(1);
        });
    });

    describe('fatalError', () => {
        it('should set fatal field to true', () => {
            const taskLogger = getTaskLoggerInstance();
            expect(taskLogger.fatal).to.equal(false);
            taskLogger.fatalError(new Error('fatal error'));
            expect(taskLogger.fatal).to.equal(true);
        });

        it('should create a new step in case no steps exists', () => {
            const taskLogger = getTaskLoggerInstance();
            taskLogger.fatalError(new Error('fatal error'));
            expect(taskLogger.create).to.have.been.calledWith('Something went wrong');
        });

        it('should call finish of each created step', () => {
            const taskLogger = getTaskLoggerInstance();
            const stepLogger = taskLogger.create('new-step');
            taskLogger.fatalError(new Error('fatal error'));
            expect(stepLogger.finish.callCount).to.equal(1);
        });

    });

    describe('updateMemoryUsage', () => {

        it('should report memory usage', () => {
            const taskLogger = getTaskLoggerInstance();
            const time = new Date();
            const memoryUsage = 'usage';
            taskLogger.updateMemoryUsage(time, memoryUsage);
            expect(taskLogger._reportMemoryUsage).to.have.been.calledWith(time, memoryUsage);
        });

    });

    describe('setMemoryLimit', () => {

        it('should set memory limit', () => {
            const taskLogger = getTaskLoggerInstance();
            const memoryLimit = 'limit';
            taskLogger.setMemoryLimit(memoryLimit);
            expect(taskLogger.memoryLimit).to.equal(memoryLimit);
            expect(taskLogger._reportMemoryLimit).to.have.been.calledWith();
        });

    });

    describe('setLogSize', () => {

        it('should set log size', () => {
            const taskLogger = getTaskLoggerInstance();
            const logSize = 'size';
            taskLogger.setLogSize(logSize);
            expect(taskLogger.logSize).to.equal(logSize);
            expect(taskLogger._reportLogSize).to.have.been.calledWith();
        });

    });

    describe('setVisibility', () => {

        describe('positive', () => {
            it('should set the visiblity to private', () => {
                const taskLogger = getTaskLoggerInstance();
                taskLogger.setVisibility(VISIBILITY.PRIVATE);
                expect(taskLogger.visibility).to.equal(VISIBILITY.PRIVATE);
                expect(taskLogger._reportVisibility).to.have.been.calledWith();
            });

            it('should set the visiblity to public', () => {
                const taskLogger = getTaskLoggerInstance();
                taskLogger.setVisibility(VISIBILITY.PUBLIC);
                expect(taskLogger.visibility).to.equal(VISIBILITY.PUBLIC);
                expect(taskLogger._reportVisibility).to.have.been.calledWith();
            });
        });

        describe('negative', () => {
            it('should fail in case the visiblity is not supported', () => {
                const taskLogger = getTaskLoggerInstance();
                try {
                    taskLogger.setVisibility('non-valid');
                    throw new Error('should have failed');
                } catch (err) {
                    expect(err.toString()).to.equal('Error: Visibility: non-valid is not supported. use public/private');
                }
            });
        });

    });

    describe('setData', () => {

        it('should set data', () => {
            const taskLogger = getTaskLoggerInstance();
            const data = {};
            taskLogger.setData(data);
            expect(taskLogger.data).to.equal(data);
            expect(taskLogger._reportData).to.have.been.calledWith();
        });

    });

    describe('setData', () => {

        it('should set data', () => {
            const taskLogger = getTaskLoggerInstance();
            const status = 'status';
            taskLogger.setStatus(status);
            expect(taskLogger.status).to.equal(status);
            expect(taskLogger._reportStatus).to.have.been.calledWith();
        });

    });

});
