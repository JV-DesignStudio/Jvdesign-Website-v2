#!/usr/bin/env node
// tools/parent-guide.html retired: it must redirect to the homepage and stay noindex.
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'tools', 'parent-guide.html');
const s = fs.readFileSync(file, 'utf8');
let failures = 0;
const check = (name, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) failures++; };

check('meta refresh points home', /http-equiv=["']refresh["'][^>]*url=\//i.test(s));
check('canonical points home', /rel=["']canonical["'][^>]*href=["']https:\/\/jvdesignstudio\.co\.uk\/["']/i.test(s));
check('page is noindex', /name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(s));
check('page has no retired-page links', !/href=["'][^"']*parent-guide/i.test(s));

console.log(failures ? '\n' + failures + ' FAILED' : '\nALL PASS');
process.exit(failures ? 1 : 0);
