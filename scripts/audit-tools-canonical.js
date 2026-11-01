#!/usr/bin/env node
// audit-tools-canonical.js - one row per tools/*.html: canonical URL or redirect target,
// catalogue membership and inbound links, so duplicates can be retired without orphaning.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TOOLS = path.join(ROOT, 'tools');
const OUT = path.join(ROOT, 'docs', 'TOOLS_CANONICAL_AUDIT.md');

const catalogue = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'tools.json'), 'utf8'));
const catalogueIds = new Set(catalogue.filter(t => t.url.startsWith('/tools/')).map(t => t.url.replace('/tools/', '').replace('.html', '')));

const files = fs.readdirSync(TOOLS).filter(f => f.endsWith('.html')).sort();

const SKIP_DIRS = new Set(['node_modules', '.git', '.worktrees', 'tmp', 'generated-images', '.aider.tags.cache.v4']);
function walk(dir, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, acc);
    } else if (entry.name.endsWith('.html')) {
      acc.push(full);
    }
  }
  return acc;
}
const siteFiles = walk(ROOT, []);

function readInfo(file) {
  const html = fs.readFileSync(file, 'utf8');
  const canonical = (html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) || [])[1] || '';
  const refresh = (html.match(/<meta[^>]+http-equiv=["']refresh["'][^>]*content=["']([^"']+)["']/i) || [])[1] || '';
  const refreshTarget = refresh ? (refresh.match(/url=([^"';]+)/i) || [])[1] || '' : '';
  const noindex = /name=["']robots["'][^>]*noindex/i.test(html);
  return { canonical, refreshTarget, isStub: !!refresh, noindex };
}

const inbound = new Map();
for (const file of siteFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  for (const f of files) {
    const base = f.replace('.html', '');
    // match either ../tools/name.html, /tools/name.html or bare name.html within tools
    const hit = new RegExp('(?:^|[\\s"\'=(])/?(?:\\.\\./)?tools/' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.html([?"\'\\)]|$)', 'i').test(html);
    const selfHit = rel === 'tools/' + f;
    const bareHit = rel.startsWith('tools/') && !selfHit && new RegExp('["\'(]' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.html([?"\'\\)]|$)', 'i').test(html);
    if (selfHit || !hit) {
      if (bareHit) {
        if (!inbound.has(f)) inbound.set(f, new Set());
        inbound.get(f).add(rel);
      }
      continue;
    }
    if (!inbound.has(f)) inbound.set(f, new Set());
    inbound.get(f).add(rel);
  }
}

function normalise(target) {
  if (!target) return '';
  let t = target.trim();
  if (t.startsWith('http')) t = t.replace('https://jvdesignstudio.co.uk', '');
  if (t.startsWith('/')) return t;
  return '/tools/' + t;
}

const rows = files.map(f => {
  const id = f.replace('.html', '');
  const info = readInfo(path.join(TOOLS, f));
  const isRedirect = info.isStub;
  const redirectTarget = isRedirect ? normalise(info.refreshTarget) : '';
  const canonicalUrl = normalise(info.canonical) || ('/tools/' + f);
  const destination = isRedirect ? redirectTarget : canonicalUrl;
  const inCatalogue = catalogueIds.has(id);
  const links = Array.from(inbound.get(f) || []).sort();
  return { f, id, info, canonicalUrl, destination, isRedirect, inCatalogue, links };
});

function statusOf(r) {
  if (r.isRedirect) return 'REDIRECT';
  if (r.info.noindex) {
    return r.canonicalUrl && r.canonicalUrl !== '/tools/' + r.f ? 'MODE' : 'NOINDEX';
  }
  return 'CANONICAL';
}

const lines = [];
lines.push('# Tools Canonical Audit - one destination per tool');
lines.push('');
lines.push('Generated: ' + new Date().toISOString().slice(0, 10) + ' via scripts/audit-tools-canonical.js');
lines.push('Scope: every HTML file in tools/ (' + files.length + '), with its canonical URL or redirect target,');
lines.push('catalogue membership and every public page that still links to it.');
lines.push('');
lines.push('Status key: CANONICAL = live page; REDIRECT = stub pointing at its canonical page;');
lines.push('MODE = noindex sub-view of a merged tool (kept because the tool links to it);');
lines.push('NOINDEX = live but hidden from search.');
lines.push('');
lines.push('| File | Status | Canonical or redirect target | In catalogue | Inbound links |');
lines.push('|---|---|---|---|---|');
for (const r of rows) {
  lines.push('| tools/' + r.f + ' | ' + statusOf(r) + ' | ' + r.destination + ' | ' + (r.inCatalogue ? 'yes' : 'no') + ' | ' + (r.links.length ? r.links.join('<br>') : '-') + ' |');
}
lines.push('');
lines.push('## Summary');
const counts = { CANONICAL: 0, REDIRECT: 0, MODE: 0, NOINDEX: 0 };
rows.forEach(r => counts[statusOf(r)]++);
lines.push('- ' + counts.CANONICAL + ' canonical, ' + counts.REDIRECT + ' redirect stubs, ' + counts.MODE + ' mode/sub-view pages, ' + counts.NOINDEX + ' hidden utilities');
lines.push('- ' + rows.filter(r => r.inCatalogue).length + ' in content/tools.json, ' + rows.filter(r => !r.inCatalogue).length + ' out of the public catalogue');
lines.push('- Redirect stubs that are still linked from elsewhere: ' + (rows.filter(r => r.isRedirect && r.links.length).map(r => 'tools/' + r.f).join(', ') || 'none'));
lines.push('- Canonical pages with no catalogue entry: ' + (rows.filter(r => !r.isRedirect && !r.inCatalogue && !r.info.noindex).map(r => 'tools/' + r.f).join(', ') || 'none'));
lines.push('- Catalogue duplicates to retire: ' + (rows.filter(r => r.inCatalogue && r.info.noindex).map(r => 'tools/' + r.f).join(', ') || 'none'));
const byName = new Map();
for (const t of catalogue.filter(x => x.url.startsWith('/tools/'))) {
  const key = t.title.split(':')[0].trim().toLowerCase();
  if (!byName.has(key)) byName.set(key, []);
  byName.get(key).push(t.id + '.html');
}
const dupeNames = Array.from(byName.entries()).filter(([, ids]) => ids.length > 1);
lines.push('- Catalogue entries that share a tool name: ' + (dupeNames.map(([name, ids]) => name + ' (' + ids.join(' vs ') + ')').join('; ') || 'none'));
lines.push('');
lines.push('## Redirect stub targets');
lines.push('');
for (const r of rows.filter(x => x.isRedirect)) {
  lines.push('- tools/' + r.f + ' -> ' + r.canonicalUrl + (r.canonicalUrl === '/tools/' + r.f ? ' (self!)' : ''));
}

fs.writeFileSync(OUT, lines.join('\n') + '\n', 'utf8');
console.log('Wrote ' + path.relative(ROOT, OUT));
console.log('Canonical ' + counts.CANONICAL + ' | Redirect ' + counts.REDIRECT + ' | Mode ' + counts.MODE + ' | Noindex ' + counts.NOINDEX);
console.log('Redirects still linked: ' + (rows.filter(r => r.isRedirect && r.links.length).map(r => r.f).join(', ') || 'none'));
console.log('Catalogue duplicates: ' + (rows.filter(r => r.inCatalogue && r.info.noindex).map(r => r.f).join(', ') || 'none'));
console.log('Canonical not in catalogue (indexable): ' + (rows.filter(r => !r.isRedirect && !r.inCatalogue && !r.info.noindex).map(r => r.f).join(', ') || 'none'));
