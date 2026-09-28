#!/usr/bin/env node
/*
 * scripts/plan-repo-tidy.js, report-only move plan for A262 (tidy repo root).
 *
 * A262 wants 324 style-*.css, 204 images and 31 zip/office files moved out of
 * the repo root into assets/. That is a site-wide content rewrite: it touches
 * every page, the service worker precache and the build/app-sync scripts.
 *
 * AGENTS.md (A255) is explicit: "No automated content rewrites without a
 * reviewed diff. Scripts may report (dashes, drift, links); a person reviews
 * and applies fixes." So this script only REPORTS. It never moves a file and
 * never edits a page. It prints the exact move list and every reference that a
 * human would have to rewrite, plus the build files that hardcode root names.
 *
 * Run: node scripts/plan-repo-tidy.js            (summary to stdout)
 *      node scripts/plan-repo-tidy.js --json     (machine readable)
 *      node scripts/plan-repo-tidy.js --files    (full per-file rewrite list)
 *
 * Always exits 0. It is a reporter, not a gate.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AS_JSON = process.argv.includes('--json');
const SHOW_FILES = process.argv.includes('--files');

// Where each kind of root file would move to.
const TARGETS = [
  { dir: 'assets/css', test: f => f.endsWith('.css') },
  { dir: 'assets/img', test: f => /\.(png|jpe?g|webp|avif|gif|svg)$/i.test(f) },
  { dir: 'assets/downloads', test: f => /\.(zip|pdf|docx|pptx|xlsx)$/i.test(f) },
];

// Never read or rewrite these: build output, deps, archives, private or
// business docs. revenue/ holds listing copy that intentionally names the
// shipped file, and board/ is private planning.
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.tmp', 'tmp', 'audit-shots', 'board',
  'social-posts', 'revenue', 'archive', 'quests', 'verification',
  'Character Refrence sheets', 'og',
]);
const SCAN_EXT = /\.(html|js|css|json|md|xml|txt|webmanifest)$/i;

// Build and sync tooling that hardcodes root-level file names. These need
// editing by hand even after the pages are fixed.
const TOOLING = ['sw.js', 'build.js', 'make-app-bundle.js', 'make-public.js', 'games-registry.js'];

const rel = p => path.relative(ROOT, p).split(path.sep).join('/');

function walk(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(p, out);
    } else if (SCAN_EXT.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

// 1. what would move
const rootFiles = fs.readdirSync(ROOT, { withFileTypes: true })
  .filter(e => e.isFile())
  .map(e => e.name);

const moves = [];
for (const f of rootFiles) {
  for (const t of TARGETS) {
    if (t.test(f)) { moves.push({ from: f, to: `${t.dir}/${f}` }); break; }
  }
}
const byGroup = {};
for (const m of moves) {
  const g = m.to.split('/')[1];
  (byGroup[g] = byGroup[g] || []).push(m);
}

// 2. who references them
const files = walk(ROOT, []);
const refs = new Map(); // file -> [{name, count}]
for (const f of files) {
  let txt;
  try { txt = fs.readFileSync(f, 'utf8'); } catch { continue; }
  for (const m of moves) {
    // Count real references, not incidental mentions in prose.
    const hits = txt.split(m.from).length - 1;
    if (hits > 0) {
      if (!refs.has(f)) refs.set(f, []);
      refs.get(f).push({ name: m.from, count: hits });
    }
  }
}

// 3. tooling that hardcodes a name we would move
const toolingHits = [];
for (const t of TOOLING) {
  const p = path.join(ROOT, t);
  if (!fs.existsSync(p)) continue;
  const txt = fs.readFileSync(p, 'utf8');
  for (const m of moves) {
    const hits = txt.split(m.from).length - 1;
    if (hits > 0) toolingHits.push({ tool: t, name: m.from, count: hits });
  }
}

// 4. collision check: does anything already sit at the target path?
const collisions = moves.filter(m => fs.existsSync(path.join(ROOT, m.to)));

// 5. target dirs that do not exist yet
const missingDirs = [...new Set(moves.map(m => path.dirname(m.to)))]
  .filter(d => !fs.existsSync(path.join(ROOT, d)));

// 6. how deep the rewrite goes per directory
const perDir = {};
for (const [f] of refs) {
  const d = rel(path.dirname(f)) || '.';
  perDir[d] = (perDir[d] || 0) + 1;
}

const report = {
  generatedFor: 'A262',
  mode: 'report-only, applies nothing',
  totals: {
    rootFilesScanned: rootFiles.length,
    filesToMove: moves.length,
    filesToRewrite: refs.size,
    referenceHits: [...refs.values()].reduce((n, l) => n + l.reduce((m, r) => m + r.count, 0), 0),
    toolingHits: toolingHits.length,
  },
  movesByGroup: Object.fromEntries(Object.entries(byGroup).map(([k, v]) => [k, v.length])),
  filesToRewriteByDir: perDir,
  toolingHits,
  collisions,
  missingDirs,
};

if (AS_JSON) {
  console.log(JSON.stringify({ ...report, moves, refs: Object.fromEntries([...refs].map(([f, l]) => [rel(f), l])) }, null, 2));
} else {
  const t = report.totals;
  console.log('A262 repo tidy, report only. Nothing was moved or rewritten.\n');
  console.log(`  root files scanned      ${t.rootFilesScanned}`);
  console.log(`  files that would move   ${t.filesToMove}  (${Object.entries(report.movesByGroup).map(([k, v]) => `${k} ${v}`).join(', ')})`);
  console.log(`  files needing rewrites  ${t.filesToRewrite}`);
  console.log(`  reference occurrences    ${t.referenceHits}`);
  console.log(`  build/sync name hits     ${t.toolingHits}\n`);
  console.log(`  files by directory:`);
  Object.entries(perDir).sort((a, b) => b[1] - a[1])
    .forEach(([d, n]) => console.log(`    ${String(n).padStart(4)}  ${d}`));
  if (collisions.length) {
    console.log(`\n  COLLISIONS (target already exists), do not move blindly:`);
    collisions.forEach(c => console.log(`    ${c.from} -> ${c.to}`));
  }
  if (missingDirs.length) {
    console.log(`\n  target dirs to create: ${missingDirs.join(', ')}`);
  }
  console.log(`\n  build/sync files hardcoding root names:`);
  const byTool = {};
  for (const h of toolingHits) (byTool[h.tool] = byTool[h.tool] || []).push(`${h.name} x${h.count}`);
  for (const [tool, list] of Object.entries(byTool)) console.log(`    ${tool}: ${list.join(', ')}`);
  if (SHOW_FILES) {
    console.log('\n  per-file reference list:');
    for (const [f, list] of [...refs].sort()) {
      console.log(`    ${rel(f)}: ${list.map(r => `${r.name} x${r.count}`).join(', ')}`);
    }
  } else {
    console.log('\n  (re-run with --files for the per-file list, --json for machine output)');
  }
}
process.exit(0);
