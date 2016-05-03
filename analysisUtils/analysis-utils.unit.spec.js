var proxyquire = require('proxyquire').noCallThru();
var Q          = require('q');
var chai       = require('chai');
var expect     = chai.expect;
var sinon      = require('sinon');
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
                userDockerFileFromRepo: true
            };

            return analyze.prepareHashInfo("owner", "name", "branch", "sha123", settings, "userId")
                .then(function (res) {
                    var expectedRes = {
                        repo: {
                            hash: '4c1bbca29599290960a76b435bf7abc584da407c',
                            repo: 'owner/name',
                            tag: 'branch',
                            imageName: 'owner/name:branch'
                        },
                        revision: {
                            hash: '4c1bbca29599290960a76b435bf7abc584da407c',
                            repo: 'owner/name',
                            tag: '4c1bbca29599290960a76b435bf7abc584da407c',
                            imageName: 'owner/name:4c1bbca29599290960a76b435bf7abc584da407c'
                        },
                        userSpecificFull: {
                            hash: '4c1bbca29599290960a76b435bf7abc584da407c',
                            repo: 'owner/name',
                            tag: '4c1bbca29599290960a76b435bf7abc584da407c-userId',
                            userId: 'userId',
                            imageName: 'owner/name:4c1bbca29599290960a76b435bf7abc584da407c-userId'
                        },
                        "userSpecificCi": {
                            "hash": "4c1bbca29599290960a76b435bf7abc584da407c",
                            "imageName": "owner/name:4c1bbca29599290960a76b435bf7abc584da407c-CI-userId",
                            "repo": "owner/name",
                            "tag": "4c1bbca29599290960a76b435bf7abc584da407c-CI-userId",
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