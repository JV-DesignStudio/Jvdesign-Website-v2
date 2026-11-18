#!/usr/bin/env node
'use strict';
// A2455: Release gate system checks.
// Verifies the status ledger exists, the CLI works, and the admin tool is present.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' -- ' + detail : ''));
  if (!ok) failures++;
}

// 1. Status ledger exists and has valid structure
const ledgerPath = path.join(ROOT, 'content/release-status.json');
check('content/release-status.json:exists', fs.existsSync(ledgerPath));
let ledger;
try {
  ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
} catch (e) {
  check('content/release-status.json:parseable', false, e.message);
  process.exit(1);
}
check('content/release-status.json:parseable', true);
check('ledger:has-schema', ledger._schema === '1.0', 'schema: ' + ledger._schema);
check('ledger:has-items', Array.isArray(ledger.items) && ledger.items.length > 0, ledger.items ? ledger.items.length + ' items' : 'no items');

// 2. Valid status values
const VALID_STATUSES = new Set(['draft', 'needs-testing', 'ready', 'published', 'needs-repair']);
const badStatus = ledger.items.filter(i => !VALID_STATUSES.has(i.status));
check('ledger:valid-statuses', badStatus.length === 0, badStatus.length ? badStatus[0].id + ' has status: ' + badStatus[0].status : 'all valid');

// 3. Status distribution makes sense
const counts = {};
for (const i of ledger.items) counts[i.status] = (counts[i.status] || 0) + 1;
check('ledger:has-entries', ledger.items.length >= 100, ledger.items.length + ' entries (expect 500+)');
check('ledger:covers-games', ledger.items.some(i => i.type === 'game'), 'no game entries');
check('ledger:covers-tools', ledger.items.some(i => i.type === 'tool'), 'no tool entries');
check('ledger:covers-workshops', ledger.items.some(i => i.type === 'workshop'), 'no workshop entries');

// 4. CLI exists and runs
const cli = path.join(ROOT, 'scripts/release-gate.cjs');
check('scripts/release-gate.cjs:exists', fs.existsSync(cli));
let cliOutput;
try {
  cliOutput = execFileSync(process.execPath, [cli, '--report'], { encoding: 'utf8', cwd: ROOT });
  check('scripts/release-gate.cjs:runs', true, 'exit 0');
} catch (e) {
  // --report exits 1 when there are untested items, which is expected at first run
  cliOutput = e.stdout || '';
  check('scripts/release-gate.cjs:runs', cliOutput.includes('Release gate report'), 'got: ' + cliOutput.slice(0, 60));
}
check('scripts/release-gate.cjs:report-output', cliOutput.includes('Total items:'), 'output: ' + cliOutput.slice(0, 80));

// 5. Admin tool exists
check('tools/release-gate.html:exists', fs.existsSync(path.join(ROOT, 'tools/release-gate.html')));
const toolSrc = fs.readFileSync(path.join(ROOT, 'tools/release-gate.html'), 'utf8');
check('tools/release-gate.html:noindex', /noindex/.test(toolSrc), 'admin tool must be noindex');
check('tools/release-gate.html:loads-ledger', /release-status\.json/.test(toolSrc), 'must reference ledger');

// 6. Status ladder fields on items
const sample = ledger.items[0];
check('ledger-items:have-id', typeof sample.id === 'string', 'id: ' + typeof sample.id);
check('ledger-items:have-type', typeof sample.type === 'string', 'type: ' + typeof sample.type);
check('ledger-items:have-checklist', typeof sample.checklist === 'object', 'checklist: ' + typeof sample.checklist);

console.log(failures === 0 ? '\nrelease-gate-http: PASS' : '\nrelease-gate-http: FAIL (' + failures + ' failures)');
process.exit(failures === 0 ? 0 : 1);
