/* My Studio two-maker switch (A3129).

   Run: node tests/two-makers-http.js
*/
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
  if (!ok) failures++;
}
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
const R = path.normalize(root);
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.normalize(path.join(root, u));
  if (!f.startsWith(R) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing'); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  const html = fs.readFileSync(path.join(root, 'me.html'), 'utf8');
  check('My Studio has the makers card', /id="makersCard"/.test(html));
  check('My Studio loads the makers script', /two-makers\.js/.test(html));

  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  if (page.setBypassServiceWorker) await page.setBypassServiceWorker(true);
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  await page.setRequestInterception(true);
  page.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());
  await page.setViewport({ width: 1440, height: 900 });

  try {
    await page.goto(base + '/me.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#makersCard', { timeout: 15000 });

    await page.evaluate(() => {
      localStorage.setItem('jvds-player-name', 'Ada');
      localStorage.setItem('jvds_pixel_keepsake', 'ada-picture');
      localStorage.setItem('jvds_lap_pad_v1', 'ada-lap');
      localStorage.setItem('jvds_studio_settings', 'device-setting');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#makersCard', { timeout: 15000 });
    const first = await page.evaluate(() => ({
      name: localStorage.getItem('jvds-player-name'),
      makers: document.querySelectorAll('#makersList [data-maker]').length,
      chip: document.querySelector('#makersList [data-maker="a"]') ? document.querySelector('#makersList [data-maker="a"]').textContent : '',
    }));
    check('Ada is the first maker', first.name === 'Ada' && /Ada/.test(first.chip), JSON.stringify(first));

    const addLoad = new Promise(resolve => page.once('load', resolve));
    await page.evaluate(() => document.getElementById('addMakerBtn').click());
    await Promise.race([addLoad, new Promise((_, reject) => setTimeout(() => reject(new Error('add did not reload')), 15000))]);
    await page.waitForSelector('#makersList [data-maker]', { timeout: 20000 });
    await page.waitForFunction(() => {
      return Array.from(document.querySelectorAll('#makersList [data-maker]')).some(c => /Maker 2/.test(c.textContent) && /this maker/.test(c.textContent));
    }, { timeout: 20000 });
    const second = await page.evaluate(() => ({
      name: localStorage.getItem('jvds-player-name'),
      keepsake: localStorage.getItem('jvds_pixel_keepsake'),
      lap: localStorage.getItem('jvds_lap_pad_v1'),
      device: localStorage.getItem('jvds_studio_settings'),
      profiles: (JSON.parse(localStorage.getItem('jvds_maker_profiles') || '{}').profiles || []).length,
      chips: document.querySelectorAll('#makersList [data-maker]').length,
    }));
    check('adding a maker switches to a clean second maker', second.name === 'Maker 2' && second.keepsake === null && second.lap === null, JSON.stringify(second));
    check('the device setting survives the switch', second.device === 'device-setting', String(second.device));
    check('the profile store keeps both makers', second.profiles === 2 && second.chips === 2, JSON.stringify(second));

    const backLoad = new Promise(resolve => page.once('load', resolve));
    await page.evaluate(() => document.querySelector('#makersList [data-maker="a"]').click());
    await Promise.race([backLoad, new Promise((_, reject) => setTimeout(() => reject(new Error('switch did not reload')), 15000))]);
    await page.waitForSelector('#makersList [data-maker="a"]', { timeout: 20000 });
    await page.waitForFunction(() => {
      const c = document.querySelector('#makersList [data-maker="a"]');
      return !!c && /this maker/.test(c.textContent);
    }, { timeout: 20000 });
    const back = await page.evaluate(() => ({
      name: localStorage.getItem('jvds-player-name'),
      keepsake: localStorage.getItem('jvds_pixel_keepsake'),
      lap: localStorage.getItem('jvds_lap_pad_v1'),
      device: localStorage.getItem('jvds_studio_settings'),
      profiles: (JSON.parse(localStorage.getItem('jvds_maker_profiles') || '{}').profiles || []).length,
    }));
    check('switching back restores Adas work', back.name === 'Ada' && back.keepsake === 'ada-picture' && back.lap === 'ada-lap', JSON.stringify(back));
    check('the device setting still survives', back.device === 'device-setting', String(back.device));
    check('switching does not delete the profile store', back.profiles === 2, String(back.profiles));
    check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' TWO MAKERS CHECK(S) FAILED'); process.exit(1); }
  console.log('\nALL TWO MAKERS CHECKS PASSED');
})();
