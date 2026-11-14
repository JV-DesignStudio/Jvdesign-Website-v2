#!/usr/bin/env node
/* tests/tools-export-validity.js , A2328
 *
 * Two jobs:
 *  1. Coverage: every tool that declares an export in content/tools-hub.json
 *     has a real page and a visible export path (a download/blob/export hook).
 *  2. Format proof: drive real exports and check the bytes open as the format
 *     they claim. Covers PNG, GIF, JSON, WAV, OBJ, GLTF (GLB) and STL.
 *
 * Run: node tests/tools-export-validity.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json'
};

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
  if (!ok) failures++;
}

const hub = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/tools-hub.json'), 'utf8'));
const tools = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/tools.json'), 'utf8'));
const urlBySlug = Object.create(null);
for (const t of tools) if (t.id && t.url) urlBySlug[t.id] = t.url;
const urlFor = (slug) => urlBySlug[slug] || ('/tools/' + slug + '.html');
const fileFor = (url) => path.join(ROOT, url.replace(/^\//, '').split('#')[0].split('?')[0]);

// ---------- 1. Coverage ----------
const declared = Object.entries(hub.cards).filter(([, c]) => Array.isArray(c.outputs) && c.outputs.length);
const EXPORT_HOOK = /blob-download|JVDS_DOWNLOAD|createObjectURL|toBlob|toDataURL|\.download\s*=|data-export|export[A-Z][A-Za-z0-9_]*\s*\(|download[A-Z][A-Za-z0-9_]*\s*\(|export\s+function|clipboard\.writeText|execCommand\(['"]copy/i;
for (const [slug, card] of declared) {
  const url = urlFor(slug);
  const file = fileFor(url);
  const exists = fs.existsSync(file);
  check('declared export tool ' + slug + ' page exists', exists, url);
  if (!exists) continue;
  const html = fs.readFileSync(file, 'utf8');
  let text = html;
  const srcs = [...html.matchAll(/(?:src|href)=["']([^"']+\.js)(?:\?[^"']*)?["']/g)].map((m) => m[1]);
  for (const s of srcs.slice(0, 40)) {
    if (/^https?:|^\/\//.test(s)) continue;
    const clean = s.split('?')[0];
    const p = clean.startsWith('/') ? path.join(ROOT, clean) : path.join(path.dirname(file), clean);
    try { if (fs.existsSync(p)) text += '\n' + fs.readFileSync(p, 'utf8'); } catch (e) { /* ignore */ }
  }
  check('declared export tool ' + slug + ' (' + card.outputs.join('/') + ') has an export path', EXPORT_HOOK.test(text));
}

