#!/usr/bin/env node
/**
 * scripts/validate-search-coverage.js
 *
 * CI gate: every published tool, game, and workshop in the content registries
 * must be either:
 *   (a) present in search-index.json, OR
 *   (b) noindex on disk (intentionally excluded - embed frames, redirect stubs, etc.)
 *
 * A registry item that passes neither check is a real gap - a page that is
 * listed as live but invisible to both search and the site indexer.
 *
 * Run standalone:  node scripts/validate-search-coverage.js
 * Run via build:   npm run build  (runs after the sitemap stage)
 * Run in CI:       npm run validate:search-coverage
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function load(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

const NOINDEX_RE = /name="robots"\s+content="[^"]*noindex/i;

function isNoindex(relUrl) {
  // relUrl e.g. "/workshops/foo.html" or "workshops/foo.html"
  const rel = relUrl.replace(/^\//, '');
  const fp  = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) return false;
  return NOINDEX_RE.test(fs.readFileSync(fp, 'utf8'));
}

function run({ verbose = true } = {}) {
  const index = load('search-index.json');
  const indexed = new Set(
    (index.pages || []).map(p => p.url.replace(/^\//, '').toLowerCase())
  );

  const tools     = load('content/tools.json');
  const games     = load('content/games.json');
  const workshops = load('content/workshops.json');

  const missing = [];
  let   checked = 0;
  let   skippedNoindex = 0;

  function check(items, label) {
    for (const item of items) {
      if (item.comingSoon) continue;
      if (!item.url) continue;
      checked++;
      const rel = item.url.replace(/^\//, '').toLowerCase();
      if (indexed.has(rel)) continue;
      // Not in search index - is it intentionally noindex on disk?
      if (isNoindex(item.url)) { skippedNoindex++; continue; }
      missing.push({ label, id: item.id || item.title, url: item.url });
    }
  }

  check(tools,     'tool');
  check(games,     'game');
  check(workshops, 'workshop');

  if (verbose) {
    if (missing.length === 0) {
      console.log(`✓ validate:search-coverage  ${checked} registry items checked - all indexed or intentionally noindex (${skippedNoindex} noindex excluded)`);
    } else {
      console.error(`✗ validate:search-coverage  ${missing.length} item(s) are published (not noindex) but absent from search-index.json:\n`);
      for (const m of missing) {
        console.error(`  [${m.label}] ${m.id}  →  ${m.url}`);
      }
      console.error(`\nRun "npm run build:sitemap" to regenerate the search index, then re-check.`);
    }
  }

  return missing;
}

if (require.main === module) {
  const missing = run();
  if (missing.length > 0) process.exit(1);
}

module.exports = { run };
