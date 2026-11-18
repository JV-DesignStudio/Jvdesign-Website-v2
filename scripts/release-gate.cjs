#!/usr/bin/env node
'use strict';
// A2455: Release gate CLI.
// Usage:
//   node scripts/release-gate.cjs --report
//   node scripts/release-gate.cjs --sign-off games/backpack-quest --tester "Josh" [--note "tested on Chrome+mobile"]
//   node scripts/release-gate.cjs --flag games/backpack-quest --reason "broken after quiz update"
//   node scripts/release-gate.cjs --promote games/backpack-quest --to published
//   node scripts/release-gate.cjs --check   (exits 1 if any published item has no test record)

const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '../content/release-status.json');

function load() {
  const raw = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  return raw;
}
function save(data) {
  data._updated = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(DATA, JSON.stringify(data, null, 2));
}

const args = process.argv.slice(2);

if (args.includes('--report')) {
  const data = load();
  const byStatus = {};
  for (const item of data.items) {
    byStatus[item.status] = (byStatus[item.status] || 0) + 1;
  }
  console.log('Release gate report', data._updated);
  console.log('Total items:', data.items.length);
  for (const [status, count] of Object.entries(byStatus)) {
    console.log(' ', status + ':', count);
  }
  const pubNoRecord = data.items.filter(i => i.status === 'published' && !i.testedAt);
  console.log('\nPublished with no test record:', pubNoRecord.length);
  if (pubNoRecord.length > 0) {
    console.log('(First 10)');
    pubNoRecord.slice(0, 10).forEach(i => console.log(' ', i.id));
  }
  const repairNeeded = data.items.filter(i => i.status === 'needs-repair');
  if (repairNeeded.length) {
    console.log('\nNeeds repair:');
    repairNeeded.forEach(i => console.log(' ', i.id, i.notes ? '-- ' + i.notes : ''));
  }
  process.exit(pubNoRecord.length === 0 ? 0 : 1);
}

if (args.includes('--check')) {
  const data = load();
  const pubNoRecord = data.items.filter(i => i.status === 'published' && !i.testedAt);
  if (pubNoRecord.length === 0) {
    console.log('release-gate --check: PASS (all published items have test records)');
    process.exit(0);
  } else {
    console.log('release-gate --check: FAIL (' + pubNoRecord.length + ' published items have no test record)');
    console.log('Run: node scripts/release-gate.cjs --sign-off <id> --tester "<name>"');
    process.exit(1);
  }
}

if (args.includes('--sign-off')) {
  const id = args[args.indexOf('--sign-off') + 1];
  const testerIdx = args.indexOf('--tester');
  const noteIdx = args.indexOf('--note');
  if (!id || !testerIdx === -1) {
    console.error('Usage: --sign-off <id> --tester "<name>" [--note "..."]');
    process.exit(1);
  }
  const tester = testerIdx !== -1 ? args[testerIdx + 1] : 'unknown';
  const note = noteIdx !== -1 ? args[noteIdx + 1] : '';
  const data = load();
  const item = data.items.find(i => i.id === id);
  if (!item) { console.error('Item not found:', id); process.exit(1); }
  item.testedAt = new Date().toISOString().slice(0, 10);
  item.testedBy = tester;
  item.status = item.status === 'needs-repair' ? 'published' : item.status;
  if (item.status === 'draft' || item.status === 'needs-testing') item.status = 'ready';
  if (note) item.notes = note;
  save(data);
  console.log('Signed off:', id, 'by', tester, 'on', item.testedAt, '-> status:', item.status);
  process.exit(0);
}

if (args.includes('--flag')) {
  const id = args[args.indexOf('--flag') + 1];
  const reasonIdx = args.indexOf('--reason');
  const reason = reasonIdx !== -1 ? args[reasonIdx + 1] : '';
  const data = load();
  const item = data.items.find(i => i.id === id);
  if (!item) { console.error('Item not found:', id); process.exit(1); }
  item.status = 'needs-repair';
  if (reason) item.notes = reason;
  save(data);
  console.log('Flagged:', id, '-> needs-repair', reason ? '-- ' + reason : '');
  process.exit(0);
}

if (args.includes('--promote')) {
  const id = args[args.indexOf('--promote') + 1];
  const toIdx = args.indexOf('--to');
  const to = toIdx !== -1 ? args[toIdx + 1] : null;
  const VALID = ['draft', 'needs-testing', 'ready', 'published', 'needs-repair'];
  if (!to || !VALID.includes(to)) {
    console.error('Usage: --promote <id> --to <status>  (statuses:', VALID.join('|') + ')');
    process.exit(1);
  }
  const data = load();
  const item = data.items.find(i => i.id === id);
  if (!item) { console.error('Item not found:', id); process.exit(1); }
  const prev = item.status;
  item.status = to;
  save(data);
  console.log('Promoted:', id, prev, '->', to);
  process.exit(0);
}

console.log('Usage:');
console.log('  node scripts/release-gate.cjs --report');
console.log('  node scripts/release-gate.cjs --check');
console.log('  node scripts/release-gate.cjs --sign-off <id> --tester "<name>" [--note "..."]');
console.log('  node scripts/release-gate.cjs --flag <id> --reason "<reason>');
console.log('  node scripts/release-gate.cjs --promote <id> --to <draft|needs-testing|ready|published|needs-repair>');
process.exit(0);
