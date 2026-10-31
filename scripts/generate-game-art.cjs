#!/usr/bin/env node
/*
 * scripts/generate-game-art.cjs
 *
 * Renders flat placeholder PNGs for the arcade so the game pages and social
 * cards have art to point at while the real hand-drawn versions are made.
 * These are deliberately simple shapes, not finished art: redraw over them.
 *
 * Existing files are left alone unless --force is passed, so a hand-redrawn
 * PNG is never overwritten by accident.
 *
 * Run: node scripts/generate-game-art.cjs [--force]
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const SPRITE_DIR = path.join(ROOT, 'assets', 'game-art', 'highway-dodge');
const COVER_DIR = path.join(ROOT, 'assets', 'game-art', 'covers');
const force = process.argv.includes('--force');

const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

function car(w, h, o) {
  const x0 = w * 0.11;
  const bodyW = w * 0.78;
  const tyreW = w * 0.09;
  const tyreH = h * 0.15;
  const tyTop = h * 0.15;
  const tyBot = h - h * 0.15 - tyreH;
  const lx = x0 - tyreW * 0.45;
  const rx = x0 + bodyW - tyreW * 0.55;
  const r = Math.min(w, h) * (o.round == null ? 0.20 : o.round);
  return svg(w, h, `
  <defs>
    <linearGradient id="b" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${o.body}"/>
      <stop offset="0.5" stop-color="${o.body2}"/>
      <stop offset="1" stop-color="${o.body}"/>
    </linearGradient>
  </defs>
  <rect x="${lx}" y="${tyTop}" width="${tyreW}" height="${tyreH}" rx="2" fill="#0a0a0a"/>
  <rect x="${lx}" y="${tyBot}" width="${tyreW}" height="${tyreH}" rx="2" fill="#0a0a0a"/>
  <rect x="${rx}" y="${tyTop}" width="${tyreW}" height="${tyreH}" rx="2" fill="#0a0a0a"/>
  <rect x="${rx}" y="${tyBot}" width="${tyreW}" height="${tyreH}" rx="2" fill="#0a0a0a"/>
  <rect x="${x0}" y="2" width="${bodyW}" height="${h - 4}" rx="${r}" fill="url(#b)" stroke="${o.dark}" stroke-width="2"/>
  ${o.stripe ? `<rect x="${w / 2 - 2}" y="${h * 0.32}" width="4" height="${h * 0.36}" rx="2" fill="${o.stripe}" opacity="0.85"/>` : ''}
  ${o.divider ? `<rect x="${x0}" y="${h * 0.30}" width="${bodyW}" height="2" fill="${o.dark}" opacity="0.5"/>` : ''}
  <rect x="${w * 0.25}" y="${h * 0.17}" width="${w * 0.50}" height="${h * 0.12}" rx="${r * 0.4}" fill="#0b1220" opacity="0.92"/>
  <rect x="${w * 0.25}" y="${h * 0.72}" width="${w * 0.50}" height="${h * 0.10}" rx="${r * 0.4}" fill="#0b1220" opacity="0.92"/>
  <rect x="${w * 0.21}" y="${h * 0.35}" width="${w * 0.58}" height="${h * 0.30}" rx="${r * 0.5}" fill="${o.body2}" opacity="0.45"/>
  <rect x="${w * 0.19}" y="${h * 0.06}" width="${w * 0.15}" height="${h * 0.035}" rx="2" fill="${o.light || '#fff7d6'}"/>
  <rect x="${w * 0.66}" y="${h * 0.06}" width="${w * 0.15}" height="${h * 0.035}" rx="2" fill="${o.light || '#fff7d6'}"/>
  <rect x="${w * 0.19}" y="${h * 0.905}" width="${w * 0.15}" height="${h * 0.035}" rx="2" fill="${o.tail || '#ef4444'}"/>
  <rect x="${w * 0.66}" y="${h * 0.905}" width="${w * 0.15}" height="${h * 0.035}" rx="2" fill="${o.tail || '#ef4444'}"/>
  `);
}

const nitro = () => svg(32, 32, `
  <defs><radialGradient id="g"><stop offset="0" stop-color="#fde047" stop-opacity="0.85"/><stop offset="1" stop-color="#eab308" stop-opacity="0"/></radialGradient></defs>
  <circle cx="16" cy="16" r="15" fill="url(#g)"/>
  <rect x="8" y="8" width="16" height="16" rx="5" fill="#facc15" stroke="#a16207" stroke-width="2"/>
  <path d="M19 5 L9 18 h6 l-2 9 L23 14 h-6 Z" fill="#7c2d12"/>
`);

const shield = () => svg(32, 32, `
  <path d="M16 2 L28 7 v9 c0 7 -6 12 -12 14 C10 28 4 23 4 16 V7 Z" fill="#38bdf8" stroke="#075985" stroke-width="2"/>
  <path d="M10 16 l4 4 l8 -9" fill="none" stroke="#f8fafc" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
`);

const fuel = () => svg(32, 32, `
  <rect x="8" y="7" width="16" height="21" rx="3" fill="#22c55e" stroke="#14532d" stroke-width="2"/>
  <rect x="12" y="3" width="8" height="5" rx="1.5" fill="#166534"/>
  <rect x="11" y="12" width="10" height="4" rx="1" fill="#bbf7d0"/>
  <rect x="11" y="19" width="10" height="4" rx="1" fill="#bbf7d0"/>
`);

const coin = () => svg(20, 20, `
  <circle cx="10" cy="10" r="9" fill="#f59e0b" stroke="#b45309" stroke-width="1.5"/>
  <circle cx="10" cy="10" r="6" fill="#fbbf24"/>
  <path d="M10 6 v8 M7.5 8.5 h5 M7.5 11.5 h5" stroke="#b45309" stroke-width="1.4" stroke-linecap="round" fill="none"/>
`);

const cone = () => svg(24, 36, `
  <rect x="2" y="5" width="20" height="28" rx="3" fill="#f97316" stroke="#9a3412" stroke-width="2"/>
  <circle cx="12" cy="19" r="9" fill="#fb923c" stroke="#9a3412" stroke-width="2"/>
  <circle cx="12" cy="19" r="5.5" fill="#f8fafc"/>
  <circle cx="12" cy="19" r="2" fill="#f97316"/>
`);

const barrel = () => svg(28, 28, `
  <circle cx="14" cy="14" r="12" fill="#dc2626" stroke="#7f1d1d" stroke-width="2"/>
  <circle cx="14" cy="14" r="8.5" fill="#ef4444"/>
  <rect x="4.5" y="12" width="19" height="4" fill="#fbbf24" transform="rotate(-22 14 14)"/>
  <circle cx="14" cy="14" r="3" fill="#7f1d1d"/>
`);

const roadTile = () => svg(120, 64, `
  <rect width="120" height="64" fill="#16161f"/>
  <rect x="0" y="0" width="2" height="64" fill="#f8fafc" opacity="0.22"/>
  <rect x="118" y="0" width="2" height="64" fill="#f8fafc" opacity="0.22"/>
  <rect x="38.5" y="16" width="3" height="32" rx="1" fill="#e2e8f0" opacity="0.88"/>
  <rect x="78.5" y="16" width="3" height="32" rx="1" fill="#e2e8f0" opacity="0.88"/>
`);

const sprites = {
  'ember-car.png': car(64, 104, { body: '#dc2626', body2: '#f97316', dark: '#7f1d1d', stripe: '#fbbf24' }),
  'stardust-car.png': car(64, 104, { body: '#e0b52e', body2: '#ffd23c', dark: '#9a6b00', stripe: '#fff7d6' }),
  'lumo-car.png': car(64, 104, { body: '#6d5ce0', body2: '#9a8cf7', dark: '#40318f', stripe: '#e0dbff' }),
  'pip-car.png': car(64, 104, { body: '#68b53f', body2: '#96e06a', dark: '#356b1b', stripe: '#eaffd6' }),
  'echo-car.png': car(64, 104, { body: '#249c8e', body2: '#5fd6c7', dark: '#176b62', stripe: '#d9fbf6' }),
  'traffic-sedan-red.png': car(56, 96, { body: '#b91c1c', body2: '#dc2626', dark: '#7f1d1d' }),
  'traffic-sedan-blue.png': car(56, 96, { body: '#1d4ed8', body2: '#3b82f6', dark: '#1e3a8a' }),
  'traffic-van-white.png': car(60, 112, { body: '#cbd5e1', body2: '#f1f5f9', dark: '#64748b', round: 0.12 }),
  'traffic-truck.png': car(64, 128, { body: '#475569', body2: '#94a3b8', dark: '#1e293b', round: 0.10, divider: true, light: '#fde68a' }),
  'traffic-wrongway.png': car(56, 96, { body: '#ef4444', body2: '#f87171', dark: '#991b1b', light: '#fecaca', tail: '#fff7d6' }),
  'pickup-nitro.png': nitro(),
  'pickup-shield.png': shield(),
  'pickup-fuel.png': fuel(),
  'hazard-cone.png': cone(),
  'hazard-barrel.png': barrel(),
  'coin.png': coin(),
  'road-tile.png': roadTile(),
};

function cover(size, bg1, bg2, title, accent, scene) {
  const [w, h] = size;
  return svg(w, h, `
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bg1}"/>
      <stop offset="1" stop-color="${bg2}"/>
    </linearGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.45"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#sky)"/>
  ${scene}
  <rect width="${w}" height="${h}" fill="url(#fade)"/>
  <text x="26" y="52" font-family="Segoe UI, Arial, sans-serif" font-size="38" font-weight="900" letter-spacing="1"
        fill="#ffffff" stroke="${accent}" stroke-width="6" paint-order="stroke" stroke-linejoin="round">${title}</text>
  <text x="28" y="${h - 22}" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="700" letter-spacing="3"
        fill="#ffffff" opacity="0.72">JVDS ARCADE</text>
  `);
}

const covers = {
  'highway-dodge-cover.png': cover([480, 270], '#0b1020', '#1e293b', 'HIGHWAY DODGE', '#f97316', `
    <path d="M150 270 L330 270 L292 0 L188 0 Z" fill="#232838"/>
    <path d="M236 270 L244 270 L241 0 L239 0 Z" fill="#e2e8f0" opacity="0.6"/>
    <path d="M196 270 L201 270 L199 0 L197 0 Z" fill="#e2e8f0" opacity="0.6"/>
    <path d="M279 270 L284 270 L281 0 L279 0 Z" fill="#e2e8f0" opacity="0.6"/>
    <rect x="140" y="96" width="40" height="70" rx="10" fill="#334155"/>
    <rect x="300" y="150" width="38" height="66" rx="9" fill="#3b82f6"/>
    <rect x="222" y="192" width="44" height="76" rx="11" fill="#f97316" stroke="#7f1d1d" stroke-width="3"/>
    <rect x="231" y="206" width="26" height="14" rx="5" fill="#0b1220"/>
    <circle cx="80" cy="60" r="3" fill="#fbbf24" opacity="0.8"/>
    <circle cx="400" cy="44" r="2" fill="#fbbf24" opacity="0.7"/>
    <circle cx="360" cy="80" r="2.5" fill="#fbbf24" opacity="0.6"/>
  `),
  'lumo-hive-cover.png': cover([480, 270], '#2e1065', '#7c3aed', "LUMO'S HIVE STRIKE", '#a855f7', `
    <g opacity="0.35" fill="none" stroke="#c4b5fd" stroke-width="2">
      <path d="M60 40 l16 -9 l16 9 v18 l-16 9 l-16 -9 Z"/>
      <path d="M110 24 l16 -9 l16 9 v18 l-16 9 l-16 -9 Z"/>
      <path d="M96 82 l16 -9 l16 9 v18 l-16 9 l-16 -9 Z"/>
      <path d="M352 36 l16 -9 l16 9 v18 l-16 9 l-16 -9 Z"/>
      <path d="M404 70 l16 -9 l16 9 v18 l-16 9 l-16 -9 Z"/>
      <path d="M330 96 l16 -9 l16 9 v18 l-16 9 l-16 -9 Z"/>
    </g>
    <circle cx="250" cy="150" r="88" fill="#f59e0b" opacity="0.9"/>
    <path d="M212 118 L226 74 L246 112 Z" fill="#f97316"/>
    <path d="M288 118 L274 74 L254 112 Z" fill="#f97316"/>
    <circle cx="250" cy="150" r="58" fill="#fbbf24"/>
    <path d="M222 156 q28 30 56 0 q-6 34 -28 38 q-22 -4 -28 -38 Z" fill="#fff7ed"/>
    <circle cx="230" cy="142" r="6" fill="#1a1208"/>
    <circle cx="270" cy="142" r="6" fill="#1a1208"/>
    <circle cx="250" cy="160" r="6" fill="#1a1208"/>
  `),
  'tower-defence-cover.png': cover([480, 270], '#0f766e', '#22c55e', 'TOWER DEFENCE', '#0d9488', `
    <path d="M0 210 q120 -34 240 0 q120 34 240 0 v60 H0 Z" fill="#166534"/>
    <path d="M0 232 q120 -26 240 0 q120 26 240 0 v38 H0 Z" fill="#14532d"/>
    <rect x="286" y="96" width="70" height="120" rx="8" fill="#94a3b8" stroke="#334155" stroke-width="4"/>
    <rect x="278" y="84" width="86" height="20" rx="4" fill="#64748b"/>
    <rect x="300" y="130" width="16" height="22" rx="3" fill="#0b1220"/>
    <rect x="326" y="130" width="16" height="22" rx="3" fill="#0b1220"/>
    <circle cx="140" cy="196" r="16" fill="#ef4444"/>
    <circle cx="184" cy="210" r="14" fill="#f97316"/>
    <circle cx="110" cy="212" r="12" fill="#fbbf24"/>
    <path d="M321 96 L236 190" stroke="#fde68a" stroke-width="3" stroke-dasharray="7 6" opacity="0.8"/>
  `),
  'crossy-crew-cover.png': cover([480, 270], '#0369a1', '#38bdf8', 'CROSSY CREW', '#0284c7', `
    <rect y="150" width="480" height="86" fill="#334155"/>
    <g fill="#fbbf24">
      <rect x="20" y="188" width="46" height="10" rx="2"/>
      <rect x="92" y="188" width="46" height="10" rx="2"/>
      <rect x="164" y="188" width="46" height="10" rx="2"/>
      <rect x="236" y="188" width="46" height="10" rx="2"/>
      <rect x="308" y="188" width="46" height="10" rx="2"/>
      <rect x="380" y="188" width="46" height="10" rx="2"/>
    </g>
    <rect y="236" width="480" height="34" fill="#22c55e"/>
    <circle cx="236" cy="132" r="26" fill="#f8fafc" stroke="#94a3b8" stroke-width="3"/>
    <circle cx="228" cy="128" r="3" fill="#1a1208"/>
    <path d="M236 156 l-7 10 h14 Z" fill="#f59e0b"/>
    <circle cx="150" cy="176" r="18" fill="#f97316"/>
    <circle cx="322" cy="108" r="16" fill="#4ade80"/>
    <rect x="120" y="70" width="70" height="44" rx="10" fill="#94a3b8"/>
  `),
  'nova-siege-cover.png': cover([480, 270], '#020617', '#312e81', 'NOVA SIEGE', '#6366f1', `
    <g fill="#f8fafc">
      <circle cx="40" cy="34" r="2"/><circle cx="96" cy="90" r="1.5"/><circle cx="180" cy="40" r="2"/>
      <circle cx="300" cy="30" r="1.5"/><circle cx="420" cy="58" r="2"/><circle cx="452" cy="130" r="1.5"/>
      <circle cx="70" cy="150" r="1.5"/><circle cx="360" cy="120" r="2"/>
    </g>
    <circle cx="380" cy="220" r="96" fill="#4338ca"/>
    <circle cx="380" cy="220" r="96" fill="none" stroke="#818cf8" stroke-width="4"/>
    <path d="M250 60 L330 96 L318 120 L238 84 Z" fill="#e2e8f0"/>
    <path d="M330 96 L300 116" stroke="#f97316" stroke-width="4"/>
    <path d="M238 84 L200 60 M318 120 L286 150" stroke="#22d3ee" stroke-width="4" stroke-dasharray="10 6"/>
    <circle cx="200" cy="60" r="6" fill="#22d3ee"/>
    <circle cx="286" cy="150" r="6" fill="#22d3ee"/>
  `),
  'voidrush-cover.png': cover([480, 270], '#1e1b4b', '#7e22ce', 'VOIDRUSH', '#c026d3', `
    <g stroke="#a78bfa" stroke-width="2" opacity="0.55">
      <path d="M0 270 L180 120 M120 270 L232 120 M240 270 L284 120 M360 270 L336 120 M480 270 L388 120"/>
      <path d="M40 0 L150 270 M180 0 L210 270 M300 0 L270 270 M440 0 L330 270"/>
    </g>
    <path d="M240 96 L274 196 L240 172 L206 196 Z" fill="#f0abfc"/>
    <path d="M240 118 L258 176 L240 162 L222 176 Z" fill="#c026d3"/>
    <circle cx="240" cy="180" r="10" fill="#22d3ee"/>
    <path d="M180 210 L214 190 M300 210 L266 190" stroke="#f0abfc" stroke-width="4" stroke-linecap="round" opacity="0.8"/>
  `),
  'arcade-card-fallback.png': cover([480, 270], '#1e1b4b', '#0f766e', 'JVDS ARCADE', '#14b8a6', `
    <rect x="176" y="118" width="128" height="76" rx="26" fill="#e2e8f0"/>
    <circle cx="214" cy="156" r="16" fill="#334155"/>
    <circle cx="266" cy="156" r="16" fill="#334155"/>
    <rect x="146" y="140" width="22" height="32" rx="10" fill="#e2e8f0"/>
    <rect x="312" y="140" width="22" height="32" rx="10" fill="#e2e8f0"/>
    <circle cx="198" cy="144" r="5" fill="#fbbf24"/>
    <circle cx="282" cy="144" r="5" fill="#f472b6"/>
  `),
};

async function render(dir, map) {
  fs.mkdirSync(dir, { recursive: true });
  let made = 0;
  for (const [name, markup] of Object.entries(map)) {
    const out = path.join(dir, name);
    if (fs.existsSync(out) && !force) { console.log('keep ' + path.relative(ROOT, out)); continue; }
    const w = Number((markup.match(/width="(\d+)"/) || [])[1]);
    const h = Number((markup.match(/height="(\d+)"/) || [])[1]);
    await sharp(Buffer.from(markup)).png().toFile(out);
    made++;
    console.log(`make ${path.relative(ROOT, out)} (${w}x${h})`);
  }
  return made;
}

(async () => {
  const a = await render(SPRITE_DIR, sprites);
  const b = await render(COVER_DIR, covers);
  console.log(`\nDone: ${a + b} file(s) written${force ? ' (--force)' : ''}.`);
})().catch(e => { console.error(e); process.exit(1); });
