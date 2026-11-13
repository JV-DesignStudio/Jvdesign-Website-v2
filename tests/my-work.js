#!/usr/bin/env node
/*
 * tests/my-work.js
 * A2641: My Studio lists creations from several tools in one place, opens a
 * preview, removes one, and downloads the whole set as a restorable archive.
 * Run: node tests/my-work.js
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon'
};
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PROJECT = {
  v: 3, cW: 2, cH: 2, fps: 8, name: 'Pixel Dragon',
  layers: [{ name: 'Layer 1', visible: true, opacity: 100 }],
  frames: [[[255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]]],
  frameMeta: [{ clip: 'idle', hold: 1 }],
  animLoop: true, exportOrigin: 0
};

const me = fs.readFileSync(path.join(ROOT, 'me.html'), 'utf8');
const keep = fs.readFileSync(path.join(ROOT, 'assets/js/my-studio-keep.js'), 'utf8');
assert.ok(me.includes('id="arcadeGrid"'), 'me.html has the My Work grid');
assert.ok(me.includes('id="workExport"'), 'me.html has the download-all button');
assert.ok(me.includes('id="workModal"'), 'me.html has the work preview dialog');
assert.ok(me.includes('/assets/js/my-studio-keep.js'), 'me.html loads the keep script');
assert.ok(/window\.MyWork/.test(keep), 'the keep script exposes MyWork');

(async () => {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.join(ROOT, url);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(''); }
    fs.readFile(file, (err, data) => {
      res.writeHead(err ? 404 : 200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(err ? '' : data);
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

  try {
    const page = await browser.newPage();
    await page.setBypassServiceWorker(true);
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      const u = r.url();
      if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) r.continue();
      else r.abort();
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR_FAILED/i.test(m.text())) errors.push(m.text()); });

    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(base + '/me.html', { waitUntil: 'load', timeout: 30000 });
    await page.evaluate(({ png, project }) => {
      localStorage.clear();
      localStorage.setItem('jvds-player-name', 'Ada');
      localStorage.setItem('jvds_pixel_keepsake', JSON.stringify([
        { id: 1700000000000, title: 'Pixel Dragon', date: '2026-11-07', thumb: png, project: JSON.stringify(project) }
      ]));
      localStorage.setItem('jvds_palettes', JSON.stringify([
        { name: 'Sunset', mood: 'sunset', cols: ['#ff0000', '#00ff00', '#0000ff'], date: '11/12/2026' }
      ]));
      localStorage.setItem('jvds_story_slots', JSON.stringify([
        null,
        { name: 'Moon Story', nodeCount: 1, date: '11/12/2026', data: { storyName: 'Moon Story', nodes: [{ id: 1, type: 'start', text: 'The moon is a door.' }], chars: [], vars: [], nextId: 2 } },
        null,
        null
      ]));
      localStorage.setItem('jvds_level_autosave', JSON.stringify({
        name: 'Sky Level', gridW: 4, gridH: 3, themeId: 'grass',
        layers: [{ name: 'Platforms', visible: true, locked: false, data: [1, 0, 0, 2, 0, 1, 0, 0, 2, 0, 1, 0] }],
        ts: Date.now()
      }));
      localStorage.removeItem('jvds_my_arcade');
      localStorage.removeItem('jvds_gdd_last');
    }, { png: PNG, project: PROJECT });
    await page.reload({ waitUntil: 'load', timeout: 30000 });
    await page.evaluate(() => document.querySelector('.tab[data-tab="keep"]').click());
    await page.waitForFunction(() => document.getElementById('panel-keep').classList.contains('active'));
    await page.waitForSelector('.arcade-card');

    const cards = await page.$$eval('.arcade-card', (list) => list.map((c) => ({
      type: c.getAttribute('data-work-type'),
      text: c.textContent.replace(/\s+/g, ' ').trim()
    })));
    assert.ok(cards.length >= 4, 'My Work lists at least four creations, got ' + cards.length);
    const text = cards.map((c) => c.text).join(' | ');
    for (const name of ['Pixel Dragon', 'Sunset', 'Moon Story', 'Sky Level']) {
      assert.ok(text.includes(name), 'My Work lists ' + name + ' (' + text + ')');
    }
    assert.ok(cards.some((c) => c.type === 'palette'), 'palette creation is listed');
    assert.ok(cards.some((c) => c.type === 'story'), 'story creation is listed');
    assert.ok(cards.some((c) => c.type === 'level'), 'level creation is listed');

    const previews = await page.evaluate(() => ({
      thumbs: document.querySelectorAll('.arcade-card img.work-thumb').length,
      swatches: document.querySelectorAll('.arcade-card .work-swatches .work-swatch').length,
      levels: document.querySelectorAll('.arcade-card canvas.work-preview-canvas').length,
      excerpts: document.querySelectorAll('.arcade-card .work-excerpt').length
    }));
    assert.ok(previews.thumbs >= 1, 'pixel art shows a picture');
    assert.ok(previews.swatches >= 3, 'palette shows colour swatches');
    assert.ok(previews.levels >= 1, 'level shows a mini map');
    assert.ok(previews.excerpts >= 1, 'story shows a text preview');

    await page.evaluate(() => {
      const card = [...document.querySelectorAll('.arcade-card')].find((c) => c.getAttribute('data-work-type') === 'palette');
      card.querySelector('.keep-primary').click();
    });
    await page.waitForFunction(() => !document.getElementById('workModal').hidden);
    const dialog = await page.evaluate(() => ({
      title: document.getElementById('workModalTitle').textContent,
      text: document.getElementById('workModalBody').textContent.replace(/\s+/g, ' '),
      swatches: document.querySelectorAll('#workModalBody .work-swatch').length,
      link: (document.querySelector('#workModalBody .work-open-link') || {}).getAttribute('href') || ''
    }));
    assert.equal(dialog.title, 'Sunset', 'the preview title names the creation');
    assert.ok(/3 colours/.test(dialog.text), 'the preview describes the palette');
    assert.ok(dialog.swatches >= 3, 'the preview shows the palette colours');
    assert.equal(dialog.link, '/tools/colour-palette.html', 'the preview links to the tool');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('workModal').hidden);

    await page.evaluate(() => {
      const card = [...document.querySelectorAll('.arcade-card')].find((c) => c.getAttribute('data-work-type') === 'story');
      [...card.querySelectorAll('button')].find((b) => /Remove/.test(b.textContent)).click();
    });
    await page.waitForFunction(() => document.querySelectorAll('.arcade-card').length === 3);
    const slotAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('jvds_story_slots'))[1]);
    assert.equal(slotAfter, null, 'Remove clears just that saved story');

    const archive = await page.evaluate(() => window.MyWork.buildArchive());
    assert.equal(archive.format, 'jvds-backpack', 'the archive fits the existing backpack restore');
    assert.equal(archive.source, 'jvds-my-work', 'the archive is marked as a My Work download');
    assert.ok(archive.keys.jvds_pixel_keepsake, 'the archive holds pixel art');
    assert.ok(archive.keys.jvds_palettes, 'the archive holds palettes');
    assert.ok(archive.keys.jvds_level_autosave, 'the archive holds the level');
    assert.ok(!archive.keys.jvds_story_slots || archive.keys.jvds_story_slots === '[]' || JSON.parse(archive.keys.jvds_story_slots || '[]')[1] === null, 'the removed story is not restored');

    await page.evaluate(() => {
      window.__saved = [];
      URL.createObjectURL = function (blob) { window.__saved.push(blob); return 'blob:test'; };
      HTMLAnchorElement.prototype.click = function () { window.__saved.push({ name: this.download }); };
    });
    await page.evaluate(() => document.getElementById('workExport').click());
    await page.waitForFunction(() => window.__saved.length >= 2);
    const download = await page.evaluate(() => window.__saved.find((s) => s && s.name) || {});
    assert.ok(/^my-jvds-work-\d{4}-\d{2}-\d{2}\.json$/.test(download.name), 'download names the archive (' + download.name + ')');

    await page.setViewport({ width: 390, height: 844 });
    await new Promise((r) => setTimeout(r, 300));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 2, 'My Work fits 390px (' + overflow + ')');
    assert.deepEqual(errors, [], 'no runtime errors on My Studio');

    console.log('\nPASS my-work: four tools listed, previews, remove and archive download (1440/390)');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error('FAIL my-work: ' + (error && error.stack ? error.stack : error));
  process.exit(1);
});

