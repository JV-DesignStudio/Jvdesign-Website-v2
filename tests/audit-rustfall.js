#!/usr/bin/env node
/*
 * tests/audit-rustfall.js - JVDS Arcade "RustFall-grade" scorecard.
 *
 * Scores every registry game against the shared bar (fullscreen shell, quality
 * kit panel, live coach, daily/streak meta, GameSystem hooks, build-next link,
 * mobile controls, content depth) plus a 390/1440 browser load check.
 *
 * Usage:
 *   node tests/audit-rustfall.js                (all games, writes JSON + table)
 *   node tests/audit-rustfall.js --limit 8      (first 8 games)
 *   node tests/audit-rustfall.js --only a.html,b.html
 *   node tests/audit-rustfall.js --json         (JSON only)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const http = require('http');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const GAMES_DIR = path.join(ROOT, 'games');
const OUT_JSON = path.join(ROOT, 'audit-rustfall-results.json');

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? (args[i + 1] || true) : null; };
const has = (name) => args.includes(name);
const LIMIT = Number(flag('--limit')) || 0;
const ONLY = flag('--only') ? String(flag('--only')).split(',').map(s => s.trim()) : null;
const JSON_ONLY = has('--json');

const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'games-registry.js'), 'utf8'), ctx);
let games = ctx.window.JVDS_GAMES || [];
if (ONLY) games = games.filter(g => ONLY.includes(g.file));
if (LIMIT) games = games.slice(0, LIMIT);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.m4a': 'audio/mp4' };
const PORT = Number(process.env.RUSTFALL_PORT || 8211);

function serve() {
  return http.createServer((req, res) => {
    let rel; try { rel = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
}

const DEPTH_MARKERS = ['wave', 'boss', 'level', 'room', 'achievement', 'shop', 'upgrade', 'daily', 'streak', 'combo', 'mission', 'score', 'save', 'relic', 'coach'];

function staticScore(file) {
  const f = path.join(GAMES_DIR, file);
  if (!fs.existsSync(f)) return { ok: false, score: 0, notes: 'missing file' };
  const s = fs.readFileSync(f, 'utf8');
  const lines = s.split('\n').length;
  const fns = (s.match(/function\s+\w+|=>\s*\{/g) || []).length;
  const out = {};
  out.shell = /game-shell\.js/.test(s);
  out.kit = /data-game-kit|jvds-kit-panel|quality-panel|gd-quality-panel/.test(s);
  out.labels = (['<b>Goal</b>', '<b>Skill</b>', '<b>Session</b>', '<b>Build next</b>'].filter(x => s.includes(x))).length === 4;
  out.coach = /coach/i.test(s);
  out.daily = /daily|streak/i.test(s);
  out.gamesystem = /addScore|recordGamePlay|saveState|GameSystem/.test(s);
  out.build = /href="\.\.\/tools\//.test(s);
  out.controls = /dpad|data-key|pointerdown|keydown|touchstart|swipe|pad|button/i.test(s);
  out.depthMarkers = DEPTH_MARKERS.filter(m => new RegExp(m, 'i').test(s)).length;

  // Wrapper pages are landing pages that embed the game in an iframe; they are
  // scored on the landing/entry bar, not on inline coach/GameSystem signals.
  const wrapper = /_page\.html$/i.test(file) || /<iframe/i.test(s);
  if (wrapper) {
    let ws = 0;
    if (out.shell) ws += 15;
    if (/how to play|guide|how-list|hero/i.test(s)) ws += 20;
    if (/data-jvds-play|data-kit-build|citedelStart|start game|>Play|>Start/i.test(s)) ws += 15;
    if (/<iframe/i.test(s)) ws += 10;
    if (/data-jvds-root|game-frame-wrap|jvds-root/i.test(s)) ws += 10;
    ws += Math.min(10, Math.round(Math.min(lines, 500) / 500 * 10));
    return { ok: true, score: ws, flags: out, lines, fns, wrapper: true };
  }

  let score = 0;
  if (out.shell) score += 5;
  if (out.kit) score += 8;
  if (out.labels) score += 7;
  if (out.coach) score += 8;
  if (out.daily) score += 8;
  if (out.gamesystem) score += 8;
  if (out.build) score += 6;
  if (out.controls) score += 6;
  score += Math.min(14, Math.round(out.depthMarkers / DEPTH_MARKERS.length * 14));
  score += Math.min(10, Math.round(Math.min(lines, 700) / 700 * 6 + Math.min(fns, 120) / 120 * 4));
  return { ok: true, score, flags: out, lines, fns, wrapper: false };
}

(async () => {
  const server = serve();
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const results = [];
  try {
    for (const g of games) {
      const stat = staticScore(g.file);
      const row = { id: g.id, file: g.file, title: g.title, static: stat, dyn: {}, score: stat.score, notes: [] };
      if (!stat.ok) { results.push(row); continue; }
      for (const vp of [{ n: '390', w: 390, h: 844 }, { n: '1440', w: 1440, h: 900 }]) {
        const page = await browser.newPage();
        const errs = [];
        page.on('pageerror', e => errs.push(e.message));
        page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
        let overflow = true;
        try {
          await page.setViewport({ width: vp.w, height: vp.h, isMobile: vp.w < 700 });
          await page.goto(`http://127.0.0.1:${PORT}/games/${g.file}`, { waitUntil: 'networkidle2', timeout: 30000 });
          await new Promise(r => setTimeout(r, 700));
          overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
        } catch (e) { errs.push('load: ' + e.message); }
        const noErr = errs.length === 0;
        row.dyn[vp.n] = { errors: errs.slice(0, 3), noErr, overflow };
        if (noErr) row.score += 8; else row.notes.push(vp.n + ' errors: ' + errs.slice(0, 2).join(' | '));
        if (overflow) row.score += 5; else row.notes.push(vp.n + ' overflow');
        await page.close();
      }
      results.push(row);
      if (!JSON_ONLY) console.log(String(row.score).padStart(3) + '  ' + g.file.padEnd(30) + (row.notes.length ? '  ' + row.notes.join('; ') : ''));
    }
  } finally {
    await browser.close();
    server.close();
  }
  results.sort((a, b) => a.score - b.score || a.file.localeCompare(b.file));
  fs.writeFileSync(OUT_JSON, JSON.stringify({ generated: new Date().toISOString(), count: results.length, results }, null, 2));
  if (JSON_ONLY) { console.log(JSON.stringify(results.map(r => ({ file: r.file, score: r.score })), null, 2)); }
  else {
    console.log('\n-- Weakest first --');
    results.slice(0, 12).forEach(r => console.log(String(r.score).padStart(3) + '  ' + r.file));
    console.log('\nWrote ' + path.relative(ROOT, OUT_JSON) + ' (' + results.length + ' games)');
  }
  process.exit(0);
})();
