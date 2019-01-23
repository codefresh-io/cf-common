
const firebaseLogger = require('./firebaseLogger');
const redisLogger = require('./redisLogger');
const LoggerComposition = require('./loggerComposition');

class LoggerFactory {

    static getLogger(opts = {}) {
        switch (opts.type) {
            case 'firebase':
                return new firebaseLogger(opts);
            case 'redis': 
                return new redisLogger(opts);
            case 'composite':
                return new LoggerComposition([new firebaseLogger(opts), new redisLogger(opts)]);
            default:
                throw new Error(`${opts.key} is not implemented`);
        }
    }

}
module.exports = LoggerFactory;