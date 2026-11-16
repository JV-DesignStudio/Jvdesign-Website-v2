const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19300;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
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

(async () => {
  const html = fs.readFileSync(path.join(root, 'tools', 'arcade-game-maker.html'), 'utf8');
  check('HTML imports the Chiptune module', /src\/arcade-maker\/Chiptune\.js/.test(html));
  check('HTML has three chiptune presets', (html.match(/data-on="_chiptunePlay"/g) || []).length === 3);
  check('HTML has a tempo field', /id="chiptuneBpm"/.test(html));

  await new Promise((resolve) => server.listen(port, resolve));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:' + port + '/tools/arcade-game-maker.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => window.Chiptune && typeof window.Chiptune.sequence === 'function', { timeout: 25000 });
    const out = await page.evaluate(async () => {
      const mod = await import('/src/arcade-maker/Chiptune.js');
      const heroic = mod.sequence({ preset: 'heroic', bars: 4, bpm: 120 });
      const spooky = mod.sequence({ preset: 'spooky', bars: 4, bpm: 120 });
      const slow = mod.sequence({ preset: 'heroic', bars: 4, bpm: 60 });
      const custom = mod.sequence({ preset: 'arcade', bars: 2, bpm: 120, scale: [0, 3, 7] });
      return {
        notes: heroic.notes.length,
        label: heroic.label,
        bpm: heroic.bpm,
        first: heroic.notes[0],
        last: heroic.notes[heroic.notes.length - 1],
        midiMin: Math.min.apply(null, heroic.notes.map(n => n.midi)),
        midiMax: Math.max.apply(null, heroic.notes.map(n => n.midi)),
        spookyRoot: spooky.notes[0].midi,
        stepFast: heroic.stepTime,
        stepSlow: slow.stepTime,
        custom: custom.notes.length,
        presets: Object.keys(mod.PRESETS).join(','),
        ui: document.querySelectorAll('[data-on="_chiptunePlay"]').length,
        tempo: !!document.getElementById('chiptuneBpm')
      };
    });
    check('heroic is a 4-bar 16-step melody', out.notes === 16 && out.label === 'Heroic' && out.bpm === 120 && out.first.time === 0, JSON.stringify(out));
    check('notes stay in a chiptune range', out.midiMin >= 55 && out.midiMax <= 90, JSON.stringify({ min: out.midiMin, max: out.midiMax }));
    check('spooky has its own darker root', out.spookyRoot < out.first.midi + 1 && out.spookyRoot === 57, String(out.spookyRoot));
    check('tempo changes the step timing', Math.abs(out.stepSlow - out.stepFast * 2) < 0.0002, JSON.stringify({ fast: out.stepFast, slow: out.stepSlow }));
    check('bars and a custom scale are respected', out.custom === 8 && out.presets === 'heroic,spooky,arcade', JSON.stringify({ custom: out.custom, presets: out.presets }));
    check('the three preset buttons and tempo field are present', out.ui === 3 && out.tempo);
    check('zero runtime errors', errors.length === 0, errors.join(' | '));
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nARCADE CHIPTUNE CHECKS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
