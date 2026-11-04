// tests/funnel-weekly-report-http.js (A1828)
// Guards the meta Content-Security-Policy on the private weekly funnel report.
// It must exist exactly once and stay in step with _headers: every directive
// carried over, frame-ancestors omitted (ignored in <meta>), and no
// unsafe-inline in script-src (the site-wide rule in check-csp-sync.js).
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PAGE = '/pages/funnel-weekly-report.html';
let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
function cspFrom(html) {
  const m = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i);
  return m ? m[1] : '';
}
function directive(policy, name) {
  const m = new RegExp('\\b' + name + '\\s+([^;]*)').exec(policy);
  return m ? m[1].trim().split(/\s+/).filter(Boolean) : [];
}
function pumps(html) {
  return (html.match(/<meta[^>]*http-equiv=["']Content-Security-Policy["']/gi) || []).length;
}

(async () => {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(ROOT, url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end('missing ' + url);
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  let status = 0, body = '';
  try {
    const res = await fetch(base + PAGE);
    status = res.status;
    body = await res.text();
  } finally {
    await new Promise((r) => server.close(r));
  }

  check('page responds 200', status === 200, 'status ' + status);
  const count = pumps(body);
  check('exactly one meta CSP', count === 1, 'count ' + count);
  const meta = cspFrom(body);
  check('meta CSP is present', !!meta);
  check('meta CSP omits frame-ancestors', meta && !/frame-ancestors/.test(meta));
  check("meta CSP keeps frame-src 'self'", directive(meta, 'frame-src').includes("'self'"));
  check('script-src allows blob:', directive(meta, 'script-src').includes('blob:'));
  check('script-src has no unsafe-inline', meta && !/script-src[^;]*'unsafe-inline'/.test(meta));
  check('connect-src allows blob:', directive(meta, 'connect-src').includes('blob:'));
  check('referrer meta is set', /name="referrer"/.test(body));

  // Compare against _headers with the two deliberate differences applied:
  // frame-ancestors (ignored in <meta>) and script-src 'unsafe-inline' (banned
  // by check-csp-sync.js on pages).
  const header = (fs.readFileSync(path.join(ROOT, '_headers'), 'utf8')
    .split(/\r?\n/)
    .find((l) => l.trim().startsWith('Content-Security-Policy:')) || '')
    .replace(/^\s*Content-Security-Policy:\s*/, '').trim();
  const expected = header
    .replace(/frame-ancestors 'self';\s*/g, '')
    .replace("script-src 'self' 'unsafe-inline' blob:", "script-src 'self' blob:")
    .replace(/\s+/g, ' ').trim();
  const actual = meta.replace(/\s+/g, ' ').trim();
  check('meta CSP matches the _headers policy', actual === expected,
    actual === expected ? 'exact' : 'expected: ' + expected.slice(0, 80) + '...');

  if (failures) { console.log('\nsecurity headers: ' + failures + ' FAILED for ' + PAGE); process.exit(1); }
  console.log('\nPASS: ' + PAGE + ' meta CSP matches the _headers policy');
})();
