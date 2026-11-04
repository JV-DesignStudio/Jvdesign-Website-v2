// tests/js-final-mission.js (A1915)
// The JS browser game build-alongs used to treat the studio tools as optional
// extras. Each page must now carry the guided final mission (Customise, Expand,
// Polish, Explain, Share) and require one original design choice.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STAGES = ['customise', 'expand', 'polish', 'explain', 'share'];
const TOOLS = [
  '../tools/pixel-studio.html',
  '../tools/colour-palette.html',
  '../tools/level-designer.html',
  '../tools/sound-studio.html',
  '../tools/game-logo-maker.html'
];

function makeServer() {
  return http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(ROOT, url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end('missing ' + url);
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    fs.createReadStream(file).pipe(res);
  });
}

async function run(pagePath) {
  let failures = 0;
  function check(name, ok, detail = '') {
    console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
    if (!ok) failures++;
  }

  const server = makeServer();
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  let status = 0, body = '';
  try {
    const res = await fetch(base + pagePath);
    status = res.status;
    body = await res.text();
  } finally {
    await new Promise((r) => server.close(r));
  }

  check('page responds 200', status === 200, 'status ' + status);
  check('guided final mission block is present', /data-final-mission/.test(body));
  const found = STAGES.filter((s) => new RegExp('data-stage="' + s + '"').test(body));
  check('mission has all five stages', found.length === STAGES.length, found.join(', '));
  const ordered = STAGES.every((s, i) => {
    const at = body.indexOf('data-stage="' + s + '"');
    const prev = i === 0 ? -1 : body.indexOf('data-stage="' + STAGES[i - 1] + '"');
    return at !== -1 && at > prev;
  });
  check('stages run Customise, Expand, Polish, Explain, Share', ordered);
  const missingTools = TOOLS.filter((t) => !body.includes('href="' + t + '"'));
  check('mission links to every studio tool', missingTools.length === 0, missingTools.length ? 'missing: ' + missingTools.join(', ') : TOOLS.length + ' tool links');
  check('states the original design choice requirement', /original design choice/i.test(body));
  check('no em or en dashes', !/[\u2013\u2014]/.test(body));

  if (failures) {
    console.log('\n' + pagePath + ': ' + failures + ' FAILED');
    process.exit(1);
  }
  console.log('\nPASS: ' + pagePath + ' guided final mission');
}

module.exports = { run };

if (require.main === module) {
  (async () => {
    await run('/workshops/sci-fi-runner-builder.html');
    await run('/workshops/race-builder.html');
  })().catch((e) => { console.error(e); process.exit(1); });
}
