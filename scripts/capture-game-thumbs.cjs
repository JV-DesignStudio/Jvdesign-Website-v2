#!/usr/bin/env node
/*
 * scripts/capture-game-thumbs.cjs - A951 / A972
 *
 * Captures a real gameplay screenshot for every game in the arcade registry and
 * writes assets/game-thumbs/<id>.webp, then sets the registry `thumb` field so
 * the arcade card shows the game instead of a generic panel or marketing cover.
 *
 * Generic capture per game:
 *   1. load games/<file>
 *   2. click a start control (in the page, or inside the wrapper iframe)
 *   3. wait for gameplay, strip page chrome
 *   4. screenshot the play area (.game-frame-wrap / .game-wrap / .stage-wrap /
 *      largest canvas / main)
 * A game that cannot be captured keeps its cover/emoji fallback.
 *
 * Usage: node scripts/capture-game-thumbs.cjs [--only id1,id2] [--no-registry]
 */
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { withServer } = require('../tests/story-run-harness.cjs');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'game-thumbs');
const REGISTRY = path.join(ROOT, 'games-registry.js');

const START_SELECTORS = [
  '#playBtn', '#startBtn', '#startGame', '#btnStart', '#start', '#play',
  '#modalPrimary', '#btn-restart', '.sr-again', 'button.primary', '.btn.primary',
  '.btn-play', '[data-start]', '.pz-play', '.rune-btn'
];

function loadRegistry() {
  const code = fs.readFileSync(REGISTRY, 'utf8');
  const sandbox = { window: {} };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window.JVDS_GAMES || [];
}

async function tryStart(ctx) {
  for (const sel of START_SELECTORS) {
    const el = await ctx.$(sel).catch(() => null);
    if (!el) continue;
    const box = await el.boundingBox().catch(() => null);
    if (!box || box.width < 4 || box.height < 4) continue;
    try { await el.click(); return sel; } catch (e) { /* try next */ }
  }
  return null;
}

async function pickTarget(page) {
  for (const sel of ['.game-frame-wrap', '.game-wrap', '.stage-wrap']) {
    const el = await page.$(sel);
    if (!el) continue;
    const b = await el.boundingBox();
    if (b && b.width > 140 && b.height > 140) return el;
  }
  const handles = await page.$$('canvas');
  let best = null, bestA = 0;
  for (const h of handles) {
    const b = await h.boundingBox().catch(() => null);
    if (!b || b.width < 140 || b.height < 140) continue;
    const a = b.width * b.height;
    if (a > bestA) { bestA = a; best = h; }
  }
  if (best) return best;
  for (const sel of ['main', '.wrap', 'body']) {
    const el = await page.$(sel);
    if (!el) continue;
    const b = await el.boundingBox();
    if (b && b.width > 140 && b.height > 140) return el;
  }
  return null;
}

const STRIP = '#cookie-banner,.jvds-launch,#jvds-exit,.gs-fullscreen-btn,.gs-resume,.arcade-menu,.mascot-companion,#jvds-feedback-widget,.mascot-quiz-backdrop';

async function capture(browser, base, game, sharp) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 900, height: 1100, deviceScaleFactor: 2 });
    await page.goto(base + '/games/' + game.file, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 300));

    // Wrapper pages iframe the real game; follow the iframe so we capture the
    // game itself, not the 16:9 marketing frame around it.
    const frameEl = await page.$('.game-frame-wrap iframe');
    if (frameEl) {
      const src = await page.$eval('.game-frame-wrap iframe', el => el.getAttribute('src')).catch(() => null);
      if (src && !/^https?:|^\/\//.test(src)) {
        await page.goto(new URL(src, base + '/games/').href, { waitUntil: 'load', timeout: 30000 });
        await new Promise(r => setTimeout(r, 300));
      }
    }

    const started = await tryStart(page);
    if (!started) {
      // tap-to-start games: click the middle of the play area
      const t = await pickTarget(page);
      if (t) { const b = await t.boundingBox(); if (b) await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); }
    }
    await new Promise(r => setTimeout(r, 1500));

    await page.evaluate(sel => {
      document.querySelectorAll(sel).forEach(el => el.remove());
    }, STRIP);
    await new Promise(r => setTimeout(r, 120));

    const target = await pickTarget(page);
    if (!target) return { id: game.id, ok: false, why: 'no play area' };
    const buf = await target.screenshot({ type: 'png' });
    const file = path.join(OUT, game.id + '.webp');
    await sharp(buf).resize({ width: 640, withoutEnlargement: true }).webp({ quality: 82 }).toFile(file);
    const meta = await sharp(file).metadata();
    // Quality gate: a real play-field shot is roughly portrait/square/16:9, not a
    // thin banner and not a long full page. Bad crops fall back to the cover.
    const ratio = meta.height / meta.width;
    if (meta.width < 300 || meta.height < 220 || ratio < 0.5 || ratio > 2.4) {
      fs.unlinkSync(file);
      return { id: game.id, ok: false, why: 'aspect ' + meta.width + 'x' + meta.height };
    }
    return { id: game.id, ok: true, size: meta.width + 'x' + meta.height };
  } catch (e) {
    return { id: game.id, ok: false, why: e.message };
  } finally {
    await page.close();
  }
}

