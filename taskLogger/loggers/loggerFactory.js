
const firebaseLogger = require('./firebaseLogger');
const redisLogger = require('./redisLogger');
const LoggerComposition = require('./loggerComposition');
const RedisPubDecorator = require('./redisPubDecorator');

class LoggerFactory {

    static getLogger(opts = {}) {
        switch (opts.type) {
            case 'firebase':
                return  new firebaseLogger(opts); 
            case 'redis': 
                return new RedisPubDecorator(opts, new redisLogger(opts)); //TODO: move to functional "withPubDecorator"
            case 'composite':
                return new LoggerComposition([new firebaseLogger(opts), new redisLogger(opts)]);
            default:
                throw new Error(`${opts.key} is not implemented`);
        }
    }

}
module.exports = LoggerFactory;