#!/usr/bin/env node
'use strict';

// A2301: aggregate the local "where learners get stuck" data.
//
// The learner exports jvds-stuck-data.json from My Progress (Export stuck
// data). This script prints the worst steps by failed tries, plus the reported
// broken steps. Nothing leaves the device until Josh runs it on an export.
//
// Usage:
//   node scripts/stuck-summary.js jvds-stuck-data.json
//   node scripts/stuck-summary.js --limit 10 jvds-stuck-data.json

const fs = require('fs');

const args = process.argv.slice(2);
let limit = 20;
let file = '';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--limit') {
    limit = Math.max(1, parseInt(args[++i], 10) || 20);
  } else if (!file) {
    file = args[i];
  }
}

if (!file) {
  console.log('Usage: node scripts/stuck-summary.js <exported-stuck-data.json> [--limit N]');
  console.log('Export the file from My Progress, then run this script on it.');
  process.exit(0);
}

function readExport(target) {
  const raw = fs.readFileSync(target, 'utf8');
  const data = JSON.parse(raw);
  if (Array.isArray(data)) return { fails: data, reports: [] };
  return { fails: Array.isArray(data.fails) ? data.fails : [], reports: Array.isArray(data.reports) ? data.reports : [] };
}

function pretty(slug) {
  return String(slug || '').replace(/\.html?$/i, '').replace(/[-_]/g, ' ');
}

function aggregate(fails) {
  const map = new Map();
  fails.forEach((item) => {
    if (!item) return;
    const key = item.workshop + '::' + item.step;
    const current = map.get(key) || {
      workshop: item.workshop,
      step: item.step,
      title: item.title || '',
      source: item.source || 'step',
      count: 0,
      lastAt: '',
    };
    current.count += Number(item.count) || 1;
    if (item.title) current.title = item.title;
    if (item.source) current.source = item.source;
    if (item.lastAt && item.lastAt > current.lastAt) current.lastAt = item.lastAt;
    map.set(key, current);
  });
  return [...map.values()].sort((a, b) => b.count - a.count || a.workshop.localeCompare(b.workshop));
}

let data;
try {
  data = readExport(file);
} catch (err) {
  console.error('Could not read ' + file + ': ' + err.message);
  process.exit(1);
}

const rows = aggregate(data.fails);
const total = rows.reduce((n, r) => n + r.count, 0);

console.log('Stuck summary');
console.log('  file: ' + file);
console.log('  steps with failed tries: ' + rows.length);
console.log('  failed tries: ' + total);
console.log('');

if (!rows.length) {
  console.log('No failed tries in this export.');
} else {
  console.log('Most tries per step');
  rows.slice(0, limit).forEach((row) => {
    const label = pretty(row.workshop) + ' step ' + row.step + (row.title ? ' (' + row.title + ')' : '');
    console.log('  ' + String(row.count).padStart(4, ' ') + '  ' + label + '  [' + row.source + ']');
  });
}

if (data.reports.length) {
  console.log('');
  console.log('Reported broken steps');
  data.reports.slice().reverse().slice(0, limit).forEach((report) => {
    console.log('  ' + pretty(report.workshop) + ' step ' + report.step + ': ' + (report.note || 'No note'));
  });
}
