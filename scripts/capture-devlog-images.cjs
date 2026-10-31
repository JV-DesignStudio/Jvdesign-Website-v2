#!/usr/bin/env node
/*
 * scripts/capture-devlog-images.cjs
 *
 * Capture a real screenshot of the thing a dev log post talks about, and save it
 * as assets/devlog/<id>-<slug>.png (1600x900, matching the 16:9 card thumb).
 *
 * The image a post shows should be the page it describes, not a stock picture.
 * This script opens that page in the shared browser harness, dismisses the usual
 * intro overlays, tries known start controls, and screenshots the play/content
 * area. It never edits devlog-data.js: it reports the exact `image: '...'` line
 * to paste into the matching POSTS entry (a person reviews that diff, per
 * AGENTS.md "no automated content rewrites without a reviewed diff").
 *
 * Usage:
 *   node scripts/capture-devlog-images.cjs --id 443 --url /games/critter-whack-page.html
 *   node scripts/capture-devlog-images.cjs --all          # every target in TARGETS below
 *   node scripts/capture-devlog-images.cjs --id 441       # url looked up from TARGETS
 *   node scripts/capture-devlog-images.cjs --id 435 --url /games/voidrush.html --force
 *   node scripts/capture-devlog-images.cjs --id 525 --url /games/echos-flight.html --viewport
 *       --viewport keeps the full 1600x900 frame. Use it for narrow, mobile-first
 *       pages (game columns) where cropping the area would upscale a 520px slice.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { withServer } = require('../tests/story-run-harness.cjs');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'devlog');
const SITE_PREFIX = '/assets/devlog/';

// Post id -> the page that post is about. Add rows as posts are written.
const TARGETS = {
  2:   { url: '/books/lumo_and_the_grumble_grit.html', note: 'Lumo book' },
  4:   { url: '/books/Pip_and_the_night_sky.html', note: 'Pip book' },
  11:  { url: '/books/Elara.html', note: 'Elara book' },
  12:  { url: '/workshops/godot_tutorial.html', note: 'Godot guide' },
  15:  { url: '/books/lumo_and_the_grumble_grit.html', note: 'Lumo book' },
  16:  { url: '/books/Pip_and_the_night_sky.html', note: 'Pip book' },
  17:  { url: '/workshops/godot_tutorial.html', note: 'Godot guide' },
  18:  { url: '/pages/discovery_session.html', note: 'Discovery session' },
  352: { url: '/tools/pixel-studio.html', note: 'Pixel Studio' },
  358: { url: '/games/nova-siege.html', note: 'Nova Siege' },
  435: { url: '/games/voidrush.html', note: 'VoidRush' },
  440: { url: '/learn/index.html', note: 'Guides hub' },
  441: { url: '/pages/gallery.html', note: 'Community Gallery' },
  442: { url: '/tools/arcade-game-maker.html', note: 'browser game studios' },
  443: { url: '/games/critter-whack-page.html', note: 'Critter Whack' },
  525: { url: '/games/echos-flight.html?debug=1', note: "Echo's Swim", viewport: true, autopilot: 2200 },
};

const START_SELECTORS = [
  '#playBtn', '#startBtn', '#startGame', '#btnStart', '#start', '#play',
  '#modalPrimary', '.sr-again', 'button.primary', '.btn.primary', '.btn-play',
  '[data-start]', '.pz-play', '.rune-btn',
];
const OVERLAY_SELECTORS = [
  '.jvds-hide', '#cookie-decline', '#cookie-accept', '#welcome', '#introModal',
  '.welcome-modal', '.intro-overlay', '#guideOverlay', '[data-dismiss]', '.modal-close',
  '#coachClose', '#tourClose',
];
const AREA_SELECTORS = ['.game-frame-wrap', '.game-wrap', '.stage-wrap', '.gallery-grid', 'main', '.wrap'];

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--id') o.id = String(argv[i + 1]);
    if (argv[i] === '--url') o.url = argv[i + 1];
    if (argv[i] === '--all') o.all = true;
    if (argv[i] === '--force') o.force = true;
    if (argv[i] === '--out') o.out = argv[i + 1];
    if (argv[i] === '--viewport') o.viewport = true;
  }
  return o;
}

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-').slice(0, 40).replace(/-+$/, '');
}

async function clickFirst(page, selectors) {
  for (const sel of selectors) {
    const el = await page.$(sel).catch(() => null);
    if (!el) continue;
    const box = await el.boundingBox().catch(() => null);
    if (!box || box.width < 4 || box.height < 4) continue;
    try { await el.click({ delay: 10 }); return sel; } catch (e) { /* next */ }
  }
  return null;
}

async function pickArea(page) {
  for (const sel of AREA_SELECTORS) {
    const el = await page.$(sel);
    if (!el) continue;
    const b = await el.boundingBox().catch(() => null);
    if (b && b.width > 320 && b.height > 240) return el;
  }
  return null;
}

