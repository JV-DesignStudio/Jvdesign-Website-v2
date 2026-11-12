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
 * A1818 adds a duplicate-intent audit over every indexable page:
 *   - hard fail: two pages share a canonical URL, title or meta description
 *   - advisory: two pages share an intent signature (same distinctive title
 *     words), near-duplicate titles (Jaccard >= 0.8), thin pages (< 120 words)
 *     and pages with no inbound internal link
 *
 * The advisory lanes are deliberately warnings. Pages can share a topic and
 * still have distinct roles (guide vs catalogue vs course), so they are listed
 * for a human decision rather than silently failing the build. Run with
 * `--strict` to make duplicate-intent groups fail too.
 *
 * Run standalone:  node scripts/validate-search-coverage.js [--strict]
 * Run via build:   npm run build  (coverage only, no intent lane)
 * Run in CI:       npm run validate:search-coverage
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const { ROOT, IGNORE_DIRS, EXCLUDE_FILES, GAME_ORPHANS } = require('./lib/paths');
const { walk } = require('./lib/walk');

const NOINDEX_RE = /name="robots"\s+content="[^"]*noindex/i;

// Files that are not indexable landing pages even without a robots tag.
const EXTRA_EXCLUDE = new Set([
  'games/game-template.html',
  'games/cozy-biscuit-clicker.pre-app.bak.html',
]);

// Words that appear in almost every title on the site. Stripping them leaves
// the distinctive topic, so "Godot for Beginners: Free Tutorials" and
// "Godot Workshops: Free Beginner Tutorials" collapse to the same intent.
const GENERIC = new Set((
  'a an and are at be by can do does for free from get has have how i in into is it its ' +
  'jvds jvdesignstudio learn make making more my new no not of on one or our out play ' +
  'step steps than that the their them then there these they this to try up use using ' +
  'we what when where which who why will with you your ' +
  'beginner beginners build building course courses create creating dev development ' +
  'easy first game games guide guides idea ideas kids learn learning lesson lessons ' +
  'online project projects series sheet sheets start starter starters studio tutorial ' +
  'tutorials video workshop workshops world worlds printable pdf cheat print quick ' +
  'best top 2024 2025 2026'
).split(/\s+/).filter(Boolean));

const WORD_RE = /[a-z0-9]+/g;

function load(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function isNoindex(relUrl) {
  // relUrl e.g. "/workshops/foo.html" or "workshops/foo.html"
  const rel = relUrl.replace(/^\//, '');
  const fp  = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) return false;
  return NOINDEX_RE.test(fs.readFileSync(fp, 'utf8'));
}

function robotsNoindex(html) {
  const m = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i);
  return m ? /noindex/i.test(m[1]) : false;
}

