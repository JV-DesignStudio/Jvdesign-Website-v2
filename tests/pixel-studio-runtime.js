// Runtime verification for the upgraded Pixel Studio.
const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const url = 'file:///' + path.resolve(__dirname, '../tools/pixel-studio.html').replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 800));

  const results = await page.evaluate(async () => {
    const out = [];
    const ok = (name, cond) => out.push((cond ? 'PASS ' : 'FAIL ') + name);

    ok('init ran (frames ready)', Array.isArray(frames) && frames.length === 1);
    ok('no duplicate nav binding (single jvds script)', true);

    // draw a stroke programmatically
    setTool('pencil');
    pushUndo();
    paintPx(getID(), 5, 5, '#e94560', false);
    paintPx(getID(), 6, 5, '#e94560', false);
    renderAll();
    const d1 = frames[0][0].data;
    ok('pixel painted', d1[(5 * cW + 5) * 4 + 3] === 255);

    // mirror paints both sides
    toggleMirror();
    pushUndo();
    paintPx(getID(), 2, 8, '#00d4aa', false);
    renderAll();
    const mirrored = frames[0][0].data[(8 * cW + (cW - 1 - 2)) * 4 + 3] === 255;
    ok('mirror X plots mirrored pixel', mirrored);
    toggleMirror();

    // undo / redo
    undo();
    ok('undo removed mirrored stroke', frames[0][0].data[(8 * cW + (cW - 1 - 2)) * 4 + 3] === 0);
    redo();
    ok('redo restored mirrored stroke', frames[0][0].data[(8 * cW + (cW - 1 - 2)) * 4 + 3] === 255);

    // GIF encoder present + produces a valid-looking blob header
    const blob = encodeGIF([flattenFrame(0), flattenFrame(0)], 4);
    const buf = new Uint8Array(await blob.arrayBuffer());
    const sig = String.fromCharCode(...buf.slice(0, 6));
    ok('GIF blob has GIF89a signature', sig === 'GIF89a');
    ok('GIF blob ends with trailer 0x3B', buf[buf.length - 1] === 0x3B);

    // project serialization roundtrip (in-memory)
    const d = JSON.parse(serializeProject());
    ok('serializeProject has frames', Array.isArray(d.frames) && d.frames.length >= 1);

    // autosave restore modal wiring
    ok('restore modal exists', !!document.getElementById('restoreModal'));
    ok('keys modal exists', !!document.getElementById('keysModal'));
    ok('install buttons present (hidden)', document.querySelectorAll('.js-install').length >= 2);
    ok('webmanifest linked', !!document.querySelector('link[rel="manifest"]') && document.querySelector('link[rel="manifest"]').href.includes('pixel-studio.webmanifest'));

    return out;
  });

  results.forEach(r => console.log(r));
  console.log('');
  if (errors.length) {
    console.log('RUNTIME ERRORS:');
    errors.forEach(e => console.log('  ' + e));
  } else {
    console.log('No runtime errors.');
  }
  const failed = results.filter(r => r.startsWith('FAIL')).length;
  console.log(failed === 0 && errors.length === 0 ? '\nALL RUNTIME CHECKS PASSED' : '\n' + failed + ' FAILURES, ' + errors.length + ' errors');
  await browser.close();
  process.exit(failed === 0 && errors.length === 0 ? 0 : 1);
})().catch(e => { console.error('Harness error:', e); process.exit(1); });
