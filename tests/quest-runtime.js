// tests/quest-runtime.js (A2555/A2552)
// Unit-style test for the shared quest runtime. Mounts a sample step in an
// isolated page with a fake player profile, then proves:
//   - only hex values pass
//   - a pass awards XP once through player-profile
//   - a replay does not double-award
//   - a non-pass save never awards
//   - the page reports no console errors at 390px
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const RUNTIME = path.join(ROOT, 'assets', 'js', 'quest-core', 'step-runtime.js');
const LAYOUT = path.join(ROOT, 'assets', 'js', 'quest-core', 'layout.js');

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

const HARNESS = `<!doctype html><html><body>
<div id="root">
  <div class="quest-actions">
    <button type="button" id="run" data-quest-run>Run</button>
    <button type="button" id="hint" data-quest-hint>Hint</button>
    <button type="button" id="reset" data-quest-reset>Reset</button>
    <button type="button" id="save" data-quest-save>Save</button>
    <button type="button" id="download" data-quest-download>Download</button>
  </div>
  <div data-quest-layout>
    <div data-quest-pane="code">
      <textarea id="code" data-quest-code>fillStyle = '#000000';</textarea>
      <p id="status" data-quest-status></p>
    </div>
    <div data-quest-pane="preview">
      <canvas id="canvas" data-quest-canvas width="32" height="32"></canvas>
      <code id="pixel" data-quest-pixel></code>
      <p id="saved" data-quest-saved hidden></p>
    </div>
  </div>
</div>
</body></html>`;

async function mountStep(page, id) {
  return page.evaluate((id) => {
    window.playerProfile = {
      _state: { bonusXP: 0, globalXP: 0, quests: {} },
      get state() { return this._state; },
      getQuestProgress(name) { return this._state.quests[name] || null; },
      completeQuest(name) { this._state.quests[name] = { completed: true }; },
      addXP(amount) { this._state.bonusXP += amount; this._state.globalXP += amount; }
    };
    window.QuestRuntime.mount(document.getElementById('root'), {
      id: id,
      xp: 20,
      storageKey: 'test_' + id,
      starter: "fillStyle = '#000000';",
      target: '#70A3A7',
      fileName: 'test.png',
      parse: function (code) { return window.QuestRuntime.readFillStyle(code); },
      draw: function (canvas, hex) {
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = hex;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      },
      passes: function (hex, pixel) { return hex === '#70A3A7' && pixel === '#70A3A7'; },
      passText: function (hex, pixel) { return 'PASS ' + pixel; },
      progressText: function (hex, pixel) { return 'TRY ' + pixel; },
      hint: function (code) { return code.replace(/#[0-9a-f]{3,6}/i, '#70A3A7'); },
      restore: function (code, value) { return code.replace(/#[0-9a-f]{3,6}/i, value); }
    });
  }, id);
}

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.setViewport({ width: 390, height: 844 });
    await page.setContent(HARNESS, { waitUntil: 'load' });
    await page.addScriptTag({ path: LAYOUT });
    await page.addScriptTag({ path: RUNTIME });

    const api = await page.evaluate(() => ({
      runtime: typeof window.QuestRuntime,
      layout: typeof window.QuestLayout,
      fill: window.QuestRuntime.readFillStyle("ctx.fillStyle = '#70a3a7';"),
      short: window.QuestRuntime.normaliseHex('#abc'),
      bad: window.QuestRuntime.readFillStyle('fillStyle = nope;')
    }));
    check('runtime exposes mount', api.runtime === 'object');
    check('layout module loads', api.layout === 'object');
    check('readFillStyle normalises case', api.fill === '#70A3A7', String(api.fill));
    check('short hex expands', api.short === '#AABBCC', String(api.short));
    check('invalid code returns null', api.bad === null, String(api.bad));

    await mountStep(page, 'sample-step');
    await page.waitForFunction(() => document.getElementById('root').dataset.questReady === '1');

    await page.click('#run');
    let state = await page.evaluate(() => ({
      status: document.getElementById('status').textContent,
      pixel: document.getElementById('pixel').textContent,
      xp: window.playerProfile.state.bonusXP
    }));
    check('starter step runs without passing', /^TRY/.test(state.status), state.status);
    check('starter pixel is black', state.pixel === '#000000', state.pixel);
    check('no XP before a pass', state.xp === 0, 'xp ' + state.xp);

    await page.click('#hint');
    await page.click('#run');
    state = await page.evaluate(() => ({
      status: document.getElementById('status').textContent,
      pixel: document.getElementById('pixel').textContent
    }));
    check('hint reaches the target colour', state.pixel === '#70A3A7', state.pixel);
    check('pass status is shown', /^PASS/.test(state.status), state.status);

    await page.click('#save');
    const saved = await page.evaluate(() => ({
      xp: window.playerProfile.state.bonusXP,
      global: window.playerProfile.state.globalXP,
      quest: window.playerProfile.getQuestProgress('sample-step'),
      message: document.getElementById('saved').textContent,
      hidden: document.getElementById('saved').hidden
    }));
    check('pass awards 20 XP once', saved.xp === 20, 'xp ' + saved.xp);
    check('profile total mirrors the award', saved.global === 20, 'global ' + saved.global);
    check('quest recorded as complete', !!(saved.quest && saved.quest.completed));
    check('saved message shown', !saved.hidden && /earned 20 XP/.test(saved.message), saved.message);

    await page.click('#save');
    const replay = await page.evaluate(() => ({
      xp: window.playerProfile.state.bonusXP,
      message: document.getElementById('saved').textContent
    }));
    check('replay does not double-award', replay.xp === 20, 'xp ' + replay.xp);
    check('replay explains the XP was already earned', /already earned/.test(replay.message), replay.message);

    await page.click('#reset');
    await page.click('#save');
    const nonPass = await page.evaluate(() => ({
      xp: window.playerProfile.state.bonusXP,
      message: document.getElementById('saved').textContent
    }));
    check('non-pass save never awards XP', nonPass.xp === 20, 'xp ' + nonPass.xp);
    check('non-pass save explains why', /No XP yet/.test(nonPass.message), nonPass.message);

    check('no console errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
  }

  if (failures) { console.log('\n' + failures + ' FAILED for quest runtime'); process.exit(1); }
  console.log('\nPASS: shared quest runtime');
})().catch((e) => { console.error(e); process.exit(1); });
