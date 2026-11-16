/* tests/games-audio.js (A3059)
 *
 * Every catalogued arcade game must be able to make a sound, and every game
 * that guards on `window.AudioEffects` must load the shared audio module.
 *
 * This caught a real bulk regression: audio-effects.js declared its classes
 * with top-level `class`, which creates a global lexical binding but NOT a
 * property of window, so pages using `window.AudioEffects ? new AudioEffects()
 * : null` quietly constructed nothing and played no sound.
 *
 * Run: node tests/games-audio.js
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const vm = require('vm');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const GAME_DIR = path.join(ROOT, 'games');
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4'
};

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'games-registry.js'), 'utf8'), ctx);
const GAMES = ctx.window.JVDS_GAMES || [];

function pageCode(file) {
  const full = path.join(GAME_DIR, file);
  const html = fs.readFileSync(full, 'utf8');
  const parts = [html];
  for (const m of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+\.js)["']/gi)) {
    const src = m[1];
    if (/^(https?:)?\/\//.test(src)) continue;
    const target = src.startsWith('/') ? path.join(ROOT, src) : path.resolve(GAME_DIR, src);
    try { parts.push(fs.readFileSync(target, 'utf8')); } catch (e) {}
  }
  return { html, code: parts.join('\n') };
}

const SOUND_CALL = /new AudioEffects|AudioContext|playTap|playSuccess|playError|playPop|playCoin|playHit|playLevelUp|playCombo|playPowerup|SFX\.|Sfx\.|SoundManager/;

function staticChecks() {
  const shared = fs.readFileSync(path.join(ROOT, 'audio-effects.js'), 'utf8');
  check('audio-effects.js publishes window.AudioEffects', /window\.AudioEffects\s*=\s*AudioEffects/.test(shared));
  check('audio-effects.js publishes window.ScreenShake', /window\.ScreenShake\s*=\s*ScreenShake/.test(shared));
  check('audio-effects.js publishes window.ParticleSystem', /window\.ParticleSystem\s*=\s*ParticleSystem/.test(shared));

  for (const g of GAMES) {
    const full = path.join(GAME_DIR, g.file);
    if (!fs.existsSync(full)) { check(g.id + ': page exists', false, g.file); continue; }
    const { html, code } = pageCode(g.file);
    const loadsAudio = /["'][^"']*\/audio-effects\.js["']/.test(html);
    const usesWindowGuard = /window\.AudioEffects/.test(code);
    const ownsAudioClass = /class AudioEffects/.test(code);
    if (usesWindowGuard && !ownsAudioClass) {
      check(g.id + ': guards on window.AudioEffects and loads audio-effects.js', loadsAudio);
    }
    check(g.id + ': has a sound engine or sound call', SOUND_CALL.test(code));
    if (loadsAudio) {
      check(g.id + ': loads audio-effects.js before its inline game script',
        html.indexOf('audio-effects.js') < html.indexOf('inline/games-') || html.indexOf('inline/games-') === -1);
    }
  }
}

const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.normalize(path.join(ROOT, u));
  if (!f.startsWith(path.normalize(ROOT)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404); return res.end('missing');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

async function browserChecks(browser, base) {
  for (const g of GAMES) {
    const full = path.join(GAME_DIR, g.file);
    if (!fs.existsSync(full)) continue;
    const html = fs.readFileSync(full, 'utf8');
    if (!/["'][^"']*\/audio-effects\.js["']/.test(html)) continue;
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message.split('\n')[0].slice(0, 90)));
    try {
      await page.setViewport({ width: 390, height: 844, isMobile: true });
      await page.goto(base + '/games/' + g.file, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 600));
      const res = await page.evaluate(() => {
        const A = window.AudioEffects;
        if (typeof A !== 'function') return { ok: false, why: 'window.AudioEffects is ' + typeof A };
        const a = new A(0);
        const methods = ['playTap', 'playSuccess', 'playError', 'playPop'].filter(m => typeof a[m] === 'function');
        return { ok: methods.length >= 3, why: methods.join(',') };
      });
      check(g.id + ': window.AudioEffects constructs a usable engine', res.ok, res.why);
      const relevant = errors.filter(e => !/Failed to load resource|ERR_|google|gtag|fonts/i.test(e));
      check(g.id + ': no audio page errors', relevant.length === 0, relevant.join(' | '));
    } catch (e) {
      check(g.id + ': audio harness', false, e.message.slice(0, 90));
    }
    await page.close();
  }
}

(async () => {
  staticChecks();
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  try {
    await browserChecks(browser, base);
  } finally {
    await browser.close();
    await new Promise(r => server.close(r));
  }
  console.log(failures ? '\n' + failures + ' FAILED' : '\nALL GAME AUDIO CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
