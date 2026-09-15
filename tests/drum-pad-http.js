// Drum Pad over HTTP.
// tools/drum-pad.html redirects to sound-studio.html (Audio Pipeline merge, c799170a). This test checks:
//  1. the raw page still lands on Sound Studio, and
//  2. with the redirect stripped, the page's own app works end to end: record a loop,
//     play/stop it, save a named pattern, reload. Guards the A210 regression where
//     #playBtn was missing and every control bound after it was dead.
const http = require('http'), fs = require('fs'), path = require('path'), puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const [urlPath, query = ''] = req.url.split('?');
  const file = path.resolve(ROOT, '.' + decodeURIComponent(urlPath));
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(404); return res.end(); }
  fs.readFile(file, (e, d) => {
    if (e) { res.writeHead(404); return res.end(); }
    let body = d;
    if (urlPath === '/tools/drum-pad.html' && !/(^|&)raw=1/.test(query)) {
      body = d.toString('utf8')
        .replace(/<script>\(function\(\)\{var t="sound-studio\.html"[^<]*<\/script>/, '')
        .replace(/<meta http-equiv="refresh"[^>]*>/, '');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  });
});
let failures = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' , ' + detail : ''}`); if (!ok) failures++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const closeWelcome = page => page.evaluate(() => { if (typeof closeDrumWelcome === 'function') closeDrumWelcome(); });
// Scroll a control to the middle of the viewport before a real click, like a learner would,
// so fixed bars pinned to the bottom of the screen cannot swallow the click.
const clickC = async (page, sel) => { await page.$eval(sel, el => el.scrollIntoView({ block: 'center' })); await wait(60); await page.click(sel); };

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await puppeteer.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const errors = [];
  try {
    // 1. Raw page redirects to the merged tool
    const raw = await browser.newPage();
    await raw.goto(base + '/tools/drum-pad.html?raw=1', { waitUntil: 'load' });
    await raw.waitForNavigation({ timeout: 5000 }).catch(() => {});
    check('raw drum-pad.html lands on sound-studio.html', raw.url().includes('/tools/sound-studio.html'), raw.url());
    await raw.close();

    // 2. The page's own app, redirect stripped
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    page.on('pageerror', e => errors.push(e.message));
    // Decline cookies up front (as a learner would) so the fixed consent banner
    // does not sit over the controls; the page is too short to scroll them clear.
    await page.evaluateOnNewDocument(() => { try { localStorage.setItem('jvds-cookie-consent', 'declined'); } catch (e) {} });
    await page.goto(base + '/tools/drum-pad.html', { waitUntil: 'load' });
    await closeWelcome(page);

    check('playBtn element exists', await page.$('#playBtn') !== null);
    check('single Advanced button', (await page.$$('#advBtn')).length === 1, String((await page.$$('#advBtn')).length));
    check('Play hidden before any loop', await page.$eval('#playBtn', b => getComputedStyle(b).display === 'none'));

    await clickC(page, '#recordBtn');
    const padCount = (await page.$$('#padGrid .pad')).length;
    check('pads rendered', padCount >= 8, String(padCount));
    const tap = i => page.evaluate(n => document.querySelectorAll('#padGrid .pad')[n].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })), i);
    await tap(0); await wait(250); await tap(1); await wait(150);
    await clickC(page, '#recordBtn');
    await wait(300);

    const afterRecord = await page.evaluate(() => ({
      play: getComputedStyle(document.getElementById('playBtn')).display !== 'none',
      clear: getComputedStyle(document.getElementById('clearBtn')).display !== 'none',
      save: getComputedStyle(document.getElementById('saveBtn')).display !== 'none',
      playText: document.getElementById('playBtn').textContent.trim(),
      filled: document.querySelectorAll('#loopDots .loop-dot.filled').length
    }));
    check('recorded hits land on loop dots', afterRecord.filled >= 1, String(afterRecord.filled));
    check('Play, Clear, Save shown after recording', afterRecord.play && afterRecord.clear && afterRecord.save, JSON.stringify(afterRecord));
    check('loop auto-plays after take (Stop label)', /Stop Loop/.test(afterRecord.playText), afterRecord.playText);

    await clickC(page, '#playBtn');
    const stopped = await page.$eval('#playBtn', b => ({ text: b.textContent.trim(), pressed: b.getAttribute('aria-pressed') }));
    check('Play button stops the loop', stopped.text === '▶ Play Loop' && stopped.pressed === 'false', JSON.stringify(stopped));
    await clickC(page, '#playBtn');
    check('Play button restarts the loop', /Stop Loop/.test(await page.$eval('#playBtn', b => b.textContent)));
    await clickC(page, '#playBtn');

    await clickC(page, '#saveBtn');
    await wait(120);
    await page.type('#patternNameInput', 'Beat A210');
    await clickC(page, '#nameSaveBtn');
    await wait(150);
    const listed = () => page.$$eval('#patternsList .pat-load', b => b.map(x => x.textContent));
    check('saved pattern listed', (await listed()).includes('Beat A210'));
    await page.reload({ waitUntil: 'load' });
    await closeWelcome(page);
    check('saved pattern survives reload', (await listed()).includes('Beat A210'));

    await clickC(page, '#advBtn');
    check('Advanced opens step sequencer', await page.$eval('#advSection', s => !s.hidden));
    await clickC(page, '#advBtn');

    fs.mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
    await page.screenshot({ path: path.join(ROOT, 'tmp', 'drum-pad-a210.png') });
    check('zero runtime errors', errors.length === 0, errors.join(' | '));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL DRUM PAD CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
