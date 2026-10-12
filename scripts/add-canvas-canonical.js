#!/usr/bin/env node
/**
 * A1364 - give every canvas build-along a canonical URL.
 *
 * The build-alongs are interactive companions to the step-by-step guides, so
 * they stay `noindex` on purpose (the guide is the search landing page) while
 * still carrying a canonical link for consistency and non-Google consumers.
 * The branded top bar itself is injected by workshop-canvas-engine.js.
 *
 * Idempotent. Run with --dry-run to preview.
 *   node scripts/add-canvas-canonical.js [--dry-run]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const W = path.join(ROOT, 'workshops');
const SITE = 'https://jvdesignstudio.co.uk/workshops/';
const DRY = process.argv.includes('--dry-run');

const files = fs.readdirSync(W).filter((f) => /-canvas\.html$/.test(f)).sort();
let added = 0;
const skipped = [];

for (const f of files) {
  const file = path.join(W, f);
  let html = fs.readFileSync(file, 'utf8');
  if (/rel="canonical"/i.test(html)) { skipped.push(f); continue; }
  const link = '<link rel="canonical" href="' + SITE + f + '">';
  if (/<title>[^<]*<\/title>/i.test(html)) {
    html = html.replace(/(<title>[^<]*<\/title>)/i, '$1\n' + link);
  } else if (html.includes('</head>')) {
    html = html.replace('</head>', link + '\n</head>');
  } else {
    skipped.push(f + ' (no insert point)');
    continue;
  }
  if (!DRY) fs.writeFileSync(file, html, 'utf8');
  added++;
}

console.log((DRY ? '[dry-run] ' : '') + 'canonical added: ' + added + ' / ' + files.length);
if (skipped.length) console.log('skipped (already had one or no head): ' + skipped.join(', '));
