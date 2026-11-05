#!/usr/bin/env node
/*
 * tests/focus-outline.js, every `outline: none` needs a keyboard ring (A2542).
 *
 * Pages remove the default focus outline to stop a double ring on inputs and
 * cards. That is fine only if a :focus-visible rule puts a ring back. This
 * scans public HTML and CSS for `outline: none` / `outline: 0` and checks that
 * the file, its inline <style> blocks, or a stylesheet loaded on the same page
 * defines :focus-visible. It does not judge the ring's contrast, only that one
 * exists.
 *
 * Run: node tests/focus-outline.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const IGNORE = new Set(['node_modules', '.git', '.claude', '.worktrees', '.github',
  'quest-board-deploy', 'tmp', 'partials', 'social-posts', 'questlog-pwa',
  'generated-images', '.continue', 'reports']);

const OUTLINE = /outline\s*:\s*(?:none|0)\b/gi;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!IGNORE.has(e.name)) walk(path.join(dir, e.name), out);
    } else if (/\.(html|css)$/i.test(e.name)) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
}

function lineAt(text, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (text[i] === '\n') line++;
  return line;
}

function resolveHref(href, file) {
  const clean = href.split(/[?#]/)[0];
  if (!clean || /^https?:/i.test(clean)) return null;
  const target = clean.startsWith('/')
    ? path.join(ROOT, clean.slice(1))
    : path.join(path.dirname(file), clean);
  return path.normalize(target);
}

function linkedCss(html, file) {
  const out = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    if (!/rel\s*=\s*["']?stylesheet/i.test(tag)) continue;
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag);
    const target = href && resolveHref(href[1], file);
    if (target) out.push(target);
  }
  return out;
}

const files = walk(ROOT);
const htmlFiles = files.filter(f => f.endsWith('.html'));
const cssFiles = files.filter(f => f.endsWith('.css'));

const cache = new Map();
function read(file) {
  if (!cache.has(file)) {
    try { cache.set(file, stripComments(fs.readFileSync(file, 'utf8'))); }
    catch { cache.set(file, ''); }
  }
  return cache.get(file);
}

/* Pages that link this CSS, and whether that page has a focus-visible rule. */
const linkedByCoveredPage = new Set();
const pageFails = [];

for (const file of htmlFiles) {
  const html = read(file);
  OUTLINE.lastIndex = 0;
  const hits = [];
  let m;
  while ((m = OUTLINE.exec(html))) hits.push(m.index);

  const sheets = linkedCss(html, file);
  const inline = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(x => x[1]).join('\n');
  const covered = /:focus-visible/i.test(inline)
    || sheets.some(css => /:focus-visible/i.test(read(css)));

  if (covered) sheets.forEach(css => linkedByCoveredPage.add(css));
  if (hits.length && !covered) {
    hits.forEach(idx => pageFails.push(`${path.relative(ROOT, file)}:${lineAt(html, idx)} has outline:none but no :focus-visible`));
  }
}

const cssFails = [];
for (const file of cssFiles) {
  const css = read(file);
  OUTLINE.lastIndex = 0;
  const hits = [];
  let m;
  while ((m = OUTLINE.exec(css))) hits.push(m.index);
  if (!hits.length) continue;
  if (/:focus-visible/i.test(css) || linkedByCoveredPage.has(file)) continue;
  hits.forEach(idx => cssFails.push(`${path.relative(ROOT, file)}:${lineAt(css, idx)} has outline:none but no :focus-visible`));
}

const fails = pageFails.concat(cssFails);
if (fails.length) {
  console.log(`x focus-outline: ${fails.length} outline:none rule(s) with no focus-visible replacement:`);
  fails.forEach(f => console.log('    ' + f));
  process.exit(1);
}

console.log(`ok focus-outline: every outline:none in ${htmlFiles.length} HTML and ${cssFiles.length} CSS files has a :focus-visible replacement`);
