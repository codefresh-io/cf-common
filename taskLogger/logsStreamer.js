const http                = require('http');
const crypto              = require('crypto');

class LogsStreamer {
    constructor(jobId) {
        this.jobId = jobId;
        this.stepId = null;
        this.host = process.env.STREAMER_HOST || 'localhost';
        this.port = process.env.STREAMER_PORT || '8081';
        this.scheme = process.env.STREAMER_SCHEME || 'http';
        this.defaultOpts = {
            host: this.host,
            port: this.port,
            method: 'PUT',
            json: true,
            headers: {
              "Content-Type": "application/json"
            }
        };
    }

    genStepId(name) {
        return crypto.createHash('md5').update(name).digest('hex');
    };

    updateStep(step, callback) {
      this.stepId = step.id;
      this._httpWrite(step, {path: `/logdata/${this.jobId}/steps/${this.stepId}`}, callback);
    };

    updateMetadata(data) {
      this._httpWrite(data, {path: `/logdata/${this.jobId}`});
    };

    log(message) {
        var data = {
            ts: (new Date).getTime(),
            log: message
        };

        this._httpWrite(data, {path: `/logdata/${this.jobId}/steps/${this.stepId}/logs`, method: 'POST'});
    };

    getRef() {
      return `${this.scheme}://${this.host}:${this.port}/logdata/${this.jobId}`;

    }

    getLogRef() {
      return `${this.scheme}://${this.host}:${this.port}/logdata/${this.jobId}/steps/${this.stepId}/logs`;
    }

    _httpWrite(data, opts, callback=function() {}) {
        var payload = JSON.stringify(data);
        var req = http.request(Object.assign({}, this.defaultOpts, opts), callback);

        req.write(payload);
        req.end();
    };
}

module.exports = LogsStreamer;

