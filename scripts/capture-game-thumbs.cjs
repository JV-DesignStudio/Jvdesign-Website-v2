#!/usr/bin/env node
/*
 * scripts/capture-game-thumbs.cjs - A951 (stage 1: flagship batch)
 *
 * Captures a real gameplay screenshot for the flagship games and writes a webp
 * thumbnail into assets/game-thumbs/<id>.webp. The arcade card prefers this over
 * the marketing cover so the card shows the game, not a generic panel.
 *
 * Usage: node scripts/capture-game-thumbs.cjs
 * Add a game to GAMES to capture more.
 */
const path = require('path');
const fs = require('fs');
const { withServer } = require('../tests/story-run-harness.cjs');

const OUT = path.resolve(__dirname, '..', 'assets', 'game-thumbs');

// id -> how to reach gameplay for that game.
const GAMES = [
  { id: 'crossy-crew', page: '/games/crossy-crew.html', start: '#playBtn', canvas: '#game', wait: 1700 },
  { id: 'highway-dodge', page: '/games/highway-dodge.html', start: '#playBtn', canvas: '#game', wait: 1300 },
  { id: 'lumo-dash', page: '/games/lumo-dash.html', start: '#playBtn', canvas: '#game', wait: 1500 },
  { id: 'nova-siege', page: '/games/nova-siege.html', start: '#startBtn', canvas: '#cv', wait: 1700 }
];

(async () => {
  const sharp = require('sharp');
  fs.mkdirSync(OUT, { recursive: true });
  await withServer(async ({ base, browser }) => {
    for (const g of GAMES) {
      const page = await browser.newPage();
      try {
        await page.setViewport({ width: 820, height: 1040, deviceScaleFactor: 2 });
        await page.goto(base + g.page, { waitUntil: 'load', timeout: 30000 });
        await page.evaluate(sel => { const b = document.querySelector(sel); if (b) b.click(); }, g.start);
        await new Promise(r => setTimeout(r, g.wait));
        // Strip page chrome that sits over the canvas so the shot is pure gameplay.
        await page.evaluate(() => {
          document.querySelectorAll('#cookie-banner,.jvds-launch,#jvds-exit,.gs-fullscreen-btn,.gs-resume,.arcade-menu,.mascot-companion,#jvds-feedback-widget,.mascot-quiz-backdrop').forEach(el => el.remove());
        });
        await new Promise(r => setTimeout(r, 120));
        const el = await page.$(g.canvas);
        if (!el) { console.error('no canvas for ' + g.id); continue; }
        const buf = await el.screenshot({ type: 'png' });
        const file = path.join(OUT, g.id + '.webp');
        await sharp(buf).resize({ width: 640, withoutEnlargement: true }).webp({ quality: 82 }).toFile(file);
        const meta = await sharp(file).metadata();
        console.log('wrote ' + g.id + '.webp ' + meta.width + 'x' + meta.height);
      } catch (e) {
        console.error('FAILED ' + g.id + ': ' + e.message);
      } finally {
        await page.close();
      }
    }
  });
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
