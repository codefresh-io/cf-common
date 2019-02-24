const FirebaseTaskLogger = require('./firebase/FirebaseTaskLogger');

const factoryMap = {
    [FirebaseTaskLogger.TYPE]: FirebaseTaskLogger.factory
};

const factory = async (task, opts) => {
    const factory = factoryMap[opts.type];
    if (!factory) {
        throw new Error(`type: ${opts.type} is not supported`);
    }

    return factory(task, opts);
};

module.exports = factory;
