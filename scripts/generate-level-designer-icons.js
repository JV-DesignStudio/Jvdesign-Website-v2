#!/usr/bin/env node
/*
  generate-level-designer-icons.js
  Renders the Level Designer app icons into icons/.

      icons/level-designer-192.png            any-purpose PWA icon
      icons/level-designer-512.png            any-purpose PWA icon
      icons/level-designer-180.png            apple-touch-icon
      icons/level-designer-maskable-512.png   maskable, art inside safe zone

  Art: a chunky 2x2 tile grid (grass / ground / stone / coin) with the blue
  player standing on it and an amber selection outline — the editor's own
  palette. Maskable adds ~14% padding so Android can crop to any shape.

  Re-run after changing the art:
      node scripts/generate-level-designer-icons.js

  Requires puppeteer (already a devDependency).
*/
const fs = require('fs');
const path = require('p' + 'ath');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'icons');

const GRASS = '#4a8f3f';
const GROUND = '#7c5c3a';
const STONE = '#888898';
const COIN = '#ffd700';
const PLAYER = '#4169e1';
const AMBER = '#f59e0b';

function svg(pad, bleed) {
  const S = 512;
  const inner = S * (1 - pad * 2);
  const o = S * pad;

  // Side-view level strip: ground row at the bottom, player + coin above.
  const tw = inner * 0.26;          // tile size
  const gap = inner * 0.02;
  const rowW = tw * 3 + gap * 2;
  const gx = o + (inner - rowW) / 2;
  const gy = o + inner * 0.58;
  const r = inner * 0.035;

  const tile = i => ({ x: gx + i * (tw + gap), y: gy });
  const left = tile(0), mid = tile(1), right = tile(2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1c2333"/>
      <stop offset="1" stop-color="#0d1017"/>
    </linearGradient>
    <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${GRASS}"/>
      <stop offset="1" stop-color="#35682d"/>
    </linearGradient>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#93704b"/>
      <stop offset="1" stop-color="${GROUND}"/>
    </linearGradient>
  </defs>

  ${bleed
      ? `<rect width="${S}" height="${S}" fill="url(#bg)"/>`
      : `<rect width="${S}" height="${S}" rx="${S * 0.22}" fill="url(#bg)"/>`}

  <!-- faint editor gridlines across the background -->
  ${[1, 2, 3, 4, 5, 6].map(i => {
    const p = o + (inner / 7) * i;
    return `<line x1="${p}" y1="${o}" x2="${p}" y2="${o + inner}" stroke="#ffffff" stroke-opacity=".05" stroke-width="${inner * 0.008}"/>
            <line x1="${o}" y1="${p}" x2="${o + inner}" y2="${p}" stroke="#ffffff" stroke-opacity=".05" stroke-width="${inner * 0.008}"/>`;
  }).join('\n  ')}

  <!-- ground row: grass, grass, stone -->
  <rect x="${left.x}" y="${left.y}" width="${tw}" height="${tw}" rx="${r}" fill="url(#grass)"/>
  <rect x="${mid.x}" y="${mid.y}" width="${tw}" height="${tw}" rx="${r}" fill="url(#grass)"/>
  <rect x="${right.x}" y="${right.y}" width="${tw}" height="${tw}" rx="${r}" fill="${STONE}"/>

  <!-- coin floating above the left tile -->
  <circle cx="${left.x + tw / 2}" cy="${left.y - tw * 1.05}" r="${tw * 0.24}"
          fill="${COIN}" stroke="#a87e00" stroke-width="${inner * 0.012}"/>

  <!-- player standing on the middle tile -->
  <rect x="${mid.x + tw * 0.20}" y="${mid.y - tw * 0.92}" width="${tw * 0.60}" height="${tw * 0.92}"
        rx="${tw * 0.13}" fill="${PLAYER}"/>
  <rect x="${mid.x + tw * 0.31}" y="${mid.y - tw * 0.80}" width="${tw * 0.38}" height="${tw * 0.22}"
        rx="${tw * 0.07}" fill="${COIN}"/>

  <!-- amber selection outline around the stone tile -->
  <rect x="${right.x - gap}" y="${right.y - gap}" width="${tw + gap * 2}" height="${tw + gap * 2}"
        rx="${r * 1.4}" fill="none" stroke="${AMBER}" stroke-width="${inner * 0.028}"
        stroke-dasharray="${inner * 0.07} ${inner * 0.045}"/>
</svg>`;
}

async function main() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  const jobs = [
    { file: 'level-designer-192.png', size: 192, pad: 0, bleed: false },
    { file: 'level-designer-512.png', size: 512, pad: 0, bleed: false },
    { file: 'level-designer-180.png', size: 180, pad: 0, bleed: false },
    { file: 'level-designer-maskable-512.png', size: 512, pad: 0.14, bleed: true },
  ];

  for (const j of jobs) {
    const markup = svg(j.pad, j.bleed);
    await page.setViewport({ width: j.size, height: j.size, deviceScaleFactor: 1 });
    await page.setContent(
      `<html><body style="margin:0;width:${j.size}px;height:${j.size}px">` +
      `<div style="width:${j.size}px;height:${j.size}px">` +
      markup.replace(/width="512" height="512"/, `width="${j.size}" height="${j.size}"`) +
      `</div></body></html>`,
      { waitUntil: 'load' }
    );
    const buf = await page.screenshot({
      omitBackground: !j.bleed,
      clip: { x: 0, y: 0, width: j.size, height: j.size },
    });
    fs.writeFileSync(path.join(OUT, j.file), buf);
    console.log(`  wrote icons/${j.file} (${j.size}x${j.size})`);
  }

  await browser.close();
  console.log('level designer icons done.');
}

main().catch(e => { console.error(e); process.exit(1); });
