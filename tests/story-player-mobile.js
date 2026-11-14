/* Story Player (tools/story-player.html) parity checks.

   Covers the Tool Parity bar for this page:
   - accessibility: scene live region, roles and labels, choice group
   - Back step (button and Backspace) returns to the previous scene
   - Share copies the real #s= link after boot clears the address hash
   - autosave resumes the same story on reload
   - 390px layout stays inside the viewport

   Run: node tests/story-player-mobile.js
*/
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
let failures = 0;
function check(name, ok, detail = '') { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : '')); if (!ok) failures++; }
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };

const story = {
  meta: { name: 'Parity Tale' },
  characters: [{ name: 'Narrator', emoji: '✨' }],
  variables: [],
  nodes: [
    { id: 'n1', type: 'choice', char: 'Narrator', text: 'Choose a path.', choices: [{ text: 'Open the door', to: 'n3' }, { text: 'Walk away', to: 'n4' }] },
    { id: 'n3', type: 'end', char: 'Narrator', text: 'You found treasure.' },
    { id: 'n4', type: 'end', char: 'Narrator', text: 'You went home.' },
  ],
};
const hash = '#s=' + Buffer.from(JSON.stringify(story), 'utf8').toString('base64');

const R = path.normalize(root);
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.normalize(path.join(root, u));
  if (!f.startsWith(R) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing'); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    // The shared studio walkthrough appears on tool pages after 1.8s and covers
    // the scene at 390px. Pre-set the seen flag so it never opens mid-test.
    await page.evaluateOnNewDocument(() => {
      try { localStorage.setItem('jvds_studio_settings', JSON.stringify({ seenWalkthrough: true })); } catch (e) {}
    });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/ERR_NETWORK|Failed to load resource|ERR_ABORTED|ERR_FILE|ERR_FAILED/.test(m.text())) errors.push(m.text().slice(0, 80)); });
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());
    await page.setViewport({ width: 390, height: 844, isMobile: true });

    const url = base + '/tools/story-player.html' + hash;
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 400));

    const a11y = await page.evaluate(() => {
      const scene = document.getElementById('scene');
      const group = document.querySelector('.sc-choices');
      const card = document.getElementById('card');
      return {
        sceneRole: scene && scene.getAttribute('role'),
        sceneLive: scene && scene.getAttribute('aria-live'),
        sceneTab: scene && scene.getAttribute('tabindex'),
        sceneLabel: scene && scene.getAttribute('aria-label'),
        groupRole: group && group.getAttribute('role'),
        groupLabel: group && group.getAttribute('aria-label'),
        cardRole: card && card.getAttribute('role'),
      };
    });
    check('scene is a labelled live region', a11y.sceneRole === 'region' && a11y.sceneLive === 'polite' && !!a11y.sceneLabel, JSON.stringify(a11y));
    check('choices are a labelled group', a11y.groupRole === 'group' && !!a11y.groupLabel, a11y.groupRole + '/' + a11y.groupLabel);
    check('story card is a labelled region', a11y.cardRole === 'region');

    const txt = () => page.evaluate(() => (document.getElementById('scene') || {}).textContent || '');
    check('starts on the choice scene', (await txt()).indexOf('Choose a path') >= 0);

    await page.click('.sc-choice');
    await new Promise(r => setTimeout(r, 200));
    check('choice advances to the ending', (await txt()).indexOf('treasure') >= 0);

    await page.click('#backBtn');
    await new Promise(r => setTimeout(r, 200));
    check('Back button returns to the previous scene', (await txt()).indexOf('Choose a path') >= 0);

    await page.click('.sc-choice');
    await new Promise(r => setTimeout(r, 150));
    await page.keyboard.press('Backspace');
    await new Promise(r => setTimeout(r, 200));
    check('Backspace also steps back', (await txt()).indexOf('Choose a path') >= 0);

    const copied = await page.evaluate(async () => {
      const got = [];
      try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { got.push(t); return Promise.resolve(); } }, configurable: true }); } catch (e) {}
      const btn = document.querySelector('.m-cancel');
      if (btn) btn.click();
      await new Promise(r => setTimeout(r, 60));
      return got[0] || '';
    });
    check('Share copies the real #s= link', copied.indexOf('#s=') >= 0 && copied.indexOf('/tools/story-player.html') >= 0, copied.slice(0, 60) + '...');

    // Autosave: finish the story, reload the same link, and it resumes there.
    await page.click('.sc-choice');
    await new Promise(r => setTimeout(r, 200));
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 400));
    check('autosave resumes the same story after reload', (await txt()).indexOf('treasure') >= 0);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('390 no horizontal overflow', overflow <= 2, 'overflow=' + overflow);
    check('no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' check(s) failed'); process.exit(1); }
  console.log('\nPASS story-player-mobile: a11y, Back step, share link and resume work');
})().catch(e => { console.error(e); process.exit(1); });
