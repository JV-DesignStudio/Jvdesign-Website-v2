// search-registry-alias.js - A680
// Proves the global search index and the client catalog are registry-fed and
// carry merged tool aliases, so a search for a retired tool name lands on the
// canonical page. Pure Node, no browser.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
const ok = (name, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) failures++; };

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'tools.json'), 'utf8'));
const hub = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'tools-hub.json'), 'utf8'));
const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'search-index.json'), 'utf8'));
const contentSrc = fs.readFileSync(path.join(ROOT, 'content-data.js'), 'utf8');
const content = JSON.parse(contentSrc.match(/window\.JVDS_CONTENT = ([\s\S]*);\s*$/)[1]);

const aliasPages = new Map(); // url -> aliases
for (const entry of index.pages || []) {
  if (entry.aliases && entry.aliases.length) aliasPages.set(entry.url, entry.aliases);
}

const byId = {};
for (const t of catalog) byId[t.id] = t;

let checked = 0;
for (const [id, card] of Object.entries(hub.cards || {})) {
  const tool = byId[id];
  if (!tool) continue;
  const aliases = [].concat(card.aliases || [], card.mergedFrom || []).filter(Boolean);
  if (!aliases.length) continue;
  const rel = String(tool.url).replace(/^\//, '');
  const pageAliases = (aliasPages.get(rel) || []).map(a => a.toLowerCase());
  const catalogEntry = (content.tools || []).find(t => t.id === id);
  for (const alias of aliases) {
    checked++;
    ok(`search-index carries "${alias}" on ${rel}`, pageAliases.includes(alias.toLowerCase()));
  }
  ok(`content-data carries aliases on ${id}`, !!(catalogEntry && catalogEntry.aliases && catalogEntry.aliases.length));
}

// Simulate the client keyword match from pages/search.html for each alias.
const keywordOf = t => [t.title, t.desc, ...(t.tags || []), ...(t.aliases || [])].join(' ').toLowerCase();
for (const [id, card] of Object.entries(hub.cards || {})) {
  const entry = (content.tools || []).find(t => t.id === id);
  if (!entry) continue;
  for (const alias of [].concat(card.aliases || [], card.mergedFrom || []).filter(Boolean)) {
    ok(`client search matches "${alias}" -> ${id}`, keywordOf(entry).includes(alias.toLowerCase()));
  }
}

ok('catalog aliases only reference real pages', [...aliasPages.keys()].every(u => fs.existsSync(path.join(ROOT, u))));

console.log(`\n${checked} registry aliases checked`);
console.log(failures === 0 ? 'ALL SEARCH ALIAS CHECKS PASSED' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
