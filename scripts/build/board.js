const { execFileSync } = require('child_process');
const path = require('path');
const { ROOT } = require('../lib/paths');
function runBoard({ verbose = true } = {}) {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'generate-board-data.js')], { stdio: verbose ? 'inherit' : 'pipe' });
}
if (require.main === module) runBoard();
module.exports = { runBoard };
