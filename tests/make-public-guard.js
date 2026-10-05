#!/usr/bin/env node
// A776 regression: make-public.js must never overwrite the hand-authored
// tools/quest-board.html when its source (project-tracker.html) is not the full
// app. The source is now a redirect stub, so the run must exit non-zero and leave
// the file byte-identical.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'tools', 'quest-board.html');
const src = fs.readFileSync(path.join(ROOT, 'tools', 'project-tracker.html'), 'utf8');

// Precondition: the source really is a redirect stub (if it ever becomes the full
// app again, this test should be retired rather than silently passing).
const isRedirect = /http-equiv="refresh"|location\.replace/.test(src);
let failures = 0;
const check = (n, c, d) => { console.log(`${c ? '✓' : '✗'} ${n}${d ? ` - ${d}` : ''}`); if (!c) failures++; };

if (!isRedirect) {
  console.log('~ make-public guard: source is no longer a redirect stub - retire this test');
  process.exit(0);
}

const hash = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const before = hash(OUT);
const r = spawnSync(process.execPath, [path.join(ROOT, 'make-public.js')], { encoding: 'utf8', cwd: ROOT });
const out = (r.stdout || '') + (r.stderr || '');
const after = hash(OUT);

check('make-public exits non-zero', r.status !== 0, `status=${r.status}`);
check('quest-board.html is byte-identical after the run', before === after, before.slice(0, 12) + ' -> ' + after.slice(0, 12));
check('guard message explains the refusal', /refusing to write|obsolete/i.test(out));

console.log(failures ? `\n✗ make-public guard: ${failures} check(s) failed` : '\n✓ make-public guard: all checks passed (quest-board.html untouched)');
process.exit(failures ? 1 : 0);
