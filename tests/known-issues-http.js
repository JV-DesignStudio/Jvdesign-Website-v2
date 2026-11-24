#!/usr/bin/env node
/* tests/known-issues-http.js (A2653): known-issues page static checks.
 * Run: node tests/known-issues-http.js
 */
const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
  if (!ok) failures++;
}

const pageHtml  = fs.readFileSync(path.join(ROOT, 'pages', 'known-issues.html'), 'utf8');
const stubHtml  = fs.readFileSync(path.join(ROOT, 'known-issues.html'), 'utf8');
const footerHtml = fs.readFileSync(path.join(ROOT, 'partials', 'footer-content.html'), 'utf8');

check('known-issues page exists',       pageHtml.length > 0);
check('page has a canonical URL',       /rel="canonical"/.test(pageHtml));
check('page has a status section',      /ki-status-banner/.test(pageHtml) || /ki-status/.test(pageHtml));
check('redirect stub points to /pages/known-issues.html',
  /url=\/pages\/known-issues\.html/.test(stubHtml));
check('footer links to /known-issues',  /href="\/known-issues"/.test(footerHtml));
check('no em-dashes in page',          !/[–—]/.test(pageHtml));
check('page has nav BUILD marker or nav element',
  /BUILD:nav-content/.test(pageHtml) || /<nav/.test(pageHtml));
check('page has footer BUILD marker or footer element',
  /BUILD:footer-content/.test(pageHtml) || /<footer/.test(pageHtml));

process.exit(failures ? 1 : 0);
