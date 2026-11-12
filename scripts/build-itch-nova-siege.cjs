#!/usr/bin/env node
/*
 * scripts/build-itch-nova-siege.cjs
 *
 * Builds the standalone itch.io copy of Nova Siege from the live site page.
 * The live page leans on the studio arcade layer (story-run, game-system,
 * games-registry, onboarding, game-shell, analytics funnel). None of that is
 * needed on itch, so the build strips it and inlines only the pieces the game
 * itself needs (hidpi-canvas, audio-effects, the game script). Everything is
 * written into F:/Website/itch/nova-siege so the live page is untouched.
 *
 * Usage:
 *   node scripts/build-itch-nova-siege.cjs
 *   node scripts/build-itch-nova-siege.cjs --no-shots
 *   node scripts/build-itch-nova-siege.cjs --no-zip
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'games', 'nova-siege.html');
const GAME_JS = path.join(ROOT, 'assets', 'js', 'inline', 'games-nova-siege-1.js');
const HIDPI_JS = path.join(ROOT, 'hidpi-canvas.js');
const AUDIO_JS = path.join(ROOT, 'audio-effects.js');
const OUT = path.resolve(ROOT, '..', 'itch', 'nova-siege');
const INDEX = path.join(OUT, 'index.html');
const ZIP = path.resolve(ROOT, '..', 'itch', 'nova-siege.zip');

const args = process.argv.slice(2);
const noShots = args.includes('--no-shots');
const noZip = args.includes('--no-zip');

function read(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

function stripSiteChrome(html) {
  // CSP and social/search metadata belong to the site, not the itch frame.
  html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, '');
  html = html.replace(/<link rel="canonical"[^>]*>/i, '');
  html = html.replace(/<link rel="icon"[^>]*>/i, '');
  html = html.replace(/<meta (?:property|name)="(?:og|twitter):[^"]*"[^>]*>/gi, '');
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/i, '');

  // Every remaining ../ stylesheet or script is a site-only dependency.
  html = html.replace(/<link rel="stylesheet" href="\.\.\/[^"]*">/g, '');
  html = html.replace(/<script[^>]*\bsrc="\.\.\/[^"]*"[^>]*><\/script>/g, '');

  // Site nav / arcade back links.
  html = html.replace(/<nav class="top">[\s\S]*?<\/nav>/i, '');
  html = html.replace(/\sdata-storyrun-host\b/g, '');

  // Keep a clean standalone title and stop search indexing.
  html = html.replace(/<title>[\s\S]*?<\/title>/i, '<title>Nova Siege</title>');
  html = html.replace(/<meta charset="utf-8">/i, '<meta charset="utf-8"><meta name="robots" content="noindex"><link rel="icon" href="data:,">');

  return html;
}

function patchGame(js) {
  // The live page constructs StoryRun unconditionally. It is the studio story
  // layer, so the itch build replaces it with a null stub. Every other use of
  // window.__storyRun in the game is already guarded.
  const before = js;
  js = js.replace(/var storyRun=window\.__storyRun=new StoryRun\(\{[\s\S]*?\}\);/,
    'var storyRun=null;');
  if (js === before) throw new Error('StoryRun constructor not found - source layout changed');

  // With the arcade GameSystem stripped there is no shared best score, so fall
  // back to the local top-5 the game already keeps in meta.leaderboard.
  js = js.replace(
    "function bestScore(){try{return (window.GameSystem&&window.GameSystem.getBestScore)?window.GameSystem.getBestScore('nova-siege'):0}catch(e){return 0}}",
    "function bestScore(){try{if(window.GameSystem&&window.GameSystem.getBestScore)return window.GameSystem.getBestScore('nova-siege');return (meta&&meta.leaderboard&&meta.leaderboard[0]&&meta.leaderboard[0].score)||0}catch(e){return 0}}"
  );
  js = js.replace(
    "set('hBest',(window.GameSystem?window.GameSystem.getBestScore('nova-siege'):0).toLocaleString())",
    "set('hBest',(Number(bestScore())||0).toLocaleString())"
  );
  return js;
}

function inlineScripts(html, game) {
  const hidpi = read(HIDPI_JS);
  const audio = read(AUDIO_JS);
  for (const [name, code] of [['hidpi', hidpi], ['audio', audio], ['game', game]]) {
    if (/<\/script/i.test(code)) throw new Error(name + ' contains </script and cannot be inlined');
  }
  const block =
    '<script>\n' + hidpi + '\n</script>\n' +
    '<script>\n' + audio + '\n</script>\n' +
    '<script>\n' + game + '\n</script>\n';
  return html.replace(/<\/body>/i, block + '</body>');
}

function serve(dir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent((req.url || '/').split('?')[0]);
      const file = path.join(dir, rel === '/' ? 'index.html' : rel);
      if (!file.startsWith(dir)) { res.writeHead(403); res.end(); return; }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); res.end('not found'); return; }
        const type = file.endsWith('.html') ? 'text/html' : 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': type });
        res.end(data);
      });
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function captureShots() {
  const puppeteer = require('puppeteer');
  const sharp = require('sharp');
  const server = await serve(OUT);
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const problems = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    page.on('console', (msg) => {
      if (msg.type() === 'error') problems.push('console: ' + msg.text());
    });
    page.on('pageerror', (err) => problems.push('pageerror: ' + err.message));
    page.on('requestfailed', (req) => problems.push('requestfailed: ' + req.url()));
    page.on('request', (req) => {
      const url = req.url();
      if (/^https?:/i.test(url) && !url.startsWith(base)) problems.push('external request: ' + url);
    });

    const shot = (name) => page.screenshot({ path: path.join(OUT, name) });
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));

    await page.goto(base + '/index.html', { waitUntil: 'load', timeout: 30000 });
    await pause(700);
    await shot('screenshot-01-title.png');

    await page.evaluate(() => window.__nova.openMenu());
    await pause(450);
    await shot('screenshot-02-upgrades.png');

    await page.evaluate(() => window.__nova.closeMenu());
    await page.click('#startBtn');
    await pause(1600);
    await shot('screenshot-03-gameplay.png');

    await page.evaluate(() => window.__nova.forceShop());
    await pause(450);
    await shot('screenshot-04-station-shop.png');

    await page.evaluate(() => window.__nova.forceEnd());
    await pause(450);
    await shot('screenshot-05-run-report.png');

    await sharp(path.join(OUT, 'screenshot-01-title.png'))
      .resize({ width: 630, height: 500, fit: 'cover', position: 'centre' })
      .png()
      .toFile(path.join(OUT, 'cover-630x500.png'));

    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (problems.length) {
    console.error('\nBuild loaded with problems:');
    for (const p of problems) console.error(' - ' + p);
    process.exitCode = 1;
  } else {
    console.log('Shots captured; no console errors and no external requests.');
  }
}

function zipBuild() {
  if (fs.existsSync(ZIP)) fs.unlinkSync(ZIP);
  execFileSync('powershell.exe', [
    '-NoProfile', '-Command',
    "Compress-Archive -LiteralPath '" + INDEX.replace(/'/g, "''") + "' -DestinationPath '" + ZIP.replace(/'/g, "''") + "' -Force"
  ], { stdio: 'inherit' });
}

(async () => {
  const html = read(SRC);
  const game = patchGame(read(GAME_JS));
  const built = inlineScripts(stripSiteChrome(html), game);

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(INDEX, built);

  const leftover = built.match(/\.\.\//g);
  if (leftover) throw new Error('site-relative reference left in build: ' + leftover.length);
  if (/<script[^>]+src=/i.test(built)) throw new Error('external script tag left in build');
  if (/<link[^>]+href="(?!data:)/i.test(built)) throw new Error('external stylesheet/icon left in build');

  const kb = (fs.statSync(INDEX).size / 1024).toFixed(1);
  console.log('Wrote ' + INDEX + ' (' + kb + ' KB, single file)');

  if (!noZip) {
    zipBuild();
    console.log('Wrote ' + ZIP);
  }
  if (!noShots) await captureShots();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
