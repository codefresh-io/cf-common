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
            'request-promise': function () {
                return requestSpy || Q.resolve();
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

            it('1.1.3 create a new logger with a reference to a previous step defined in a different instance', function () {
                var Firebase = createMockFirebase();
                var Logger = createMockLogger();
                var logger = new Logger("progress_id", null, "firebaseUrl", Firebase, {servers: ['address']}, "previousStepReference");
                expect(logger).to.exist; // jshint ignore:line
                expect(logger.create).to.exist; // jshint ignore:line
                expect(logger.finish).to.exist; // jshint ignore:line
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
            expect(stepLogger.warn).to.exist; // jshint ignore:line
            expect(stepLogger.info).to.exist; // jshint ignore:line
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
            expect(stepLogger.warn).to.exist; // jshint ignore:line
            expect(stepLogger.info).to.exist; // jshint ignore:line
            expect(stepLogger.finish).to.exist; // jshint ignore:line
            logger.create("step1");
        });

        it('2.3 creating a new step when firstStepCreationTIme was passed should put this time on the first step creationTimeStamp but not on the second', function (done) {
            var firstStepCreationTime = new Date().getTime();
            var pushSpy = sinon.spy(function(step){
                if (step.name === "step1"){
                    expect(step.creationTimeStamp).to.equal(firstStepCreationTime);
                    return createMockFirebase()();
                }
                else if (step.name === "step2"){
                    expect(step.creationTimeStamp).to.not.equal(firstStepCreationTime);
                    var onHandler = function(){
                        done();
                    };
                    return createMockFirebase(null, null, null, onHandler)();
                }
                else {
                    done(new Error("should not reach here"));
                }
            });
            var Firebase = createMockFirebase(null, null, pushSpy, null, null, null);
            var Logger     = createMockLogger(null);
            var logger = new Logger("progress_id", firstStepCreationTime, "firebaseUrl", Firebase);
            logger.create("step1");
            logger.create("step2");
        });

        it('2.4 create a new step should emit an event "step-pushed" once it arrived to firebase', function (done) {
            var onSpy = sinon.spy(function(event, callback){
                callback({
                    val: function(){
                        return {
                            name: "step1"
                        };
                    }
                });
            });
            var Firebase = createMockFirebase(null, null, null, onSpy);
            var Logger     = createMockLogger(null);
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase);
            logger.on("step-pushed", function(){
                done();
            });
            logger.create("step1");
        });

        it('2.5 should send to the workflow event uri an event with the new step', function (done) {

            var onSpy    = sinon.spy(function (event, callback) {
                callback({
                    val: function () {
                        return {
                            name: "step1"
                        };
                    }
                });
            });

            var eventSpy = sinon.spy((context) => {
                expect(context).to.deep.equal({
                    "body": {
                        "action": "new-progress-step",
                        "name": "step1"
                    },
                    "headers": {
                        "x-access-token": "token"
                    },
                    "json": true,
                    "method": "POST",
                    "uri": "url"
                });
                return Q.resolve();
            });

            var Firebase = createMockFirebase(null, null, null, onSpy);
            var Logger   = proxyquire('./taskLogger', {
                'request-promise': eventSpy
            });

            var logger   = new Logger("progress_id", null, "firebaseUrl", Firebase);
            logger.on("step-pushed", function () {
                setTimeout(() => {
                    expect(eventSpy).to.have.been.calledOnce; // jshint ignore:line
                    done();
                }, 10);
            });
            logger.create("step1", null, {
                token: 'token',
                url: 'url'
            });
        });

    });

    describe('3 trigger step handlers', function(){

        it('3.1 trigger write handler', function(){

            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            stepLogger.write("write message");

        });

        it('3.2 trigger debug handler', function(){

            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            stepLogger.debug("debug message");

        });

        it('3.3 trigger warn handler', function(){

            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            stepLogger.warn("warn message");

        });

        it('3.4 trigger info handler', function(){

            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            stepLogger.info("info message");

        });

        it('3.5 trigger finish handler without error', function(){

            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            stepLogger.finish();

        });

        it('3.6 trigger finish handler with error', function(){

            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            stepLogger.finish(new Error("step error"));

        });

        it('3.7 trigger warn handler and finish', function(){

            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            stepLogger.warn("warn message");
            stepLogger.finish();

        });

        it('3.8 trigger getReference handler', function(){

            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            stepLogger.getReference();
        });

        it('3.9 trigger getLogsReference handler', function(){

            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            stepLogger.getLogsReference();
        });

        it('3.10 trigger getLastUpdateReference handler', function(){

            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            stepLogger.getLastUpdateReference();
        });

        it('3.11 trigger start handler', function(){

            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            expect(stepLogger.getStatus()).to.equal('pending');
            stepLogger.start();
            expect(stepLogger.getStatus()).to.equal('running');
        });

    });

    describe('4 using handlers after step was finished', function(){

        it('4.1 should emit an error when triggering write handler after step has finished', function(done){
            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            stepLogger.start();
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
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            stepLogger.start();
            logger.on("error", function(err){
                expect(err.toString()).to.contain("was triggered after the job finished");
                done();
            });
            stepLogger.finish();
            stepLogger.debug("not good!");
        });

        it('4.3 should emit an error when triggering warn handler after step has finished', function(done){
            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            stepLogger.start();
            logger.on("error", function(err){
                expect(err.toString()).to.contain("was triggered after the job finished");
                done();
            });
            stepLogger.finish();
            stepLogger.warn("not good!");
        });

        it('4.4 should emit an error when triggering info handler after step has finished', function(done){
            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            stepLogger.start();
            logger.on("error", function(err){
                expect(err.toString()).to.contain("was triggered after the job finished");
                done();
            });
            stepLogger.finish();
            stepLogger.info("not good!");
        });

        it('4.5 should emit an error when triggering finish handler after step has finished', function(done){
            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            stepLogger.start();
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
            var logger = new Logger("progress_id", null, "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            stepLogger.start();
            logger.on("error", function(err){
                expect(err.toString()).to.contain("was triggered after the job finished");
                expect(err.toString()).to.not.contain("with err");
                done();
            });
            stepLogger.finish();
            stepLogger.finish();
        });
    });

    describe('5 fatalError', function() {

        describe('potisive', function(){

            it('5.1.1 should not enable creating an additional step once fatal error was called', function(){
                var childSpy = sinon.spy(function () {
                    return this;
                });
                var Firebase = createMockFirebase(childSpy);
                var Logger = createMockLogger();
                var logger = new Logger("progress_id", null, "firebaseUrl", Firebase);
                var stepLogger = logger.create("new step");
                stepLogger.start();
                logger.fatalError(new Error("fatal error"));
                stepLogger.write("hey");
                stepLogger.getReference();
                expect(childSpy.callCount).to.equal(4); // jshint ignore:line
            });

            it('5.1.2 should call last step finish in case a step was created before', function(){
                var childSpy = sinon.spy(function () {
                    return this;
                });
                var Firebase = createMockFirebase(childSpy);
                var Logger = createMockLogger();
                var logger = new Logger("progress_id", null, "firebaseUrl", Firebase);
                var stepLogger = logger.create("new step");
                stepLogger.start();
                stepLogger.finish = sinon.spy();
                logger.fatalError(new Error("fatal error"));
                expect(stepLogger.finish).to.have.been.called; // jshint ignore:line
            });

        });

        describe('negative', function(){

            it('5.2.1 should fail if calling fatal error without an error', function(){
                var childSpy = sinon.spy(function () {
                    return this;
                });
                var Firebase = createMockFirebase(childSpy);
                var Logger = createMockLogger();
                var logger = new Logger("progress_id", null, "firebaseUrl", Firebase);
                try {
                    logger.fatalError();
                }
                catch(e){
                    expect(e.toString()).to.equal("Error: fatalError was called without an error. not valid.");
                    return;
                }
                throw new Error("should have failed");
            });

        });

    });

});
