const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19291;
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
    await page.goto('http://127.0.0.1:' + port + '/tools/pixel-studio.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => window.JVDSStudio && JVDSStudio.panel && JVDSStudio.conceptHelp, { timeout: 25000 });
    await page.evaluate(() => { if (!document.getElementById('jvsConceptHelp')) JVDSStudio.panel.toggle(); });
    await page.waitForFunction(() => !!document.getElementById('jvsConceptHelp'), { timeout: 8000 }).catch(() => {});
    const offByDefault = await page.evaluate(() => ({
      exists: !!document.getElementById('jvsConceptHelp'),
      checked: !!(document.getElementById('jvsConceptHelp') || {}).checked,
      cls: document.documentElement.classList.contains('jvds-concept-help'),
      markers: document.querySelectorAll('.jvs-concept').length
    }));
    check('concept help toggle exists', offByDefault.exists);
    check('concept help is off by default', !offByDefault.checked && !offByDefault.cls && offByDefault.markers === 0, JSON.stringify(offByDefault));

    await page.evaluate(() => {
      const box = document.getElementById('jvsConceptHelp');
      box.checked = true;
      box.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForFunction(() => document.querySelectorAll('.jvs-concept').length > 0, { timeout: 8000 }).catch(() => {});
    const on = await page.evaluate(() => ({
      cls: document.documentElement.classList.contains('jvds-concept-help'),
      markers: document.querySelectorAll('.jvs-concept').length,
      saved: JSON.parse(localStorage.getItem('jvds_studio_settings') || '{}').conceptHelp
    }));
    check('concept help turns markers on', on.cls && on.markers > 0, JSON.stringify(on));
    check('concept help persists in settings', on.saved === true);

    const mobileTip = await page.evaluate(() => {
      const marker = [...document.querySelectorAll('.jvs-concept')].find(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; }) || document.querySelector('.jvs-concept');
      if (!marker) return { ok: false };
      marker.click();
      const tip = document.getElementById('jvsConceptTip');
      const canvas = document.getElementById('main-canvas');
      if (!tip || tip.hidden) return { ok: false };
      const n = tip.getBoundingClientRect();
      const c = canvas ? canvas.getBoundingClientRect() : null;
      const overlaps = c ? !(n.right <= c.left || n.left >= c.right || n.bottom <= c.top || n.top >= c.bottom) : false;
      return { ok: true, text: tip.innerText, overlaps, visible: n.width > 0 && n.height > 0, mobile: tip.classList.contains('jvs-concept-tip--mobile'), note: { top: n.top, bottom: n.bottom }, canvas: c ? { top: c.top, bottom: c.bottom } : null };
    });
    check('mobile marker shows a Lumo tip', mobileTip.ok && mobileTip.visible && mobileTip.mobile && /Lumo says/i.test(mobileTip.text) && /Try:/i.test(mobileTip.text), JSON.stringify(mobileTip));
    check('mobile note does not cover the canvas', mobileTip.ok && mobileTip.visible && !mobileTip.overlaps, JSON.stringify({ note: mobileTip.note, canvas: mobileTip.canvas }));

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.JVDSStudio && JVDSStudio.conceptHelp, { timeout: 25000 });
    await wait(700);
    const persisted = await page.evaluate(() => ({
      cls: document.documentElement.classList.contains('jvds-concept-help'),
      markers: document.querySelectorAll('.jvs-concept').length
    }));
    check('concept help survives a reload', persisted.cls && persisted.markers > 0, JSON.stringify(persisted));

    await page.setViewport({ width: 1440, height: 900 });
    await page.evaluate(() => {
      const marker = document.querySelector('.jvs-concept');
      if (marker) marker.click();
    });
    await wait(200);
    const desktop = await page.evaluate(() => {
      const tip = document.getElementById('jvsConceptTip');
      return {
        shown: !!tip && !tip.hidden,
        text: tip ? tip.innerText : '',
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
      };
    });
    check('desktop marker shows a Lumo tooltip', desktop.shown && /Lumo says/i.test(desktop.text) && /Try:/i.test(desktop.text), desktop.text.slice(0, 80));
    check('concept help does not add horizontal overflow at 1440', !desktop.overflow);

    const glossary = await page.evaluate(() => {
      if (!document.getElementById('jvsGlossaryBtn')) JVDSStudio.panel.toggle();
      const btn = document.getElementById('jvsGlossaryBtn');
      if (btn) btn.click();
      return { opened: !!document.querySelector('.jvs-sheet'), text: document.body.innerText };
    });
    check('glossary opens from Studio tools', glossary.opened && /Lumo glossary/i.test(glossary.text) && /Layer/.test(glossary.text) && /Example:/.test(glossary.text));

    const sound = await browser.newPage();
    sound.on('pageerror', (e) => errors.push('sound pageerror: ' + e.message));
    await sound.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await sound.goto('http://127.0.0.1:' + port + '/tools/sound-studio.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sound.waitForFunction(() => window.JVDSStudio && JVDSStudio.conceptHelp, { timeout: 25000 });
    await wait(800);
    const shared = await sound.evaluate(() => ({
      cls: document.documentElement.classList.contains('jvds-concept-help'),
      markers: document.querySelectorAll('.jvs-concept').length
    }));
    check('concept help carries into Audio Studio', shared.cls && shared.markers > 0, JSON.stringify(shared));
    await sound.close();

    check('zero runtime errors', errors.length === 0, errors.join(' | '));
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nCONCEPT HELP CHECKS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
