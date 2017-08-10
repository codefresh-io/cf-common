var crypto  = require('crypto');
var Q       = require('q');
var _       = require('lodash');

function removeImageOwnerUnsupportedChars(owner){
    owner = owner.toLowerCase();
    return owner.replace(/[^a-z0-9]+/g, "");
}

var removeImageNameUnsupportedChars = removeImageOwnerUnsupportedChars;

function removeImageTagUnsupportedChars(tag){
    return tag.replace(/[^a-zA-Z0-9_.-]+/g, "").replace(/^[.-]*/, "");
}


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

var prepareHashInfo = function(repoOwner, repoName, branch, latestSha, settings, userId, extra) {

    return Q() //jshint ignore:line
        .then(function () {

            var dockerFileContents = "";
            var test_sh = "";
            var deploy_sh = "";
            var integ_sh = "";
            var useDockerfileFromRepo = false;

            var imageName = settings.imageName || removeImageOwnerUnsupportedChars(repoOwner) + '/' + removeImageNameUnsupportedChars(repoName);
            var repo = imageName.toLowerCase();

            if (settings) {
                dockerFileContents = settings.dockerFileContents || dockerFileContents;
                test_sh = settings.test_sh || test_sh;
                deploy_sh = settings.deploy_sh || deploy_sh;
                integ_sh = settings.integ_sh || integ_sh;
                useDockerfileFromRepo = settings.useDockerfileFromRepo;
            }

            function calcHash(sha) {

                var hashData =
                    JSON.stringify(useDockerfileFromRepo) +
                    (useDockerfileFromRepo ? '': JSON.stringify(dockerFileContents)) +
                    JSON.stringify(_.get(settings, 'template.value', '')) +
                    _.get(settings, 'imageName', '') +
                    (extra ? JSON.stringify(extra) : '') +
                    sha;

                var hash =
                    crypto.createHash('sha1')
                        .update(hashData)
                        .digest('hex')
                        .replace(/-/g, '_').toLowerCase();

                var res = {
                    hash: hash,
                    repo: repo,
                    tag: hash
                };
                res.imageName = res.repo + ":" + res.tag;
                return res;
            }

            var forRevision = calcHash(latestSha + branch);

            var forRepo = {
                hash: forRevision.hash,
                repo: repo,
                tag: removeImageTagUnsupportedChars(branch)
            };
            forRepo.imageName = forRepo.repo + ':' + forRepo.tag;


            var forUserSpecificFull = {
                hash: forRevision.hash,
                repo: repo,
                tag: forRevision.hash + "-" + userId,
                userId: userId
            };
            forUserSpecificFull.imageName = forUserSpecificFull.repo + ":" + forUserSpecificFull.tag;

            var forUserSpecificCi = {
                hash: forRevision.hash,
                repo: repo,
                tag: forRevision.hash + "-CI-" + userId,
                userId: userId
            };
            forUserSpecificCi.imageName = forUserSpecificCi.repo + ":" + forUserSpecificCi.tag;

            return {
                repo: forRepo,
                revision: forRevision,
                userSpecificFull: forUserSpecificFull,
                userSpecificCi: forUserSpecificCi,
                dockerFileContents: dockerFileContents,
                test_sh: test_sh,
                deploy_sh: deploy_sh,
                integ_sh: integ_sh
            };
        });
};


module.exports = {
    prepareHashInfo: prepareHashInfo,
    getLatestSha: getLatestSha,
    getLatestCommit: getLatestCommit,
    removeImageOwnerUnsupportedChars: removeImageOwnerUnsupportedChars,
    removeImageNameUnsupportedChars: removeImageNameUnsupportedChars,
    removeImageTagUnsupportedChars: removeImageTagUnsupportedChars    
};
