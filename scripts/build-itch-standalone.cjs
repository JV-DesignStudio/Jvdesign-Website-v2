#!/usr/bin/env node
/*
 * scripts/build-itch-standalone.cjs
 *
 * Builds a standalone itch.io copy of one arcade game from the live site page.
 * The live page leans on the studio chrome (nav, analytics, cookie banner,
 * mascots, story-run, handoff, game shell). None of that belongs on itch, so
 * this build drops those scripts/styles, inlines the remaining local CSS and
 * JS into one file, and writes it to F:/Website/itch/<slug>/index.html.
 *
 * Usage:
 *   node scripts/build-itch-standalone.cjs <slug> [--no-shots] [--no-zip]
 *   node scripts/build-itch-standalone.cjs --list
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ITCH = path.resolve(ROOT, '..', 'itch');
const SITE = 'https://jvdesignstudio.co.uk';

const GAMES = {
  'stardust-snake': { src: 'games/stardust-snake.html', title: 'Stardust Snake', viewport: '960x540' },
  'bread-blocks': { src: 'games/bread-blocks.html', title: 'Bread Blocks', viewport: '960x540' },
  'ember-smash': { src: 'games/ember-smash.html', title: 'Ember Smash: Brick Forge', viewport: '960x540' },
  'bubble-pop-galaxy': { src: 'games/bubble-pop-galaxy.html', title: 'Bubble Pop Galaxy', viewport: '960x720', keepScripts: [/story-run\.js/i], keepStyles: [/story-run\.css/i] },
  'paper-toss-deluxe': { src: 'games/paper-toss-deluxe.html', title: 'Paper Toss: Wind Lab', viewport: '960x720', keepScripts: [/story-run\.js/i], keepStyles: [/story-run\.css/i] },
  'pip_star_connect': { src: 'games/pip_star_connect.html', title: "Pip's Star Connect", viewport: '960x540' },
  'dungeon-delve': { src: 'games/dungeon-delve.html', title: 'Dungeon Delve: Map Logic', viewport: '960x540' },
  'voidrush': { src: 'games/voidrush.html', title: 'VoidRush: Chase the Sun', viewport: '960x720', keepScripts: [/story-run\.js/i], keepStyles: [/story-run\.css/i] },
  'arcane-citadel': { src: 'games/arcane_citadel.html', title: 'Arcane Citadel: Tower Defence', viewport: '960x720', keepScripts: [/story-run\.js/i], keepStyles: [/story-run\.css/i] },
  'call-of-the-cards': { src: 'games/call_of_the_cards.html', title: 'Call of the Cards: Quest for the Crown', viewport: '960x720', keepScripts: [/story-run\.js/i], keepStyles: [/story-run\.css/i] },
  'cozy-creatures': { src: 'games/cozy_creatures.html', title: 'Cozy Creatures: The Ultimate Snuggle', viewport: '960x720' },
  'cozy-biscuit-clicker': { src: 'games/cozy-biscuit-clicker.html', title: 'Biscuit Tin Clicker', viewport: '960x720', keepScripts: [/story-run\.js/i], keepStyles: [/story-run\.css/i] },
  'cozy-cafe-match': { src: 'games/cozy-cafe-match-game.html', title: 'Cozy Cafe Match: Morning Rush', viewport: '960x720', keepScripts: [/story-run\.js/i], keepStyles: [/story-run\.css/i] },
  'rustfall': { src: 'games/rustfall.html', title: 'Rustfall: Free Wasteland Roguelike Shooter', viewport: '960x720' },
  'sky-high-with-friends': { src: 'games/sky_high_with_friends.html', title: 'Sky High With Friends', viewport: '960x720' },
  'tower-defence': { src: 'games/tower-defence.html', title: 'Tower Defence: Free Cosy Strategy Game', viewport: '960x720' }
};

const DROP_SCRIPTS = [
  /analytics-loader\.js/i, /cookie-consent\.js/i, /mascots\.js/i,
  /game-shell\.js/i, /story-run\.js/i, /game-showcase\.js/i,
  /games-registry\.js/i, /game-onboarding\.js/i, /game-handoff\.js/i,
  /jvds-funnel\.js/i, /feedback-widget\.js/i, /report-issue/i,
  /sw-register\.js/i, /tool-kit\.js/i,
  /(?:^|\/)nav\.js/i, /partials-footer/i, /partials-nav/i, /breadcrumb-inject\.js/i
];
const DROP_STYLES = [/story-run\.css/i, /style-mascots\.css/i, /style-shared\.css/i];

const args = process.argv.slice(2);
if (args.includes('--list')) {
  for (const [slug, game] of Object.entries(GAMES)) console.log(slug.padEnd(22), game.src);
  process.exit(0);
}
const slug = args.find((a) => !a.startsWith('--'));
if (!slug || !GAMES[slug]) {
  console.error('Usage: node scripts/build-itch-standalone.cjs <slug> [--no-shots] [--no-zip]');
  console.error('Slugs: ' + Object.keys(GAMES).join(', '));
  process.exit(1);
}
const game = GAMES[slug];
const noShots = args.includes('--no-shots');
const noZip = args.includes('--no-zip');
const SRC = path.join(ROOT, game.src);
const OUT = path.join(ITCH, slug);
const INDEX = path.join(OUT, 'index.html');
const ZIP = path.join(ITCH, slug + '.zip');

function read(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

function resolveLocal(href, fromFile) {
  // ../arcade.html -> /arcade.html ; assets/x.png -> /games/assets/x.png
  const clean = href.split('?')[0];
  if (clean.startsWith('/')) return clean;
  const dir = path.posix.dirname(fromFile.split(path.sep).join('/'));
  const joined = path.posix.normalize(path.posix.join(dir, clean));
  return '/' + joined.replace(/^\.?\//, '');
}

function stripMeta(html) {
  html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\s*/i, '');
  html = html.replace(/<link rel="canonical"[^>]*>\s*/i, '');
  html = html.replace(/<link rel="icon"[^>]*>\s*/gi, '');
  html = html.replace(/<link rel="apple-touch-icon"[^>]*>\s*/gi, '');
  html = html.replace(/<link rel="manifest"[^>]*>\s*/gi, '');
  html = html.replace(/<meta (?:property|name)="(?:og|twitter):[^"]*"[^>]*>\s*/gi, '');
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/i, '');
  return html;
}

