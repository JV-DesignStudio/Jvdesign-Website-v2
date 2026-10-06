#!/usr/bin/env node
var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..');
var dataSrc = fs.readFileSync(path.join(ROOT, 'devlog-data.js'), 'utf8');
var pageSrc = fs.readFileSync(path.join(ROOT, 'pages', 'devlog.html'), 'utf8');

var dataTags = {};
dataSrc.replace(/tag:\s*'([^']+)'/g, function(_, t) { dataTags[t] = (dataTags[t] || 0) + 1; });

var labelMatch = pageSrc.match(/TAG_LABELS\s*=\s*\{([^}]+)\}/);
if (!labelMatch) { console.error('FAIL: cannot find TAG_LABELS in devlog.html'); process.exit(1); }
var labelKeys = [];
labelMatch[1].replace(/(\w+)\s*:/g, function(_, k) { labelKeys.push(k); });

var filterMatch = pageSrc.match(/data-filter="(\w+)"/g) || [];
var filterKeys = filterMatch.map(function(m) { return m.replace(/data-filter="|"/g, ''); }).filter(function(k) { return k !== 'all'; });

var errors = [];

Object.keys(dataTags).forEach(function(tag) {
  if (labelKeys.indexOf(tag) === -1) {
    errors.push('Data tag "' + tag + '" (' + dataTags[tag] + ' posts) has no TAG_LABELS entry - renders as undefined');
  }
  if (filterKeys.indexOf(tag) === -1) {
    errors.push('Data tag "' + tag + '" (' + dataTags[tag] + ' posts) has no filter button - unfilterable');
  }
});

labelKeys.forEach(function(key) {
  if (!dataTags[key]) {
    errors.push('TAG_LABELS has "' + key + '" but no posts use this tag - dead filter');
  }
});

if (errors.length) {
  console.error('FAIL: ' + errors.length + ' devlog tag issue(s):');
  errors.forEach(function(e) { console.error('  ' + e); });
  process.exit(1);
} else {
  console.log('PASS: all ' + Object.keys(dataTags).length + ' data tags have labels and filters. Tags: ' + Object.keys(dataTags).map(function(t) { return t + '(' + dataTags[t] + ')'; }).join(', '));
}
