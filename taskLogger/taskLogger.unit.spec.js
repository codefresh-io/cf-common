var proxyquire = require('proxyquire').noCallThru();
var Q          = require('q');
var chai       = require('chai');
var expect     = chai.expect;
var sinon      = require('sinon');
var sinonChai  = require('sinon-chai');
chai.use(sinonChai);

describe('taskLogger tests', function () {

    var createMockFirebase = function (childSpy, setSpy, pushSpy, onSpy, removeSpy, offSpy, updateSpy) {
        var Firebase = function(){
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
        };
        return Firebase;
    };

    var createMockLogger = function (requestSpy) {
        var Logger = proxyquire('./taskLogger', {
            'cf-queue': function () {
                return {
                    request: requestSpy || function () {
                        return Q.resolve();
                    }
                };
            }
        });
        return Logger;
    };

    describe('1 create a new logger', function(){

        describe('positive', function(){

            it('1.1.1 create a new logger', function () {
                var Firebase = createMockFirebase();
                var Logger = createMockLogger();
                var logger = new Logger("progress_id", null, "firebaseUrl", Firebase, {servers: ['address']});
                expect(logger).to.exist; // jshint ignore:line
                expect(logger.create).to.exist; // jshint ignore:line
                expect(logger.finish).to.exist; // jshint ignore:line
            });

            it('1.1.2 create a new logger, a step and finish it', function () {
                var Firebase = createMockFirebase();
                var Logger = createMockLogger();
                var logger = new Logger("progress_id", null, "firebaseUrl", Firebase, {servers: ['address']});
                logger.create("Step1");
                logger.finish();
            });
        });

        describe('negative', function(){

            it('1.1.1 should fail when not providing jobId', function () {
                var Firebase = createMockFirebase();
                var Logger = createMockLogger();
                try{
                    var logger = new Logger(null, null, "firebaseUrl", Firebase, {servers: ['address']}); // jshint ignore:line
                }
                catch(e){
                    expect(e.toString()).to.contain("failed to create taskLogger because jobId must be provided");
                    return Q.resolve();
                }
                return Q.reject(new Error("should have failed"));
            });

            it('1.1.2 should fail when not providing basefirebaseUrl', function () {
                var Firebase = createMockFirebase();
                var Logger = createMockLogger();
                try{
                    var logger = new Logger("progress_id", null, null, Firebase, {servers: ['address']}); // jshint ignore:line
                }
                catch(e){
                    expect(e.toString()).to.contain("failed to create taskLogger because baseFirebaseUrl must be provided");
                    return Q.resolve();
                }
                return Q.reject(new Error("should have failed"));
            });

            it('1.1.3 should fail when not providing Firebase lib', function () {
                var Firebase = createMockFirebase();
                var Logger = createMockLogger();
                try{
                    var logger = new Logger("progress_id", null, "baseurl", null, {servers: ['address']}); // jshint ignore:line
                }
                catch(e){
                    expect(e.toString()).to.contain("failed to create taskLogger because Firebase lib reference must be provided");
                    return Q.resolve();
                }
                return Q.reject(new Error("should have failed"));
            });

            it('1.1.4 should fail when not providing Firebase lib', function () {
                var Firebase = createMockFirebase();
                var Logger = createMockLogger();
                try{
                    var logger = new Logger("progress_id", null, "baseurl", Firebase, null); // jshint ignore:line
                }
                catch(e){
                    expect(e.toString()).to.contain("failed to create taskLogger because queue configuration must be provided");
                    return Q.resolve();
                }
                return Q.reject(new Error("should have failed"));
            });

        });

    });

    describe('2 create a new step', function(){


        it('2.1 create a new step should return specific functions', function () {
            var removeSpy = sinon.spy(function(){
                return this;
            });
            var Firebase = createMockFirebase(null, null, null, null, removeSpy, null);
            var Logger     = createMockLogger(null);
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase, {servers: ['address']});
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
            var Firebase = createMockFirebase();
            var Logger     = createMockLogger(null);
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase, {servers: ['address']});
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
            var Firebase = createMockFirebase();
            var Logger     = createMockLogger(null, null, null, null, null, null, null);
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase, {servers: ['address']});
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

    describe('3 trigger step handlers', function(){

        it('3.1 trigger write handler', function(){

            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase, {servers: ['address']});
            var stepLogger = logger.create("step1");
            stepLogger.write("write message");

        });

        it('3.2 trigger debug handler', function(){

            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase, {servers: ['address']});
            var stepLogger = logger.create("step1");
            stepLogger.debug("debug message");

        });

        it('3.3 trigger warning handler', function(){

            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase, {servers: ['address']});
            var stepLogger = logger.create("step1");
            stepLogger.warning("warning message");

        });

        it('3.4 trigger info handler', function(){

            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase, {servers: ['address']});
            var stepLogger = logger.create("step1");
            stepLogger.info("info message");

        });

        it('3.5 trigger error handler', function(){

            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase, {servers: ['address']});
            var stepLogger = logger.create("step1");
            stepLogger.error("error message");

        });

        it('3.6 trigger finish handler without error', function(){

            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase, {servers: ['address']});
            var stepLogger = logger.create("step1");
            stepLogger.finish();

        });

        it('3.7 trigger finish handler with error', function(){

            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase, {servers: ['address']});
            var stepLogger = logger.create("step1");
            stepLogger.finish(new Error("step error"));

        });


    });

    describe('4 using handlers after step was finished', function(){

        it('4.1 should emit an error when triggering write handler after step has finished', function(done){
            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase, {servers: ['address']});
            var stepLogger = logger.create("step1");
            logger.on("error", function(err){
                expect(err.toString()).to.contain("was triggered after the job finished");
                done();
            });
            stepLogger.finish();
            stepLogger.write("not good!");
        });

        it('4.2 should emit an error when triggering debug handler after step has finished', function(done){
            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase, {servers: ['address']});
            var stepLogger = logger.create("step1");
            logger.on("error", function(err){
                expect(err.toString()).to.contain("was triggered after the job finished");
                done();
            });
            stepLogger.finish();
            stepLogger.debug("not good!");
        });

        it('4.3 should emit an error when triggering warning handler after step has finished', function(done){
            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase, {servers: ['address']});
            var stepLogger = logger.create("step1");
            logger.on("error", function(err){
                expect(err.toString()).to.contain("was triggered after the job finished");
                done();
            });
            stepLogger.finish();
            stepLogger.warning("not good!");
        });

        it('4.4 should emit an error when triggering info handler after step has finished', function(done){
            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase, {servers: ['address']});
            var stepLogger = logger.create("step1");
            logger.on("error", function(err){
                expect(err.toString()).to.contain("was triggered after the job finished");
                done();
            });
            stepLogger.finish();
            stepLogger.info("not good!");
        });

        it('4.5 should emit an error when triggering error handler after step has finished', function(done){
            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase, {servers: ['address']});
            var stepLogger = logger.create("step1");
            logger.on("error", function(err){
                expect(err.toString()).to.contain("was triggered after the job finished");
                done();
            });
            stepLogger.finish();
            stepLogger.error("not good!");
        });

        it('4.6 should emit an error when triggering finish handler after step has finished', function(done){
            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase, {servers: ['address']});
            var stepLogger = logger.create("step1");
            logger.on("error", function(err){
                expect(err.toString()).to.contain("was triggered after the job finished with err");
                done();
            });
            stepLogger.finish();
            stepLogger.finish("not good!");
        });


        it('4.7 should emit an error when triggering finish handler after step has finished', function(done){
            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase, {servers: ['address']});
            var stepLogger = logger.create("step1");
            logger.on("error", function(err){
                expect(err.toString()).to.contain("was triggered after the job finished");
                expect(err.toString()).to.not.contain("with err");
                done();
            });
            stepLogger.finish();
            stepLogger.finish();
        });

    });

});
