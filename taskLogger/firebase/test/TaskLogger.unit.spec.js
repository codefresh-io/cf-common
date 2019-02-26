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
