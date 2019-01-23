class LoggerComposition {
    constructor(loggers) {
        this.loggers = loggers;
    }
    validate() {
        this.loggers.forEach(logger => {
            logger.validate();
        });
    }
    start() {
        this.loggers.forEach(logger => {
            logger.start();
        });
    }

    attach(container) {
        const writters = [];
        this.loggers.forEach(logger => {
            writters.push(logger.attach(container));
        });
        return {

            push: (message) => {
                writters.forEach(writter => writter.push(message));
            },
            setLastUpdate: (date) => {
                writters.forEach(writter => writter.setLastUpdate(date));
            },
            updateMetric: (path, size) => {
                writters.forEach(writter => writter.updateMetric(path, size));
            }
        };
    }
}
module.exports = LoggerComposition;