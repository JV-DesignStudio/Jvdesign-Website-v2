#!/usr/bin/env node
// A965 + A1434: SEO meta QA across every indexable page.
//
// Checks:
//   - unique, non-empty <title>
//   - unique, non-empty meta description
//   - exactly one <link rel="canonical"> pointing at the page's production URL
//   - og:image present and pointing at a file that exists on disk
//   - sitemap.xml covers every indexable page
//
// Redirect stubs (meta refresh), noindex pages and canvas embeds are skipped:
// they are deliberately not indexable landing pages. The sitemap ignore lists
// (EXCLUDE_FILES, GAME_ORPHANS) are shared with generate-sitemap.js so the two
// never disagree about what counts as an indexable page.
const fs = require('fs');
const path = require('path');
const { ROOT, IGNORE_DIRS, EXCLUDE_FILES, GAME_ORPHANS, BASE_URL } = require('../scripts/lib/paths');
const { walk } = require('../scripts/lib/walk');

const EXCLUDE = new Set([
  ...EXCLUDE_FILES,
  ...GAME_ORPHANS,
  'games/game-template.html',
  'games/cozy-biscuit-clicker.pre-app.bak.html',
]);

// Mirror generate-sitemap.js: filesystem path -> clean canonical URL.
function toCleanUrl(rel) {
  if (rel === 'index.html') return '/';
  if (rel.startsWith('pages/')) return '/' + rel.replace(/^pages\//, '').replace(/\.html$/, '');
  if (rel === 'learn/index.html') return '/learn/';
  if (rel.startsWith('learn/')) return '/' + rel.replace(/\.html$/, '');
  if (rel.endsWith('.bak.html')) return null;
  return '/' + rel;
}

const robotsNoindex = (html) => {
  const m = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i);
  return m ? /noindex/i.test(m[1]) : false;
};

const pages = [];
for (const fp of walk(ROOT, { ext: '.html', ignore: IGNORE_DIRS })) {
  const rel = path.relative(ROOT, fp).replace(/\\/g, '/');
  if (EXCLUDE.has(rel)) continue;
  const html = fs.readFileSync(fp, 'utf8');
  if (/http-equiv=["']refresh["']/i.test(html)) continue;
  if (robotsNoindex(html)) continue;
  if (/-canvas\.html$/.test(rel)) continue;
  const clean = toCleanUrl(rel);
  if (!clean) continue;
  pages.push({ rel, clean, html });
}

const sitemap = fs.existsSync(path.join(ROOT, 'sitemap.xml')) ? fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8') : '';
const locs = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));

let failures = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' -- ' + extra : ''));
  if (!cond) failures++;
};

const titles = {};
const descs = {};
const canonical = {};
const missing = { title: [], desc: [], canonical: [], og: [], ogFile: [], canonicalMatch: [], sitemap: [] };

for (const { rel, clean, html } of pages) {
  const title = ((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '').trim();
  if (!title) missing.title.push(rel); else (titles[title] = titles[title] || []).push(rel);

  // Extract the content attribute, respecting quoting so an apostrophe inside a
  // double-quoted value (e.g. "Lumo's Dash") does not truncate it.
  const descTag = (html.match(/<meta[^>]*name=["']description["'][^>]*>/i) || [])[0] || '';
  const dm = descTag.match(/content=("([^"]*)"|'([^']*)')/i);
  const desc = ((dm && (dm[2] !== undefined ? dm[2] : dm[3])) || '').trim();
  if (!desc) missing.desc.push(rel); else (descs[desc] = descs[desc] || []).push(rel);

  const canonTag = (html.match(/<link[^>]*rel=["']canonical["'][^>]*>/i) || [])[0] || '';
  const canon = (canonTag.match(/href=["']([^"']+)["']/i) || [])[1] || '';
  // Use canonical as the authoritative URL when it points to our domain; fall back to computed clean URL
  const wantUrl = (canon && canon.startsWith(BASE_URL)) ? canon : BASE_URL + clean;
  if (!canon) missing.canonical.push(rel);
  else {
    (canonical[canon] = canonical[canon] || []).push(rel);
    if (canon !== wantUrl) missing.canonicalMatch.push(rel + ' (' + canon + ' != ' + wantUrl + ')');
  }

  const ogTag = (html.match(/<meta[^>]*property=["']og:image["'][^>]*>/i) || [])[0] || '';
  const og = (ogTag.match(/content=["']([^"']+)["']/i) || [])[1] || '';
  if (!og) missing.og.push(rel);
  else if (og.startsWith(BASE_URL + '/')) {
    const relImg = decodeURIComponent(og.slice(BASE_URL.length + 1));
    if (!fs.existsSync(path.join(ROOT, relImg))) missing.ogFile.push(rel + ' (' + og + ')');
  }

  if (!locs.has(wantUrl)) missing.sitemap.push(rel);
}

const dupTitles = Object.entries(titles).filter(([, v]) => v.length > 1);
const dupDescs = Object.entries(descs).filter(([, v]) => v.length > 1);
const dupCanon = Object.entries(canonical).filter(([, v]) => v.length > 1);

console.log(`SEO meta QA: ${pages.length} indexable pages scanned`);
ok('every indexable page has a <title>', missing.title.length === 0, missing.title.slice(0, 5).join(', ') || 'all present');
ok('every indexable page has a meta description', missing.desc.length === 0, missing.desc.slice(0, 5).join(', ') || 'all present');
ok('page titles are unique', dupTitles.length === 0, dupTitles.slice(0, 3).map(([k, v]) => `"${k.slice(0, 40)}" (${v.join(', ')})`).join(' | ') || 'all unique');
ok('meta descriptions are unique', dupDescs.length === 0, dupDescs.slice(0, 3).map(([k, v]) => `"${k.slice(0, 40)}" (${v.join(', ')})`).join(' | ') || 'all unique');
ok('every indexable page has a canonical', missing.canonical.length === 0, missing.canonical.slice(0, 5).join(', ') || 'all present');
ok('canonicals are unique', dupCanon.length === 0, dupCanon.slice(0, 3).map(([k, v]) => `${k} (${v.join(', ')})`).join(' | ') || 'all unique');
ok('canonicals match the page URL', missing.canonicalMatch.length === 0, missing.canonicalMatch.slice(0, 3).join(' | ') || 'all correct');
ok('every indexable page has an og:image', missing.og.length === 0, missing.og.slice(0, 5).join(', ') || 'all present');
ok('every og:image file exists on disk', missing.ogFile.length === 0, missing.ogFile.slice(0, 5).join(' | ') || 'all resolve');
ok('sitemap covers every indexable page', missing.sitemap.length === 0, missing.sitemap.slice(0, 5).join(', ') || 'all covered');

console.log(failures === 0 ? 'ALL SEO META CHECKS PASSED' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
