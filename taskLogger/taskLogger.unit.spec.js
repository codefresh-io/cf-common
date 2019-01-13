var _ = require('lodash');
var proxyquire = require('proxyquire').noCallThru();
var Q          = require('q');
var chai       = require('chai');
var expect     = chai.expect;
var sinon      = require('sinon');
var sinonChai  = require('sinon-chai');
chai.use(sinonChai);

describe('taskLogger tests', function () {

    var createMockFirebase = function ({childSpy, setSpy, pushSpy, onSpy, removeSpy, offSpy, updateSpy, toStringSpy, onceSpy} = {}) {
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
                once: onceSpy || function () {
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
                },
                toString: toStringSpy || function () {
                    return 'http://firebase.com/ref';
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
                var logger = new Logger("progress_id", "firebaseUrl", Firebase);
                expect(logger).to.exist; // jshint ignore:line
                expect(logger.create).to.exist; // jshint ignore:line
                expect(logger.finish).to.exist; // jshint ignore:line
            });

            it('1.1.2 create a new logger, a step and finish it', function () {
                var Firebase = createMockFirebase();
                var Logger = createMockLogger();
                var logger = new Logger("progress_id", "firebaseUrl", Firebase);
                logger.create("Step1");
                logger.finish();
            });

            it('1.1.3 create a new logger with a reference to a previous step defined in a different instance', function () {
                var Firebase = createMockFirebase();
                var Logger = createMockLogger();
                var logger = new Logger("progress_id", "firebaseUrl", Firebase);
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
                    var logger = new Logger(null, "firebaseUrl", Firebase); // jshint ignore:line
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
                    var logger = new Logger("progress_id", null, Firebase); // jshint ignore:line
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
                    var logger = new Logger("progress_id", "baseurl", null); // jshint ignore:line
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
            var Firebase = createMockFirebase({removeSpy});
            var Logger     = createMockLogger(null);
            var logger = new Logger("progress_id", "firebaseUrl", Firebase);
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
            var logger = new Logger("progress_id", "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            expect(stepLogger).to.exist; // jshint ignore:line
            expect(stepLogger.write).to.exist; // jshint ignore:line
            expect(stepLogger.debug).to.exist; // jshint ignore:line
            expect(stepLogger.warn).to.exist; // jshint ignore:line
            expect(stepLogger.info).to.exist; // jshint ignore:line
            expect(stepLogger.finish).to.exist; // jshint ignore:line
            logger.create("step1");
        });

        it('2.3 create a new step should emit an event "step-pushed" once it arrived to firebase', function (done) {
            var onSpy = sinon.spy(function(event, callback){
                callback({
                    val: function(){
                        return {
                            name: "step1"
                        };
                    }
                });
            });
            var Firebase = createMockFirebase({onSpy});
            var Logger     = createMockLogger(null);
            var logger = new Logger("progress_id", "firebaseUrl", Firebase);
            logger.on("step-pushed", function(){
                done();
            });
            logger.create("step1");
        });

        it('2.4 should send to the workflow event uri an event with the new step', function (done) {

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

            var Firebase = createMockFirebase({onSpy});
            var Logger   = proxyquire('./taskLogger', {
                'request-promise': eventSpy
            });

            var logger   = new Logger("progress_id", "firebaseUrl", Firebase);
            logger.on("step-pushed", function () {
                setTimeout(() => {
                    expect(eventSpy).to.have.been.calledOnce; // jshint ignore:line
                    done();
                }, 10);
            });
            logger.create("step1", {
                token: 'token',
                url: 'url'
            });
        });

    });

    describe('3 trigger step handlers', function(){

        it('3.1 trigger write handler', function(){

            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            stepLogger.write("write message");

        });

        it('3.2 trigger debug handler', function(){

            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            stepLogger.debug("debug message");

        });

        it('3.3 trigger warn handler', function(){

            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            stepLogger.warn("warn message");

        });

        it('3.4 trigger info handler', function(){

            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            stepLogger.info("info message");

        });

        it('3.5 trigger finish handler without error', function(){

            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            stepLogger.finish();

        });

        it('3.6 trigger finish handler with error', function(){

            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            stepLogger.finish(new Error("step error"));

        });

        it('3.7 trigger finish handler with error on step with termination status', function(){

            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            stepLogger.start();
            stepLogger.markTerminating();
            stepLogger.finish(new Error("step error"));
            expect(stepLogger.getStatus()).to.equal('terminated'); 

        });


        it('3.8 trigger warn handler and finish', function(){

            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            stepLogger.warn("warn message");
            stepLogger.finish();

        });

        it('3.9 trigger getReference handler', function(){

            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            stepLogger.getReference();
        });

        it('3.10 trigger getLogsReference handler', function(){

            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            stepLogger.getLogsReference();
        });

        it('3.11 trigger getLastUpdateReference handler', function(){

            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            stepLogger.getLastUpdateReference();
        });

        it('3.12 trigger start handler', function(){

            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            expect(stepLogger.getStatus()).to.equal('pending');
            stepLogger.start();
            expect(stepLogger.getStatus()).to.equal('running');
        });

        it('3.13 trigger markPreviouslyExecuted handler', function(){
            var childSpy = sinon.spy(function () {
                return this;
            });
            var Firebase = createMockFirebase({childSpy});
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            stepLogger.markPreviouslyExecuted();
            expect(childSpy).to.have.been.calledWith('previouslyExecuted') // jshint ignore:line
        });

        it('3.14 trigger getMetricsLogsReference handler', function(){

            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            stepLogger.getMetricsLogsReference();
        });
        it('3.15 trigger markTerminating handler', function() {
            var childSpy = sinon.spy(function () {
                return this;
            });
            var Firebase = createMockFirebase({childSpy});
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", "firebaseUrl", Firebase);
            var stepLogger = logger.create("step1");
            stepLogger.start();
            stepLogger.markTerminating();
            expect(stepLogger.getStatus()).to.equal('terminating'); 
            expect(childSpy).to.have.been.calledWith('status');

        });

    });

    describe('4 using handlers after step was finished', function(){

        it('4.1 should emit an error when triggering write handler after step has finished', function(done){
            var Firebase = createMockFirebase();
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", "firebaseUrl", Firebase);
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
            var logger = new Logger("progress_id", "firebaseUrl", Firebase);
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
            var logger = new Logger("progress_id", "firebaseUrl", Firebase);
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
            var logger = new Logger("progress_id", "firebaseUrl", Firebase);
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
            var logger = new Logger("progress_id", "firebaseUrl", Firebase);
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
            var logger = new Logger("progress_id", "firebaseUrl", Firebase);
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
                var Firebase = createMockFirebase({childSpy});
                var Logger = createMockLogger();
                var logger = new Logger("progress_id", "firebaseUrl", Firebase);
                var stepLogger = logger.create("new step");
                stepLogger.start();
                logger.fatalError(new Error("fatal error"));
                stepLogger.write("hey");
                stepLogger.getReference();
                expect(childSpy.callCount).to.equal(5); // jshint ignore:line
            });

            it('5.1.2 should call last step finish in case a step was created before', function(){
                var childSpy = sinon.spy(function () {
                    return this;
                });
                var Firebase = createMockFirebase({childSpy});
                var Logger = createMockLogger();
                var logger = new Logger("progress_id", "firebaseUrl", Firebase);
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
                var Firebase = createMockFirebase({childSpy});
                var Logger = createMockLogger();
                var logger = new Logger("progress_id", "firebaseUrl", Firebase);
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

    describe('6 updateCurrentStepReferences', function () {

        it('should update correct structure in case of one step', function (done) {
            const setSpy = sinon.spy((value) => {
                try {
                    expect(value).to.deep.equal({
                        "ref": "step1"
                    });
                    done();
                } catch (err) {
                    done(err);
                }
            });

            const onSpy = sinon.spy((value, callback) => {
                callback({
                    val: () => {
                        return {
                            name: 'step1'
                        };
                    }
                });
            });
            var Firebase = createMockFirebase({setSpy, onSpy});
            var Logger     = createMockLogger();
            var logger = new Logger("progress_id", "firebaseUrl", Firebase);
            logger.create('step1');
        });

    });

    describe('7 restoreExistingSteps', function () {

        describe('positive', function () {
            it('should not create any steps in case of a missing stepsReferences object', function () {
                const onceSpy = sinon.spy((val, callback) => {
                    callback({
                        val: () => {
                            return undefined;
                        }
                    });
                });
                var Firebase = createMockFirebase({
                    onceSpy
                });
                var Logger     = createMockLogger();
                var logger = new Logger("progress_id", "firebaseUrl", Firebase);
                return logger.restoreExistingSteps()
                    .then(() => {
                        expect(logger.steps).to.deep.equal({});
                    });
            });

            it('should not create any steps in case of non previous existing steps', function () {
                const onceSpy = sinon.spy((val, callback) => {
                    callback({
                        val: () => {
                            return {};
                        }
                    });
                });
                var Firebase = createMockFirebase({
                    onceSpy
                });
                var Logger     = createMockLogger();
                var logger = new Logger("progress_id", "firebaseUrl", Firebase);
                return logger.restoreExistingSteps()
                    .then(() => {
                        expect(logger.steps).to.deep.equal({});
                    });
            });

            it('should restore 2 steps', function () {
                let it = 1;
                const responses = {
                    first: {
                        'ref1': 'step1',
                        'ref2': 'step2'
                    },
                    second: 'value'
                };
                let currentResponse = responses.first;
                const onceSpy = sinon.spy((val, callback) => {
                    callback({
                        val: () => {
                            const response = currentResponse;
                            currentResponse = responses.second + it;
                            it++;
                            return response;
                        }
                    });
                });
                var Firebase = createMockFirebase({
                    onceSpy
                });
                var Logger     = createMockLogger();
                var logger = new Logger("progress_id", "firebaseUrl", Firebase);
                return logger.restoreExistingSteps()
                    .then(() => {
                        _.forEach(logger.steps, (step) => {
                            delete step.firebaseRef;
                        });
                        expect(logger.steps).to.deep.equal({
                            "value1": {
                                "logs": {},
                                "name": "value1",
                                "status": "value2",
                            },
                            "value3": {
                                "logs": {},
                                "name": "value3",
                                "status": "value4"
                            }
                        });
                    });
            });
        });

        describe('negative', function () {
            it('should reject in case of not responding in 5 seconds', function () {
                this.timeout(6000);
                var Firebase = createMockFirebase();
                var Logger     = createMockLogger();
                var logger = new Logger("progress_id", "firebaseUrl", Firebase);
                return logger.restoreExistingSteps()
                    .then(() => {
                        throw new Error('should have failed');
                    }, (err) => {
                        expect(err.toString()).to.contain('Failed to restore steps metadata from Firebase');
                    });
            });
        });

    });

    describe('8 updateMetrics', function () {

        describe('8.1 updateStepMetrics', function () {

            it('8.1.1 update memory usage', function(){
                var childSpy = sinon.spy(function () {
                    return this;
                });
                var Firebase = createMockFirebase({childSpy});
                var Logger     = createMockLogger();
                var logger = new Logger("progress_id", "firebaseUrl", Firebase);
                var stepLogger = logger.create("step1");
                stepLogger.updateMemoryUsage(0,0);
                expect(childSpy).to.have.been.calledWith('metrics'); // jshint ignore:line
                expect(childSpy).to.have.been.calledWith('memory'); // jshint ignore:line
            });

            it('8.1.2 update cpu usage', function(){
                var childSpy = sinon.spy(function () {
                    return this;
                });
                var Firebase = createMockFirebase({childSpy});
                var Logger     = createMockLogger();
                var logger = new Logger("progress_id", "firebaseUrl", Firebase);
                var stepLogger = logger.create("step1");
                stepLogger.updateCpuUsage(0,0);
                expect(childSpy).to.have.been.calledWith('metrics'); // jshint ignore:line
                expect(childSpy).to.have.been.calledWith('cpu'); // jshint ignore:line
            });
        });

        describe('8.2 updateTaskMetrics', function () {

            it('8.2.1 update total memory usage', function(){
                var childSpy = sinon.spy(function () {
                    return this;
                });
                var Firebase = createMockFirebase({childSpy});
                var Logger     = createMockLogger();
                var logger = new Logger("progress_id", "firebaseUrl", Firebase);
                logger.updateMemoryUsage(0,0);
                expect(childSpy).to.have.been.calledWith('metrics'); // jshint ignore:line
                expect(childSpy).to.have.been.calledWith('memory'); // jshint ignore:line
            });


            it('8.2.2 set total memory limit', function(){
                var childSpy = sinon.spy(function () {
                    return this;
                });
                var Firebase = createMockFirebase({childSpy});
                var Logger     = createMockLogger();
                var logger = new Logger("progress_id", "firebaseUrl", Firebase);
                logger.setMemoryLimit('2000Mi');
                expect(childSpy).to.have.been.calledWith('metrics'); // jshint ignore:line
                expect(childSpy).to.have.been.calledWith('memory'); // jshint ignore:line
                expect(childSpy).to.have.been.calledWith('limits'); // jshint ignore:line
            });

        });
    });
});