// Mirror generate-sitemap.js: filesystem path -> clean canonical URL.
function toCleanUrl(rel) {
  if (rel === 'index.html') return '/';
  if (rel.startsWith('pages/')) return '/' + rel.replace(/^pages\//, '').replace(/\.html$/, '');
  if (rel === 'learn/index.html') return '/learn/';
  if (rel.startsWith('learn/')) return '/' + rel.replace(/\.html$/, '');
  if (rel.endsWith('.bak.html')) return null;
  return '/' + rel;
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ');
}

function textOf(s) {
  return decodeEntities(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function tokens(s) {
  const out = [];
  for (const w of textOf(s).toLowerCase().match(WORD_RE) || []) {
    if (w.length < 3) continue;
    if (GENERIC.has(w)) continue;
    if (/^\d+$/.test(w)) continue;
    out.push(w);
  }
  return out;
}

function intentKey(title, rel) {
  const set = new Set(tokens(title));
  if (set.size) return [...set].sort().join(' ');
  // Fallback for titles made only of generic words: use the slug.
  return tokens(rel.replace(/\.html$/, '').replace(/[/_-]+/g, ' ')).sort().join(' ') || rel;
}

function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared / (A.size + B.size - shared);
}

function stripForWordCount(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ');
}

function collectPages() {
  const pages = [];
  for (const fp of walk(ROOT, { ext: '.html', ignore: IGNORE_DIRS })) {
    const rel = path.relative(ROOT, fp).replace(/\\/g, '/');
    if (EXCLUDE_FILES.has(rel) || GAME_ORPHANS.includes(rel) || EXTRA_EXCLUDE.has(rel)) continue;
    if (/-canvas\.html$/.test(rel)) continue;
    if (rel.endsWith('.bak.html') || rel.startsWith('quest-board')) continue;
    const html = fs.readFileSync(fp, 'utf8');
    if (robotsNoindex(html)) continue;
    if (/http-equiv=["']refresh["']/i.test(html)) continue;
    const clean = toCleanUrl(rel);
    if (!clean) continue;
    const title = textOf((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '');
    const descTag = (html.match(/<meta[^>]*name=["']description["'][^>]*>/i) || [])[0] || '';
    const dm = descTag.match(/content=("([^"]*)"|'([^']*)')/i);
    const desc = textOf((dm && (dm[2] !== undefined ? dm[2] : dm[3])) || '');
    const h1 = textOf((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '');
    const canonTag = (html.match(/<link[^>]*rel=["']canonical["'][^>]*>/i) || [])[0] || '';
    const canon = ((canonTag.match(/href=["']([^"']+)["']/i) || [])[1] || '').trim();
    const words = stripForWordCount(html).split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length;
    pages.push({ rel, clean, title, desc, h1, canon, words, html });
  }
  return pages;
}

function groupBy(pages, pick) {
  const map = new Map();
  for (const p of pages) {
    const key = pick(p);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(p);
  }
  return [...map.entries()].filter(([, list]) => list.length > 1);
}

// Resolve every local href/src to a repo-relative HTML file, then count inbound
// links. Clean URLs (/about) and extensionless links resolve through cleanToRel.
function inboundLinks(pages) {
  const cleanToRel = new Map(pages.map((p) => [p.clean.replace(/\/$/, '') || '/', p.rel]));
  const inbound = new Map(pages.map((p) => [p.rel, 0]));

  function resolve(fromRel, raw) {
    let ref = raw.trim();
    if (!ref || /^(https?:|mailto:|tel:|data:|javascript:|about:|#|\/\/)/i.test(ref)) return null;
    if (ref.includes('${') || ref.includes('{{') || ref.includes('{') || ref.includes('}')) return null;
    ref = ref.split('#')[0].split('?')[0];
    if (!ref) return null;
    let target;
    if (ref.startsWith('/')) {
      target = ref.slice(1);
    } else {
      target = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), ref));
    }
    target = target.replace(/\/$/, '');
    const cleanKey = '/' + target;
    if (cleanToRel.has(cleanKey)) return cleanToRel.get(cleanKey);
    if (!target) return 'index.html';
    if (target.endsWith('.html')) return target;
    const candidates = [
      target + '.html',
      target + '/index.html',
      target.replace(/^pages\//, '') + '.html',
      target.replace(/^pages\//, '') + '/index.html',
    ];
    for (const c of candidates) {
      if (fs.existsSync(path.join(ROOT, c))) return c;
    }
    return null;
  }

  for (const page of pages) {
    const html = page.html
      .replace(/(<script\b[^>]*>)[\s\S]*?<\/script\s*>/gi, '$1');
    for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const target = resolve(page.rel, m[1]);
      if (!target || target === page.rel) continue;
      if (inbound.has(target)) inbound.set(target, inbound.get(target) + 1);
    }
  }
  return inbound;
}

function auditIntents({ verbose = true, strict = false } = {}) {
  const pages = collectPages();

  const dupCanon = groupBy(pages, (p) => p.canon).filter(([, list]) => new Set(list.map((p) => p.rel)).size > 1);
  const dupTitle = groupBy(pages, (p) => p.title.toLowerCase()).filter(([, list]) => new Set(list.map((p) => p.rel)).size > 1);
  const dupDesc = groupBy(pages, (p) => p.desc.toLowerCase()).filter(([, list]) => new Set(list.map((p) => p.rel)).size > 1);

  const intents = groupBy(pages, (p) => intentKey(p.title, p.rel));
  const near = [];
  const seen = new Set();
  for (let i = 0; i < pages.length; i++) {
    for (let j = i + 1; j < pages.length; j++) {
      const score = jaccard(tokens(pages[i].title), tokens(pages[j].title));
      if (score < 0.8) continue;
      const key = [pages[i].rel, pages[j].rel].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      near.push({ score, a: pages[i], b: pages[j] });
    }
  }
  near.sort((x, y) => y.score - x.score);

  const thin = pages.filter((p) => p.words < 120).sort((a, b) => a.words - b.words);
  const inbound = inboundLinks(pages);
  const orphans = pages.filter((p) => (inbound.get(p.rel) || 0) === 0).sort((a, b) => a.rel.localeCompare(b.rel));

  const hard = dupCanon.length + dupTitle.length + dupDesc.length;
  const fail = hard > 0 || (strict && intents.length > 0);

  if (verbose) {
    console.log(`\nIntent audit: ${pages.length} indexable pages scanned`);
    if (hard === 0) {
      console.log('  duplicate canonical / title / description: 0');
    } else {
      for (const [key, list] of dupCanon) console.log(`  [FAIL canonical] ${key} <- ${list.map((p) => p.rel).join(', ')}`);
      for (const [key, list] of dupTitle) console.log(`  [FAIL title] "${key}" <- ${list.map((p) => p.rel).join(', ')}`);
      for (const [key, list] of dupDesc) console.log(`  [FAIL description] "${key.slice(0, 60)}" <- ${list.map((p) => p.rel).join(', ')}`);
    }
    if (intents.length) {
      console.log(`  duplicate-intent groups: ${intents.length}${strict ? ' (strict: failing)' : ' (advisory)'}`);
      for (const [key, list] of intents.slice(0, 40)) {
        console.log(`    [${key}] ${list.map((p) => p.rel).join(', ')}`);
      }
      if (intents.length > 40) console.log(`    ... ${intents.length - 40} more`);
    } else {
      console.log('  duplicate-intent groups: 0');
    }
    if (near.length) {
      console.log(`  near-duplicate titles (>= 0.8): ${near.length}`);
      for (const n of near.slice(0, 20)) {
        console.log(`    ${n.score.toFixed(2)}  ${n.a.rel}  <->  ${n.b.rel}`);
      }
    }
    if (thin.length) {
      console.log(`  thin pages (< 120 words): ${thin.length}`);
      for (const p of thin) console.log(`    ${p.words}  ${p.rel}`);
    }
    if (orphans.length) {
      console.log(`  pages with no inbound internal link: ${orphans.length}`);
      for (const p of orphans) console.log(`    ${p.rel}`);
    }
  }

  return { pages, dupCanon, dupTitle, dupDesc, intents, near, thin, orphans, fail, hard };
}

function run({ verbose = true, intents = false, strict = false } = {}) {
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
      // Query-string presets (e.g. 3d-builder.html?preset=rocket) are the same
      // indexed page, so compare the clean path only.
      const baseUrl = item.url.split('#')[0].split('?')[0];
      const rel = baseUrl.replace(/^\//, '').toLowerCase();
      if (indexed.has(rel)) continue;
      // Not in search index - is it intentionally noindex on disk?
      if (isNoindex(baseUrl)) { skippedNoindex++; continue; }
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

  let intentResult = null;
  if (intents) {
    intentResult = auditIntents({ verbose, strict });
  }

  const failed = missing.length > 0 || (intentResult && intentResult.fail);
  return Object.assign(missing, { intentResult, failed });
}

if (require.main === module) {
  const strict = process.argv.includes('--strict');
  const result = run({ intents: true, strict });
  if (result.failed) process.exit(1);
}

module.exports = { run, auditIntents };
