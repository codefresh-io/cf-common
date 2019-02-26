const _ = require('lodash');
const proxyquire = require('proxyquire').noCallThru();
const Q          = require('q');
const chai       = require('chai');
const expect     = chai.expect;
const sinon      = require('sinon');
const sinonChai  = require('sinon-chai');
chai.use(sinonChai);
const { STATUS, VISIBILITY } = require('../enums');

const getStepLoggerInstance = (task = {accountId: 'accountId', jobId: 'jobId', name: 'name'}, opts = {}) => {
    const StepLogger = proxyquire('../StepLogger', {});

    const stepLogger = new StepLogger(task, opts);
    stepLogger.emit = sinon.spy();
    stepLogger.setFinishTimestamp = sinon.spy(stepLogger.setFinishTimestamp);
    stepLogger.updateLastUpdate = sinon.spy(stepLogger.updateLastUpdate);
    stepLogger.setStatus = sinon.spy(stepLogger.setStatus);
    stepLogger.setCreationTimestamp = sinon.spy(stepLogger.setCreationTimestamp);
    stepLogger._reportStatus = sinon.spy();
    stepLogger._reportFinishTimestamp = sinon.spy();
    stepLogger._reportCreationTimestamp = sinon.spy();
    stepLogger._reportLog = sinon.spy();
    stepLogger._reportLastUpdate = sinon.spy();
    stepLogger._reportPrevioulyExecuted = sinon.spy();
    stepLogger._reportMemoryUsage = sinon.spy();
    stepLogger._reportCpuUsage = sinon.spy();
    stepLogger._reportLogSize = sinon.spy();

    stepLogger.setStatus(STATUS.PENDING);
    stepLogger.setStatus.resetHistory();
    stepLogger._reportStatus.resetHistory();
    return stepLogger;
};

