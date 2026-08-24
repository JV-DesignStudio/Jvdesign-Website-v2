#!/usr/bin/env node
/*
 * scripts/make-featured-links.js — real share-links for the landing gallery.
 *
 * Each featured game becomes a byte-compatible ?game= (play) / ?remix= link
 * that tools/arcade-game-maker.html decodes natively. Wire format must match
 * _compressPayload exactly: JSON → raw DEFLATE → base64url. Node's
 * zlib.deflateRawSync produces identical bytes to the browser's
 * CompressionStream('deflate-raw'), verified by tests/arcade-audit.js.
 *
 * - Rewrites hrefs on landing anchors carrying [data-game][data-mode]
 * - Writes tools/featured-games.json (consumed by tests/arcade-audit.js)
 *
 * Run after changing any template:  node scripts/make-featured-links.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT    = path.join(__dirname, '..');
const LANDING = path.join(ROOT, 'tools', 'arcade-game-maker-landing.html');
const OUT     = path.join(ROOT, 'tools', 'featured-games.json');
const SITE_URL = 'https://jvdesignstudio.co.uk/tools/arcade-game-maker.html';

/* ── Featured templates ────────────────────────────────────────────────────────
 * Mirrors _TEMPLATES in arcade-game-maker.html. Keep in sync when templates
 * change there. `title` is the storefront name (may differ from the in-maker
 * template title on purpose). */
const GAMES = {
  space_survival: {
    title: 'Space Survival', genre: 'WAVESURVIVAL', speed: 240,
    lc: { lives:3, waveScaling:2, wavePause:2000, waveClearBonus:true, enemyAI:'bomber',
          bossEnabled:true, bossHpNew:20, bossScore:300, coinsEnabled:true,
          particleStyle:'star', particleColor:'purple', difficultyScale:1.2, theme:'space',
          storyIntro:'Endless alien fleets are descending. Survive as long as you can!',
          storyWin:'The fleet retreats... for now.', storyLose:'Overwhelmed by the swarm...' },
  },
  dino_runner: {
    title: 'Dino Dash', genre: 'RUNNER', speed: 300,
    lc: { lives:1, runnerObstacleMix:'mixed', runnerCoinFreq:0.3, spawnDelay:800,
          coinsEnabled:true, coinEmoji:'🦴', particleStyle:'burst', particleColor:'green',
          doubleJump:true, difficultyScale:1.5, weatherEffect:'none', theme:'forest',
          storyIntro:'A tiny dino sprints through the jungle, how far can you go?',
          storyWin:'Legendary runner!', storyLose:'Bonk!' },
  },
  ghost_maze: {
    title: 'Ghost Maze', genre: 'ROGUELIKE', speed: 170,
    lc: { lives:5, rogueRooms:8, rogueDensity:0.4, rogueStartHp:5,
          coinsEnabled:true, coinEmoji:'💎', particleStyle:'sparkle', particleColor:'purple',
          bossEnabled:true, bossHpNew:25, bossScore:400, difficultyScale:1, theme:'castle',
          storyIntro:'Escape the haunted maze and defeat the ghost king!',
          storyWin:'The ghost king is banished!', storyLose:'Trapped forever...' },
  },
  neon_wave: {
    title: 'Neon Wave', genre: 'WAVESURVIVAL', speed: 260,
    lc: { lives:2, bgStyle:'neon', waveScaling:3, wavePause:1500, waveClearBonus:true,
          enemyAI:'zigzag', bossEnabled:true, bossHpNew:30, bossScore:500, coinsEnabled:true,
          particleStyle:'swirl', particleColor:'purple', difficultyScale:2, gameFont:'Orbitron',
          theme:'cyber',
          storyIntro:'Waves of neon drones are charging the grid!',
          storyWin:'Grid secured!', storyLose:'System overloaded...' },
  },
  street_dojo: {
    title: 'Street Dojo', genre: 'BEAT', speed: 210,
    lc: { lives:3, cpuDifficulty:'normal', roundCount:3, twoPlayer:false,
          particleStyle:'burst', particleColor:'purple', difficultyScale:0, theme:'cyber',
          storyIntro:'The Dojo championship begins. Prove your worth in 1v1 combat!',
          storyWin:'Champion! The dojo bows to you.', storyLose:'Defeated... train harder.' },
  },
  ocean_shooter: {
    title: 'Ocean Shooter', genre: 'SHOOTER', speed: 220,
    lc: { lives:3, bossEnabled:true, bossHpNew:20, bossScore:400, enemyAI:'chaser',
          coinsEnabled:true, particleStyle:'burst', particleColor:'blue',
          difficultyScale:1, weatherEffect:'rain', theme:'ocean',
          storyIntro:'The deep-sea aliens are invading! Defend the ocean!',
          storyWin:'The ocean is saved!', storyLose:'The aliens took over the sea...' },
  },
  cyber_invaders: {
    title: 'Cyber Invaders', genre: 'INVADERS', speed: 200,
    lc: { lives:3, bossEnabled:true, bossHpNew:25, bossScore:500, enemyAI:'zigzag',
          coinsEnabled:true, particleStyle:'swirl', particleColor:'purple',
          difficultyScale:1.5, weatherEffect:'none', theme:'cyber',
          storyIntro:'The cyber drones are hacking the mainframe! Stop them all!',
          storyWin:'System secured. You are the firewall!', storyLose:'System breached...' },
  },
  rhythm_pop: {
    title: 'Rhythm Pop', genre: 'RHYTHM', speed: 200,
    lc: { rhythmLanes:4, rhythmSpeed:260, rhythmMisses:25, rhythmWinScore:2000, seqBpm:120,
          seqPattern:[[1,0,0,0,1,0,0,0],[0,0,1,0,0,0,1,0],[0,1,0,1,0,1,0,1],[1,0,0,1,0,0,1,0],
                      [1,0,1,0,1,0,1,0],[0,1,0,0,0,1,0,0],[0,0,0,1,0,0,0,1],[1,0,0,0,0,0,1,0]],
          particleStyle:'star', particleColor:'purple', difficultyScale:0, theme:'cyber',
          storyIntro:"Hit the notes as they reach the line, A S D F. Build combos for max score!",
          storyWin:'Perfect rhythm!', storyLose:'Missed too many beats...' },
  },
};

