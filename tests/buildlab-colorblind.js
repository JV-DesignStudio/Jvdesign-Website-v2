// BuildLab A2738: a colourblind-safe (Okabe-Ito) swatch row that stays
// distinguishable under protanopia and deuteranopia, on desktop and mobile.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19273;
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
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
function listen() { return new Promise(resolve => server.listen(port, resolve)); }
let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const SAFE = ['#e69f00', '#56b4e9', '#009e73', '#f0e442', '#0072b2', '#d55e00', '#cc79a7', '#000000'];
const SIM = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
};
function toLinear(rgb) {
  return rgb.map(c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
}
function simulate(v, m) {
  return [0, 1, 2].map(i => m[i][0] * v[0] + m[i][1] * v[1] + m[i][2] * v[2]);
}
function minSimDistance(colours) {
  const out = {};
  for (const [name, m] of Object.entries(SIM)) {
    let min = Infinity;
    for (let i = 0; i < colours.length; i++) {
      for (let j = i + 1; j < colours.length; j++) {
        const a = simulate(toLinear(colours[i]), m), b = simulate(toLinear(colours[j]), m);
        min = Math.min(min, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
      }
    }
    out[name] = min;
  }
  return out;
}
function hexToRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

(async () => {
  await listen();
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  try {
    for (const vp of [{ name: 'mobile', w: 390, h: 844, m: true }, { name: 'desktop', w: 1440, h: 900, m: false }]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push('pageerror: ' + e.message));
      page.on('console', m => {
        if (m.type() !== 'error') return;
        const text = m.text();
        if (/ERR_NETWORK_ACCESS_DENIED|Failed to load resource/.test(text)) return;
        errors.push('console: ' + text);
      });
      await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1, isMobile: vp.m, hasTouch: vp.m });
      await page.goto('http://127.0.0.1:' + port + '/tools/buildlab.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('#viewport canvas, #viewport.engine-error', { timeout: 20000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 700));
      await page.evaluate(() => {
        try { window.closeModal('welcomeModal'); } catch (e) {}
        const w = document.getElementById('welcomeModal');
        if (w) w.classList.remove('open');
        document.body.classList.remove('bl-modal-open');
      });
      await new Promise(r => setTimeout(r, 300));

      const base = await page.evaluate(() => {
        const grid = document.getElementById('colourSafeGrid');
        const swatches = grid ? Array.from(grid.querySelectorAll('.colour-swatch')) : [];
        const rgb = swatches.map(s => getComputedStyle(s).backgroundColor);
        const label = grid ? (grid.previousElementSibling?.textContent || '').trim() : '';
        return {
          hasGrid: !!grid,
          count: swatches.length,
          rgb,
          label,
          overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
        };
      });
      check(vp.name + ': colourblind-safe row exists', base.hasGrid && base.count >= 7, 'count=' + base.count);
      check(vp.name + ': row is labelled', /colourblind-safe/i.test(base.label), base.label);
      const parsed = base.rgb.map(s => {
        const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
      });
      check(vp.name + ': every safe swatch has a colour', parsed.every(Boolean), JSON.stringify(base.rgb));
      const parsedHex = parsed.filter(Boolean).map(rgb => '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join(''));
      const expected = SAFE.map(h => h.toLowerCase());
      check(vp.name + ': uses the Okabe-Ito safe palette', expected.every(h => parsedHex.includes(h)), parsedHex.join(','));
      const distances = minSimDistance(parsed.filter(Boolean));
      check(vp.name + ': distinguishable under protanopia', distances.protan >= 0.1, 'min=' + distances.protan.toFixed(4));
      check(vp.name + ': distinguishable under deuteranopia', distances.deutan >= 0.1, 'min=' + distances.deutan.toFixed(4));

      const click = await page.evaluate(() => {
        const grid = document.getElementById('colourSafeGrid');
        const sw = grid && grid.querySelector('.colour-swatch');
        if (!sw) return { ok: false };
        sw.click();
        return { ok: true, selected: sw.classList.contains('selected'), selectedCount: document.querySelectorAll('.colour-swatch.selected').length };
      });
      check(vp.name + ': a safe swatch can be selected', click.ok && click.selected && click.selectedCount === 1, JSON.stringify(click));

      if (vp.m) {
        await page.evaluate(() => { if (typeof window.mobTab === 'function') window.mobTab('colour'); });
        await new Promise(r => setTimeout(r, 900));
        const mob = await page.evaluate(() => {
          const dst = document.getElementById('mobColourGrid');
          const swatches = dst ? Array.from(dst.querySelectorAll('.mob-colour-swatch')) : [];
          const rgb = swatches.map(s => getComputedStyle(s).backgroundColor);
          return { count: swatches.length, rgb };
        });
        const mobParsed = mob.rgb.map(s => {
          const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          return m ? '#' + [1, 2, 3].map(i => Number(m[i]).toString(16).padStart(2, '0')).join('') : '';
        });
        check('mobile: drawer palette includes the safe colours', mob.count >= 23 && expected.every(h => mobParsed.includes(h)), 'count=' + mob.count);
      }

      check(vp.name + ': no horizontal overflow', base.overflow <= 2, String(base.overflow));
      check(vp.name + ': zero runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }
  } finally {
    await browser.close().catch(() => {});
    await new Promise(r => server.close(r));
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL BUILDLAB COLOURBLIND CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
