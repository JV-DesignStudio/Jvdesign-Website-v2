/* A2145: Audio Studio keeps My Sounds and Sound Lab settings across reloads.

   Uses the real page and IndexedDB:
     1. upload a WAV, confirm it is listed, reload, confirm it is still listed,
     2. delete it, reload, confirm it is gone,
     3. change the Sound Lab recipe and knobs, reload, confirm they survive,
     4. with IndexedDB unavailable, the page still works and says so.

   Run: node tests/sound-studio-persistence.js
*/
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.zip': 'application/zip'
};

const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.resolve(root, '.' + u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
  if (!ok) failures++;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

function wav(seconds, freq, rate) {
  const n = Math.floor(seconds * rate), data = Buffer.alloc(44 + n * 2);
  data.write('RIFF', 0); data.writeUInt32LE(36 + n * 2, 4); data.write('WAVE', 8);
  data.write('fmt ', 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24); data.writeUInt32LE(rate * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.sin(2 * Math.PI * freq * i / rate) * 0.3;
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(s * 32767))), 44 + i * 2);
  }
  return data;
}

(async () => {
  const wavPath = path.join(os.tmpdir(), 'jvds-test-tone.wav');
  fs.writeFileSync(wavPath, wav(0.25, 440, 44100));

  const html = fs.readFileSync(path.join(root, 'tools', 'sound-studio.html'), 'utf8');
  check('size cap is defined', /SAMPLE_MAX_BYTES\s*=/.test(html) && /SAMPLE_TOTAL_BYTES\s*=/.test(html));
  check('samples use IndexedDB store "samples"', /SAMPLE_STORE='samples'/.test(html));
  check('lab settings use IndexedDB store "lab"', /LAB_STORE='lab'/.test(html));

  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });

  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message.split('\n')[0]));
    await page.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem('jvds_sound_seen', '1');
        localStorage.removeItem('jvds_sound_auto');
        localStorage.removeItem('jvds_sound_lab');
      } catch (e) {}
    });
    await page.setViewport({ width: 1200, height: 900 });
    await page.goto(base + '/tools/sound-studio.html', { waitUntil: 'load', timeout: 30000 });
    await sleep(1300);
    await page.click('.ss-mode[data-mode="sfx"]');
    await sleep(300);

    const setLab = await page.evaluate(() => {
      const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
      set('sfxPitch', '1.35'); set('sfxLen', '1.75'); set('sfxTone', '0.85'); set('sfxShape', '0.65');
      const btn = Array.from(document.querySelectorAll('#sfxRecipeBtns .sfx-vbtn')).find(b => /Explosion/.test(b.textContent));
      if (btn) btn.click();
      return { recipe: btn ? btn.textContent : null };
    });
    check('Sound Lab recipe can be selected', !!setLab.recipe, JSON.stringify(setLab));
    await sleep(500);

    const input = await page.$('#sfxFileInput');
    await input.uploadFile(wavPath);
    await page.waitForFunction(() => document.querySelectorAll('#mySampleBtns .my-sample-chip').length > 0, { timeout: 15000 });
    const added = await page.evaluate(() => {
      const chip = document.querySelector('#mySampleBtns .my-sample-chip');
      return {
        name: chip ? chip.querySelector('.sfx-vbtn').textContent : '',
        hasDelete: !!(chip && chip.querySelector('.my-sample-del')),
        status: (document.getElementById('mySfxStatus') || {}).textContent || ''
      };
    });
    check('uploaded WAV is listed in My Sounds', /test-tone/i.test(added.name), JSON.stringify(added));
    check('My Sounds has a delete control', added.hasDelete, JSON.stringify(added));

    await page.reload({ waitUntil: 'load' });
    await sleep(1500);
    const afterReload = await page.evaluate(() => {
      const chip = document.querySelector('#mySampleBtns .my-sample-chip');
      const playing = document.querySelector('#sfxRecipeBtns .sfx-vbtn.playing');
      return {
        names: Array.from(document.querySelectorAll('#mySampleBtns .my-sample-chip .sfx-vbtn')).map(b => b.textContent),
        hasDelete: !!document.querySelector('#mySampleBtns .my-sample-del'),
        pitch: document.getElementById('sfxPitch').value,
        len: document.getElementById('sfxLen').value,
        tone: document.getElementById('sfxTone').value,
        shape: document.getElementById('sfxShape').value,
        recipe: playing ? playing.textContent : '',
        chip: chip ? chip.querySelector('.sfx-vbtn').textContent : ''
      };
    });
    check('My Sounds survives reload', afterReload.names.some(n => /test-tone/i.test(n)), JSON.stringify(afterReload.names));
    check('delete control survives reload', afterReload.hasDelete, String(afterReload.hasDelete));
    check('Sound Lab recipe survives reload', /Explosion/.test(afterReload.recipe), afterReload.recipe);
    check('Sound Lab knobs survive reload',
      [+afterReload.pitch === 1.35, +afterReload.len === 1.75, +afterReload.tone === 0.85, +afterReload.shape === 0.65].every(Boolean),
      JSON.stringify({ pitch: afterReload.pitch, len: afterReload.len, tone: afterReload.tone, shape: afterReload.shape }));

    await page.click('#mySampleBtns .my-sample-del');
    await sleep(400);
    check('delete removes the sound immediately', await page.evaluate(() => !document.querySelector('#mySampleBtns .my-sample-chip')), '');
    await page.reload({ waitUntil: 'load' });
    await sleep(1400);
    check('deleted sound stays gone after reload', await page.evaluate(() => !document.querySelector('#mySampleBtns .my-sample-chip')), '');
    check('no runtime errors in the persistence run', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();

    const noIdb = await browser.newPage();
    const noIdbErrors = [];
    noIdb.on('pageerror', e => noIdbErrors.push(e.message.split('\n')[0]));
    await noIdb.evaluateOnNewDocument(() => {
      try { Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }); } catch (e) {}
      try { localStorage.setItem('jvds_sound_seen', '1'); localStorage.removeItem('jvds_sound_auto'); localStorage.removeItem('jvds_sound_lab'); } catch (e) {}
    });
    await noIdb.setViewport({ width: 1200, height: 900 });
    await noIdb.goto(base + '/tools/sound-studio.html', { waitUntil: 'load', timeout: 30000 });
    await sleep(1200);
    const fallbackStatus = await noIdb.evaluate(() => (document.getElementById('mySfxStatus') || {}).textContent || '');
    check('IndexedDB failure is explained to the learner', /cannot keep|not survive|download/i.test(fallbackStatus), fallbackStatus);
    const input2 = await noIdb.$('#sfxFileInput');
    await input2.uploadFile(wavPath);
    await sleep(900);
    const afterUpload = await noIdb.evaluate(() => (document.getElementById('mySfxStatus') || {}).textContent || '');
    check('IndexedDB failure still lets the sound be used', await noIdb.evaluate(() => !!document.querySelector('#mySampleBtns .my-sample-chip')), afterUpload);
    check('no runtime errors without IndexedDB', noIdbErrors.length === 0, noIdbErrors.slice(0, 2).join(' | '));
    await noIdb.close();
  } finally {
    await browser.close();
    server.close();
    try { fs.unlinkSync(wavPath); } catch (e) {}
  }

  if (failures) { console.log('\n' + failures + ' CHECK(S) FAILED'); process.exit(1); }
  console.log('\nAUDIO STUDIO PERSISTENCE CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
