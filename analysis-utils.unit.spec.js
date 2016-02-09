var proxyquire = require('proxyquire').noCallThru();
var Q          = require('q');
var chai       = require('chai');
var expect     = chai.expect;
var sinon      = require('sinon');
var sinonChai  = require('sinon-chai');
chai.use(sinonChai);
var analyze    = require('./index').analysisUtils;

describe('prepareHashInfo', function () {

    describe('positive', function () {

        it('providing a valid branch name (in terms of docker image tag conventions) should keep it as original', function () {

            var settings = {
                dockerFileContents: "FROM jim/bob:version",
                test_sh: "test",
                deploy_sh: "deploy",
                userDockerFileFromRepo: true
            };

            return analyze.prepareHashInfo("owner", "name", "branch", "sha123", settings, "userId")
                .then(function (res) {
                    var expectedRes = {
                        repo: {
                            hash: 'd4e10ca1cc63c86fc8dc63126ddf229b81237a26',
                            repo: 'owner/name',
                            tag: 'branch',
                            imageName: 'owner/name:branch'
                        },
                        revision: {
                            hash: 'd4e10ca1cc63c86fc8dc63126ddf229b81237a26',
                            repo: 'owner/name',
                            tag: 'd4e10ca1cc63c86fc8dc63126ddf229b81237a26',
                            imageName: 'owner/name:d4e10ca1cc63c86fc8dc63126ddf229b81237a26'
                        },
                        userSpecificFull: {
                            hash: 'd4e10ca1cc63c86fc8dc63126ddf229b81237a26',
                            repo: 'owner/name',
                            tag: 'd4e10ca1cc63c86fc8dc63126ddf229b81237a26-userId',
                            userId: 'userId',
                            imageName: 'owner/name:d4e10ca1cc63c86fc8dc63126ddf229b81237a26-userId'
                        },
                        "userSpecificCi": {
                            "hash": "d4e10ca1cc63c86fc8dc63126ddf229b81237a26",
                            "imageName": "owner/name:d4e10ca1cc63c86fc8dc63126ddf229b81237a26-CI-userId",
                            "repo": "owner/name",
                            "tag": "d4e10ca1cc63c86fc8dc63126ddf229b81237a26-CI-userId",
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

    });

});