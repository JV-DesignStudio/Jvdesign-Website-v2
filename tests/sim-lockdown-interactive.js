#!/usr/bin/env node
/*
 * tests/sim-lockdown-interactive.js
 *
 * Real-browser test for the SIM LOCKDOWN workshop episodes. Loads each page in
 * Puppeteer and actually plays it: answers every quiz, fills every concept and
 * code blank with the real answer, orders every order-challenge, advances all
 * steps, checks the finish banner appears, then reloads to prove progress
 * persisted. This is the honest oracle for the interactives (the static test
 * only checks that the keys decode; this checks the engine accepts them).
 *
 * Run: node tests/sim-lockdown-interactive.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PAGES = [
  'workshops/roblox-sim-lockdown-1-workshop.html',
  'workshops/roblox-sim-lockdown-2-workshop.html',
  'workshops/roblox-sim-lockdown-3-workshop.html',
];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2' };

let passes = 0;
const failures = [];
const ok = (name, cond, detail) => {
  if (cond) { passes++; console.log('  [PASS] ' + name); }
  else { failures.push(name + (detail ? ' - ' + detail : '')); console.log('  [FAIL] ' + name + (detail ? ' - ' + detail : '')); }
};
// The shared workshop-enhancements.js rewrites #progressCount as "n / N Steps"
// (capital S) while our engine writes "n / N steps"; both are correct, so
// compare on normalised text.
const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();

// Runs inside the page: play every step of the workshop and report what failed.
function driveAllSteps(TOTAL) {
  const fails = [];
  const dec = (s) => { try { return atob(s); } catch (e) { return null; } };
  const canon = (el) => (dec(el.dataset.a) || '').split('|')[0];
  for (let n = 1; n <= TOTAL; n++) {
    const card = document.getElementById('step-' + n);
    if (!card) { fails.push('missing step-' + n); continue; }
    card.classList.remove('locked');

    const cf = card.querySelector('.concept-fill');
    if (cf) {
      cf.querySelectorAll('.cf-blank').forEach(b => { b.value = canon(b); });
      cf.querySelector('.cf-check-btn').click();
      if (!cf.classList.contains('passed')) fails.push('concept-fill failed @ step ' + n);
    }
    const cc = card.querySelector('.code-challenge');
    if (cc) {
      cc.querySelectorAll('.cc-blank').forEach(b => { b.value = canon(b); });
      cc.querySelector('.cc-check-btn').click();
      if (!cc.classList.contains('passed')) fails.push('code-challenge failed @ step ' + n);
    }
    const oc = card.querySelector('.order-challenge');
    if (oc) {
      const items = [...oc.querySelectorAll('.oc-item')].sort((a, b) => Number(dec(a.dataset.k)) - Number(dec(b.dataset.k)));
      items.forEach(it => it.click());
      oc.querySelector('.oc-check-btn').click();
      if (!oc.classList.contains('passed')) fails.push('order-challenge failed @ step ' + n);
    }
    const q = card.querySelector('.quiz-gate');
    if (q) {
      const k = Number(dec(q.dataset.k));
      const opt = q.querySelector('.quiz-opt[data-idx="' + k + '"]');
      if (!opt) { fails.push('no correct option @ step ' + n); }
      else {
        opt.click();
        q.querySelector('.quiz-submit').click();
        if (!q.classList.contains('passed')) fails.push('quiz failed @ step ' + n);
        const nb = q.querySelector('.quiz-next-btn');
        if (nb) nb.click();
      }
    }
  }
  return { fails, progress: (document.getElementById('progressCount') || {}).textContent || '', done: !!document.querySelector('.finish-banner.show') };
}

(async () => {
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
  await new Promise((r, rej) => server.listen(0, r).on('error', rej));
  const port = server.address().port;

  let browser;
  try { browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] }); }
  catch (e) { server.close(); console.error('puppeteer launch failed:', e.message); process.exit(2); }

  for (const rel of PAGES) {
    const name = path.basename(rel).replace('.html', '');
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message.split('\n')[0].slice(0, 100)));
    page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|net::ERR/.test(m.text())) pageErrors.push(m.text().split('\n')[0].slice(0, 100)); });

    const url = `http://localhost:${port}/${rel}`;
    await page.goto(url, { waitUntil: 'load', timeout: 25000 });

    const total = await page.evaluate(() => window.WORKSHOP_TOTAL);
    ok(name + ': WORKSHOP_TOTAL exposed (' + total + ')', Number.isInteger(total) && total > 0);
    const hasFns = await page.evaluate(() => ['toggleStep', 'completeStep', 'checkQuiz', 'selectQuizOpt', 'checkConceptFill', 'checkCodeChallenge', 'checkOrder'].every(f => typeof window[f] === 'function'));
    ok(name + ': engine handlers are global functions', hasFns);

    const result = await page.evaluate(driveAllSteps, total);
    ok(name + ': every activity passed', result.fails.length === 0, result.fails.join('; '));
    ok(name + ': progress reached ' + total + '/' + total, norm(result.progress) === norm(total + ' / ' + total + ' steps'), result.progress.trim());
    ok(name + ': finish banner shown', result.done);

    // reload -> progress persisted from localStorage
    await page.reload({ waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 400));
    const after = await page.evaluate(() => ({
      progress: (document.getElementById('progressCount') || {}).textContent || '',
      done: !!document.querySelector('.finish-banner.show'),
      saved: (() => { try { return (JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}).completed || []; } catch (e) { return []; } })(),
    }));
    ok(name + ': progress persists after reload', norm(after.progress) === norm(total + ' / ' + total + ' steps'), after.progress.trim());
    ok(name + ': finish banner restored after reload', after.done);
    ok(name + ': localStorage saved all steps', (after.saved || []).length === total, 'saved=' + JSON.stringify(after.saved));

    ok(name + ': no page/console errors', pageErrors.length === 0, pageErrors.join(' | '));

    await page.close();
  }

  try { await browser.close(); } catch {}
  try { await new Promise(r => server.close(r)); } catch {}

  console.log('\n' + passes + ' checks passed, ' + failures.length + ' failed');
  if (failures.length) { console.log('Failures:\n- ' + failures.join('\n- ')); process.exit(1); }
})().catch(e => { console.error(e); process.exit(2); });
