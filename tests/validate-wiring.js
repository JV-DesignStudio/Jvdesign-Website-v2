/* A1460: gate wiring guard.

   A quality gate is only worth having if it actually runs. This checks that
   every validate-*.js in the repo is invoked by `npm run validate`, the CI
   workflow, or a package.json script, and that every file the tooling points
   at really exists. It would have caught scripts/validate-game-quality.js
   silently crashing after A779.

   Run: node tests/validate-wiring.js
*/
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
  if (!ok) failures++;
}

const indexSrc = fs.readFileSync(path.join(root, 'scripts', 'validate', 'index.js'), 'utf8');
const ciSrc = fs.readFileSync(path.join(root, '.github', 'workflows', 'validate.yml'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const pkgSrc = JSON.stringify(pkg.scripts || {});

// Validators that are deliberately not auto-run, with the reason.
const EXCEPTIONS = {
  // e.g. 'validate-something.js': 'runs from a scheduled task only'
};

function listValidators(dir, prefix) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => /^validate-.*\.js$/.test(f)).map(f => prefix + f);
}
const validators = [...listValidators(root, ''), ...listValidators(path.join(root, 'scripts'), 'scripts/')];
check('found validator scripts', validators.length >= 5, validators.length + ' validators');

for (const rel of validators) {
  const name = path.basename(rel);
  const wired = indexSrc.includes(name) || ciSrc.includes(name) || pkgSrc.includes(name);
  check(name + ' is run somewhere', wired || !!EXCEPTIONS[rel], wired ? '' : 'not in npm run validate, CI or package.json');
}

// Every file that `npm run validate` points at must exist.
const missingIndex = [];
for (const m of indexSrc.matchAll(/path\.join\(ROOT,\s*([^)]*)\)/g)) {
  const parts = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
  if (!parts.length) continue;
  if (!fs.existsSync(path.join(root, ...parts))) missingIndex.push(parts.join('/'));
}
check('every validate:index step file exists', missingIndex.length === 0, missingIndex.join(', '));

// Every local `node <file>` target in package.json scripts must exist.
const missingPkg = [];
for (const [key, val] of Object.entries(pkg.scripts || {})) {
  for (const m of String(val).matchAll(/\bnode\s+([^\s"']+\.(?:js|cjs))/g)) {
    const t = m[1];
    if (/^[A-Za-z]:[\\/]/.test(t) || t.startsWith('/') || t.includes('studio-workspace')) continue; // absolute/private
    if (!fs.existsSync(path.join(root, t.replace(/\\/g, '/')))) missingPkg.push(key + ' -> ' + t);
  }
}
check('every npm script node target exists', missingPkg.length === 0, missingPkg.slice(0, 6).join(', '));

// The game gates we care about must be in CI.
for (const gate of ['tests/game-quality.js', 'tests/games-keep-rule.js', 'scripts/validate-game-quality.js', 'validate-covers.js']) {
  check('CI runs ' + gate, ciSrc.includes(gate));
}

if (failures) { console.log('\n' + failures + ' CHECK(S) FAILED'); process.exit(1); }
console.log('\nALL VALIDATE-WIRING CHECKS PASSED');