describe('Base StepLogger tests', function () {

    describe('constructor', () => {

        describe('positive', () => {
            it('should succeeded instantiating a new TaskLogger instance', () => {
                getStepLoggerInstance({accountId: 'accountId', jobId: 'jobId', name: 'name'}, {});
            });
        });

        describe('negative', () => {
            it('should fail in case accountId is missing', () => {
                try {
                    getStepLoggerInstance({}, {});
                    throw new Error('should have failed');
                } catch (err) {
                    expect(err.toString()).to.equal('Error: failed to create stepLogger because accountId must be provided');
                }
            });

            it('should fail in case jobId is missing', () => {
                try {
                    getStepLoggerInstance({accountId: 'accountId'}, {});
                    throw new Error('should have failed');
                } catch (err) {
                    expect(err.toString()).to.equal('Error: failed to create stepLogger because jobId must be provided');
                }
            });

            it('should fail in case name is missing', () => {
                try {
                    getStepLoggerInstance({accountId: 'accountId', jobId: 'jobId'}, {});
                    throw new Error('should have failed');
                } catch (err) {
                    expect(err.toString()).to.equal('Error: failed to create stepLogger because name must be provided');
                }
            });
        });
    });

    describe('start', () => {

        it('should start a step in case the step is in pending', () => {
            const stepLogger = getStepLoggerInstance();
            expect(stepLogger.getStatus()).to.equal(STATUS.PENDING);
            stepLogger.start();
            expect(stepLogger._reportStatus).to.have.been.calledWith();
            expect(stepLogger.getStatus()).to.equal(STATUS.RUNNING);
        });

        it('should not do anything in case the step is not in pending', () => {
            const stepLogger = getStepLoggerInstance();
            stepLogger.start();
            expect(stepLogger._reportStatus.callCount).to.equal(1);
            stepLogger.start();
            expect(stepLogger._reportStatus.callCount).to.equal(1);
            expect(stepLogger.getStatus()).to.equal(STATUS.RUNNING);
        });

    });

    describe('write', () => {

        describe('positive', () => {
            it('should start a step', () => {
                const stepLogger = getStepLoggerInstance();
                const message = 'message';
                stepLogger.write(message);
                expect(stepLogger._reportLog).to.have.been.calledWith(message);
                expect(stepLogger.updateLastUpdate).to.have.been.calledWith();
            });
        });

        describe('negative', () => {
            it('should emit an error in case the step is not in running/pending/pending-approval/terminating status', () => {
                const stepLogger = getStepLoggerInstance();
                stepLogger.setStatus(STATUS.SUCCESS);
                const message = 'message';
                stepLogger.write(message);
                expect(stepLogger.emit).to.have.been.calledWith('error');
            });
        });

    });

    describe('debug', () => {

        describe('positive', () => {
            it('should start a step', () => {
                const stepLogger = getStepLoggerInstance();
                const message = 'message';
                stepLogger.debug(message);
                expect(stepLogger._reportLog).to.have.been.calledWith(message + '\r\n');
                expect(stepLogger.updateLastUpdate).to.have.been.calledWith();
            });
        });

        describe('negative', () => {
            it('should emit an error in case the step is not in running/pending/pending-approval/terminating status', () => {
                const stepLogger = getStepLoggerInstance();
                stepLogger.setStatus(STATUS.SUCCESS);
                const message = 'message';
                stepLogger.debug(message);
                expect(stepLogger.emit).to.have.been.calledWith('error');
            });
        });

    });

    describe('warn', () => {

        describe('positive', () => {
            it('should start a step', () => {
                const stepLogger = getStepLoggerInstance();
                const message = 'message';
                stepLogger.warn(message);
                expect(stepLogger._reportLog).to.have.been.calledWith(`\x1B[01;93m${message}\x1B[0m\r\n`);
                expect(stepLogger.updateLastUpdate).to.have.been.calledWith();
            });
        });

        describe('negative', () => {
            it('should emit an error in case the step is not in running/pending/pending-approval/terminating status', () => {
                const stepLogger = getStepLoggerInstance();
                stepLogger.setStatus(STATUS.SUCCESS);
                const message = 'message';
                stepLogger.warn(message);
                expect(stepLogger.emit).to.have.been.calledWith('error');
            });
        });

    });

    describe('info', () => {

        describe('positive', () => {
            it('should start a step', () => {
                const stepLogger = getStepLoggerInstance();
                const message = 'message';
                stepLogger.info(message);
                expect(stepLogger._reportLog).to.have.been.calledWith(message + '\r\n');
                expect(stepLogger.updateLastUpdate).to.have.been.calledWith();
            });
        });

        describe('negative', () => {
            it('should emit an error in case the step is not in running/pending/pending-approval/terminating status', () => {
                const stepLogger = getStepLoggerInstance();
                stepLogger.setStatus(STATUS.SUCCESS);
                const message = 'message';
                stepLogger.info(message);
                expect(stepLogger.emit).to.have.been.calledWith('error');
            });
        });

    });

    describe('finish', () => {

        describe('positive', () => {
            it('should conclude a step with success status in case it is running', () => {
                const stepLogger = getStepLoggerInstance();
                stepLogger.start();
                stepLogger.finish();
                expect(stepLogger.getStatus()).to.equal(STATUS.SUCCESS);
                expect(stepLogger.emit).to.have.been.calledWith('finished');
            });

            it('should conclude a step with error in case it is running and an error reported', () => {
                const stepLogger = getStepLoggerInstance();
                stepLogger.start();
                stepLogger.finish(new Error('error'));
                expect(stepLogger.getStatus()).to.equal(STATUS.ERROR);
                expect(stepLogger.emit).to.have.been.calledWith('finished');
            });

            it('should conclude a step with approved in case it is in pending approval status without an error', () => {
                const stepLogger = getStepLoggerInstance();
                stepLogger.start();
                stepLogger.markPendingApproval();
                stepLogger.finish();
                expect(stepLogger.getStatus()).to.equal(STATUS.APPROVED);
                expect(stepLogger.emit).to.have.been.calledWith('finished');
            });

            it('should conclude a step with approved in case it is in pending approval status without an error', () => {
                const stepLogger = getStepLoggerInstance();
                stepLogger.start();
                stepLogger.markPendingApproval();
                stepLogger.finish(new Error('error'));
                expect(stepLogger.getStatus()).to.equal(STATUS.DENIED);
                expect(stepLogger.emit).to.have.been.calledWith('finished');
            });

            it('should mark a step as skipped', () => {
                const stepLogger = getStepLoggerInstance();
                stepLogger.start();
                stepLogger.finish(undefined, true);
                expect(stepLogger.getStatus()).to.equal(STATUS.SKIPPED);
                expect(stepLogger.emit).to.have.been.calledWith('finished');
            });

            it('should conclude step with status terminated in case it is terminating', () => {
                const stepLogger = getStepLoggerInstance();
                stepLogger.start();
                stepLogger.markTerminating();
                stepLogger.finish(new Error('error'));
                expect(stepLogger.getStatus()).to.equal(STATUS.TERMINATED);
            });

            it('should conclude step with status success in case it is terminating but an error was not reported', () => {
                const stepLogger = getStepLoggerInstance();
                stepLogger.start();
                stepLogger.markTerminating();
                stepLogger.finish();
                expect(stepLogger.getStatus()).to.equal(STATUS.SUCCESS);
            });
        });

        describe('negative', () => {
            it('should emit an error in case the step is not in running/pending/pending-approval/terminating status', () => {
                const stepLogger = getStepLoggerInstance();
                stepLogger.setStatus(STATUS.SUCCESS);
                stepLogger.finish();
                expect(stepLogger.emit).to.have.been.calledWith('error');
            });

            it('should emit an error in case the step is not in running/pending/pending-approval/terminating status', () => {
                const stepLogger = getStepLoggerInstance();
                stepLogger.setStatus(STATUS.SUCCESS);
                stepLogger.finish(new Error('error'));
                expect(stepLogger.emit).to.have.been.calledWith('error');
            });
        });

    });

    describe('updateLastUpdate', () => {

        it('should update last date of a change', () => {
            const stepLogger = getStepLoggerInstance();
            stepLogger.updateLastUpdate();
            expect(stepLogger._reportLastUpdate).to.have.been.calledWith();
        });

    });

    describe('setFinishTimestamp', () => {

        it('should update finish timestamp', () => {
            const stepLogger = getStepLoggerInstance();
            const date = new Date();
            stepLogger.setFinishTimestamp(date);
            expect(stepLogger._reportFinishTimestamp).to.have.been.calledWith();
            expect(stepLogger.finishTimeStamp).to.equal(date);
        });

    });

    describe('setCreationTimestamp', () => {

        it('should update creation timestamp', () => {
            const stepLogger = getStepLoggerInstance();
            const date = new Date();
            stepLogger.setCreationTimestamp(date);
            expect(stepLogger._reportCreationTimestamp).to.have.been.calledWith();
            expect(stepLogger.creationTimeStamp).to.equal(date);
        });

    });

    describe('markPreviouslyExecuted', () => {

        it('should update creation timestamp', () => {
            const stepLogger = getStepLoggerInstance();
            stepLogger.markPreviouslyExecuted();
            expect(stepLogger._reportPrevioulyExecuted).to.have.been.calledWith();
            expect(stepLogger.previouslyExecuted).to.equal(true);
        });

    });

    describe('markPendingApproval', () => {

        it('should mark as pending approval', () => {
            const stepLogger = getStepLoggerInstance();
            stepLogger.markPendingApproval();
            expect(stepLogger.emit).to.have.been.calledWith('finished');
            expect(stepLogger.pendingApproval).to.equal(true);
            expect(stepLogger.getStatus()).to.equal(STATUS.PENDING_APPROVAL)
        });

    });

    describe('updateMemoryUsage', () => {

        it('should update memory usage', () => {
            const stepLogger = getStepLoggerInstance();
            const time = new Date();
            const memoryUsage = 'usage';
            stepLogger.updateMemoryUsage(time, memoryUsage);
            expect(stepLogger._reportMemoryUsage).to.have.been.calledWith(time, memoryUsage);
        });

    });

    describe('updateCpuUsage', () => {

        it('should update cpu usage', () => {
            const stepLogger = getStepLoggerInstance();
            const time = new Date();
            const cpuUsage = 'usage';
            stepLogger.updateCpuUsage(time, cpuUsage);
            expect(stepLogger._reportCpuUsage).to.have.been.calledWith(time, cpuUsage);
        });

    });

    describe('setLogSize', () => {

        it('should set log size', () => {
            const stepLogger = getStepLoggerInstance();
            const logSize = 'size';
            stepLogger.setLogSize(logSize);
            expect(stepLogger._reportLogSize).to.have.been.calledWith();
        });

    });

    describe('markTerminating', () => {

        describe('positive', () => {
            it('should emit error in case step is not running', () => {
                const stepLogger = getStepLoggerInstance();
                stepLogger.start();
                stepLogger.markTerminating();
                expect(stepLogger.getStatus()).to.equal(STATUS.TERMINATING);
                expect(stepLogger._reportStatus).to.have.been.calledWith();
            });
        });

        describe('negative', () => {
            it('should emit error in case step is not running', () => {
                const stepLogger = getStepLoggerInstance();
                stepLogger.markTerminating();
                expect(stepLogger.emit).to.have.been.calledWith('error');
            });
        });

    });

});
