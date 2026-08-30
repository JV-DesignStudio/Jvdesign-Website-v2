#!/usr/bin/env node
/*
 * validate-js.js — loads every page in a real browser and fails on dead JavaScript.
 *
 * This exists because of the corruption that shipped in commit 299c0fb. A build
 * transform parsed inline <script> content as HTML, truncating every line at a
 * "<" (so `for(let y=0;y<cH;y++)` became `for(let y=0;y`) and splicing in
 * duplicate fragments. 39 pages went live with a SyntaxError, which in a classic
 * script kills the ENTIRE block: nine creative tools rendered their whole UI and
 * then did nothing at all when you pressed a button.
 *
 * Nothing else in the validate chain catches that. validate-links reads hrefs,
 * validate-css only parses <style>, and validate-contrast measures colour. A
 * page can be perfectly valid HTML with completely dead JavaScript.
 *
 * A static regex over <script> blocks is NOT sufficient either, and I tried:
 * a script containing the literal "</script>" inside a string truncates the
 * match and invents failures. The browser is the only honest oracle, so this
 * loads the page and listens for what actually breaks.
 *
 * Reported as FATAL (exit 1), because each one means code that never ran:
 *   SyntaxError                       - the block failed to parse
 *   "x is not defined"                - usually a dead block earlier on the page
 *   "Identifier x has already been declared"
 *   "Unexpected ..."
 *
 * Ignored: network 404s for optional assets, favicon noise, and anything a page
 * catches itself. Those are not evidence of dead code.
 *
 * Run: node validate-js.js            (npm run validate:js)
 *      node validate-js.js --all      (also list non-fatal console errors)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = __dirname;
const PORT = 8979;
const CONCURRENCY = 5;
const SETTLE_MS = 500;
const ALL = process.argv.includes('--all');

const IGNORE = new Set(['node_modules', '.git', '.claude', 'partials', 'quest-board-deploy',
  '.github', '.continue', 'og', 'social-posts', 'questlog-pwa']);

const FATAL = /SyntaxError|is not defined|has already been declared|Unexpected (token|identifier|string|number|end of input)|Invalid or unexpected|missing \) after/;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf', '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };

function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!IGNORE.has(e.name)) out = out.concat(walk(path.join(dir, e.name))); }
    else if (e.name.endsWith('.html')) out.push(path.join(dir, e.name));
  }
  return out;
}

(async () => {
  const files = walk(ROOT).map(f => path.relative(ROOT, f).split(path.sep).join('/'));

  const server = http.createServer((req, res) => {
    let url = decodeURIComponent(req.url.split('?')[0]);
    if (url.endsWith('/')) url += 'index.html';
    const file = path.join(ROOT, url);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('404'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  });
  await new Promise(r => server.listen(PORT, r));

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const fatal = [];
  const noisy = [];
  let loaded = 0;

  const queue = files.slice();
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    for (;;) {
      const file = queue.pop();
      if (!file) break;
      const errs = new Set();
      const onPageErr = e => errs.add(e.message.split('\n')[0].slice(0, 90));
      const onConsole = m => {
        if (m.type() !== 'error') return;
        const t = m.text();
        if (/favicon|Failed to load resource|net::ERR/.test(t)) return;
        errs.add(t.split('\n')[0].slice(0, 90));
      };
      page.on('pageerror', onPageErr);
      page.on('console', onConsole);
      try {
        await page.goto(`http://localhost:${PORT}/${file}`, { waitUntil: 'load', timeout: 25000 });
        await new Promise(r => setTimeout(r, SETTLE_MS));
        loaded++;
      } catch (e) {
        errs.add('page failed to load: ' + e.message.split('\n')[0].slice(0, 60));
      }
      page.off('pageerror', onPageErr);
      page.off('console', onConsole);

      [...errs].forEach(msg => {
        (FATAL.test(msg) ? fatal : noisy).push({ file, msg });
      });
    }
    await page.close();
  });
  await Promise.all(workers);

  await browser.close();
  server.close();

  if (ALL && noisy.length) {
    console.log(`  ${noisy.length} non-fatal console error(s):`);
    noisy.slice(0, 20).forEach(n => console.log(`    ${n.file}  ${n.msg}`));
    if (noisy.length > 20) console.log(`    ... +${noisy.length - 20} more`);
    console.log('');
  }

  if (!fatal.length) {
    console.log(`✓ validate-js: ${loaded} pages loaded in a browser, 0 with dead JavaScript.` +
      (noisy.length && !ALL ? ` (${noisy.length} non-fatal console error(s), see --all)` : ''));
    process.exit(0);
  }

  const byFile = {};
  fatal.forEach(f => (byFile[f.file] = byFile[f.file] || []).push(f.msg));
  const names = Object.keys(byFile).sort();
  console.log(`✗ validate-js: ${names.length} page(s) have JavaScript that never runs:\n`);
  names.forEach(f => {
    console.log('  ' + f);
    byFile[f].forEach(m => console.log('      ' + m));
  });
  console.log('\n  A SyntaxError kills the whole <script> block, so the page can look');
  console.log('  completely normal while every button on it does nothing. Check for');
  console.log('  lines truncated at a "<" and for spliced duplicate fragments.');
  process.exit(1);
})();
