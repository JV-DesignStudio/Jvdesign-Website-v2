const { execFileSync } = require('child_process');
const path = require('path');
const { ROOT } = require('../lib/paths');
function runLatest({ verbose = true } = {}) {
  execFileSync(process.execPath, [path.join(ROOT, 'generate-latest-post.js')], { stdio: verbose ? 'inherit' : 'pipe' });
}
if (require.main === module) runLatest();
module.exports = { runLatest };
