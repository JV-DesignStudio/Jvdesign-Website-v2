#!/usr/bin/env node
// scripts/report-inline.js (A1494 / A1485): measure inline-script drift toward
// removing script-src 'unsafe-inline'.
//
// For every .html page it counts:
//   - inline event handlers  (onclick="..." etc.)   -> must be replaced with addEventListener
//   - inline <script> blocks (no src, not ld+json)  -> can be externalised to a file
//
// Usage:
//   node scripts/report-inline.js            # summary + worst offenders
//   node scripts/report-inline.js --clean    # pages with 0 handlers (ready to externalise scripts)
//   node scripts/report-inline.js --json     # machine readable
//   node scripts/report-inline.js --top 40
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IGN = new Set(['node_modules', '.git', '.claude', 'tmp', 'quest-board-deploy', '.aider.tags.cache.v4', '.github']);

const HANDLER = /\son(?:click|input|change|submit|load|error|mouseover|mouseout|keydown|keyup|keypress|focus|blur|touchstart|touchend|touchmove|animationend|animationstart|transitionend|drag|dragstart|dragover|drop|scroll|play|pause|ended|contextmenu|dblclick|pointerdown|pointerup|pointermove|wheel|reset|invalid|toggle|select)\s*=\s*["']/gi;
const INLINE = /<script(?![^>]*\bsrc=)[^>]*>/gi;
const LDJSON = /type\s*=\s*["']application\/ld\+json["']/i;

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGN.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p, out); continue; }
    if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const pages = walk(ROOT, []);
const rows = [];
for (const p of pages) {
  const s = fs.readFileSync(p, 'utf8');
  const handlers = (s.match(HANDLER) || []).length;
  const scriptTags = s.match(INLINE) || [];
  const inlineScripts = scriptTags.filter((t) => !LDJSON.test(t)).length;
  rows.push({ file: path.relative(ROOT, p).split(path.sep).join('/'), handlers, inlineScripts });
}

const totalHandlers = rows.reduce((a, r) => a + r.handlers, 0);
const totalScripts = rows.reduce((a, r) => a + r.inlineScripts, 0);
const withHandlers = rows.filter((r) => r.handlers > 0).length;
const withScripts = rows.filter((r) => r.inlineScripts > 0).length;

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ pages: rows.length, totalHandlers, totalScripts, rows }, null, 2));
  process.exit(0);
}

if (process.argv.includes('--clean')) {
  const clean = rows.filter((r) => r.handlers === 0 && r.inlineScripts > 0).sort((a, b) => a.inlineScripts - b.inlineScripts);
  console.log(`Pages ready for script-only externalisation (0 handlers, has inline scripts): ${clean.length}`);
  clean.forEach((r) => console.log(`  ${String(r.inlineScripts).padStart(3)} scripts  ${r.file}`));
  process.exit(0);
}

const topIdx = process.argv.indexOf('--top');
const top = topIdx >= 0 ? parseInt(process.argv[topIdx + 1], 10) || 20 : 20;
rows.sort((a, b) => (b.handlers + b.inlineScripts) - (a.handlers + a.inlineScripts));

console.log(`Inline-script report (A1485)`);
console.log(`  pages:                 ${rows.length}`);
console.log(`  pages w/ handlers:     ${withHandlers}  (${totalHandlers} inline handlers)`);
console.log(`  pages w/ inline script:${withScripts}  (${totalScripts} inline script blocks)`);
console.log(`  candidate for legacy <script> externalisation: ${rows.filter(r => r.inlineScripts > 0).length} pages`);
console.log(`\nWorst ${top} pages (handlers + inline scripts):`);
rows.slice(0, top).forEach((r) => console.log(`  ${String(r.handlers).padStart(4)}h ${String(r.inlineScripts).padStart(3)}s  ${r.file}`));
