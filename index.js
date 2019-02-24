module.exports = {
  analysisUtils : require('./analysisUtils/analysis-utils'),
  TaskLogger: require('./taskLogger/taskLoggerFactory'),
  StepLogger: require('./taskLogger/stepLoggerFactory'),
  TYPES: require('./taskLogger/enums').TYPES,
};
