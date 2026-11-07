#!/usr/bin/env node
/*
 * tests/arcade-game-maker-a11y-hardening.js
 * Batch coverage for six Arcade Game Maker hardening cards:
 *   A2673 roundPixels + pixelArt for fractional zoom
 *   A2677 sanitise imported story and project text
 *   A2678 dyslexia-friendly Blueprint code toggle
 *   A2680 low-stimulation mode
 *   A2681 adjustable coyote time and jump buffer
 *   A2685 spatial partitioning (RTree) for collisions
 * Run: node tests/arcade-game-maker-a11y-hardening.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.AGM_HARDENING_PORT || 0);
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.webp':'image/webp', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.woff':'font/woff', '.ico':'image/x-icon' };

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const server = http.createServer((req, res) => {
    let file = decodeURIComponent(req.url.split('?')[0]);
    if (file.endsWith('/')) file += 'index.html';
    fs.readFile(path.join(ROOT, file), (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const BASE = `http://127.0.0.1:${server.address().port}/`;

  const browser = await puppeteer.launch({ headless:'new', args:['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') jsErrors.push(m.text()); });
  await page.setViewport({ width:1280, height:900 });

  try {
    await page.goto(BASE + 'tools/arcade-game-maker.html', { waitUntil:'domcontentloaded' });
    await page.waitForSelector('#runGameBtn', { timeout:15000 });
    await page.waitForFunction(() => typeof window._buildPhaserConfig === 'function', { timeout:15000 });

    // A2677: a malicious imported project must never execute or inject markup.
    const safe = await page.evaluate(async () => {
      window.__xss = 0;
      const payload = {
        title:'<img src=x onerror="window.__xss=1">',
        speed:200, gravity:600, jump:450,
        story:{ title:'<b>bad</b>', intro:'<img src=x onerror="window.__xss=1">Hello', nodes:[
          { id:'s', type:'start', text:'<img src=x onerror="window.__xss=1">', char:'<img src=x onerror="window.__xss=1">', tag:'<b>x</b>', choices:[] }
        ], chars:[{ name:'<img src=x onerror="window.__xss=1">' }] },
        liveConfig:{ storyIntro:'<img src=x onerror="window.__xss=1">' },
        customAchs:[{ id:'a', label:'<img src=x onerror="window.__xss=1">', trigger:'score_reaches', target:1 }],
        cuts:[{ text:'<img src=x onerror="window.__xss=1">' }]
      };
      _applyLoadData(payload, { skipBoot:true });
      // onGenreChange rewrites the mission line, so apply the story again to
      // exercise the innerHTML path that the security fix guards.
      applyStory(payload.story);
      await new Promise(r => setTimeout(r, 350));
      const mt = document.getElementById('missionText');
      const out = {
        xss: window.__xss,
        title: document.getElementById('gameTitle').value,
        missionHtml: mt ? mt.innerHTML : '',
        storyText: (currentStory && currentStory.nodes && currentStory.nodes[0]) ? currentStory.nodes[0].text : ''
      };
      // Do not let the test story or cutscene play before the game boots.
      currentStory = null;
      _storyIntroPlayed = true;
      try { _cutSlides = []; liveConfig.cutsceneSlides = []; } catch (e) {}
      return out;
    });
    check('malicious import does not execute', safe.xss === 0, String(safe.xss));
    check('imported title renders as text', !/[<>]/.test(safe.title), safe.title);
    check('imported story heading has no live img', !/<img/i.test(safe.missionHtml), safe.missionHtml.slice(0, 80));
    check('imported story text is stripped', !/<[^>]*>/.test(safe.storyText), safe.storyText.slice(0, 80));

    // Boot a real PLATFORMER so physics and scene values can be inspected.
    await page.evaluate(() => {
      document.getElementById('genreMode').value = 'PLATFORMER';
      if (typeof onGenreChange === 'function') onGenreChange();
    });
    await sleep(800);
    await page.evaluate(() => compileAndBootEngine());
    await page.waitForFunction(() => {
      const io = document.getElementById('introOverlay');
      return !!(io && io.classList.contains('show'));
    }, { timeout:15000 });
    await page.evaluate(() => closeIntro());
    await page.waitForFunction(() => !!window._phaserGame, { timeout:20000 });
    await page.waitForFunction(() => {
      const g = window._phaserGame;
      const sc = g && g.scene && g.scene.getScenes(true)[0];
      return !!(sc && sc.sys && sc.sys.isActive());
    }, { timeout:20000 });

    // A2673 and A2685: config carries the pixel and physics settings.
    const cfg = await page.evaluate(() => {
      const c = _buildPhaserConfig({ genre:'PLATFORMER', title:'Hardening', speed:200, gravity:600, jump:450, map:null });
      const sc = window._phaserGame.scene.getScenes(true)[0];
      return {
        roundPixels: c.render && c.render.roundPixels,
        pixelArt: c.render && c.render.pixelArt,
        useTree: c.physics.arcade.useTree,
        maxEntries: c.physics.arcade.maxEntries,
        worldUseTree: !!(sc && sc.physics && sc.physics.world && sc.physics.world.useTree),
        worldTree: !!(sc && sc.physics && sc.physics.world && sc.physics.world.tree)
      };
    });
    check('render sets roundPixels and pixelArt', cfg.roundPixels === true && cfg.pixelArt === true, JSON.stringify({ roundPixels: cfg.roundPixels, pixelArt: cfg.pixelArt }));
    check('arcade config enables the RTree', cfg.useTree === true && cfg.maxEntries === 16, JSON.stringify({ useTree: cfg.useTree, maxEntries: cfg.maxEntries }));
    check('live physics world uses the RTree', cfg.worldUseTree === true && cfg.worldTree === true, JSON.stringify({ useTree: cfg.worldUseTree, tree: cfg.worldTree }));

    // A2678: dyslexia-friendly code class and computed style.
    await page.evaluate(() => _setDyslexiaFont(true));
    await page.waitForFunction(() => {
      const el = document.querySelector('.bp-code');
      return !!(el && /inter|system-ui|segoe/i.test(getComputedStyle(el).fontFamily));
    }, { timeout:8000 }).catch(() => {});
    const dys = await page.evaluate(() => {
      const el = document.querySelector('.bp-code');
      const cs = el ? getComputedStyle(el) : null;
      const persisted = localStorage.getItem('jv_arcade_dyslexia_font');
      const cls = document.documentElement.classList.contains('dyslexia-blueprint');
      let ruleFound = false;
      for (const sheet of document.styleSheets) {
        try { for (const rule of sheet.cssRules || []) { if (rule.selectorText && rule.selectorText.includes('dyslexia-blueprint')) ruleFound = true; } } catch (e) {}
      }
      // getComputedStyle is live, so snapshot before turning the class off.
      const font = cs ? cs.fontFamily : '';
      const size = cs ? parseFloat(cs.fontSize) : 0;
      const lh = cs ? parseFloat(cs.lineHeight) : 0;
      _setDyslexiaFont(false);
      return { cls, font, size, lh, persisted, ruleFound };
    });
    // The class was toggled off before reading? It is read before the second call, so ok.
    check('dyslexia toggle adds the html class', dys.cls === true);
    check('dyslexia stylesheet rule is loaded', dys.ruleFound === true);
    check('dyslexia code uses a sans font', /inter|system-ui|segoe/i.test(dys.font) && !/jetbrains|monospace/i.test(dys.font), dys.font);
    check('dyslexia code keeps generous line height', dys.size > 0 && dys.lh / dys.size >= 1.55, (dys.lh / dys.size).toFixed(2));
    check('dyslexia choice persists', dys.persisted === '1', String(dys.persisted));

    // A2680: low-stimulation caps every bus, disables shake and particles.
    const low = await page.evaluate(() => {
      GameAudio.volume = 0.9; GameAudio.musicVol = 0.9; GameAudio.sfxVol = 0.9;
      _setLowStimulation(true);
      const on = {
        volume: GameAudio.volume, music: GameAudio.musicVol, sfx: GameAudio.sfxVol,
        reduced: _a11yReducedMotion(), shake: _allowShake(), flag: liveConfig.lowStimulation
      };
      _setLowStimulation(false);
      const off = { volume: GameAudio.volume, music: GameAudio.musicVol, sfx: GameAudio.sfxVol };
      return { on, off };
    });
    check('low-stimulation clamps every audio bus', low.on.volume <= 0.35 && low.on.music <= 0.35 && low.on.sfx <= 0.35, JSON.stringify(low.on));
    check('low-stimulation disables shake and particles', low.on.reduced === true && low.on.shake === false && low.on.flag === true, JSON.stringify(low.on));
    check('low-stimulation restores volume when off', low.off.volume === 0.9 && low.off.music === 0.9 && low.off.sfx === 0.9, JSON.stringify(low.off));

    // A2681: the slider widens coyote time and the jump buffer.
    await page.evaluate(() => _setCoyoteWindow(300));
    await page.waitForFunction(() => {
      const sc = window._phaserGame && window._phaserGame.scene.getScenes(true)[0];
      return !!(sc && sc._coyoteTime === 300);
    }, { timeout:8000 }).catch(() => {});
    const coyote = await page.evaluate(() => {
      const sc = window._phaserGame.scene.getScenes(true)[0];
      return {
        setting: liveConfig.a11yCoyoteMs,
        label: (document.getElementById('a11yCoyoteVal') || {}).textContent || '',
        scene: sc ? sc._coyoteTime : null,
        stored: localStorage.getItem('jv_arcade_coyote_ms')
      };
    });
    check('jump forgiveness slider sets 300ms', coyote.setting === 300 && coyote.label === '300ms', JSON.stringify({ setting: coyote.setting, label: coyote.label }));
    check('jump forgiveness persists', coyote.stored === '300', String(coyote.stored));
    check('running platformer uses the wider window', coyote.scene === 300, String(coyote.scene));

    check('no page errors during the run', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n' + (failures ? failures + ' check(s) failed' : 'arcade-game-maker a11y hardening: all checks passed'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
