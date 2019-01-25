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
        return this._wrapper(writters, this);

    }
    child(name) {

        const newWritters = [];
        this.loggers.forEach(writter => newWritters.push(writter.child(name)));
        return this._wrapper(newWritters, this);
    }
    _wrapper(writters, thisArg) {
        return {
            push: (obj) => {
                writters.forEach(writter => writter.push(obj));
            },
            child: (name) => {
                const newWritters = [];
                writters.forEach(writter => newWritters.push(writter.child(name)));
                return thisArg._wrapper(newWritters, thisArg);
            },
            update: (value) => {
                writters.forEach(writter => writter.update(value));
            },
            set: (value) => {
                writters.forEach(writter => writter.push(value));
            }
        }
    }
}
module.exports = LoggerComposition;