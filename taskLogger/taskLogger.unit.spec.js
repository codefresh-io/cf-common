var proxyquire = require('proxyquire').noCallThru();
var Q          = require('q');
var chai       = require('chai');
var expect     = chai.expect;
var sinon      = require('sinon');
var sinonChai  = require('sinon-chai');
chai.use(sinonChai);

describe('taskLogger tests', function () {

    var createMockLogger = function (requestSpy, childSpy, setSpy, pushSpy, onSpy, removeSpy, offSpy, updateSpy) {
        var Logger = proxyquire('./taskLogger', {
            'cf-queue': function () {
                return {
                    request: requestSpy || function () {
                        return Q.resolve();
                    }
                };
            },
            'firebase': function () {
                return {
                    child: childSpy || function () {
                        return this;
                    },
                    set: setSpy || function () {
                        return this;
                    },
                    push: pushSpy || function () {
                        return this;
                    },
                    on: onSpy || function () {
                        return this;
                    },
                    remove: removeSpy || function () {
                        return this;
                    },
                    off: offSpy || function () {
                        return this;
                    },
                    update: updateSpy || function () {
                        return this;
                    }
                };
            }
        });
        return Logger;
    };

    describe('1 create a new logger', function(){

        it('1.1 create a new logger', function () {
            var Logger = createMockLogger();
            var logger = new Logger({
                request: {
                    context: {
                        progress_id: "progress_id"
                    }
                }
            });
            expect(logger).to.exist; // jshint ignore:line
            expect(logger.create).to.exist; // jshint ignore:line
            expect(logger.finish).to.exist; // jshint ignore:line
        });

        it('1.2 create a new logger, a step and finish it', function () {
            var Logger = createMockLogger();
            var logger = new Logger({
                request: {
                    context: {
                        progress_id: "progress_id"
                    }
                }
            });
            logger.create("Step1");
            logger.finish();
        });

    });

    describe('2 create a new step', function(){


        it('2.1 create a new step should return specific functions', function () {
            var removeSpy = sinon.spy(function(){
                return this;
            });
            var Logger     = createMockLogger(null, null, null, null, null, removeSpy, null);
            var logger     = new Logger({
                request: {
                    context: {
                        progress_id: "progress_id"
                    }
                }
            });
            var stepLogger = logger.create("step1");
            expect(stepLogger).to.exist; // jshint ignore:line
            expect(stepLogger.write).to.exist; // jshint ignore:line
            expect(stepLogger.debug).to.exist; // jshint ignore:line
            expect(stepLogger.warning).to.exist; // jshint ignore:line
            expect(stepLogger.info).to.exist; // jshint ignore:line
            expect(stepLogger.error).to.exist; // jshint ignore:line
            expect(stepLogger.finish).to.exist; // jshint ignore:line
            expect(removeSpy).to.not.have.been.called; // jshint ignore:line
        });

        it('2.2 creating the same step twice should not listen on the progress top-level status again', function () {
            var Logger     = createMockLogger(null, null, null, null, null, null, null);
            var logger     = new Logger({
                request: {
                    context: {
                        progress_id: "progress_id"
                    }
                }
            });
            var stepLogger = logger.create("step1");
            expect(stepLogger).to.exist; // jshint ignore:line
            expect(stepLogger.write).to.exist; // jshint ignore:line
            expect(stepLogger.debug).to.exist; // jshint ignore:line
            expect(stepLogger.warning).to.exist; // jshint ignore:line
            expect(stepLogger.info).to.exist; // jshint ignore:line
            expect(stepLogger.error).to.exist; // jshint ignore:line
            expect(stepLogger.finish).to.exist; // jshint ignore:line
            logger.create("step1");
        });

        it('2.3 creating the same step twice should not listen on the progress top-level status again', function () {
            var Logger     = createMockLogger(null, null, null, null, null, null, null);
            var logger     = new Logger({
                request: {
                    context: {
                        progress_id: "progress_id"
                    }
                }
            });
            var stepLogger = logger.create("step1");
            expect(stepLogger).to.exist; // jshint ignore:line
            expect(stepLogger.write).to.exist; // jshint ignore:line
            expect(stepLogger.debug).to.exist; // jshint ignore:line
            expect(stepLogger.warning).to.exist; // jshint ignore:line
            expect(stepLogger.info).to.exist; // jshint ignore:line
            expect(stepLogger.error).to.exist; // jshint ignore:line
            expect(stepLogger.finish).to.exist; // jshint ignore:line
            logger.create("step1");
        });

    });

    describe('3 receive a change in top level progress status', function(){

        it('3.1 receive change in top level status to terminating should remove listener and finish existing running step', function(done){
            var offSpy = sinon.spy(function(type){
                expect(type).to.equal("value");
            });
            var setSpy = sinon.spy(function(value){
               expect(value).to.exist; // jshint ignore:line
            });
            var updateSpy = sinon.spy(function(value){
                expect(value).to.exist; // jshint ignore:line
            });

            var onSpy = sinon.spy(function(type, callback){
                setTimeout(function(){
                    callback({val: function(){return "terminating";}});
                    expect(offSpy).to.have.been.calledOnce; // jshint ignore:line
                    expect(setSpy).to.have.been.calledOnce; // jshint ignore:line
                    expect(updateSpy).to.have.been.calledOnce; // jshint ignore:line
                    done();
                }, 1);
            });

            var Logger     = createMockLogger(null, null, setSpy, null, onSpy, null, offSpy, updateSpy);
            var logger     = new Logger({
                request: {
                    context: {
                        progress_id: "progress_id"
                    }
                }
            });
            logger.create("step1");

        });

        it('3.2 receive change in top level status to terminated should remove listener but not finish the still running step', function(done){
            var offSpy = sinon.spy(function(type){
                expect(type).to.equal("value");
            });
            var setSpy = sinon.spy(function(value){
                expect(value).to.exist; // jshint ignore:line
            });

            var onSpy = sinon.spy(function(type, callback){
                setTimeout(function(){
                    callback({val: function(){return "terminated";}});
                    expect(offSpy).to.have.been.calledOnce; // jshint ignore:line
                    expect(setSpy).to.not.have.been.called; // jshint ignore:line
                    done();
                }, 1);
            });

            var Logger     = createMockLogger(null, null, setSpy, null, onSpy, null, offSpy);
            var logger     = new Logger({
                request: {
                    context: {
                        progress_id: "progress_id"
                    }
                }
            });
            logger.create("step1");

        });

        it('3.3 receive change in top level status to success should remove listener but not finish the still running step', function(done){
            var offSpy = sinon.spy(function(type){
                expect(type).to.equal("value");
            });
            var setSpy = sinon.spy(function(value){
                expect(value).to.exist; // jshint ignore:line
            });

            var onSpy = sinon.spy(function(type, callback){
                setTimeout(function(){
                    callback({val: function(){return "success";}});
                    expect(offSpy).to.have.been.calledOnce; // jshint ignore:line
                    expect(setSpy).to.not.have.been.called; // jshint ignore:line
                    done();
                }, 1);
            });

            var Logger     = createMockLogger(null, null, setSpy, null, onSpy, null, offSpy);
            var logger     = new Logger({
                request: {
                    context: {
                        progress_id: "progress_id"
                    }
                }
            });
            logger.create("step1");

        });

        it('3.4 receive change in top level status to error should remove listener but not finish the still running step', function(done){
            var offSpy = sinon.spy(function(type){
                expect(type).to.equal("value");
            });
            var setSpy = sinon.spy(function(value){
                expect(value).to.exist; // jshint ignore:line
            });

            var onSpy = sinon.spy(function(type, callback){
                setTimeout(function(){
                    callback({val: function(){return "error";}});
                    expect(offSpy).to.have.been.calledOnce; // jshint ignore:line
                    expect(setSpy).to.not.have.been.called; // jshint ignore:line
                    done();
                }, 1);
            });

            var Logger     = createMockLogger(null, null, setSpy, null, onSpy, null, offSpy);
            var logger     = new Logger({
                request: {
                    context: {
                        progress_id: "progress_id"
                    }
                }
            });
            logger.create("step1");

        });

    });

    describe('4 trigger step handlers', function(){

        it('4.1 trigger write handler', function(){

            var Logger     = createMockLogger();
            var logger     = new Logger({
                request: {
                    context: {
                        progress_id: "progress_id"
                    }
                }
            });
            var stepLogger = logger.create("step1");
            stepLogger.write("write message");

        });

        it('4.2 trigger debug handler', function(){

            var Logger     = createMockLogger();
            var logger     = new Logger({
                request: {
                    context: {
                        progress_id: "progress_id"
                    }
                }
            });
            var stepLogger = logger.create("step1");
            stepLogger.debug("debug message");

        });

        it('4.3 trigger warning handler', function(){

            var Logger     = createMockLogger();
            var logger     = new Logger({
                request: {
                    context: {
                        progress_id: "progress_id"
                    }
                }
            });
            var stepLogger = logger.create("step1");
            stepLogger.warning("warning message");

        });

        it('4.4 trigger info handler', function(){

            var Logger     = createMockLogger();
            var logger     = new Logger({
                request: {
                    context: {
                        progress_id: "progress_id"
                    }
                }
            });
            var stepLogger = logger.create("step1");
            stepLogger.info("info message");

        });

        it('4.5 trigger error handler', function(){

            var Logger     = createMockLogger();
            var logger     = new Logger({
                request: {
                    context: {
                        progress_id: "progress_id"
                    }
                }
            });
            var stepLogger = logger.create("step1");
            stepLogger.error("error message");

        });

        it('4.6 trigger finish handler without error', function(){

            var Logger     = createMockLogger();
            var logger     = new Logger({
                request: {
                    context: {
                        progress_id: "progress_id"
                    }
                }
            });
            var stepLogger = logger.create("step1");
            stepLogger.finish();

        });

        it('4.7 trigger finish handler with error', function(){

            var Logger     = createMockLogger();
            var logger     = new Logger({
                request: {
                    context: {
                        progress_id: "progress_id"
                    }
                }
            });
            var stepLogger = logger.create("step1");
            stepLogger.finish(new Error("step error"));

        });


    });


});
