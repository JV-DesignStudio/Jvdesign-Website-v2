#!/usr/bin/env node
/*
 * tests/sim-lockdown-workshops.js
 *
 * Contract test for the SIM LOCKDOWN workshop series (3 episodes). These pages
 * share one browser engine (workshops/sim-lockdown-engine.js) and drive it with
 * quiz gates, concept-fill, code challenges and order challenges whose answers
 * are base64-encoded in data attributes. A typo in an answer key or an option
 * index makes an activity silently unsolvable, which is invisible to the plain
 * metadata gate in validate-workshops.js. This checks the interactive contract.
 *
 * Run: node tests/sim-lockdown-workshops.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ENGINE = path.join(ROOT, 'workshops', 'sim-lockdown-engine.js');
const PAGES = [
  'workshops/roblox-sim-lockdown-1-workshop.html',
  'workshops/roblox-sim-lockdown-2-workshop.html',
  'workshops/roblox-sim-lockdown-3-workshop.html',
];

let passes = 0;
const failures = [];
const ok = (name, cond, detail) => {
  if (cond) { passes++; }
  else { failures.push(name + (detail ? ' - ' + detail : '')); console.log('  [FAIL] ' + name + (detail ? ' - ' + detail : '')); return; }
  console.log('  [PASS] ' + name);
};

const b64 = (s) => { try { return Buffer.from(String(s), 'base64').toString('utf8'); } catch (e) { return null; } };
const isInt = (s) => typeof s === 'string' && /^-?\d+$/.test(s.trim());

// engine must define every handler the pages call inline
const engine = fs.readFileSync(ENGINE, 'utf8');
const defined = new Set([
  ...[...engine.matchAll(/function\s+([A-Za-z_]\w*)\s*\(/g)].map(m => m[1]),
  ...[...engine.matchAll(/window\.([A-Za-z_]\w*)\s*=/g)].map(m => m[1]),
]);
ok('engine defines toggleStep', defined.has('toggleStep'));
ok('engine defines completeStep', defined.has('completeStep'));
ok('engine defines checkQuiz', defined.has('checkQuiz'));
ok('engine defines selectQuizOpt', defined.has('selectQuizOpt'));
ok('engine defines checkConceptFill', defined.has('checkConceptFill'));
ok('engine defines checkCodeChallenge', defined.has('checkCodeChallenge'));
ok('engine defines checkOrder', defined.has('checkOrder'));

const seenKeys = new Set();

for (const rel of PAGES) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) { ok(rel + ' exists', false); continue; }
  const html = fs.readFileSync(file, 'utf8');
  const name = path.basename(rel).replace('.html', '');

  // metadata contract
  ok(name + ': title', /<title>[^<]+<\/title>/.test(html));
  ok(name + ': description', /<meta\s+name=["']description["']/i.test(html));
  ok(name + ': canonical', /<link\s+rel=["']canonical["']/i.test(html));
  ok(name + ': loads shared engine', /sim-lockdown-engine\.js/.test(html));

  // storage + total
  const key = (html.match(/STORAGE_KEY\s*=\s*['"]([^'"]+)['"]/) || [])[1];
  ok(name + ': STORAGE_KEY present', !!key);
  ok(name + ': STORAGE_KEY unique', key && !seenKeys.has(key), key);
  if (key) seenKeys.add(key);
  const total = parseInt((html.match(/WORKSHOP_TOTAL\s*=\s*(\d+)/) || [])[1], 10);
  ok(name + ': WORKSHOP_TOTAL numeric', Number.isInteger(total) && total > 0);
  const stepCards = (html.match(/class="step-card/g) || []).length;
  ok(name + ': step-card count matches TOTAL', stepCards === total, stepCards + ' vs ' + total);
  for (let i = 1; i <= total; i++) ok(name + ': step-' + i + ' exists', new RegExp('id="step-' + i + '"').test(html));

  // quiz gates: data-k decodes to a valid option index; option idx values unique
  const gateBlocks = html.split('<div class="quiz-gate"').slice(1);
  gateBlocks.forEach((b, idx) => {
    const k = (b.match(/data-k="([^"]+)"/) || [])[1];
    const opts = (b.match(/class="quiz-opt"/g) || []).length;
    const dec = k != null ? b64(k) : null;
    const ki = dec != null ? parseInt(dec, 10) : NaN;
    ok(name + ' quiz#' + (idx + 1) + ': answer key in range',
      isInt(dec) && ki >= 0 && ki < opts, 'k="' + k + '" -> ' + dec + ' (opts=' + opts + ')');
    const idxs = [...b.matchAll(/class="quiz-opt"[^>]*data-idx="(\d+)"/g)].map(m => Number(m[1]));
    ok(name + ' quiz#' + (idx + 1) + ': option indices 0..' + (opts - 1),
      new Set(idxs).size === opts && idxs.every(v => v >= 0 && v < opts), 'idx=' + idxs.join(','));
  });
  ok(name + ': has at least one quiz gate', gateBlocks.length >= 1);

  // concept-fill + code-challenge blanks: data-a must decode to non-empty text
  for (const cls of ['cf-blank', 'cc-blank']) {
    const found = [
      ...html.matchAll(new RegExp('class="' + cls + '"[^>]*data-a="([^"]+)"', 'g')),
      ...html.matchAll(new RegExp('data-a="([^"]+)"[^>]*class="' + cls + '"', 'g')),
    ];
    found.forEach((m, i) => {
      const dec = b64(m[1]);
      ok(name + ' ' + cls + '#' + (i + 1) + ': answer decodes', !!dec && dec.length > 0, 'a="' + m[1] + '"');
    });
  }

  // order challenges: positions must be a clean 1..N permutation
  const ocBlocks = html.split('<div class="order-challenge"').slice(1);
  ocBlocks.forEach((b, idx) => {
    const a = [...b.matchAll(/class="oc-item"[^>]*data-k="([^"]+)"/g)].map(m => parseInt(b64(m[1]), 10));
    const c = [...b.matchAll(/data-k="([^"]+)"[^>]*class="oc-item"/g)].map(m => parseInt(b64(m[1]), 10));
    const list = a.length >= c.length ? a : c;
    const expect = Array.from({ length: list.length }, (_, i) => i + 1);
    const sorted = [...list].sort((x, y) => x - y);
    ok(name + ' order#' + (idx + 1) + ': positions are 1..' + list.length,
      JSON.stringify(sorted) === JSON.stringify(expect), 'got ' + list.join(','));
  });

  // every inline onclick handler must exist in the engine
  const RESERVED = new Set(['if', 'for', 'while', 'return', 'function', 'switch', 'catch', 'new', 'typeof', 'window', 'this', 'do', 'else']);
  const handlers = [...new Set([...html.matchAll(/onclick="([A-Za-z_]\w*)\(/g)].map(m => m[1]))]
    .filter(h => !RESERVED.has(h));
  handlers.forEach(h => ok(name + ': onclick ' + h + ' defined', defined.has(h)));
}

console.log('\n' + passes + ' checks passed, ' + failures.length + ' failed');
if (failures.length) {
  console.log('\nFailures:\n- ' + failures.join('\n- '));
  process.exit(1);
}
