//  to base64 and escape / and + characters
function transformLabelToBase64(reName) {
    return new Buffer(reName).toString('base64')
        .replace(/=+$/, '')
        .replace(/[/+]/g, (char) => {
            return {
                '/': '-',
                '+': '_'
            }[char];
        })
        .slice(0, 63);
}

//  from base64 and unescape - and _ characters
function transformLabelFromBase64(escapedBase64) {
    try {
        const base64 = escapedBase64
            .replace(/[-_]/g, (char) => {
                return {
                    '-': '/',
                    '_': '+'
                }[char];
            });
        return new Buffer(base64, 'base64').toString();
    } catch (err) {
        console.error('Failed to transform base64 k8s label to ascii');
        return null;
    }
}

module.exports = {
    transformLabelFromBase64,
    transformLabelToBase64,
};
