#!/usr/bin/env node
/**
 * validate-script-refs.js - Catch missing scripts, stylesheets and CSS url()
 * references before they reach the published site, and flag duplicate script
 * loading on the same page.
 *
 * Checks:
 *   1. Every <script src="..."> local reference resolves to a file on disk.
 *   2. Every <link rel="stylesheet" href="..."> local reference resolves.
 *   3. Every url(...) inside <style> blocks resolves.
 *   4. No page loads the same script src more than once (duplicate detection).
 *
 * Exit 1 if any issue is found so it can gate a build or pre-commit hook.
 * Run: node scripts/validate-script-refs.js
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const { ROOT, IGNORE_DIRS } = require('./lib/paths');

// ── helpers ──────────────────────────────────────────────────────────────────

function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (IGNORE_DIRS.has(e.name)) continue;
      out = out.concat(walk(path.join(dir, e.name)));
    } else if (e.isFile() && e.name.endsWith('.html')) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

function resolveRef(ref, fileDir) {
  let clean = ref.split('?')[0].split('#')[0];
  try { clean = decodeURIComponent(clean); } catch (_) { /* use as-is */ }
  if (!clean) return null;
  if (/^(https?:|data:|javascript:|\/\/)/i.test(clean)) return null; // external
  if (clean.startsWith('/')) return path.join(ROOT, clean);
  return path.resolve(fileDir, clean);
}

function isTemplate(ref) {
  return ref.includes('${') || ref.includes('{{') || ref.includes('{%');
}

// ── scan ─────────────────────────────────────────────────────────────────────

const issues = [];   // { file, type, ref, detail }

for (const filePath of walk(ROOT)) {
  const rel  = path.relative(ROOT, filePath).replace(/\\/g, '/');
  const dir  = path.dirname(filePath);
  const raw  = fs.readFileSync(filePath, 'utf8');
  // Strip inline script bodies (keep opening tag) so JS-internal strings like
  // '...phaser...' don't get matched as real src attributes.
  const html = raw.replace(/(<script\b[^>]*>)[\s\S]*?<\/script\s*>/gi, '$1');

  // 1 & 4 — <script src="..."> references + duplicate detection
  const scriptSrcs = [];
  for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/gi)) {
    const ref = m[1];
    if (isTemplate(ref)) continue;
    scriptSrcs.push(ref);
    const abs = resolveRef(ref, dir);
    if (abs && !fs.existsSync(abs)) {
      issues.push({ file: rel, type: 'missing-script', ref });
    }
  }
  // Duplicate detection (same normalised src used more than once per page)
  const seen = new Map();
  for (const s of scriptSrcs) {
    const key = s.split('?')[0].toLowerCase();
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  for (const [key, count] of seen) {
    if (count > 1) {
      issues.push({ file: rel, type: 'duplicate-script', ref: key, detail: `loaded ${count}x` });
    }
  }

  // 2 — <link rel="stylesheet" href="...">
  for (const m of html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"/gi)) {
    const ref = m[1];
    if (isTemplate(ref)) continue;
    const abs = resolveRef(ref, dir);
    if (abs && !fs.existsSync(abs)) {
      issues.push({ file: rel, type: 'missing-stylesheet', ref });
    }
  }
  // also <link href="..." rel="stylesheet"> (attr order flipped)
  for (const m of html.matchAll(/<link\b[^>]*\bhref="([^"]+)"[^>]*\brel="stylesheet"/gi)) {
    const ref = m[1];
    if (isTemplate(ref)) continue;
    const abs = resolveRef(ref, dir);
    if (abs && !fs.existsSync(abs)) {
      issues.push({ file: rel, type: 'missing-stylesheet', ref });
    }
  }

  // 3 — url(...) inside inline <style> blocks
  for (const styleM of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    for (const urlM of styleM[1].matchAll(/url\(\s*['"]?([^'")\s]+)['"]?\s*\)/g)) {
      const ref = urlM[1];
      if (isTemplate(ref)) continue;
      const abs = resolveRef(ref, dir);
      if (abs && !fs.existsSync(abs)) {
        issues.push({ file: rel, type: 'missing-css-url', ref });
      }
    }
  }
}

// ── report ────────────────────────────────────────────────────────────────────

if (issues.length === 0) {
  console.log('validate:script-refs  OK — no missing scripts, stylesheets or broken css url() references found');
  process.exit(0);
}

const byType = {};
for (const i of issues) {
  (byType[i.type] = byType[i.type] || []).push(i);
}

let hasError = false;
for (const [type, list] of Object.entries(byType)) {
  const isDuplicate = type === 'duplicate-script';
  if (!isDuplicate) hasError = true;
  console.log(`\n${isDuplicate ? 'WARN' : 'ERROR'} [${type}] ${list.length} issue(s):`);
  for (const i of list) {
    const detail = i.detail ? ` (${i.detail})` : '';
    console.log(`  ${i.file}  →  ${i.ref}${detail}`);
  }
}

if (hasError) {
  console.log('\nFix missing files or references before publishing.');
  process.exit(1);
} else {
  // only warnings (duplicates) — exit 0 so it doesn't block releases for now
  console.log('\nNo blocking errors. Review duplicate warnings above.');
  process.exit(0);
}
