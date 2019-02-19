module.exports = {
    analysisUtils: require('./analysisUtils/analysis-utils'),
    createTaskLogger: require('./taskLogger/taskLogger').factory,
    createStepLogger: require('./taskLogger/StepLogger').factory
};
