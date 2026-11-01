#!/usr/bin/env node
/*
 * tests/board-data-contract.js (A2044): the committed board-data.json is the
 * public file. It must carry neutral stubs only. Live throughput, learner and
 * revenue telemetry belongs in studio-workspace/board-telemetry.json and is
 * merged by the private board server, never written into the public repo.
 *
 * Run: node tests/board-data-contract.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const raw = fs.readFileSync(path.join(ROOT, 'board-data.json'), 'utf8');

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

let data;
try {
  data = JSON.parse(raw);
  check('board-data.json is valid JSON', true);
} catch (e) {
  check('board-data.json is valid JSON', false, e.message);
  process.exit(1);
}

check('public generated timestamp is present', typeof data.generated === 'string' && data.generated.length > 0, String(data.generated));
check('throughput is a neutral stub', !!data.throughput && data.throughput.updated === null && !data.throughput.series, JSON.stringify(data.throughput && data.throughput.updated));
check('throughput points at the private telemetry file', /board-telemetry\.json/.test((data.throughput && data.throughput.note) || ''), (data.throughput && data.throughput.note) || '');
check('learner wins are a stub', !data.learner || data.learner.generated === null, String(data.learner && data.learner.generated));
check('revenue is marked private', !data.revenue || data.revenue.private === true, String(data.revenue && data.revenue.private));
check('task counts are not published', !data.board || (data.board.total === 0 && data.board.backlog === 0 && data.board.in_progress === 0 && data.board.human_review === 0), JSON.stringify(data.board));

console.log('\n' + (failures === 0 ? 'BOARD-DATA CONTRACT PASSED' : failures + ' FAILURE(S)'));
process.exit(failures === 0 ? 0 : 1);
