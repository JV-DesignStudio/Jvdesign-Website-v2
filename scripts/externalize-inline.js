#!/usr/bin/env node
// scripts/externalize-inline.js (A1494 / A1485 step 1)
// Moves a page's inline <script> blocks (no src, not ld+json) into files under
// assets/js/inline/ and replaces each with a <script src> tag, preserving order,
// defer/async and type="module". This is the mechanical half of removing
// script-src 'unsafe-inline'; inline event handlers still need hand migration.
//
// Usage:
//   node scripts/externalize-inline.js --page games/foo.html            # dry run
//   node scripts/externalize-inline.js --page games/foo.html --apply    # write
//   node scripts/externalize-inline.js --clean --apply                  # every page with 0 handlers
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUTDIR = path.join(ROOT, 'assets', 'js', 'inline');
const APPLY = process.argv.includes('--apply');

// Never touch files git ignores (private/internal pages like dev-board must not
// have their scripts copied into the public assets dir). Batch the lookup once.
let IGNORED = null;
function ignoredSet() {
  if (IGNORED) return IGNORED;
  IGNORED = new Set();
  try {
    const out = execFileSync('git', ['ls-files', '--others', '--ignored', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' });
    out.split(/\r?\n/).forEach((l) => { if (l) IGNORED.add(l); });
  } catch (e) { /* git unavailable: treat nothing as ignored */ }
  return IGNORED;
}
function isIgnored(abs) {
  return ignoredSet().has(path.relative(ROOT, abs).split(path.sep).join('/'));
}

const HANDLER = /\son(?:click|input|change|submit|load|error|mouseover|mouseout|keydown|keyup|keypress|focus|blur|touchstart|touchend|touchmove|animationend|animationstart|transitionend|drag|dragstart|dragover|drop|scroll|play|pause|ended|contextmenu|dblclick|pointerdown|pointerup|pointermove|wheel|reset|invalid|toggle|select)\s*=\s*["']/gi;
const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

function listAllHtml(dir, out) {
  const IGN = new Set(['node_modules', '.git', '.claude', 'tmp', 'quest-board-deploy', '.aider.tags.cache.v4', 'assets']);
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGN.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listAllHtml(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

function targetPages() {
  const pageArgs = [];
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--page') pageArgs.push(process.argv[i + 1]);
  }
  if (pageArgs.length) return pageArgs.map((p) => path.join(ROOT, p.replace(/^[/\\]+/, '')));
  if (process.argv.includes('--clean')) {
    return listAllHtml(ROOT, []).filter((p) => {
      if (p.includes(path.sep + 'partials' + path.sep)) return false;
      if (isIgnored(p)) return false;
      const s = fs.readFileSync(p, 'utf8');
      return (s.match(HANDLER) || []).length === 0 && (s.match(/<script(?![^>]*\bsrc=)[^>]*>/gi) || []).length > 0;
    });
  }
  console.error('Provide --page <file> (repeatable) or --clean');
  process.exit(1);
}

function attrKeep(attrs) {
  const keep = [];
  if (/\bdefer\b/i.test(attrs)) keep.push('defer');
  if (/\basync\b/i.test(attrs)) keep.push('async');
  const t = attrs.match(/type\s*=\s*["']module["']/i);
  if (t) keep.push('type="module"');
  return keep.length ? ' ' + keep.join(' ') : '';
}

function safeBase(rel) {
  return rel.replace(/\.html$/i, '').replace(/[\\/]+/g, '-').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
}

let written = 0, changedFiles = 0, skippedDocWrite = 0;
if (APPLY) fs.mkdirSync(OUTDIR, { recursive: true });

for (const page of targetPages()) {
  const rel = path.relative(ROOT, page).split(path.sep).join('/');
  if (!fs.existsSync(page)) { console.log('  [skip] missing ' + rel); continue; }
  if (isIgnored(page)) { console.log('  [skip] git-ignored ' + rel); continue; }
  let src = fs.readFileSync(page, 'utf8');
  const base = safeBase(rel);
  let n = 0;
  const before = src;
  src = src.replace(SCRIPT_RE, (whole, attrs, body) => {
    if (/\bsrc\s*=/i.test(attrs)) return whole;
    if (/application\/ld\+json/i.test(attrs)) return whole;
    if (!body.trim()) return whole;
    if (/document\.write\s*\(/.test(body)) { skippedDocWrite++; console.log('  [keep] document.write in ' + rel); return whole; }
    n++;
    const name = base + '-' + n + '.js';
    const outRel = 'assets/js/inline/' + name;
    if (APPLY) fs.writeFileSync(path.join(OUTDIR, name), body.replace(/^\r?\n/, ''), 'utf8');
    written++;
    // Emit a page-relative path (e.g. ../assets/... from games/) rather than a
    // root-absolute one, so the page also loads when the site is served from a
    // sub-folder (local Live Server) or via file://, not only from the domain root.
    const prefix = path.relative(path.dirname(page), ROOT).split(path.sep).join('/');
    const relSrc = (prefix ? prefix + '/' : '') + outRel;
    return '<script src="' + relSrc + '"' + attrKeep(attrs) + '></script>';
  });
  if (src !== before) {
    changedFiles++;
    console.log((APPLY ? '  [done] ' : '  [dry ] ') + rel + ' -> ' + n + ' external script(s)');
    if (APPLY) fs.writeFileSync(page, src, 'utf8');
  }
}
console.log(`\n${APPLY ? 'Wrote' : 'Would write'} ${written} script file(s) across ${changedFiles} page(s); kept ${skippedDocWrite} inline (document.write).`);
if (!APPLY) console.log('Re-run with --apply to write changes.');
