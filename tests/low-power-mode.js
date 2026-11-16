const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19289;
const mime = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff'
};
const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(root, url));
  if (!file.startsWith(path.normalize(root))) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
  if (!ok) failures++;
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  await new Promise((resolve) => server.listen(port, resolve));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto('http://127.0.0.1:' + port + '/tools/particle-designer.html', { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForFunction(() => window.JVDSStudio && JVDSStudio.panel && JVDSStudio.settings && typeof burstEmit === 'function' && typeof P !== 'undefined', { timeout: 25000 });
    await page.evaluate(() => {
      window.__lp = 0;
      document.addEventListener('jvds:lowpower', (e) => { if (e.detail && e.detail.on) window.__lp++; });
      JVDSStudio.panel.toggle();
    });
    await page.waitForFunction(() => !!document.getElementById('jvsLowPower'), { timeout: 8000 }).catch(() => {});
    const toggleExists = await page.evaluate(() => !!document.getElementById('jvsLowPower'));
    check('low-power toggle appears in Studio tools', toggleExists);

    await page.evaluate(() => {
      const box = document.getElementById('jvsLowPower');
      box.checked = true;
      box.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await wait(300);
    const on = await page.evaluate(() => ({
      cls: document.documentElement.classList.contains('jvds-low-power'),
      data: document.documentElement.dataset.lowPower,
      saved: JSON.parse(localStorage.getItem('jvds_studio_settings') || '{}').lowPower,
      event: window.__lp
    }));
    check('low-power sets the page class', on.cls && on.data === '1', JSON.stringify(on));
    check('low-power persists in settings', on.saved === true, JSON.stringify(on));
    check('low-power fires its event', on.event >= 1, String(on.event));

    const counts = await page.evaluate(() => {
      clearParticles(); P.maxParticles = 300; P.burst = 300; burstEmit();
      const lowCount = particles.length;
      JVDSStudio.settings.set('lowPower', false);
      clearParticles(); burstEmit();
      const normalCount = particles.length;
      JVDSStudio.settings.set('lowPower', true);
      return { lowCount, normalCount, capLow: particles.length };
    });
    check('low-power caps and trims particles', counts.lowCount <= 120 && counts.normalCount > 120 && counts.capLow <= 120, JSON.stringify(counts));

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.JVDSStudio && JVDSStudio.settings, { timeout: 25000 });
    const persisted = await page.evaluate(() => ({
      cls: document.documentElement.classList.contains('jvds-low-power'),
      saved: JVDSStudio.lowPower.enabled()
    }));
    check('low-power survives a reload', persisted.cls && persisted.saved, JSON.stringify(persisted));

    await page.setViewport({ width: 1440, height: 900 });
    await page.evaluate(() => { if (!document.getElementById('jvsLowPower')) JVDSStudio.panel.toggle(); });
    await page.waitForFunction(() => !!document.getElementById('jvsLowPower'), { timeout: 8000 }).catch(() => {});
    const wide = await page.evaluate(() => ({
      checked: !!(document.getElementById('jvsLowPower') || {}).checked,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
    }));
    check('1440 shows low-power still on', wide.checked);
    check('1440 has no horizontal overflow', !wide.overflow);
    await page.close();

    const sound = await browser.newPage();
    sound.on('pageerror', (e) => errors.push('sound pageerror: ' + e.message));
    await sound.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await sound.goto('http://127.0.0.1:' + port + '/tools/sound-studio.html', { waitUntil: 'domcontentloaded', timeout: 25000 });
    await sound.waitForFunction(() => window.JVDSStudio && JVDSStudio.lowPower, { timeout: 25000 });
    const shared = await sound.evaluate(() => document.documentElement.classList.contains('jvds-low-power'));
    check('low-power carries into Audio Studio', shared);
    await sound.close();

    check('zero runtime errors', errors.length === 0, errors.join(' | '));
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nLOW POWER MODE CHECKS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
