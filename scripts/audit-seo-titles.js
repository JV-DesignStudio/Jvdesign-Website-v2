#!/usr/bin/env node
/*
 * audit-seo-titles.js - report indexable pages whose <title> is too generic to
 * win a search query. Read-only; prints a prioritised list.
 *
 * Run: node scripts/audit-seo-titles.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIRS = ['', 'pages', 'tools', 'workshops', 'games'];

const weak = [];
const all = [];

for (const d of DIRS) {
  const full = path.join(ROOT, d);
  if (!fs.existsSync(full)) continue;
  for (const f of fs.readdirSync(full)) {
    if (!f.endsWith('.html') || f.startsWith('_')) continue;
    const rel = path.join(d, f).replace(/\\/g, '/');
    if (/-canvas\.html$/.test(rel)) continue;
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    if (/http-equiv=["']refresh["']/i.test(html)) continue;
    if (/name=["']robots["'][^>]*noindex/i.test(html)) continue;
    const raw = ((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '').trim();
    const title = raw.replace(/\s*\|\s*JVDesignStudio\s*$/i, '').trim();
    const slug = f.replace(/\.html$/, '').replace(/-/g, ' ');
    all.push({ rel, title });
    const reasons = [];
    if (title.length < 30) reasons.push('short(' + title.length + ')');
    // "cheat sheet", "builder" and "tutorial" are good query words, so only flag
    // titles that tail off with a bare format word and carry no query intent.
    if (/\b(workshop|series|guide)$/i.test(title)) reasons.push('generic-tail');
    if (/^(my first .* (ep|part)|ep\s*\d|part\s*\d)/i.test(title)) reasons.push('episode-first');
    if (title.toLowerCase() === slug.toLowerCase()) reasons.push('slug-only');
    if (reasons.length) weak.push({ rel, title, reasons: reasons.join(',') });
  }
}

console.log(`SEO title audit: ${all.length} indexable pages, ${weak.length} generic titles\n`);
for (const w of weak.sort((a, b) => a.rel.localeCompare(b.rel))) {
  console.log(`  [${w.reasons}] ${w.title}   <${w.rel}>`);
}