async function capture(page, base, job) {
  const url = job.url;
  const target = base + (url.startsWith('/') ? url : '/' + url);
  await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
  // 'domcontentloaded' + a fixed settle. Fresh page per job (see main) avoids the
  // state carry-over that stalled earlier batches. 'commit' fired before render
  // and produced blank shots, so it is not used here.
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 3000));
  await clickFirst(page, OVERLAY_SELECTORS);
  await clickFirst(page, OVERLAY_SELECTORS);
  await clickFirst(page, START_SELECTORS);
  await new Promise(r => setTimeout(r, 1200));
  // Optional short autopilot for games that only show their art once a run is
  // really moving (needs the ?debug hook). Pass autopilot:<ms> on the target.
  if (job.autopilot) {
    await page.evaluate(async (ms) => {
      const g = window.__echoSwim || window.__gameHook;
      if (!g) return;
      if (g.start) g.start();
      await new Promise(r => setTimeout(r, 120));
      if (g.flap) g.flap();
      const end = performance.now() + ms;
      while (performance.now() < end) {
        const s = g.state ? g.state() : null;
        if (!s || s.phase === 'over') break;
        const centre = s.next ? s.next.center : (s.vh ? s.vh / 2 : 300);
        if (s.y > centre && g.flap) g.flap();
        await new Promise(r => setTimeout(r, 16));
      }
    }, job.autopilot, { timeout: 30000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 200));
  }
  if (job.viewport) return { buffer: await page.screenshot(), mode: 'viewport' };
  const area = await pickArea(page);
  if (area) {
    const box = await area.boundingBox().catch(() => null);
    if (box && box.width > 320 && box.height > 240) {
      return { buffer: await area.screenshot(), mode: 'area' };
    }
  }
  return { buffer: await page.screenshot(), mode: 'viewport' };
}

// Screenshots are heavy; downscale to a 16:9 webp so a school connection stays light.
function optimize(buffer) {
  return require('sharp')(buffer)
    .resize(1280, 720, { fit: 'cover', position: 'top' })
    .webp({ quality: 82 })
    .toBuffer();
}

// Hard per-job ceiling so one bad page never stalls the whole batch.
function withTimeout(promise, ms, label) {
  let t;
  const timeout = new Promise((_, reject) => { t = setTimeout(() => reject(new Error(label + ' timed out')), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  let jobs = [];

  if (opts.all) {
    jobs = Object.entries(TARGETS).map(([id, t]) => ({ id, url: t.url, viewport: t.viewport, autopilot: t.autopilot }));
  } else if (opts.id) {
    const t = TARGETS[opts.id];
    const url = opts.url || (t && t.url);
    if (!url) { console.error(`No url for post ${opts.id}. Pass --url or add it to TARGETS.`); process.exit(1); }
    jobs = [{ id: opts.id, url, viewport: opts.viewport || (t && t.viewport), autopilot: t && t.autopilot }];
  } else if (opts.url) {
    jobs = [{ id: 'manual', url: opts.url, out: opts.out, viewport: opts.viewport }];
  } else {
    console.error('Usage: node scripts/capture-devlog-images.cjs --id <id> [--url <path>] | --all');
    process.exit(1);
  }

  fs.mkdirSync(OUT, { recursive: true });
  const results = [];

  await withServer(async ({ base, browser }) => {
    for (const job of jobs) {
      const slug = slugify(job.url.replace(/[?#].*$/, '').replace(/^\//, '').replace(/\.html$/, '').replace(/[\/]/g, '-')) || 'shot';
      const name = job.out ? job.out : `${job.id}-${slug}.webp`;
      const outPath = path.join(OUT, name);
      if (fs.existsSync(outPath) && !opts.force) {
        console.log(`↷ skip (exists): assets/devlog/${name}`);
        results.push({ id: job.id, file: SITE_PREFIX + name, skipped: true });
        continue;
      }
      const page = await browser.newPage();
      try {
        const shot = await withTimeout(capture(page, base, job), 45000, `id ${job.id}`);
        const optimized = await optimize(shot.buffer);
        fs.writeFileSync(outPath, optimized);
        const kb = Math.round(fs.statSync(outPath).size / 1024);
        console.log(`✓ ${job.id}: assets/devlog/${name} (${shot.mode}, ${kb}kB)`);
        results.push({ id: job.id, file: SITE_PREFIX + name });
      } catch (e) {
        console.error(`✗ ${job.id}: ${e.message}`);
        results.push({ id: job.id, error: e.message });
      } finally {
        await page.close().catch(() => {});
      }
    }
  });

  console.log('\nPaste the matching line into devlog-data.js POSTS entry (do not auto-apply):');
  for (const r of results) {
    if (r.file) console.log(`  id ${r.id}:  image: '${r.file}',`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
