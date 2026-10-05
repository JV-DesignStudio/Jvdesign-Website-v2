const { execFileSync } = require('child_process');
const path = require('path');
const { ROOT } = require('../lib/paths');
function runRedirects({ verbose = true } = {}) {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'generate-redirect-stubs.js')], { stdio: verbose ? 'inherit' : 'pipe' });
}
if (require.main === module) runRedirects();
module.exports = { runRedirects };
