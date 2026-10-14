#!/usr/bin/env node
/* Regression guard for the shared workshop data-action delegator.

   workshops/workshop-actions.js is loaded by ~80 workshop pages and turns
   [data-action] controls into calls on each page's own functions. It once went
   missing (it was not tracked by git, so a cleanup swept it away) which broke
   every workshop page that loaded it. This pins the things that failed:

     1. the file exists AND is tracked by git (an untracked shared file can be
        deleted as if it were an orphan),
     2. every page that loads it resolves it,
     3. the delegator still contains its DOM specials and a click listener,
     4. every data-action name used in a workshop is a built-in special or a
        function the delegator can reach.

   Run: node tests/workshop-actions.js
*/
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const REL = 'workshops/workshop-actions.js';
const DELEGATE = path.join(ROOT, 'workshops', 'workshop-actions.js');
const SPECIALS = new Set(['print', 'removeClosest', 'removeId']);

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

check('delegator file exists', fs.existsSync(DELEGATE), REL);

let tracked = false;
try { execFileSync('git', ['ls-files', '--error-unmatch', REL], { cwd: ROOT, stdio: 'ignore' }); tracked = true; } catch (e) { tracked = false; }
check('delegator file is tracked by git', tracked, tracked ? '' : 'not in git - a cleanup could delete it again');

const src = fs.existsSync(DELEGATE) ? fs.readFileSync(DELEGATE, 'utf8') : '';
const hasSpecials = /removeClosest/.test(src) && /removeId/.test(src);
check('delegator handles the DOM specials', hasSpecials, hasSpecials ? '' : 'missing removeClosest/removeId');
check('delegator registers a click listener', /addEventListener\(\s*['"]click['"]/.test(src));

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html') || e.name.endsWith('.js')) out.push(p);
  }
  return out;
}
const files = walk(path.join(ROOT, 'workshops'), []);

const loaders = files.filter(f => f.endsWith('.html') && fs.readFileSync(f, 'utf8').includes('workshop-actions.js'));
check('workshop pages load the delegator', loaders.length > 0, loaders.length + ' pages');
let unresolved = 0;
for (const f of loaders) if (!fs.existsSync(path.join(path.dirname(f), 'workshop-actions.js'))) unresolved++;
check('every loader resolves the delegator next to it', unresolved === 0, unresolved + ' unresolved');

const actions = new Set();
const win = new Set(), meth = new Set();
const reAction = /data-action="([^"$+{]+)"/g;
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  if (f.endsWith('.html')) { reAction.lastIndex = 0; let m; while ((m = reAction.exec(s))) actions.add(m[1].trim()); }
  for (const raw of s.split(/\r?\n/)) {
    const t = raw.trim(); let m;
    if ((m = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/.exec(t))) win.add(m[1]);
    else if ((m = /^(?:let|const)\s+([A-Za-z_$][\w$]*)\s*=/.exec(t))) win.add(m[1]);
    else if ((m = /^var\s+([A-Za-z_$][\w$]*)\s*=/.exec(t))) win.add(m[1]);
    else if ((m = /^window\.([A-Za-z_$][\w$]*)\s*=/.exec(t))) win.add(m[1]);
    else if ((m = /^([A-Za-z_$][\w$]*)\s*=\s*(?:function|\(|async)/.exec(t))) win.add(m[1]);
    if ((m = /^\s*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/.exec(raw))) meth.add(m[1]);
  }
}
const missing = [...actions].filter(a => !SPECIALS.has(a) && !win.has(a) && !meth.has(a));
check('every data-action name is reachable', missing.length === 0, missing.join(', '));

console.log('\ndata-action names: ' + actions.size + ' | loader pages: ' + loaders.length);
if (failures) { console.log('\n' + failures + ' CHECK(S) FAILED'); process.exit(1); }
console.log('\nALL WORKSHOP-ACTIONS CHECKS PASSED');
