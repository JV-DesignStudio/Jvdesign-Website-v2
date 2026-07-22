#!/usr/bin/env node
/*
  generate-arcade-icons.js
  ────────────────────────
  Renders the JVDS Arcade app icons into icons/.

  The Arcade ships as its own installable app (arcade.webmanifest), so it
  needs its own icon set rather than the site-wide JVDS logo:

      icons/arcade-192.png            any-purpose PWA icon
      icons/arcade-512.png            any-purpose PWA icon
      icons/arcade-maskable-512.png   maskable, art kept inside the safe zone
      icons/arcade-180.png            apple-touch-icon
      icons/arcade-splash.png         1024 source for Capacitor asset generation

  Art: a retro cabinet on the crew's purple, with four marquee lights in the
  cozy-crew colours (Lumo, Ember, Pip, Echo). Maskable adds ~20% padding so
  Android can crop it to any shape without clipping the cabinet.

  Re-run after changing the art:
      node scripts/generate-arcade-icons.js

  Requires puppeteer (already a devDependency). No webfonts, so it works
  offline and renders identically on any machine.
*/
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'icons');

// Cozy-crew accents, per the art spec.
const LUMO = '#A583CE';
const EMBER = '#E8A9B4';
const PIP = '#8FCB7F';
const ECHO = '#F6C6D4';
const GOLD = '#F0C040';

/**
 * The icon as a standalone SVG.
 * @param {number} pad Fraction of the canvas to leave empty around the art.
 *                     0 for normal icons, ~0.14 for maskable safe zone.
 * @param {boolean} bleed Fill the whole canvas with the background colour
 *                        (maskable icons must have no transparent corners).
 */
function svg(pad, bleed) {
  const S = 512;
  const inner = S * (1 - pad * 2);
  const o = S * pad;
  // Cabinet geometry, expressed inside the padded box.
  const cx = o + inner / 2;
  const cw = inner * 0.62;
  const ch = inner * 0.74;
  const cy = o + inner * 0.16;
  const r = inner * 0.09;
  const screenPad = cw * 0.13;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2a2140"/>
      <stop offset="1" stop-color="#0a0b10"/>
    </linearGradient>
    <linearGradient id="cab" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${LUMO}"/>
      <stop offset="1" stop-color="#6b4b9e"/>
    </linearGradient>
    <linearGradient id="scr" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#10131f"/>
      <stop offset="1" stop-color="#1d2436"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="${S * 0.014}" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  ${bleed
      ? `<rect width="${S}" height="${S}" fill="url(#bg)"/>`
      : `<rect width="${S}" height="${S}" rx="${S * 0.22}" fill="url(#bg)"/>`}

  <!-- cabinet body -->
  <rect x="${cx - cw / 2}" y="${cy}" width="${cw}" height="${ch}" rx="${r}" fill="url(#cab)"/>

  <!-- marquee -->
  <rect x="${cx - cw / 2 + screenPad * 0.55}" y="${cy + ch * 0.055}"
        width="${cw - screenPad * 1.1}" height="${ch * 0.115}"
        rx="${ch * 0.045}" fill="${GOLD}" opacity=".92"/>

  <!-- screen -->
  <rect x="${cx - cw / 2 + screenPad}" y="${cy + ch * 0.215}"
        width="${cw - screenPad * 2}" height="${ch * 0.375}"
        rx="${ch * 0.05}" fill="url(#scr)"/>

  <!-- four crew lights on the screen -->
  ${[LUMO, EMBER, PIP, ECHO].map((c, i) => {
    const gw = cw - screenPad * 2;
    const step = gw / 5;
    const px = cx - cw / 2 + screenPad + step * (i + 1);
    const py = cy + ch * 0.215 + ch * 0.375 / 2;
    return `<circle cx="${px}" cy="${py}" r="${inner * 0.033}" fill="${c}" filter="url(#glow)"/>`;
  }).join('\n  ')}

  <!-- joystick -->
  <rect x="${cx - inner * 0.012}" y="${cy + ch * 0.645}"
        width="${inner * 0.024}" height="${ch * 0.105}" rx="${inner * 0.012}" fill="#2b2338"/>
  <circle cx="${cx}" cy="${cy + ch * 0.645}" r="${inner * 0.042}" fill="${EMBER}"/>

  <!-- two buttons -->
  <circle cx="${cx + cw * 0.235}" cy="${cy + ch * 0.70}" r="${inner * 0.030}" fill="${GOLD}"/>
  <circle cx="${cx - cw * 0.235}" cy="${cy + ch * 0.70}" r="${inner * 0.030}" fill="${PIP}"/>

  <!-- base -->
  <rect x="${cx - cw / 2 - inner * 0.03}" y="${cy + ch * 0.90}"
        width="${cw + inner * 0.06}" height="${ch * 0.10}"
        rx="${ch * 0.035}" fill="#4a3670"/>
</svg>`;
}

async function main() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  // size = output px, pad/bleed = art treatment.
  const jobs = [
    { file: 'arcade-192.png', size: 192, pad: 0, bleed: false },
    { file: 'arcade-512.png', size: 512, pad: 0, bleed: false },
    { file: 'arcade-180.png', size: 180, pad: 0, bleed: false },
    { file: 'arcade-maskable-512.png', size: 512, pad: 0.14, bleed: true },
    { file: 'arcade-splash.png', size: 1024, pad: 0.10, bleed: true },
  ];

  for (const j of jobs) {
    const markup = svg(j.pad, j.bleed);
    await page.setViewport({ width: j.size, height: j.size, deviceScaleFactor: 1 });
    await page.setContent(
      `<html><body style="margin:0;width:${j.size}px;height:${j.size}px">` +
      `<div style="width:${j.size}px;height:${j.size}px">` +
      markup.replace('width="512" height="512"', `width="${j.size}" height="${j.size}"`) +
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
  console.log('arcade icons done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
