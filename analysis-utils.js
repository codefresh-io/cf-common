var crypto  = require('crypto');
var Q       = require('q');

function getLatestSha(user, repoOwner, repoName, branch) {

  console.log(new Date() + ': Get latest sha - started');

  return user.provider.getCommits(repoOwner, repoName, branch, 1)
    .then(function (commitInfo) {
      console.log(new Date() + ': Get latest sha - ended - success');
      return (commitInfo && commitInfo.length === 1) ?
        commitInfo[0].sha :
        branch;
    });
}

var prepareHashInfo = function(repoOwner, repoName, branch, latestSha, settings) {

    return Q() //jshint ignore:line
        .then(function () {

            var build_sh = "";
            var start_sh = "";
            var useDockerfileFromRepo = false;
            var repo = (repoOwner + '/' + repoName).replace(/-/g, '_').toLowerCase();

            if (settings) {
                build_sh = settings.build_sh || build_sh;
                start_sh = settings.start_sh || start_sh;
                useDockerfileFromRepo = settings.useDockerfileFromRepo;
            }

            function calcHash(sha) {

                var hash =
                    crypto.createHash('sha1')
                    .update(
                        JSON.stringify(build_sh) +
                        JSON.stringify(start_sh) +
                        JSON.stringify(useDockerfileFromRepo) +
                        sha)
                    .digest('hex')
                    .replace(/-/g, '_').toLowerCase();

                return {
                    build_sh: build_sh,
                    start_sh: start_sh,
                    hash: hash,
                    repo: repo,
                    imageName: repo + ':' + hash
                };
            }

            var forRevision = calcHash(latestSha);
            //if we use customer dockerfile, we don't have an image per repo, we have an image per sha.
            var forRepo = useDockerfileFromRepo ? withSha : calcHash('');

            return {
                repo: forRepo,
                revision: forRevision
            };
        });
};


module.exports = {
    prepareHashInfo: prepareHashInfo,
    getLatestSha: getLatestSha
};
