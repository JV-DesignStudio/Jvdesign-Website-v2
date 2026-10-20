#!/usr/bin/env node
/*
 * scripts/update-css-baseline.js - regenerate css-gate-baseline.json.
 *
 * Run this after intentionally adding a new bespoke style-*.css file or
 * new hardcoded hex values in inline <style> blocks, then commit the updated
 * baseline alongside your changes so the sprawl gate (A1637) stays green.
 *
 * Usage: node scripts/update-css-baseline.js
 */
const fs = require('fs');
const path = require('path');
const { IGNORE_DIRS } = require('./lib/paths');

const ROOT = path.resolve(__dirname, '..');
const allCss = [];

function walkCss(dir) {
  for (const e of fs.readdirSync(dir, {withFileTypes:true})) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (!IGNORE_DIRS.has(e.name)) walkCss(full); continue; }
    const assetsPath = path.sep + 'assets' + path.sep + 'css' + path.sep;
    if (/^style-.+\.css$/.test(e.name) && !full.includes(assetsPath)) {
      allCss.push(path.relative(ROOT, full).split(path.sep).join('/'));
    }
  }
}

const hexSet = new Set();
const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/g;
const HEX = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g;

function walkHtml(dir) {
  for (const e of fs.readdirSync(dir, {withFileTypes:true})) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (!IGNORE_DIRS.has(e.name)) walkHtml(full); continue; }
    if (!e.name.endsWith('.html')) continue;
    const src = fs.readFileSync(full, 'utf8');
    let m;
    styleRe.lastIndex = 0;
    while ((m = styleRe.exec(src))) {
      HEX.lastIndex = 0;
      let h;
      while ((h = HEX.exec(m[1]))) hexSet.add(h[0].toLowerCase());
    }
  }
}

walkCss(ROOT);
walkHtml(ROOT);

const baseline = {
  bespoke_stylesheets: allCss.sort(),
  inline_hex_unique_count: hexSet.size,
  inline_hex_values: [...hexSet].sort()
};

const outPath = path.join(ROOT, 'css-gate-baseline.json');
fs.writeFileSync(outPath, JSON.stringify(baseline, null, 2));
console.log(`Updated css-gate-baseline.json`);
console.log(`  Bespoke stylesheets: ${allCss.length}`);
console.log(`  Unique inline hex values: ${hexSet.size}`);
console.log(`Commit css-gate-baseline.json alongside your changes.`);
