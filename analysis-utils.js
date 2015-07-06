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

var prepareHashInfo = function(repoOwner, repoName, branch, settings, user) {

    var build_sh = "";
    var start_sh = "";
    var useDockerfileFromRepo = false;

    if (settings) {
        build_sh = settings.build_sh || build_sh;
        start_sh = settings.start_sh || start_sh;
        useDockerfileFromRepo = settings.useDockerfileFromRepo;
    }

    //the revision marker may or may not include information... that depends on the use case.
    //if we don't use the dockerfile from the repo - we have a single image per repo.
    //no need to create a sha for every branch.
    //if we do use the dockerfile from the repo - we can't optimize, we have to build each time.
    //we need a sha for every branch.
    var revisionMarkerPromise = Q(''); //jshint ignore:line
    if (useDockerfileFromRepo) {
        revisionMarkerPromise = revisionMarkerPromise.then(function () {
          return getLatestSha(user, repoOwner, repoName, branch);
        });
    }

    return revisionMarkerPromise
        .then(function (revisionMarker) {
            var hash = crypto.createHash('sha1');
            hash.update(
                JSON.stringify(build_sh) +
                JSON.stringify(start_sh) +
                JSON.stringify(useDockerfileFromRepo) +
                revisionMarker);

            var buildHash = hash.digest('hex');

            return {
                build_sh: build_sh,
                start_sh: start_sh,
                hash: buildHash,
                imageName: (repoOwner + '/' + repoName + ':' + buildHash).replace(/-/g, '_').toLowerCase()
            };
        });
};


module.exports = {
    prepareHashInfo: prepareHashInfo,
    getLatestSha: getLatestSha
};