// ---------- 2. Format proof ----------
function serve() {
  const server = http.createServer((req, res) => {
    let u = decodeURIComponent(req.url.split('?')[0]);
    if (u === '/') u = '/index.html';
    const f = path.normalize(path.join(ROOT, u));
    if (!f.startsWith(path.normalize(ROOT))) { res.writeHead(403); return res.end(); }
    fs.readFile(f, (err, data) => {
      if (err) { res.writeHead(404); return res.end('missing'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

// Capture exports without touching the disk: keep Blob references and swallow
// anchor clicks. Data-URL fallbacks are recorded through the href.
function installCapture() {
  window.__exp = [];
  window.__lastHref = null;
  window.__lastName = null;
  try {
    URL.createObjectURL = function (blob) {
      try { window.__exp.push(blob); } catch (e) {}
      return 'blob:captured/' + window.__exp.length;
    };
  } catch (e) {}
  const originalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    window.__lastHref = this.href;
    window.__lastName = this.download;
  };
  void originalClick;
}

async function drive(browser, base, pagePath, setup, trigger, waitMs = 25000) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.evaluateOnNewDocument(installCapture);
  await page.goto(base + pagePath, { waitUntil: 'load', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 900));
  if (setup) { try { await page.evaluate(setup); } catch (e) { errors.push('setup: ' + e.message); } }
  await new Promise((r) => setTimeout(r, 400));
  if (trigger) { try { await page.evaluate(trigger); } catch (e) { errors.push('trigger: ' + e.message); } }
  const got = await page.evaluate(async (limit) => {
    const started = Date.now();
    while (Date.now() - started < limit) {
      if (window.__exp.length) {
        const blob = window.__exp[window.__exp.length - 1];
        const buf = new Uint8Array(await blob.arrayBuffer());
        return { bytes: Array.from(buf.slice(0, 8192)), len: buf.length, type: blob.type || '', name: window.__lastName, data: null };
      }
      if (window.__lastHref && /^data:/.test(window.__lastHref)) {
        return { bytes: [], len: window.__lastHref.length, type: 'data', name: window.__lastName, data: window.__lastHref };
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return { bytes: [], len: 0, type: 'none', name: window.__lastName, data: null };
  }, waitMs);
  await page.close();
  return { ...got, errors };
}

const ascii = (bytes, start = 0, end) =>
  Buffer.from(bytes.slice(start, end == null ? bytes.length : end)).toString('latin1');
const jsonOk = (bytes) => {
  const text = ascii(bytes);
  const trimmed = text.trim();
  if (!/^[\[{]/.test(trimmed)) return false;
  try { JSON.parse(text); return true; } catch (e) { return /"asset"\s*:/.test(text) || /"cols"\s*:/.test(text); }
};
const stlOk = (bytes, len) => {
  if (ascii(bytes, 0, 5).toLowerCase() === 'solid') return /facet\s+normal/i.test(ascii(bytes));
  if (len >= 84) {
    const dv = Buffer.from(bytes.slice(0, 84));
    const n = dv.readUInt32LE(80);
    return n > 0 && len === 84 + 50 * n;
  }
  return false;
};
const glbOk = (bytes) => ascii(bytes, 0, 4) === 'glTF' && Buffer.from(bytes.slice(4, 8)).readUInt32LE(0) === 2;

const seedPixelArt = function () {
  var id = getID();
  setPixel(id, 0, 0, 255, 0, 0, 255);
  setPixel(id, 1, 0, 255, 0, 0, 255);
  setPixel(id, 0, 1, 0, 255, 0, 255);
};
const seedTwoFrames = function () {
  var id = getID();
  setPixel(id, 0, 0, 255, 0, 0, 255);
  setPixel(id, 1, 0, 255, 0, 0, 255);
  addFrame();
  var id2 = getID();
  setPixel(id2, 1, 1, 0, 0, 255, 255);
  setPixel(id2, 2, 2, 0, 255, 255, 255);
};
const FORMATS = [
  { format: 'PNG', page: '/tools/pixel-studio.html', setup: seedPixelArt, trigger: () => exportPNG() },
  { format: 'GIF', page: '/tools/pixel-studio.html', setup: seedTwoFrames, trigger: () => downloadGIF() },
  { format: 'JSON', page: '/tools/colour-palette.html', trigger: () => document.querySelector('[data-export="download-json"]').click() },
  { format: 'WAV', page: '/tools/sound-studio.html', trigger: () => exportWAV() },
  {
    format: 'OBJ', page: '/tools/buildlab.html',
    setup: () => quickBuild('castle'), trigger: () => exportOBJ()
  },
  {
    format: 'GLTF', page: '/tools/buildlab.html',
    setup: () => quickBuild('castle'), trigger: () => exportGLTF()
  },
  {
    format: 'STL', page: '/tools/buildlab.html',
    setup: () => quickBuild('castle'), trigger: () => exportSTL()
  }
];

(async () => {
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    for (const spec of FORMATS) {
      const out = await drive(browser, base, spec.page, spec.setup, spec.trigger);
      let bytes = out.bytes;
      if ((!bytes || !bytes.length) && out.data && /^data:[^,]*,/.test(out.data)) {
        const comma = out.data.indexOf(',');
        const meta = out.data.slice(5, comma);
        const body = out.data.slice(comma + 1);
        try {
          const buf = /;base64/i.test(meta) ? Buffer.from(body, 'base64') : Buffer.from(decodeURIComponent(body), 'latin1');
          out.len = buf.length;
          bytes = Array.from(buf.slice(0, 8192));
        } catch (e) { /* leave empty */ }
      }
      let ok = false;
      if (spec.format === 'PNG') ok = out.len > 100 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
      else if (spec.format === 'GIF') ok = out.len > 20 && /^GIF8[79]a/.test(ascii(bytes));
      else if (spec.format === 'JSON') ok = out.len > 2 && jsonOk(bytes);
      else if (spec.format === 'WAV') ok = out.len > 44 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WAVE';
      else if (spec.format === 'OBJ') ok = out.len > 20 && /(^|\n)v\s+-?\d/.test(ascii(bytes)) && /(^|\n)f\s+\d/.test(ascii(bytes));
      else if (spec.format === 'GLTF') ok = out.len > 12 && glbOk(bytes);
      else if (spec.format === 'STL') ok = out.len > 84 && stlOk(bytes, out.len);
      const detail = 'len=' + out.len + ' type=' + (out.type || (out.data ? 'data-url' : 'none')) + (out.errors.length ? ' errors=' + out.errors.join(' | ') : '');
      check('real ' + spec.format + ' export opens', ok, detail);
    }
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nTOOLS EXPORT VALIDITY PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('Harness error:', e); process.exit(1); });
