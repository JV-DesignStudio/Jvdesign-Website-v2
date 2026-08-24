#!/usr/bin/env node
/*
 * validate-css.js — detects inline <style> blocks that fail to parse.
 *
 * Brace corruption (a rule missing its closing "}") makes the browser silently
 * collapse or drop most of a stylesheet, so a page renders with no theme while
 * looking fine to a static check. This loads every page in a headless browser
 * (ground truth) and flags any inline <style> whose parsed rule count is far
 * below the number of rule-opening braces in its source — the signature of the
 * mugen-workshop / mugen-ai-workshop corruption.
 *
 * A purely static brace count is NOT reliable here: pages with large inline
 * <script> blocks (the 3D builders) fool it. The live cssRules count does not.
 *
 * Exit 1 if any block looks broken. Run: node validate-css.js  (npm run validate:css)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = __dirname;
const PORT = 8977;
const IGNORE = new Set(['node_modules', '.git', '.claude', 'partials', 'quest-board-deploy', '.github', '.continue']);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.m4a': 'audio/mp4' };

function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!IGNORE.has(e.name)) out = out.concat(walk(path.join(dir, e.name))); }
    else if (e.name.endsWith('.html')) out.push(path.join(dir, e.name));
  }
  return out;
}

/* ── Static pre-pass ────────────────────────────────────────────────────────
 * Catches corruption signatures the live cssRules ratio can't see:
 *   1. Orphaned custom-property declarations — a lost ':root {' opener leaves
 *      "--var: value;" pairs at brace depth 0. Browsers silently discard them,
 *      so tokens vanish while the sheet still "parses".
 *   2. Unbalanced braces per <style> block (comment/string aware).
 * Returns a list of problem strings for the file.
 * ────────────────────────────────────────────────────────────────────────── */
const DECL_RE = /^--[a-zA-Z][\w-]*\s*:/;
function skipComment(s, i) {
  const end = s.indexOf('*/', i + 2);
  return end === -1 ? s.length : end + 2;
}
function skipString(s, i) {
  const q = s[i]; i++;
  while (i < s.length) {
    if (s[i] === '\\') { i += 2; continue; }
    if (s[i] === q) { i++; break; }
    i++;
  }
  return i;
}
// NB: callers use while-loops with explicit index management — skipString/
// skipComment return the index just past the token, so a for-loop's auto-
// increment would swallow the char after a string's closing quote.
function staticStyleChecks(css) {
  const problems = [];
  let depth = 0, i = 0;
  const n = css.length;
  const lineAt = pos => css.slice(0, pos).split('\n').length;
  while (i < n) {
    const c = css[i];
    if (c === '/' && css[i + 1] === '*') { i = skipComment(css, i); continue; }
    if (c === '"' || c === "'") { i = skipString(css, i); continue; }
    if (c === '{') { depth++; i++; continue; }
    if (c === '}') { depth--; i++; continue; }
    // depth-0 custom-property declaration whose preceding char isn't part of
    // an identifier (avoids false positives on BEM names like .block--mod)
    const prevCh = i > 0 ? css[i - 1] : ' ';
    if (depth === 0 && c === '-' && css[i + 1] === '-' && !/[\w-]/.test(prevCh) && DECL_RE.test(css.slice(i, i + 120))) {
      problems.push(`orphaned declaration at style-line ${lineAt(i)} (missing ':root {' opener?)`);
      break; // one report per block is enough
    }
    i++;
  }
  if (depth !== 0) problems.push(`unbalanced braces (depth ${depth})`);
  return problems;
}

(async () => {
  // ── Static pre-pass (fast, no browser) ──
  const pages = walk(ROOT);
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/g;
  const staticBroken = [];
  for (const fp of pages) {
    const rel = path.relative(ROOT, fp).replace(/\\/g, '/');
    const src = fs.readFileSync(fp, 'utf8');
    let m;
    while ((m = styleRe.exec(src))) {
      for (const p of staticStyleChecks(m[1])) {
        staticBroken.push(`${rel}  <style>  ${p}`);
      }
    }
  }
  if (staticBroken.length) {
    console.log(`✗ validate-css: ${staticBroken.length} static CSS problem(s):\n`);
    staticBroken.forEach(b => console.log('  ' + b));
    process.exit(1);
  }

  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    fs.readFile(path.join(ROOT, p), (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const broken = [];

  for (const fp of pages) {
    const rel = path.relative(ROOT, fp).replace(/\\/g, '/');
    const page = await browser.newPage();
    try {
      await page.goto(`http://localhost:${PORT}/${rel}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      const blocks = await page.evaluate(() => {
        return [...document.querySelectorAll('style')].map((st, i) => {
          const opens = (st.textContent.match(/\{/g) || []).length;
          let rules = -1;
          try { rules = st.sheet ? st.sheet.cssRules.length : -1; } catch (e) { rules = -2; }
          return { i, opens, rules };
        });
      });
      for (const b of blocks) {
        // Only meaningful for non-trivial blocks. Corruption signature: many
        // opening braces but almost no parsed rules.
        if (b.opens >= 8 && b.rules >= 0 && b.rules < b.opens * 0.35) {
          broken.push(`${rel}  <style#${b.i}>  ${b.rules} rules parsed from ${b.opens} opening braces`);
        }
      }
    } catch (e) {
      broken.push(`${rel}  LOAD_ERROR: ${String(e.message || e).slice(0, 60)}`);
    }
    await page.close();
  }

  await browser.close();
  server.close();

  if (!broken.length) {
    console.log(`✓ validate-css: ${pages.length} pages, all inline <style> blocks parse cleanly.`);
    process.exit(0);
  }
  console.log(`✗ validate-css: ${broken.length} broken inline <style> block(s):\n`);
  broken.forEach(b => console.log('  ' + b));
  process.exit(1);
})();
