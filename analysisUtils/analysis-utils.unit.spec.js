var proxyquire = require('proxyquire').noCallThru(); // jshint ignore:line
var Q          = require('q'); // jshint ignore:line
var chai       = require('chai');
var expect     = chai.expect;
var sinonChai  = require('sinon-chai');
chai.use(sinonChai);
var analyze    = require('../index').analysisUtils;

describe('prepareHashInfo', function () {

    describe('positive', function () {

        it('providing a valid branch name (in terms of docker image tag conventions) should keep it as original', function () {

            var settings = {
                dockerFileContents: "FROM jim/bob:version",
                test_sh: "test",
                deploy_sh: "deploy",
                userDockerFileFromRepo: true,
                imageName: "repoOwner/repoName"
            };

            return analyze.prepareHashInfo("owner", "name", "branch", "sha123", settings, "userId")
                .then(function (res) {
                    var expectedRes = {
                        repo: {
                            hash: 'ae375201fa5b6b5ed3ff5bd9dc38df07cbd79992',
                            repo: 'repoowner/reponame',
                            tag: 'branch',
                            imageName: 'repoowner/reponame:branch'
                        },
                        revision: {
                            hash: 'ae375201fa5b6b5ed3ff5bd9dc38df07cbd79992',
                            repo: 'repoowner/reponame',
                            tag: 'ae375201fa5b6b5ed3ff5bd9dc38df07cbd79992',
                            imageName: 'repoowner/reponame:ae375201fa5b6b5ed3ff5bd9dc38df07cbd79992'
                        },
                        userSpecificFull: {
                            hash: 'ae375201fa5b6b5ed3ff5bd9dc38df07cbd79992',
                            repo: 'repoowner/reponame',
                            tag: 'ae375201fa5b6b5ed3ff5bd9dc38df07cbd79992-userId',
                            userId: 'userId',
                            imageName: 'repoowner/reponame:ae375201fa5b6b5ed3ff5bd9dc38df07cbd79992-userId'
                        },
                        "userSpecificCi": {
                            "hash": "ae375201fa5b6b5ed3ff5bd9dc38df07cbd79992",
                            "imageName": "repoowner/reponame:ae375201fa5b6b5ed3ff5bd9dc38df07cbd79992-CI-userId",
                            "repo": "repoowner/reponame",
                            "tag": "ae375201fa5b6b5ed3ff5bd9dc38df07cbd79992-CI-userId",
                            "userId": "userId"
                        },
                        dockerFileContents: 'FROM jim/bob:version',
                        test_sh: "test",
                        integ_sh: '',
                        deploy_sh: 'deploy'
                    };

                    expect(res).to.deep.equal(expectedRes);
                });

        });

        it('providing a non-valid branch name (in terms of docker image tag conventions) should remove all non valid chars', function () {

            return analyze.prepareHashInfo("owner", "name", "*branch", "sha123", {}, "userId")
                .then(function (res) {
                    expect(res.repo.tag).to.equal("branch");
                });

        });

        it('providing a non-valid branch name (in terms of docker image tag conventions) should remove all non valid chars', function () {

            return analyze.prepareHashInfo("owner", "name", ".branch", "sha123", {}, "userId")
                .then(function (res) {
                    expect(res.repo.tag).to.equal("branch");
                });
        });

        it('providing a non-valid branch name (in terms of docker image tag conventions) should remove all non valid chars', function () {

            return analyze.prepareHashInfo("owner", "name", "..branch", "sha123", {}, "userId")
                .then(function (res) {
                    expect(res.repo.tag).to.equal("branch");
                });
        });

        it('providing a non-valid branch name (in terms of docker image tag conventions) should remove all non valid chars', function () {

            return analyze.prepareHashInfo("owner", "name", ".a.branch", "sha123", {}, "userId")
                .then(function (res) {
                    expect(res.repo.tag).to.equal("a.branch");
                });
        });

        it('providing a non-valid branch name (in terms of docker image tag conventions) should remove all non valid chars', function () {

            return analyze.prepareHashInfo("owner", "name", "b&ranch", "sha123", {}, "userId")
                .then(function (res) {
                    expect(res.repo.tag).to.equal("branch");
                });

        });

        it('providing a non-valid branch name (in terms of docker image tag conventions) should remove all non valid chars', function () {

            return analyze.prepareHashInfo("owner", "name", "-b&ranch", "sha123", {}, "userId")
                .then(function (res) {
                    expect(res.repo.tag).to.equal("branch");
                });
        });

        it('providing a non-valid branch name (in terms of docker image tag conventions) should remove all non valid chars', function () {

            return analyze.prepareHashInfo("owner", "name", "b&ranch*", "sha123", {}, "userId")
                .then(function (res) {
                    expect(res.repo.tag).to.equal("branch");
                });

        });

        it('providing a non-valid branch name (in terms of docker image tag conventions) should remove all non valid chars', function () {

            return analyze.prepareHashInfo("owner", "name", "&&", "sha123", {}, "userId")
                .then(function (res) {
                    expect(res.repo.tag).to.equal("");
                });

        });

        it('should replace unsupported chars in image name', function () {

            return analyze.prepareHashInfo("infra - structure", "test", "branch", "sha123", {}, "userId")
                .then(function (res) {
                    expect(res.repo.imageName).to.equal("infrastructure/test:branch");
                });

        });

    });

});