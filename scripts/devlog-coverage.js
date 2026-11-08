#!/usr/bin/env node
/**
 * devlog-coverage.js - report shipped P1 cards that have no public dev log post.
 *
 * Report-only by default so it is safe in CI. Pass --strict to exit 1 when any
 * card is missing a post. When the private studio-workspace is present it also
 * writes devlog-coverage.json there so the board can surface the gap.
 *
 * Run: node scripts/devlog-coverage.js [--strict]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STRICT = process.argv.includes('--strict');

const TASK_CANDIDATES = [
  path.join(ROOT, '..', 'studio-workspace', 'tasks.json'),
  'F:/Website/studio-workspace/tasks.json',
];
const OUT_CANDIDATES = [
  path.join(ROOT, '..', 'studio-workspace', 'devlog-coverage.json'),
  'F:/Website/studio-workspace/devlog-coverage.json',
];

function loadPosts() {
  const src = fs.readFileSync(path.join(ROOT, 'devlog-data.js'), 'utf8');
  const sandbox = { console: { log() {}, warn() {} }, window: {} };
  const vm = require('vm');
  vm.createContext(sandbox);
  return vm.runInContext('(function(){' + src + ';return POSTS;})()', sandbox, { timeout: 5000 }) || [];
}

function main() {
  const tasksPath = TASK_CANDIDATES.find(p => fs.existsSync(p));
  if (!tasksPath) {
    console.log('devlog-coverage: private tasks.json not present; skipping.');
    return;
  }
  let tasks;
  try { tasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8')); }
  catch (e) { console.error('devlog-coverage: cannot read tasks.json: ' + e.message); process.exit(1); }

  const posts = loadPosts();
  const blob = posts.map(p => `${p.title || ''} ${p.excerpt || ''} ${p.content || ''}`).join('\n');
  const shipped = tasks.filter(t => t.priority === 'P1' && ['done', 'verified_local'].includes(t.status));
  const missing = shipped.filter(t => {
    const title = String(t.title || '').trim();
    if (!title) return false;
    if (blob.includes(title.slice(0, 20))) return false;
    return true;
  }).map(t => ({ id: t.id, title: t.title, tag: t.tag || '', status: t.status }));

  const report = {
    generated: new Date().toISOString(),
    totalShippedP1: shipped.length,
    withPost: shipped.length - missing.length,
    missing,
  };

  const outPath = OUT_CANDIDATES.find(p => fs.existsSync(path.dirname(p)));
  if (outPath) {
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`devlog-coverage: wrote ${outPath}`);
  }

  console.log(`devlog-coverage: ${missing.length}/${shipped.length} shipped P1 card(s) have no post.`);
  for (const m of missing) console.log(`  ${m.id} [${m.status}] ${m.title}`);

  if (STRICT && missing.length) process.exit(1);
}

main();
