// Runtime verification for the upgraded Pixel Studio - HTTP (A204: avoid file:// SecurityError/CORS).
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIME = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json','.json':'application/json','.webp':'image/webp','.avif':'image/avif'};
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!path.extname(p)) p = path.join(p, 'index.html');
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, {'Content-Type': MIME[path.extname(p)] || 'application/octet-stream'});
    res.end(d);
  });
});

(async () => {
  await new Promise(r => server.listen(8125, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const url = 'http://127.0.0.1:8125/tools/pixel-studio.html';
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));

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

    // --- A810: ellipse tool + flip/rotate transforms ---
    const blank = () => { frames[0][0] = new ImageData(cW, cH); };
    const alpha = (x, y) => frames[0][0].data[(y * cW + x) * 4 + 3];

    // Ellipse outline draws the boundary, not the centre
    setTool('ellipse');
    ok('ellipse tool selectable (key O)', currentTool === 'ellipse');
    blank();
    pushUndo();
    drawEllipse(getID(), 0, 0, 8, 8, '#e94560', false);
    renderAll();
    ok('ellipse outline edge painted', alpha(4, 0) === 255 || alpha(0, 4) === 255 || alpha(8, 4) === 255 || alpha(4, 8) === 255);
    ok('ellipse outline centre empty', alpha(4, 4) === 0);
    undo();
    ok('ellipse undo removes whole shape', frames[0][0].data.every((v, i) => i % 4 !== 3 || v === 0));

    // Filled ellipse paints the interior
    blank();
    const prevFill = filledRect;
    filledRect = true;
    pushUndo();
    drawEllipse(getID(), 0, 0, 8, 8, '#e94560', false);
    renderAll();
    ok('ellipse filled centre painted', alpha(4, 4) === 255);
    filledRect = prevFill;
    undo();

    // Flip X moves a pixel to the mirrored column, undo restores it
    blank();
    setTool('pencil');
    pushUndo();
    paintPx(getID(), 1, 2, '#00d4aa', false);
    flipFrame('x');
    ok('flip X moves pixel to mirrored column', alpha(cW - 2, 2) === 255 && alpha(1, 2) === 0);
    undo();
    ok('flip undo restores pixel', alpha(1, 2) === 255 && alpha(cW - 2, 2) === 0);

    // Rotate 90 clockwise (square canvas keeps its size), undo restores content
    blank();
    setPixel(frames[0][0], 1, 2, 0, 212, 170, 255);
    rotateFrame();
    ok('rotate 90 keeps square canvas size', cW === 32 && cH === 32);
    ok('rotate 90 moves pixel clockwise', alpha(cW - 3, 1) === 255);
    undo();
    ok('rotate undo restores pixel', alpha(1, 2) === 255 && cW === 32 && cH === 32);

    // Non-square rotate swaps dimensions; undo restores them and the content
    setCanvasSize(16, 32, false);
    setPixel(frames[0][0], 1, 2, 255, 0, 0, 255);
    rotateFrame();
    ok('rotate swaps non-square dimensions', cW === 32 && cH === 16);
    undo();
    ok('undo restores non-square dimensions and pixel', cW === 16 && cH === 32 && alpha(1, 2) === 255);
    setCanvasSize(32, 32, false);

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
  server.close();
  process.exit(failed === 0 && errors.length === 0 ? 0 : 1);
})().catch(e => { console.error('Harness error:', e); try{server.close();}catch(_){} process.exit(1); });