function insertThumb(text, id) {
  const thumb = 'assets/game-thumbs/' + id + '.webp';
  if (text.indexOf('"' + thumb + '"') >= 0) return text;
  const re = new RegExp('("id"\\s*:\\s*"' + id + '",)');
  if (!re.test(text)) return text;
  return text.replace(re, '$1\n    "thumb": "' + thumb + '",');
}

// Add thumbs for kept games and drop thumbs for any game no longer captured, so
// the registry always matches the assets on disk.
function syncRegistry(text, keptSet, allIds) {
  for (const id of allIds) {
    const thumb = 'assets/game-thumbs/' + id + '.webp';
    const has = text.indexOf('"' + thumb + '"') >= 0;
    if (keptSet.has(id) && !has) text = insertThumb(text, id);
    if (!keptSet.has(id) && has) {
      text = text.replace(new RegExp('\\s*"thumb":\\s*"assets/game-thumbs/' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.webp",'), '');
    }
  }
  return text;
}

(async () => {
  const args = process.argv.slice(2);
  const onlyIdx = args.indexOf('--only');
  const only = onlyIdx >= 0 ? args[onlyIdx + 1].split(',').map(s => s.trim()) : null;
  const writeRegistry = args.indexOf('--no-registry') < 0;

  const sharp = require('sharp');
  fs.mkdirSync(OUT, { recursive: true });
  let games = loadRegistry().filter(g => g && g.id && g.file);
  if (only) games = games.filter(g => only.includes(g.id));
  console.log('capturing ' + games.length + ' games');

  const results = [];
  await withServer(async ({ base, browser }) => {
    for (const g of games) {
      const r = await capture(browser, base, g, sharp);
      results.push(r);
      console.log((r.ok ? 'OK   ' : 'MISS ') + r.id + (r.ok ? ' ' + r.size : ' - ' + r.why));
    }
  });

  const kept = results.filter(r => r.ok).map(r => r.id);
  const allIds = games.map(g => g.id);

  // remove stale webp files for games that were not kept
  for (const id of allIds) {
    if (kept.indexOf(id) >= 0) continue;
    const f = path.join(OUT, id + '.webp');
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }

  if (writeRegistry) {
    const before = fs.readFileSync(REGISTRY, 'utf8');
    const after = syncRegistry(before, new Set(kept), allIds);
    if (after !== before) {
      fs.writeFileSync(REGISTRY + '.bak', before);
      fs.writeFileSync(REGISTRY, after);
      try {
        require('child_process').execFileSync(process.execPath, ['--check', REGISTRY]);
        fs.unlinkSync(REGISTRY + '.bak');
        console.log('registry synced: ' + kept.length + ' thumbs');
      } catch (e) {
        fs.copyFileSync(REGISTRY + '.bak', REGISTRY);
        fs.unlinkSync(REGISTRY + '.bak');
        console.error('registry edit failed syntax check, reverted');
      }
    }
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(kept.sort(), null, 2));
  console.log('kept ' + kept.length + '/' + games.length);
})().catch(e => { console.error(e); process.exit(1); });
