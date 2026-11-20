#!/usr/bin/env node
/*
 * scripts/capture-workshop-steps.js (A3103)
 *
 * The canvas engine can render the reference solution for any step. This script
 * walks the flagship browser series, fills each step with its solution, renders
 * the preview and stores a small WebP beside the workshop. The engine then shows
 * the picture beside the step so a learner can compare their own screen.
 *
 * Run: node scripts/capture-workshop-steps.js
 *      node scripts/capture-workshop-steps.js --only js-flappy-workshop
 *      node scripts/capture-workshop-steps.js --check
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'workshop-steps');
const MANIFEST = path.join(ROOT, 'content', 'workshop-step-images.json');
const CHECK = process.argv.includes('--check');
const onlyAt = process.argv.indexOf('--only');
const ONLY = onlyAt !== -1 ? process.argv[onlyAt + 1] : '';

const TARGETS = [
  { slug: 'js-flappy-workshop', label: 'Flappy Bird' },
  { slug: 'js-memory-workshop', label: 'Memory Cards' },
  { slug: 'js-breakout-workshop', label: 'Breakout' },
  { slug: 'js-snake-workshop', label: 'Snake' },
  { slug: 'js-platformer-part2-workshop', label: 'Platformer Part 2' },
  { slug: 'my-first-scratch-game', label: 'First Scratch Game' }
];

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon'
};

function loadManifest() {
  try { return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch { return { series: {} }; }
}

function writeManifest(data) {
  const series = {};
  for (const slug of Object.keys(data.series || {}).sort()) {
    const steps = data.series[slug] || {};
    series[slug] = {};
    for (const n of Object.keys(steps).map(Number).sort((a, b) => a - b)) series[slug][String(n)] = steps[String(n)];
  }
  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
  fs.writeFileSync(MANIFEST, JSON.stringify({ generatedBy: 'scripts/capture-workshop-steps.js', series }, null, 2) + '\n');
}

function check(data) {
  let failures = 0;
  const ok = (name, okFlag, extra) => {
    console.log((okFlag ? 'PASS ' : 'FAIL ') + name + (okFlag || !extra ? '' : ' :: ' + extra));
    if (!okFlag) failures++;
  };
  const series = data.series || {};
  const allSeries = Object.keys(series);
  ok('manifest names at least one series', allSeries.length > 0);
  let covered = 0;
  for (const slug of allSeries) {
    const steps = series[slug] || {};
    const nums = Object.keys(steps).map(Number).sort((a, b) => a - b);
    if (!nums.length) continue;
    const missing = nums.filter((n) => {
      const rel = String(steps[n]).replace(/^\//, '');
      const file = path.join(ROOT, rel);
      return !fs.existsSync(file) || fs.statSync(file).size < 2000;
    });
    if (!missing.length && nums.length >= 5) covered++;
    ok(slug + ' has ' + nums.length + ' step images', missing.length === 0, missing.slice(0, 4).join(', '));
  }
  ok('a flagship series covers every step', covered >= 1);
  const flappy = series['js-flappy-workshop'] || {};
  ok('Flappy has a finished image for all 6 steps', Object.keys(flappy).length === 6, 'found ' + Object.keys(flappy).length);
  if (failures) {
    console.log('\nFAIL workshop-step-images: ' + failures + ' check(s) failed');
    return 1;
  }
  console.log('\nPASS workshop-step-images: ' + covered + ' series carry expected-result images');
  return 0;
}

async function capture() {
  const fsPromises = fs.promises;
  const puppeteer = require(path.join(ROOT, 'node_modules', 'puppeteer'));

  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = path.normalize(path.join(ROOT, url));
    if (!file.startsWith(path.normalize(ROOT))) { res.writeHead(403); res.end('Forbidden'); return; }
    fs.readFile(file, (err, body) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(body);
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const data = loadManifest();
  let failures = 0;

  try {
    for (const target of TARGETS) {
      if (ONLY && target.slug !== ONLY) continue;
      if (!fs.existsSync(path.join(ROOT, 'workshops', target.slug + '.html'))) {
        console.log('SKIP ' + target.slug + ' (no page)');
        continue;
      }
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.setRequestInterception(true);
      page.on('request', (r) => {
        if (r.url().startsWith(base) || /^data:|^blob:/.test(r.url())) return r.continue();
        return r.abort();
      });
      await page.setViewport({ width: 1280, height: 900 });
      try {
        await page.goto(base + '/workshops/' + target.slug + '.html', { waitUntil: 'load' });
        await page.waitForFunction(() => window.CW && document.querySelector('#gameFrame'), { timeout: 15000 });
        await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
        const steps = await page.evaluate(() =>
          Array.from(document.querySelectorAll('.cw-step')).map((n) => Number(n.id.replace('card-', ''))).filter(Boolean)
        );
        if (!steps.length) { console.log('SKIP ' + target.slug + ' (no steps)'); await page.close(); continue; }
        const dir = path.join(OUT_DIR, target.slug);
        await fsPromises.mkdir(dir, { recursive: true });
        const map = {};
        for (const num of steps) {
          const rendered = await page.evaluate((n) => {
            try {
              window.CW.showSolution(n);
              window.CW.previewStep(n);
              return true;
            } catch (e) { return String(e.message || e); }
          }, num);
          if (rendered !== true) { console.log('FAIL ' + target.slug + ' step ' + num + ': ' + rendered); failures++; continue; }
          await new Promise((r) => setTimeout(r, 1100));
          const frame = await page.$('#gameFrame');
          if (!frame) { console.log('FAIL ' + target.slug + ' step ' + num + ': no frame'); failures++; continue; }
          let ext = 'webp';
          let shot;
          try {
            shot = await frame.screenshot({ type: 'webp', quality: 82 });
          } catch (e) {
            ext = 'png';
            shot = await frame.screenshot({ type: 'png' });
          }
          const rel = '/assets/workshop-steps/' + target.slug + '/step-' + num + '.' + ext;
          await fsPromises.writeFile(path.join(ROOT, rel.replace(/^\//, '')), shot);
          map[String(num)] = rel;
        }
        data.series[target.slug] = map;
        console.log('Captured ' + target.slug + ': ' + Object.keys(map).length + ' steps' + (errors.length ? ' (' + errors.length + ' page errors)' : ''));
      } catch (e) {
        console.log('FAIL ' + target.slug + ': ' + (e.message || e));
        failures++;
      } finally {
        await page.close().catch(() => {});
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  writeManifest(data);
  console.log('Wrote ' + path.relative(ROOT, MANIFEST));
  return failures ? 1 : 0;
}

(async () => {
  if (CHECK) process.exit(check(loadManifest()));
  process.exit(await capture());
})().catch((e) => { console.error(e); process.exit(1); });