function inlineStyles(html) {
  return html.replace(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/gi, (tag, href) => {
    const keep = (game.keepStyles || []).some((re) => re.test(href));
    if (!keep && DROP_STYLES.some((re) => re.test(href))) return '';
    if (/^(?:https?:)?\/\//i.test(href)) return '';
    const rel = resolveLocal(href, game.src);
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) throw new Error('missing stylesheet: ' + rel);
    const css = rewriteCss(read(file), rel).replace(/<\/style/gi, '<\\/style');
    return '<style>\n' + css + '\n</style>';
  });
}

function patchEngine(rel, code) {
  // Any hard-coded back link inside an engine script points at the site.
  code = code.replace(/(['"])\.\.\/arcade\.html\1/g, `$1${SITE}/arcade.html$1`);
  // game-system.js dynamically pulls player-profile.js from its own script
  // location. On itch there is no site profile, and an inlined script has no
  // currentScript, so the fallback '../player-profile.js' would 404 outside
  // the build. Disable the profile load instead of shipping a broken request.
  if (/game-system\.js$/.test(rel)) {
    code = code.replace(/:\s*'\.\.\/player-profile\.js';/, ": '';");
    code = code.replace(/(function ensureProfileLoaded\(\)\s*\{)/, "$1\n  if (!profileSrc) { flushPending(); return; }");
    // The arcade menu, fullscreen toggle and floating mute/pause are site
    // chrome. The game page already has its own controls, so skip them here.
    code = code.split('initFullscreenToggle(); initMutePauseChrome(); initArcadeMenu(); initErrorBoundary();')
      .join('initErrorBoundary();');
  }
  return code;
}

function inlineScripts(html) {
  const deferred = [];
  html = html.replace(/<script([^>]*)\bsrc="([^"]+)"([^>]*)>\s*<\/script>/gi, (tag, before, src, after) => {
    if (/^(?:https?:)?\/\//i.test(src)) return '';
    const keep = (game.keepScripts || []).some((re) => re.test(src));
    if (!keep && DROP_SCRIPTS.some((re) => re.test(src))) return '';
    const rel = resolveLocal(src, game.src);
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) throw new Error('missing script: ' + rel);
    const code = patchEngine(rel, read(file)).replace(/<\/script/gi, '<\\/script');
    const attrs = before + ' ' + after;
    // A defer/module script runs after parsing on the live site. Keep that
    // timing by appending it at the end of the body. A classic script runs in
    // place, so the page's own inline scripts still find its globals.
    if (/\bdefer\b/i.test(attrs) || /type="module"/i.test(attrs)) {
      deferred.push({ rel, code, module: /type="module"/i.test(attrs) });
      return '';
    }
    return '<!-- ' + rel + ' -->\n<script>\n' + code + '\n</script>';
  });
  const block = deferred
    .map((s) => '<!-- ' + s.rel + ' -->\n<script' + (s.module ? ' type="module"' : '') + '>\n' + s.code + '\n</script>')
    .join('\n');
  if (process.env.ITCH_DEBUG) console.log('[inlineScripts] deferred:', deferred.map((s) => s.rel));
  return html.replace(/<\/body>/i, block + '\n</body>');
}

function stripChrome(html) {
  // Empty story-run mount point.
  html = html.replace(/<div[^>]*data-storyrun-host[^>]*>\s*<\/div>\s*/gi, '');
  html = html.replace(/\sdata-storyrun-host\b/g, '');
  // Site header / footer if a game carries them.
  html = html.replace(/<header class="site-header"[\s\S]*?<\/header>\s*/i, '');
  html = html.replace(/<footer class="site-footer"[\s\S]*?<\/footer>\s*/i, '');
  html = html.replace(/<nav class="top"[\s\S]*?<\/nav>\s*/i, '');
  // The site service worker must not be registered inside an itch frame.
  html = html.replace(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi, (block) =>
    /serviceWorker\s*\.\s*register/.test(block) ? '' : block);
  return html;
}

const ASSET_EXT = /\.(?:png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|otf|mp3|ogg|wav)$/i;

function copyDir(siteDir) {
  const clean = siteDir.replace(/^\//, '');
  const src = path.join(ROOT, clean);
  if (!fs.existsSync(src) || !fs.statSync(src).isDirectory()) return null;
  fs.cpSync(src, path.join(OUT, clean), { recursive: true });
  return clean;
}

// Some inline game scripts build asset paths at runtime, for example
// img.src = 'chars/' + name + '.png'. Those paths are relative to /games/ on
// the live site but to the build root on itch, so copy the folder and rewrite
// the quoted prefix.
function patchInlineScripts(html) {
  return html.replace(/(<script(?![^>]*\bsrc=)[^>]*>)([\s\S]*?)(<\/script>)/gi, (m, open, code, close) => {
    code = code.replace(/(['"])(\.\/[^'"]+)\1/g, (mm, q, rel) => {
      const copied = copyAsset(resolveLocal(rel, game.src));
      return copied ? `${q}${copied}${q}` : mm;
    });
    code = code.replace(/(['"])((?:[\w.-]+\/)+)\1/g, (mm, q, dir) => {
      if (/^(?:https?:|\/\/|\/)/i.test(dir)) return mm;
      const copied = copyDir(resolveLocal(dir, game.src));
      return copied ? `${q}${copied}/${q}` : mm;
    });
    return open + code + close;
  });
}

function copyAsset(sitePath) {
  const clean = sitePath.split('?')[0].split('#')[0];
  const src = path.join(ROOT, clean);
  if (!fs.existsSync(src) || !fs.statSync(src).isFile()) return null;
  const rel = clean.replace(/^\//, '');
  const dest = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return rel;
}

function rewriteCss(css, cssSitePath) {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, quote, url) => {
    if (/^(?:data:|https?:|\/\/|#)/i.test(url)) return m;
    const sitePath = resolveLocal(url, cssSitePath.replace(/^\//, ''));
    const rel = copyAsset(sitePath);
    if (!rel) return m;
    return 'url(' + quote + rel + quote + ')';
  });
}

function rewriteUrls(html) {
  const store = [];
  html = html.replace(/<script[\s\S]*?<\/script>/gi, (tag) => {
    store.push(tag);
    return '\u0000JVDSSCRIPT' + (store.length - 1) + '\u0000';
  });
  const swap = (attr, url) => {
    if (!url || /^(?:data:|https?:|\/\/|#|mailto:|tel:)/i.test(url)) return null;
    const sitePath = resolveLocal(url, game.src);
    if (ASSET_EXT.test(sitePath)) {
      const rel = copyAsset(sitePath);
      return rel ? `${attr}="${rel}"` : null;
    }
    return `${attr}="${SITE}${sitePath}"`;
  };
  html = html.replace(/\b(src|href|poster|action|data-go)="([^"]+)"/gi, (m, attr, url) => swap(attr, url) || m);
  html = html.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (m, open, css, close) =>
    open + rewriteCss(css, game.src) + close);
  html = html.replace(/\bsrcset="([^"]+)"/gi, (m, value) => {    const parts = value.split(',').map((entry) => {
      const bits = entry.trim().split(/\s+/);
      const rel = copyAsset(resolveLocal(bits[0], game.src));
      if (!rel) return null;
      bits[0] = rel;
      return bits.join(' ');
    }).filter(Boolean);
    return parts.length ? 'srcset="' + parts.join(', ') + '"' : '';
  });
  html = html.replace(/<source(?![^>]*\bsrcset=)[^>]*>/gi, '');
  return html.replace(/\u0000JVDSSCRIPT(\d+)\u0000/g, (m, i) => store[+i]);
}

// The build checks must only look at real markup, not at engine comments or
// string literals that happen to contain "../" or a script tag.
function markupOnly(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
}

function finish(html) {
  html = html.replace(/<title>[\s\S]*?<\/title>/i, '<title>' + game.title + '</title>');
  html = html.replace(/<meta name="viewport"[^>]*>/i,
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">');
  const add = [];
  if (!/<meta name="robots"/i.test(html)) add.push('<meta name="robots" content="noindex">');
  if (!/<link rel="icon"/i.test(html)) add.push('<link rel="icon" href="data:,">');
  if (add.length) html = html.replace(/<head([^>]*)>/i, (m, attrs) => m + '\n' + add.join('') + '\n');
  return html;
}

function serve(dir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent((req.url || '/').split('?')[0]);
      const file = path.join(dir, rel === '/' ? 'index.html' : rel);
      if (!file.startsWith(dir)) { res.writeHead(403); res.end(); return; }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); res.end('not found'); return; }
        const type = /\.(?:html|css|js|json|png|webp|jpe?g|svg|woff2?|mp3|ogg|wav)$/i.test(file)
          ? { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' }[path.extname(file).toLowerCase()]
          : 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': type || 'application/octet-stream' });
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
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const problems = [];
  try {
    for (const vp of [{ name: '390', width: 390, height: 844 }, { name: '1440', width: 1440, height: 900 }]) {
      const ctx = await browser.createBrowserContext();
      const page = await ctx.newPage();
      await page.setViewport(vp);
      page.on('console', (msg) => { if (msg.type() === 'error') problems.push(vp.name + ' console: ' + msg.text()); });
      page.on('pageerror', (err) => problems.push(vp.name + ' pageerror: ' + err.message));
      page.on('requestfailed', (req) => problems.push(vp.name + ' requestfailed: ' + req.url()));
      page.on('response', (res) => {
        if (res.status() >= 400) problems.push(vp.name + ' HTTP ' + res.status() + ': ' + res.url());
      });
      page.on('request', (req) => {
        const url = req.url();
        if (/^https?:/i.test(url) && !url.startsWith(base)) problems.push(vp.name + ' external request: ' + url);
      });
      await page.goto(base + '/index.html', { waitUntil: 'load', timeout: 30000 });
      await new Promise((r) => setTimeout(r, 800));
      if (vp.name === '1440') await page.screenshot({ path: path.join(OUT, 'screenshot-01-title.png') });

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 2) problems.push(vp.name + ' horizontal overflow: ' + overflow);

      // Start the game the way a player would, then grab a gameplay frame.
      const started = await page.evaluate(() => {
        const btn = [...document.querySelectorAll('button, [role="button"], a')]
          .find((el) => /start|play|begin|go/i.test((el.textContent || '').trim()) && el.offsetParent);
        if (btn) { btn.click(); return true; }
        return false;
      });
      if (!started) {
        await page.keyboard.press('Space');
        await page.keyboard.press('ArrowRight');
      }
      await new Promise((r) => setTimeout(r, 1800));
      if (vp.name === '1440') await page.screenshot({ path: path.join(OUT, 'screenshot-02-play.png') });
      await ctx.close();
    }

    await sharp(path.join(OUT, 'screenshot-01-title.png'))
      .resize({ width: 630, height: 500, fit: 'cover', position: 'centre' })
      .png()
      .toFile(path.join(OUT, 'cover-630x500.png'));
  } finally {
    await browser.close();
    server.close();
  }
  if (problems.length) {
    console.error('\nBuild loaded with problems:');
    for (const p of problems) console.error(' - ' + p);
    process.exitCode = 1;
  } else {
    console.log('Shots captured; no console errors, no failed requests and no external requests.');
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
  fs.mkdirSync(OUT, { recursive: true });
  let html = read(SRC);
  html = stripMeta(html);
  html = stripChrome(html);
  html = inlineStyles(html);
  html = rewriteUrls(html);
  html = inlineScripts(html);
  html = patchInlineScripts(html);
  html = finish(html);

  const markup = markupOnly(html);
  if (/\.\.\//.test(markup)) {
    const hits = [...markup.matchAll(/.{0,60}\.\.\/.{0,60}/g)].slice(0, 8).map((m) => m[0].replace(/\n/g, ' '));
    throw new Error('site-relative reference left in build: ' + (markup.match(/\.\.\//g) || []).length + '\n' + hits.join('\n'));
  }
  if (/<script[^>]+src=/i.test(markup)) {
    const tags = (markup.match(/<script[^>]+src=[^>]*>/gi) || []).slice(0, 6);
    throw new Error('script src left in build (expected all inline)\n' + tags.join('\n'));
  }

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(INDEX, html);
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
