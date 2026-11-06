#!/usr/bin/env node
/*
 * tests/post-deploy-check.js , A2654
 * Proves the post-deploy check catches a bad deploy:
 *   - against a healthy local site it runs the live link check + smoke pass and
 *     exits 0 with a pasteable POST_DEPLOY_RESULT record
 *   - against a missing route it exits 1 and names the failed route
 *   - --dry-run prints the plan without making a request
 * Run: node tests/post-deploy-check.js
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'post-deploy-check.js');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.gif': 'image/gif', '.txt': 'text/plain'
};

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

function serve(req, res) {
  const clean = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(ROOT, clean);
  if (clean === '/') file = path.join(ROOT, 'index.html');
  const isFile = fs.existsSync(file) && fs.statSync(file).isFile();
  if (isFile) {
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    return fs.createReadStream(file).pipe(res);
  }
  // GitHub Pages-style clean routes: /create, /books, /tools resolve to a page.
  const isDir = fs.existsSync(file) && fs.statSync(file).isDirectory();
  if (!path.extname(clean) || isDir) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return fs.createReadStream(path.join(ROOT, 'index.html')).pipe(res);
  }
  res.writeHead(404, { 'Content-Type': 'text/html' });
  res.end('<!doctype html><title>Not found</title><h1>Not found</h1>');
}

function run(args, server) {
  // Async spawn: the local server lives in this process, so a blocking
  // spawnSync would deadlock the request it is waiting on.
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, '--base=' + server].concat(args), { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    const timer = setTimeout(() => { try { child.kill(); } catch (e) {} }, 180000);
    child.on('close', (status) => {
      clearTimeout(timer);
      const line = out.split(/\r?\n/).find((l) => l.startsWith('POST_DEPLOY_RESULT '));
      let json = null;
      if (line) { try { json = JSON.parse(line.slice('POST_DEPLOY_RESULT '.length)); } catch (e) {} }
      resolve({ status, out, json });
    });
  });
}

(async () => {
  check('script exists', fs.existsSync(SCRIPT));
  const src = fs.readFileSync(SCRIPT, 'utf8');
  check('script runs the live link check by default', /validate-links-live\.js/.test(src));
  check('validate-links-live script exists', fs.existsSync(path.join(ROOT, 'scripts', 'validate-links-live.js')));

  const server = http.createServer(serve);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const good = await run(['--json'], base);
    check('healthy deploy exits 0', good.status === 0, 'exit=' + good.status);
    check('healthy deploy reports ok', !!good.json && good.json.ok === true);
    check('live link check ran and passed', !!good.json && good.json.liveLinks && good.json.liveLinks.ok === true);
    check('smoke pass covered every default route', !!good.json && Array.isArray(good.json.checks) && good.json.checks.length === 8, good.json ? String(good.json.checks.length) : 'no json');
    check('every smoke check passed', !!good.json && (good.json.checks || []).every((c) => c.ok));

    const bad = await run(['--json', '--routes=/index.html,/definitely-missing-page.html'], base);
    check('bad deploy exits 1', bad.status === 1, 'exit=' + bad.status);
    check('bad deploy reports not ok', !!bad.json && bad.json.ok === false);
    check('bad deploy names the failed route', !!bad.json && (bad.json.failures || []).some((f) => /definitely-missing-page/.test(f)), bad.json ? JSON.stringify(bad.json.failures) : 'no json');

    const dry = await run(['--dry-run'], base);
    check('dry run exits 0', dry.status === 0, 'exit=' + dry.status);
    check('dry run prints the live link plan', /links:/i.test(dry.out) && /validate-links-live/.test(dry.out));
    check('dry run prints the smoke routes', /smoke:/i.test(dry.out) && /\/arcade\.html/.test(dry.out));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  if (failures) {
    console.log('\n' + failures + ' CHECK(S) FAILED');
    process.exit(1);
  }
  console.log('\nALL POST-DEPLOY CHECK TESTS PASSED');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
