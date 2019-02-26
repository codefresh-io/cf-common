const FirebaseTaskLogger = require('./firebase/TaskLogger');

const factoryMap = {
    [FirebaseTaskLogger.TYPE]: FirebaseTaskLogger.factory
};

const factory = async (task, opts) => {
    const factory = factoryMap[opts.type];
    if (!factory) {
        throw new Error(`Failed to create TaskLogger. Type: ${opts.type} is not supported`);
    }

    return factory(task, opts);
};

module.exports = factory;
