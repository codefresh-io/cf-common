var crypto  = require('crypto');
var Q       = require('q');
var _       = require('lodash');

function getLatestSha(user, repoOwner, repoName, branch) {

    return getLatestSha(user, repoOwner, repoName, branch)
        .then(function (commit) {
            if (commit === null) {
                return branch;
            }
            else {
                return commit.sha;
            }
        });
}

function getLatestCommit(user, repoOwner, repoName, branch) {

    console.log(new Date() + ': Get latest commit - started');

    return user.provider.getCommits(repoOwner, repoName, branch, 1)
        .then(function (commitInfo) {
            console.log(new Date() + ': Get latest commit - ended - success');
            return (commitInfo && commitInfo.length === 1) ?
                commitInfo[0] : null;
        });
}

var prepareHashInfo = function(repoOwner, repoName, branch, latestSha, settings) {

    return Q() //jshint ignore:line
        .then(function () {

            var build_sh = "";
            var start_sh = "";
            var test_sh = "";
            var deploy_sh = "";
            var useDockerfileFromRepo = false;

            var imageName = settings.imageName || repoOwner + '/' + repoName;
            var repo = imageName.toLowerCase();

            if (settings) {
                build_sh = settings.build_sh || build_sh;
                start_sh = settings.start_sh || start_sh;
                test_sh = settings.test_sh || test_sh;
                deploy_sh = settings.deploy_sh || deploy_sh;
                useDockerfileFromRepo = settings.useDockerfileFromRepo;
            }

            function calcHash(sha) {

                var hash =
                    crypto.createHash('sha1')
                        .update(
                        JSON.stringify(build_sh) +
                        JSON.stringify(start_sh) +
                        JSON.stringify(useDockerfileFromRepo) +
                        JSON.stringify(_.get(settings, 'template.value', '')) +
                        sha)
                        .digest('hex')
                        .replace(/-/g, '_').toLowerCase();

                return {
                    hash: hash,
                    repo: repo,
                    imageName: repo + ':' + hash
                };
            }

            var forRevision = calcHash(latestSha + branch);

            var forRepo = {
                hash: forRevision.hash,
                repo: repo,
                imageName: repo + ':' + branch
            };

            return {
                repo: forRepo,
                revision: forRevision,
                build_sh: build_sh,
                start_sh: start_sh,
                test_sh: test_sh,
                deploy_sh: deploy_sh
            };
        });
};


module.exports = {
    prepareHashInfo: prepareHashInfo,
    getLatestSha: getLatestSha,
    getLatestCommit: getLatestCommit
};
