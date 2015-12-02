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
                build_sh: "build",
                start_sh: "start",
                test_sh: "test",
                deploy_sh: "deploy",
                userDockerFileFromRepo: true
            };

            return analyze.prepareHashInfo("owner", "name", "branch", "sha123", settings, "userId")
                .then(function (res) {
                    var expectedRes = {
                        repo: {
                            hash: '8c71c47bcdc3d21a8c45027a6e07737015db8945',
                            repo: 'owner/name',
                            tag: 'branch',
                            imageName: 'owner/name:branch'
                        },
                        revision: {
                            hash: '8c71c47bcdc3d21a8c45027a6e07737015db8945',
                            repo: 'owner/name',
                            tag: '8c71c47bcdc3d21a8c45027a6e07737015db8945',
                            imageName: 'owner/name:8c71c47bcdc3d21a8c45027a6e07737015db8945'
                        },
                        userSpecificFull: {
                            hash: '8c71c47bcdc3d21a8c45027a6e07737015db8945',
                            repo: 'owner/name',
                            tag: '8c71c47bcdc3d21a8c45027a6e07737015db8945-userId',
                            userId: 'userId',
                            imageName: 'owner/name:8c71c47bcdc3d21a8c45027a6e07737015db8945-userId'
                        },
                        "userSpecificCi": {
                            "hash": "8c71c47bcdc3d21a8c45027a6e07737015db8945",
                            "imageName": "owner/name:8c71c47bcdc3d21a8c45027a6e07737015db8945-CI-userId",
                            "repo": "owner/name",
                            "tag": "8c71c47bcdc3d21a8c45027a6e07737015db8945-CI-userId",
                            "userId": "userId"
                        },
                        build_sh: 'build',
                        start_sh: 'start',
                        test_sh: 'test',
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