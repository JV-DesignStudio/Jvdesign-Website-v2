// tests/learn-http.js - verifies the Teen Learn redirect page
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const PAGE = '/workshops/learn.html';
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

(async () => {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(ROOT, url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end('missing ' + url);
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;

  const html = fs.readFileSync(path.join(ROOT, PAGE), 'utf8');
  check('has noindex meta', /noindex/.test(html));
  check('has canonical to workshop hub', /rel="canonical".*workshop\.html/.test(html));
  check('has JS redirect', /location\.replace/.test(html));
  check('has meta refresh fallback', /meta http-equiv="refresh"/.test(html));
  check('has fallback link', /Workshop hub<\/a>/.test(html));

  const resp = await new Promise((resolve, reject) => {
    http.get(base + PAGE, resolve).on('error', reject);
  });
  check('serves 200', resp.statusCode === 200);

  await new Promise(r => server.close(r));
  if (failures) { console.log('\n' + failures + ' FAILED for ' + PAGE); process.exit(1); }
  console.log('\nPASS: ' + PAGE + ' redirect page');
})().catch(e => { console.error(e); process.exit(1); });
