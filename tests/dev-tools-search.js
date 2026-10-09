// A796: Tools hub search must cover every hub entry (core cards + reference pills).
// Pure Node, no browser. Mirrors filterToolsBySearch matching: query substring of data-search.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HUB = path.join(ROOT, 'pages', 'dev-tools.html');
const html = fs.readFileSync(HUB, 'utf8');

let failures = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' -- ' + extra : ''));
  if (!cond) failures++;
};

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');

// Core cards: data-search + visible title.
const cardRe = /<a[^>]*data-tool-card[^>]*data-search="([^"]*)"[^>]*>[\s\S]*?<h3 class="tool-title">([^<]+)<\/h3>/gi;
const cards = [];
let m;
while ((m = cardRe.exec(html))) cards.push({ search: decode(m[1]).toLowerCase(), title: decode(m[2]).trim() });

// Reference pills: require data-search on every pill.
const pillRe = /<a[^>]*class="reference-pill"[^>]*>([^<]+)<\/a>/gi;
const pillTags = [];
while ((m = pillRe.exec(html))) pillTags.push(m[0]);
const pillSearchRe = /data-search="([^"]*)"/i;
const pills = pillTags.map((tag) => {
  const sm = tag.match(pillSearchRe);
  const tm = tag.match(/>([^<]+)<\/a>/);
  return { search: sm ? decode(sm[1]).toLowerCase() : '', title: tm ? decode(tm[1]).trim() : '' };
});

ok('hub has 15 core tool cards', cards.length === 15, 'found ' + cards.length);
// 23 pills: A797 retired the roblox-builder redirect-stub pill, so the count dropped from 24.
ok('hub has 23 reference pills', pills.length === 23, 'found ' + pills.length);
ok('every core card has data-search', cards.every((c) => c.search.length > 0));
ok('every reference pill has data-search', pills.every((p) => p.search.length > 0),
  pills.filter((p) => !p.search).map((p) => p.title).join(', ') || 'all present');

// Every hub entry findable by its title: at least one distinctive title token hits its own index.
const STOP = new Set(['and', 'the', 'for', 'with', 'move', 'note']);
const tokensOf = (title) => title.toLowerCase().split(/[^a-z0-9#+]+/).filter((t) => t.length >= 3 && !STOP.has(t));
for (const entry of [...cards, ...pills]) {
  const tokens = tokensOf(entry.title);
  const hit = tokens.some((t) => entry.search.includes(t));
  ok('findable by title: "' + entry.title + '"', hit, 'tokens [' + tokens.join(', ') + ']');
}

// Regression queries from the card: these reported "0 tools found" before the fix.
const index = [...cards, ...pills].map((e) => e.search);
const searchCount = (q) => index.filter((hay) => hay.includes(q)).length;
for (const q of ['python', 'unity', 'godot', 'glossary', 'scratch', 'roblox', 'asset', 'palette', 'certificate']) {
  ok('search "' + q + '" returns at least one entry', searchCount(q) >= 1, 'found ' + searchCount(q));
}
// Unity should hit both the cheatsheet pill and the starter pill.
ok('search "unity" returns 2+ entries', searchCount('unity') >= 2, 'found ' + searchCount('unity'));
// Full-title probe for a punctuation case: "glossary" exact.
ok('search "glossary" matches the Glossary pill',
  pills.some((p) => p.title === 'Glossary' && p.search.includes('glossary')));

// The hub script must include pills in the filter logic (not cards only).
const scriptHasPills = html.includes('reference-pill') && /filterToolsBySearch[\s\S]*reference-pill/.test(html);
ok('filterToolsBySearch covers reference pills', scriptHasPills);
ok('filter resets reference visibility on applyFilter', /resetReferenceVisibility|pills\.forEach/.test(html));

// Pill targets must exist on disk.
const hrefRe = /<a[^>]*class="reference-pill"[^>]*href="([^"]+)"[^>]*>/gi;
const missing = [];
let hm;
while ((hm = hrefRe.exec(html))) {
  const href = hm[1].replace(/^\.\.\//, '');
  if (!fs.existsSync(path.join(ROOT, href))) missing.push(hm[1]);
}
ok('all pill hrefs resolve to real files', missing.length === 0, missing.join(', ') || 'all resolve');

console.log(failures === 0 ? 'ALL DEV-TOOLS SEARCH CHECKS PASSED' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
