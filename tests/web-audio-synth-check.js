#!/usr/bin/env node
/* A2561: in-browser Web Audio sound generator.
 * Unit checks the synth and WAV encoder in Node, then drives the Quest Builder
 * SFX panel at 390 and 1440 to prove presets, sliders, preview and export work
 * with no audio files and no network calls.
 * Run: node tests/web-audio-synth-check.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const synth = require('../assets/js/quest-core/audio-synth.js');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };

let failures = 0;
let checks = 0;
const check = (name, ok, detail) => {
  checks++;
  if (ok) { console.log('  [ok] ' + name); return; }
  failures++;
  console.log('  [FAIL] ' + name + (detail ? ' [' + detail + ']' : ''));
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

function decodeBase64(dataUri) {
  const raw = dataUri.split(',')[1] || '';
  return Buffer.from(raw, 'base64');
}

function zeroCrossings(samples) {
  let n = 0;
  for (let i = 1; i < samples.length; i++) if ((samples[i - 1] < 0) !== (samples[i] < 0)) n++;
  return n;
}

function unit() {
  check('module exposes the three presets', ['jump', 'laser', 'explosion'].every(k => synth.PRESETS[k]));

  const rendered = ['jump', 'laser', 'explosion'].map(preset => synth.build({ preset, pitch: 1, duration: 0.3 }));
  rendered.forEach(r => {
    const peak = r.samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    check(r.preset + ' renders a non-silent clip', peak > 0.05 && r.samples.length > 100, 'peak=' + peak.toFixed(3));
    check(r.preset + ' honours the requested length', Math.abs(r.samples.length - Math.round(0.3 * synth.SAMPLE_RATE)) <= 2, r.samples.length + ' samples');
  });

  const fingerprints = rendered.map(r => zeroCrossings(r.samples) + ':' + r.samples.length);
  check('presets are audibly different', new Set(fingerprints).size === 3, fingerprints.join(' | '));

  const low = synth.build({ preset: 'jump', pitch: 0.5, duration: 0.25 });
  const high = synth.build({ preset: 'jump', pitch: 2, duration: 0.25 });
  const lowZ = zeroCrossings(low.samples);
  const highZ = zeroCrossings(high.samples);
  check('pitch control changes the tone', highZ > lowZ * 2.5, 'crossings low=' + lowZ + ' high=' + highZ);

  const wav = synth.toWavBytes(rendered[0].samples, rendered[0].sampleRate);
  const header = Buffer.from(wav.slice(0, 44)).toString('ascii');
  check('WAV header is RIFF/WAVE', header.startsWith('RIFF') && header.includes('WAVE') && header.includes('data'));
  const dataSize = new DataView(wav.buffer, wav.byteOffset).getUint32(40, true);
  check('WAV data length matches the samples', dataSize === rendered[0].samples.length * 2, dataSize + ' bytes');

  const uri = rendered[0].dataUri;
  check('export is a Base64 WAV data URI', /^data:audio\/wav;base64,[A-Za-z0-9+/=]+$/.test(uri));
  const decoded = decodeBase64(uri);
  check('exported data decodes to a WAV', decoded.slice(0, 4).toString('ascii') === 'RIFF' && decoded.length > 44);
  check('export stays inside a sensible size budget', uri.length < 120000, Math.round(uri.length / 1024) + ' KB');

  const src = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'quest-core', 'audio-synth.js'), 'utf8');
  check('synth makes no network calls', !/https?:\/\//.test(src) && !/\bfetch\s*\(/.test(src) && !/XMLHttpRequest/.test(src));
  check('synth has no external library imports', !/\bimport\s+.+from\s+['"]/.test(src) && !/require\(['"][^.'"]/.test(src));
}

async function ui() {
  const server = http.createServer((req, res) => {
    let rel;
    try { rel = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
    if (rel === '/') rel = '/index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('missing'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  const baseUrl = 'http://127.0.0.1:' + port;
  const pageUrl = baseUrl + '/jvdesignstudio/tools/quest-builder.html';

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage();
      const errors = [];
      const external = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR_|Failed to load resource/i.test(m.text())) errors.push(m.text()); });
      page.on('request', req => {
        const url = req.url();
        if (!url.startsWith(baseUrl) && !/^(data|blob):/.test(url) && !/googletagmanager|google-analytics/.test(url)) external.push(url);
        if (/\.(mp3|wav|ogg|m4a)(\?|$)/i.test(url)) external.push(url);
      });
      await page.evaluateOnNewDocument(() => {
        window.__sfxPreview = 0;
        window.Audio = function () {
          this.volume = 1;
          this.play = function () { window.__sfxPreview++; return Promise.resolve(); };
          this.pause = function () {};
        };
      });
      await page.setViewport({ width, height: 900, isMobile: width < 700 });
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await sleep(600);

      const loaded = await page.evaluate(() => {
        const panel = document.getElementById('sfx-panel');
        return {
          synth: !!window.JVDSAudioSynth,
          panel: !!panel,
          presets: panel ? panel.querySelectorAll('[data-sfx-preset]').length : 0,
          overflow: document.documentElement.scrollWidth - window.innerWidth
        };
      });
      check(width + 'px: synth module loaded', loaded.synth);
      check(width + 'px: SFX panel has three presets', loaded.panel && loaded.presets === 3);
      check(width + 'px: no horizontal overflow', loaded.overflow <= 1, '+' + loaded.overflow + 'px');

      await page.evaluate(() => { const p = document.getElementById('sfx-panel'); if (p) p.open = true; });
      await page.click('[data-sfx-preset="laser"]');
      const pressed = await page.evaluate(() => {
        const btn = document.querySelector('[data-sfx-preset="laser"]');
        const jump = document.querySelector('[data-sfx-preset="jump"]');
        return { laser: btn && btn.getAttribute('aria-pressed'), jump: jump && jump.getAttribute('aria-pressed') };
      });
      check(width + 'px: preset switches to Laser', pressed.laser === 'true' && pressed.jump === 'false', JSON.stringify(pressed));

      await page.evaluate(() => {
        for (const [id, value] of [['sfx-pitch', '1.5'], ['sfx-duration', '0.3']]) {
          const input = document.getElementById(id);
          input.value = value;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      await page.click('#sfx-preview');
      await sleep(200);
      const previewCalls = await page.evaluate(() => window.__sfxPreview || 0);
      check(width + 'px: preview plays the generated clip', previewCalls > 0, String(previewCalls));

      await page.click('#sfx-export');
      await sleep(250);
      const exported = await page.evaluate(() => ({
        data: document.getElementById('sfx-output').value,
        status: document.getElementById('sfx-status').textContent
      }));
      check(width + 'px: export writes a Base64 WAV', /^data:audio\/wav;base64,/.test(exported.data), exported.data.slice(0, 30));
      check(width + 'px: exported data is a real WAV', decodeBase64(exported.data).slice(0, 4).toString('ascii') === 'RIFF');
      check(width + 'px: status explains the next step', /paste|base64|ready/i.test(exported.status), exported.status);

      check(width + 'px: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      check(width + 'px: no audio files or external calls', external.length === 0, external.slice(0, 2).join(' | '));
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
}

(async () => {
  console.log('unit:');
  unit();
  console.log('ui:');
  await ui();
  if (failures) {
    console.log('\nweb-audio-synth-check: FAIL (' + failures + ' of ' + checks + ')');
    process.exitCode = 1;
  } else {
    console.log('\nweb-audio-synth-check: PASS (' + checks + ' checks)');
  }
})().catch(e => { console.error('harness error', e); process.exit(1); });
