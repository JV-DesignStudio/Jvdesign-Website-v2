#!/usr/bin/env node
/*
 * tests/arcade-game-maker-genre-records.js , A3065
 *
 * A READY label is a promise. This checks every READY genre has a dated,
 * passing record that names the checks actually run (boot, play, bodies,
 * no-errors, restart) and that the record is not older than 180 days.
 *
 * Run: node tests/arcade-game-maker-genre-records.js
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'src', 'arcade-maker', 'genre-tests.json');
const REQUIRED = ['boot', 'play', 'bodies', 'no-errors', 'restart'];
const MAX_AGE_DAYS = 180;

let failures = 0;
function check(name, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; }

(async () => {
  const m = await import(pathToFileURL(path.join(ROOT, 'src', 'arcade-maker', 'genres.js')).href);
  const list = m.GENRE_LIST || [];
  const quality = m.GENRE_QUALITY || {};
  let data = null;
  try { data = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) {}
  check('genre test record file exists', !!data && !!data.genres, path.relative(ROOT, FILE));
  if (!data || !data.genres) { process.exit(1); }

  const generated = Date.parse(data.generatedAt);
  check('record file has a valid generatedAt date', Number.isFinite(generated), data.generatedAt);
  check('record file names its source', typeof data.source === 'string' && data.source.length > 10, data.source);

  const unknown = Object.keys(data.genres).filter(g => list.indexOf(g) === -1);
  check('every record names a real genre', unknown.length === 0, unknown.join(','));

  const ready = list.filter(g => quality[g] === 'READY');
  const missing = [], failed = [], stale = [], old = [], incomplete = [];
  for (const g of ready) {
    const rec = data.genres[g];
    if (!rec) { missing.push(g); continue; }
    if (rec.pass !== true) { failed.push(g); continue; }
    const at = Date.parse(rec.date);
    if (!Number.isFinite(at)) { stale.push(g); continue; }
    if ((Date.now() - at) / 86400000 > MAX_AGE_DAYS) old.push(g);
    const checks = Array.isArray(rec.checks) ? rec.checks : [];
    if (!REQUIRED.every(c => checks.includes(c))) incomplete.push(g + ':' + checks.join('+'));
  }
  check('every READY genre has a record', missing.length === 0, missing.join(','));
  check('every READY record passes', failed.length === 0, failed.join(','));
  check('every READY record has a valid date', stale.length === 0, stale.join(','));
  check('every READY record has the required checks', incomplete.length === 0, incomplete.join(','));
  check('every READY record is under 180 days old', old.length === 0, old.join(','));
  check('records cover every genre, not just READY', Object.keys(data.genres).length >= list.length,
    `${Object.keys(data.genres).length}/${list.length}`);

  const winLose = Object.entries(data.genres).filter(([, r]) => r.win && r.lose).length;
  check('records name win/lose coverage', winLose >= list.length, `${winLose}/${list.length}`);

  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log(`\nARCADE GAME MAKER GENRE RECORDS PASSED (${ready.length} READY genres dated ${data.generatedAt})`);
})().catch(e => { console.error('genre records test crashed:', e); process.exit(1); });
