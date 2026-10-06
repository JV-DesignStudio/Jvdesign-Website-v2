#!/usr/bin/env node
var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..');
var src = fs.readFileSync(path.join(ROOT, 'pick-your-path.html'), 'utf8');

var hrefRe = /href:"(\/[^"]+)"/g;
var m, hrefs = [];
while ((m = hrefRe.exec(src)) !== null) hrefs.push(m[1]);

var unique = [...new Set(hrefs)];
var cleanMap = {};
var fourOhFour = fs.readFileSync(path.join(ROOT, '404.html'), 'utf8');
var mapRe = /'(\/[^']+)'\s*:\s*'(\/[^']+)'/g;
while ((m = mapRe.exec(fourOhFour)) !== null) cleanMap[m[1]] = m[2];

var errors = [];
for (var href of unique) {
  var resolved = cleanMap[href];
  if (resolved) {
    var filePath = path.join(ROOT, resolved);
    if (!fs.existsSync(filePath)) {
      errors.push(href + ' -> ' + resolved + ' (file missing)');
    }
  } else {
    var direct = path.join(ROOT, href + '.html');
    var index = path.join(ROOT, href, 'index.html');
    if (!fs.existsSync(direct) && !fs.existsSync(index)) {
      errors.push(href + ' (no clean-URL mapping and no file)');
    }
  }
}

if (errors.length) {
  console.error('FAIL: ' + errors.length + ' broken Pick Your Path href(s):');
  errors.forEach(function(e) { console.error('  ' + e); });
  process.exit(1);
} else {
  console.log('PASS: all ' + unique.length + ' Pick Your Path hrefs resolve to real files.');
}
