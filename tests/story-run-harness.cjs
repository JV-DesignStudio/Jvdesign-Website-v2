#!/usr/bin/env node
/*
 * tests/story-run-harness.cjs , shared browser harness for the StoryRun tests
 *
 * The four StoryRun suites (story-run-smoke, story-run-games, story-run-games-deep,
 * story-run-cosy, story-run-cosy-deep) used to each copy-paste their own static
 * server and puppeteer launch. That duplication caused a real problem: several
 * suites bound fixed, overlapping ports (SRG_PORT was read by two different
 * suites, plus hardcoded 8199/8138) and none handled the server 'error' event,
 * so two runs at once could collide on EADDRINUSE and hang instead of failing
 * clearly. See the A587 bot-fail streak for the symptom.
 *
 * This harness fixes the class of bug in one place:
 *   - binds an ephemeral port (listen(0)) so concurrent runs never collide
 *   - fails fast with a clear message if the server cannot start
 *   - serves the repo root with correct MIME types
 *   - hands every suite the same launch/goto/dispose lifecycle
 *
 * Usage:
 *   const { withServer } = require('./story-run-harness.cjs');
 *   await withServer(async ({ base, browser }) => { ... });
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav', '.txt': 'text/plain', '.xml': 'application/xml'
};

// Serve the repo root, refusing path traversal. One server per process, on an
// ephemeral port, so parallel suites can never fight over a fixed port.
function createServer() {
  return http.createServer((req, res) => {
    let p;
    try { p = path.resolve(ROOT, '.' + decodeURIComponent(req.url.split('?')[0])); }
    catch { res.writeHead(400); return res.end(); }
    if (!p.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(p, (e, b) => {
      res.writeHead(e ? 404 : 200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' });
      res.end(e ? '' : b);
    });
  });
}

// Start the server on an ephemeral port and resolve with its base URL. Rejects
// clearly (instead of hanging) if the port cannot be bound.
function listen(server) {
  return new Promise((resolve, reject) => {
    const onError = (e) => { server.removeListener('listening', onOk); reject(new Error('story-run server failed to start: ' + e.message)); };
    const onOk = () => { server.removeListener('error', onError); resolve('http://127.0.0.1:' + server.address().port); };
    server.once('error', onError);
    server.once('listening', onOk);
    server.listen(0, '127.0.0.1');
  });
}

// Launch puppeteer, run the suite body, and always tear both down. `fn` gets
// { base, browser, server }. Any throw still closes the browser and server.
async function withServer(fn, launchOpts) {
  const puppeteer = require('puppeteer');
  const server = createServer();
  const base = await listen(server);
  let browser;
  try {
    browser = await puppeteer.launch(Object.assign({ headless: 'new', args: ['--no-sandbox'] }, launchOpts));
    return await fn({ base, browser, server });
  } finally {
    if (browser) await browser.close().catch(() => {});
    await new Promise(r => server.close(r));
  }
}

// Atomic JSON write for the audit pipeline. The old suites wrote straight to
// <ARCADE_QA_OUT>/depth-results.json, so two suites sharing that dir could leave
// a half-written file. Writing to a temp name then renaming is atomic on the same
// volume and keeps one suite's result from clobbering another mid-write.
function writeResults(dir, name, data) {
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, name);
  const tmp = target + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, target);
}

module.exports = { ROOT, MIME, createServer, listen, withServer, writeResults };
