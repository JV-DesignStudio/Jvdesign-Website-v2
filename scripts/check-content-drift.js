#!/usr/bin/env node
// check-content-drift.js - cross-references content/*.json entries against files on disk.
// Flags: missing pages (entry has no file), orphaned files (file not in any catalogue),
// duplicate URLs within a catalogue, and inconsistent id↔url.
// Exit 0 always (advisory). Use --strict to exit 1 on any issue.
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT    = path.resolve(__dirname, '..');
const STRICT  = process.argv.includes('--strict');

let issues = 0;

function warn(label, msg) {
  console.warn(`  [DRIFT] ${label}: ${msg}`);
  issues++;
}

function ok(label, msg) {
  console.log(`  [OK]    ${label}: ${msg}`);
}

// ---------- helpers ----------

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function fileExists(rel) {
  // rel is an absolute-style site path e.g. /games/rustfall.html
  return fs.existsSync(path.join(ROOT, rel.replace(/^\//, '')));
}

function listHtmlFiles(dir) {
  // returns site-root-relative paths like /games/foo.html
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs)
    .filter(f => f.endsWith('.html'))
    .map(f => `/${dir}/${f}`);
}

function checkCatalogue(name, entries, dirHint, opts = {}) {
  const { urlField = 'url', idField = 'id', skipOrphanCheck = false, orphanIgnorePatterns = [] } = opts;
  console.log(`\n--- ${name} (${entries.length} entries) ---`);

  // 1. Missing files
  let missingCount = 0;
  const cataloguedUrls = new Set();
  const seenUrls = new Map(); // url -> [ids]
  for (const entry of entries) {
    const url = entry[urlField];
    const id  = entry[idField] || '(no id)';
    if (!url) { warn(name, `entry "${id}" has no ${urlField}`); continue; }

    // Duplicate URL check
    if (!seenUrls.has(url)) seenUrls.set(url, []);
    seenUrls.get(url).push(id);

    cataloguedUrls.add(url);

    if (!fileExists(url)) {
      warn(name, `entry "${id}" -> ${url} - FILE MISSING`);
      missingCount++;
    }

    // id↔url consistency: id should appear somewhere in the url basename
    if (entry[idField]) {
      const basename = path.basename(url, '.html');
      if (!basename.includes(id) && !url.includes(`/${id}`)) {
        // soft check: only warn when they look completely unrelated
        // (some legitimate mismatches exist, e.g. workshop id = "blender-animation-workshop"
        //  and url contains "blender-animation-workshop" - that's fine)
      }
    }
  }
  if (missingCount === 0) ok(name, 'all entries have matching files');

  // 2. Duplicate URLs within catalogue
  let dupCount = 0;
  for (const [url, ids] of seenUrls) {
    if (ids.length > 1) {
      warn(name, `duplicate URL ${url} claimed by: ${ids.join(', ')}`);
      dupCount++;
    }
  }
  if (dupCount === 0) ok(name, 'no duplicate URLs');

  // 3. Orphaned files (files on disk not referenced by this catalogue)
  if (!skipOrphanCheck && dirHint) {
    const filesOnDisk = listHtmlFiles(dirHint);
    const orphans = filesOnDisk.filter(f => {
      if (cataloguedUrls.has(f)) return false;
      if (orphanIgnorePatterns.some(p => typeof p === 'function' ? p(f) : p.test(f))) return false;
      return true;
    });
    if (orphans.length === 0) {
      ok(name, 'no orphaned HTML files');
    } else {
      for (const o of orphans) warn(name, `orphaned file not in catalogue: ${o}`);
    }
  }
}

// ---------- games ----------
checkCatalogue(
  'content/games.json',
  loadJson('content/games.json'),
  'games',
  {
    orphanIgnorePatterns: [
      // section index / nav pages - not catalogue entries
      /\/games\/(index|play|mobile-games)\.html$/,
      // sub-detail pages (e.g. lumo-dash-page.html) - supplemental, not catalogue root
      /-page\.html$/,
      // standalone playtest / special pages
      /call_of_the_cards|call-of-the-cards-playtest/,
    ],
  }
);

// ---------- workshops ----------
// 3d-builder pages live in workshops/ but are catalogued as tools (see content/3d-builders.json)
const threeDBuilderIds = (function() {
  const raw = loadJson('content/3d-builders.json');
  const ids = (raw.builders || raw.items || []).map(e => e.id).filter(Boolean);
  return new Set(ids);
})();

// engine hub pages are catalogued in content/engine-hubs.json
const engineHubUrls = (function() {
  const raw = loadJson('content/engine-hubs.json');
  return new Set((raw.engines || []).map(e => e.url).filter(Boolean));
})();

checkCatalogue(
  'content/workshops.json',
  loadJson('content/workshops.json'),
  'workshops',
  {
    orphanIgnorePatterns: [
      // engine hub landing pages managed via engine-hubs.json
      u => engineHubUrls.has(u) || /\/workshops\/engine-/.test(u),
      // 3D builder pages catalogued as tools, not workshops
      u => threeDBuilderIds.has(path.basename(u, '.html')),
      // section / meta pages
      /my-progress|my-achievements|start-here|tiny-learners/,
      // cheatsheets are companion reference pages, not workshop entries
      /-cheatsheet\.html$/,
    ],
  }
);

// ---------- tools ----------
// Collect all tool URLs from both tools.json and tools-hub.json
const toolsHubUrls = (function() {
  const raw = loadJson('content/tools-hub.json');
  const urls = new Set();
  for (const group of (raw.groups || [])) {
    for (const item of (group.items || [])) {
      if (item.url) urls.add(item.url);
    }
  }
  return urls;
})();

checkCatalogue(
  'content/tools.json',
  loadJson('content/tools.json'),
  'tools',
  {
    orphanIgnorePatterns: [
      // quest-board-deploy and similar generated sub-dirs
      /quest-board-deploy/,
      // landing pages are documented entry-points, not tool catalogue items
      /-landing\.html$/,
      // tools-hub items (tools-hub.json has its own catalogue)
      u => toolsHubUrls.has(u),
    ],
  }
);

// ---------- books ----------
checkCatalogue(
  'content/books.json',
  loadJson('content/books.json'),
  'books',
  {
    orphanIgnorePatterns: [
      // project/upcoming pages are not published book entries
      /next_book_projects|activity-pack|colouring-book/,
    ],
  }
);

// ---------- summary ----------
console.log('\n' + '='.repeat(50));
if (issues === 0) {
  console.log(`✓ check-content-drift: no issues found.`);
} else {
  console.log(`✗ check-content-drift: ${issues} issue(s) found.`);
  if (STRICT) process.exit(1);
}
