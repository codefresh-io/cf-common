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

    attachContainer(container) {
        const writters = [];
        this.loggers.forEach(logger => {
            writters.push(logger.attachContainer(container));
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
    attachStep(step) {
        const writters = [];
        this.loggers.forEach(logger => {
            writters.push(logger.attachStep(step));
        });
        return this._wrapper(writters);
        
    }
    _wrapper(writters) {
        return {
            push: (obj) => {
                writters.forEach(writter => writter.push(obj));
            },
            child: (name) => {
                const newWritters=[];
                writters.forEach(writter => newWritters.push(writter.child(name)));
                return this._wrapper(newWritters);
            },
            update: (value) => {
                writters.forEach(writter => writter.update(value));
            }
        }
    }
}
module.exports = LoggerComposition;