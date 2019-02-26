const sinon      = require('sinon');

const createFirebaseStub = function () {
    const __authWithCustomTokenStub = sinon.stub().yields();
    const __pushSpy = sinon.spy();
    const __setSpy = sinon.spy();

    const Firebase = function(path) {
        this.path = path;

        this.authWithCustomToken = __authWithCustomTokenStub;
        this.push = __pushSpy;
        this.set = __setSpy;
        this.child = function (path) {
            return new Firebase(`${this.path}/${path}`);
        };
    };

    Firebase.__authWithCustomTokenStub = __authWithCustomTokenStub;
    Firebase.__pushSpy = __pushSpy;
    Firebase.__setSpy = __setSpy;

    return Firebase;
};

module.exports = createFirebaseStub;
