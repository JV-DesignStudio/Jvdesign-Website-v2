#!/usr/bin/env node
/**
 * A1995 — SW offline coverage: registry-vs-filesystem
 *
 * Parses every entry in sw.js CORE and MAKER_DEPS and asserts each one maps to
 * an actual file on disk. Then cross-checks that every tool in content/tools.json
 * whose URL appears in CORE has a corresponding HTML file, so a renamed or removed
 * tool page cannot silently make the SW precache attempt a ghost URL.
 *
 * This is the static, fast sibling of tests/offline-tools-smoke.js (which starts
 * a real browser). Run it in CI before the browser tests so failures surface early
 * with a clear file-not-found message rather than a cryptic Puppeteer timeout.
 */

const fs   = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OK   = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';

// ── 1. Parse CORE and MAKER_DEPS from sw.js ──────────────────────────────────

const swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

function parseArray(src, name) {
  const m = src.match(new RegExp(`const ${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
  if (!m) throw new Error(`Could not find ${name} array in sw.js`);
  return m[1]
    .split('\n')
    .map(line => line.replace(/\/\/.*$/, '').trim())   // strip inline comments
    .map(line => line.replace(/^['"`]|['"`],?$/g, '').trim())
    .filter(Boolean);
}

const CORE       = parseArray(swSrc, 'CORE');
const MAKER_DEPS = parseArray(swSrc, 'MAKER_DEPS');
const allEntries = [...new Set([...CORE, ...MAKER_DEPS])];

// ── 2. Check every SW entry resolves to a real file ──────────────────────────

const missingFiles = [];

for (const entry of allEntries) {
  // Strip query strings and anchors, normalise to a root-relative path.
  const clean  = entry.split('?')[0].split('#')[0];
  const relPath = clean.replace(/^\//, '');
  const abs    = path.join(ROOT, relPath);

  // Directories (ending in /) → check for index.html inside.
  const target = clean.endsWith('/') ? path.join(abs, 'index.html') : abs;

  if (!fs.existsSync(target)) {
    missingFiles.push({ entry, target: path.relative(ROOT, target) });
  }
}

// ── 3. Cross-check content/tools.json against CORE ───────────────────────────
// Every non-comingSoon tool whose URL matches a CORE entry must have its HTML
// file on disk (belt-and-suspenders: CORE check above already catches this, but
// this names the tool by title for a much clearer error message).

const toolsRaw = require(path.join(ROOT, 'content', 'tools.json'));
const tools    = Object.values(toolsRaw).filter(t => t && t.url && !t.comingSoon);
const coreSet  = new Set(CORE);

const ghostTools = [];
for (const tool of tools) {
  if (!coreSet.has(tool.url)) continue; // only check CORE-listed tools here
  const abs = path.join(ROOT, tool.url.replace(/^\//, ''));
  if (!fs.existsSync(abs)) {
    ghostTools.push({ title: tool.title, url: tool.url, file: path.relative(ROOT, abs) });
  }
}

// ── 4. Report ─────────────────────────────────────────────────────────────────

let failed = false;

if (missingFiles.length > 0) {
  failed = true;
  console.error(`\nSW coverage FAIL — ${missingFiles.length} CORE/MAKER_DEPS entr${missingFiles.length === 1 ? 'y' : 'ies'} point to missing files:`);
  for (const { entry, target } of missingFiles) {
    console.error(`  ${FAIL}  ${entry}  →  ${target} (not found)`);
  }
  console.error('\nUpdate CORE/MAKER_DEPS in sw.js and bump CACHE_NAME to match reality.');
}

if (ghostTools.length > 0) {
  failed = true;
  console.error(`\nSW coverage FAIL — ${ghostTools.length} tool(s) in content/tools.json are in CORE but their HTML is missing:`);
  for (const { title, url, file } of ghostTools) {
    console.error(`  ${FAIL}  "${title}"  url=${url}  file=${file} (not found)`);
  }
}

if (!failed) {
  console.log(
    `${OK} SW coverage OK — ${CORE.length} CORE + ${MAKER_DEPS.length} MAKER_DEPS entries, ` +
    `all files present on disk (${ghostTools.length === 0 ? 'tool registry cross-check clean' : ''})`
  );
}

if (failed) process.exit(1);
