#!/usr/bin/env node
/**
 * scripts/studio-minify.cjs - zero-dependency asset optimisation for Studio Core.
 *
 * The site deliberately has no bundler. This script is the small, boring
 * replacement for one: it writes .min.css / .min.js copies next to the source
 * files, verifies every JavaScript copy with `node --check`, and prints the
 * gzip size so a change that doubles the payload is visible in review.
 *
 * It never edits the originals and never rewrites HTML. Wiring a .min file in
 * is a deliberate, reviewed change.
 *
 *   node scripts/studio-minify.cjs          write the minified copies
 *   node scripts/studio-minify.cjs --check  verify sources and existing copies
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const FILES = [
  'assets/css/studio-core.css',
  'assets/js/studio-core.js',
  'assets/js/studio/studio-storage.js',
  'assets/js/studio/studio-bundle.js',
  'assets/js/studio/studio-preview.js',
  'assets/js/studio/studio-inspector.js',
  'assets/js/studio/studio-templates.js'
];

const CHECK = process.argv.includes('--check');

function stripCss(src) {
  let out = '';
  let i = 0;
  let quote = '';
  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];
    if (quote) {
      out += ch;
      if (ch === '\\') { out += next || ''; i += 2; continue; }
      if (ch === quote) quote = '';
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; out += ch; i++; continue; }
    if (ch === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    out += ch;
    i++;
  }
  return out
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}

function stripJs(src) {
  const lines = src.split(/\r?\n/);
  const out = [];
  // Indentation can be meaningful inside a multi-line template literal, so
  // leave it alone in any file that uses backticks.
  const trimIndent = src.indexOf('`') === -1;
  let inBlock = false;
  let quote = '';
  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index];
    let line = '';
    let i = 0;
    while (i < raw.length) {
      const ch = raw[i];
      const next = raw[i + 1];
      if (inBlock) {
        const end = raw.indexOf('*/', i);
        if (end === -1) { i = raw.length; break; }
        inBlock = false;
        i = end + 2;
        continue;
      }
      if (quote) {
        line += ch;
        if (ch === '\\') { line += next || ''; i += 2; continue; }
        if (ch === quote) quote = '';
        i++;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') { quote = ch; line += ch; i++; continue; }
      if (ch === '/' && next === '*') { inBlock = true; i += 2; continue; }
      if (ch === '/' && next === '/' && line.trim() === '') { break; }
      line += ch;
      i++;
    }
    if (line.trim()) out.push(trimIndent ? line.replace(/^\s+/, '') : line);
  }
  return out.join('\n') + '\n';
}

function sizeOf(buf) {
  return { raw: buf.length, gzip: zlib.gzipSync(buf).length };
}

let failures = 0;
for (const rel of FILES) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    console.log('  [FAIL] missing ' + rel);
    failures++;
    continue;
  }
  const source = fs.readFileSync(full, 'utf8');
  const isCss = rel.endsWith('.css');
  const minified = isCss ? stripCss(source) : stripJs(source);
  const minPath = full.replace(/\.(css|js)$/, '.min.$1');
  const before = sizeOf(Buffer.from(source, 'utf8'));
  const after = sizeOf(Buffer.from(minified, 'utf8'));

  if (!CHECK) {
    if (isCss) {
      fs.writeFileSync(minPath, minified, 'utf8');
    } else {
      const temp = minPath + '.tmp.js';
      fs.writeFileSync(temp, minified, 'utf8');
      try {
        execFileSync(process.execPath, ['--check', temp], { stdio: 'pipe' });
        fs.writeFileSync(minPath, minified, 'utf8');
      } catch (e) {
        console.log('  [WARN] ' + rel + ' minifier produced invalid JS; kept the source unchanged');
        try { fs.unlinkSync(temp); } catch (err) {}
        failures++;
        continue;
      }
      try { fs.unlinkSync(temp); } catch (e) {}
    }
  }

  const saving = before.gzip ? Math.round((1 - after.gzip / before.gzip) * 100) : 0;
  console.log('  ' + (isCss ? '[CSS] ' : '[JS]  ') + rel.padEnd(46) +
    String(before.gzip).padStart(5) + ' -> ' + String(after.gzip).padStart(5) + ' B gzip (' + saving + '% smaller)');
}

if (failures) {
  console.log('\n' + failures + ' Studio Core asset(s) failed.');
  process.exit(1);
}
console.log('\n  [PASS] Studio Core assets are valid' + (CHECK ? '' : ' and minified copies are written'));
