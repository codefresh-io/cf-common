const FirebaseStepLogger = require('./firebase/FirebaseStepLogger');

const factoryMap = {
    [FirebaseStepLogger.TYPE]: FirebaseStepLogger.factory
};

const factory = async (step, opts) => {
    const factory = factoryMap[opts.type];
    if (!factory) {
        throw new Error(`type: ${opts.type} is not supported`);
    }

    return factory(step, opts);
};

module.exports = factory;
