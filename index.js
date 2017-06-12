if (process.env.ENABLE_LOGS_STREAMER) {
  module.exports = {
    analysisUtils : require('./analysisUtils/analysis-utils'),
    TaskLogger: require('./taskLogger/logsStreamerTaskLogger')
  };
}
else {
  module.exports = {
    analysisUtils : require('./analysisUtils/analysis-utils'),
    TaskLogger: require('./taskLogger/taskLogger')
  };
}