function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function encodeParam(cfg) {
  const payload = {
    title: cfg.title, genre: cfg.genre,
    speed: cfg.speed || 200, gravity: 600, jump: 450, map: null,
    lc: cfg.lc, th: { c: [], n: '' }, bs: 0, bn: '', fk: 0,
  };
  // Self-check: what we emit must inflate back to identical JSON.
  const json = JSON.stringify(payload);
  const deflated = zlib.deflateRawSync(Buffer.from(json, 'utf8'));
  const roundTrip = zlib.inflateRawSync(deflated).toString('utf8');
  if (roundTrip !== json) throw new Error('round-trip mismatch for ' + cfg.title);
  return b64url(deflated);
}

// ── Build URLs ────────────────────────────────────────────────────────────────
const manifest = [];
let html = fs.readFileSync(LANDING, 'utf8');
let patched = 0;

for (const [key, cfg] of Object.entries(GAMES)) {
  const playUrl  = SITE_URL + '?game=' + encodeParam({ ...cfg });
  const remixUrl = SITE_URL + '?remix=' + encodeParam({ ...cfg });
  manifest.push({ key, title: cfg.title, genre: cfg.genre, playUrl, remixUrl, urlBytes: playUrl.length });

  for (const mode of ['play', 'remix']) {
    const url = mode === 'play' ? playUrl : remixUrl;
    const re = new RegExp('href="#"([^>]*data-game="' + key + '"[^>]*data-mode="' + mode + '")');
    if (!re.test(html)) throw new Error(`landing anchor not found for ${key}/${mode} — was the gallery markup changed?`);
    html = html.replace(re, () => `href="${url}"$1`);
    patched++;
  }
}

fs.writeFileSync(LANDING, html);
fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2));

console.log(`✓ patched ${patched} links in ${path.basename(LANDING)}`);
console.log(`✓ wrote ${path.basename(OUT)}\n`);
console.log('key'.padEnd(16), 'genre'.padEnd(14), 'url size');
for (const m of manifest) {
  console.log(m.key.padEnd(16), m.genre.padEnd(14), (m.urlBytes / 1024).toFixed(2) + 'KB' + (m.urlBytes < 3000 ? '  (QR-friendly)' : ''));
}
