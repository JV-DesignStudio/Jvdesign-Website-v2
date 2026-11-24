#!/usr/bin/env node
/**
 * A2007: Add breadcrumb-inject.js to pages that have BreadcrumbList JSON-LD
 * but are missing the inject script tag.
 * Targets: tools/*.html, games/*.html, and any workshops missing it.
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const glob = require('fs');

const BASE = path.resolve(__dirname, '..');

const INJECT_BLOCK = `<!-- BUILD:breadcrumb -->\n<script src="/assets/js/breadcrumb-inject.js" defer></script>\n<!-- /BUILD:breadcrumb -->`;

function processDir(dir) {
  const dirPath = path.join(BASE, dir);
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.html'));
  let added = 0;
  let skipped = 0;

  for (const f of files) {
    const p = path.join(dirPath, f);
    let html = fs.readFileSync(p, 'utf8');

    // Skip if already has inject
    if (html.includes('breadcrumb-inject.js')) { skipped++; continue; }

    // Skip if no BreadcrumbList JSON-LD
    if (!html.includes('BreadcrumbList')) { skipped++; continue; }

    // Add inject before </head>
    if (!html.includes('</head>')) { skipped++; continue; }

    html = html.replace('</head>', INJECT_BLOCK + '\n</head>');
    fs.writeFileSync(p, html, 'utf8');
    console.log('  + ' + dir + '/' + f);
    added++;
  }

  return { added, skipped };
}

console.log('Adding breadcrumb inject to pages with BreadcrumbList JSON-LD...');
const r1 = processDir('tools');
const r2 = processDir('games');
const r3 = processDir('workshops');

console.log('\nDone.');
console.log('  tools:     added=' + r1.added + ' skipped=' + r1.skipped);
console.log('  games:     added=' + r2.added + ' skipped=' + r2.skipped);
console.log('  workshops: added=' + r3.added + ' skipped=' + r3.skipped);
