#!/usr/bin/env node
/**
 * scripts/post-deploy-check.js (A2654)
 *
 * Post-deploy verification for the published site. Local tests cannot catch a
 * bad deploy, so after landing a change this runs:
 *   1. scripts/validate-links-live.js against the live base, then
 *   2. a short smoke pass over the pages learners reach first.
 *
 * Usage:
 *   node scripts/post-deploy-check.js [--base=https://jvdesignstudio.co.uk]
 *                                     [--routes=/a.html,/b.html]
 *                                     [--no-live-links] [--json] [--dry-run]
 *                                     [--timeout=10000]
 *
 * Exit 1 if the live link check or any smoke route fails. With --json it prints
 * one POST_DEPLOY_RESULT line that can be pasted into the landed card's
 * evidence.
 */
'use strict';
const http = require('http');
const https = require('https');
const path = require('path');
const { spawnSync } = require('child_process');
const { BASE_URL } = require('./lib/paths');

const arg = (name) => {
  const hit = process.argv.find((a) => a.startsWith('--' + name + '='));
  return hit ? hit.split('=').slice(1).join('=') : '';
};
const has = (name) => process.argv.includes('--' + name);

const BASE = (arg('base') || process.env.SITE_BASE_URL || BASE_URL || '').replace(/\/+$/, '');
const TIMEOUT = Number(arg('timeout')) || 10000;
const JSON_OUT = has('json');
const DRY_RUN = has('dry-run');
const LIVE_LINKS = !has('no-live-links');
const ROUTES = (arg('routes') || '/,/create,/arcade.html,/books,/tools/pixel-studio.html,/games/cozy-cafe-match-game.html,/pages/privacy-policy.html,/404.html')
  .split(',')
  .map((r) => r.trim())
  .filter(Boolean);

function fetchStatus(url) {
  return new Promise((resolve) => {
    let mod;
    try { mod = url.startsWith('https') ? https : http; } catch (e) { return resolve({ url, status: 0, error: e.message }); }
    const req = mod.get(url, { timeout: TIMEOUT }, (res) => {
      const chunks = [];
      let size = 0;
      res.on('data', (c) => {
        if (size < 4096) { chunks.push(c); size += c.length; }
      });
      res.on('end', () => resolve({
        url,
        status: res.statusCode,
        type: String(res.headers['content-type'] || ''),
        body: Buffer.concat(chunks).toString('utf8')
      }));
    });
    req.on('error', (e) => resolve({ url, status: 0, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ url, status: 0, error: 'timeout' }); });
  });
}

function smokePass() {
  return Promise.all(ROUTES.map((route) => fetchStatus(BASE + route).then((r) => {
    const problems = [];
    if (r.status === 0) problems.push(r.error || 'no response');
    else if (r.status >= 400) problems.push('HTTP ' + r.status);
    else if (r.status < 300) {
      if (!/text\/html/i.test(r.type || '')) problems.push('content-type ' + (r.type || 'missing'));
      if (r.body && !/<html|<!doctype/i.test(r.body)) problems.push('not an HTML document');
      if (r.body && !/JVDesignStudio|jvdesignstudio/i.test(r.body)) problems.push('missing site marker');
    }
    return { route, url: r.url, status: r.status, ok: problems.length === 0, problems };
  })));
}

function runLiveLinks() {
  const script = path.join(__dirname, 'validate-links-live.js');
  const res = spawnSync(process.execPath, [script, '--base=' + BASE], { encoding: 'utf8', timeout: 120000 });
  return {
    ok: res.status === 0,
    status: res.status === null ? -1 : res.status,
    output: ((res.stdout || '') + (res.stderr || '')).trim().split('\n').slice(-6).join('\n')
  };
}

async function main() {
  if (DRY_RUN) {
    console.log('post-deploy-check (dry run)');
    console.log('  base:   ' + (BASE || '<unset>'));
    console.log('  links:  ' + (LIVE_LINKS ? 'scripts/validate-links-live.js --base=' + BASE : 'skipped'));
    console.log('  smoke:  ' + ROUTES.join(', '));
    if (!BASE) { console.error('  FAIL: no base URL (pass --base= or set SITE_BASE_URL)'); process.exit(1); }
    console.log('  OK: plan is valid');
    return;
  }
  if (!BASE) { console.error('post-deploy-check: no base URL (pass --base= or set SITE_BASE_URL)'); process.exit(1); }

  const result = { base: BASE, ok: true, liveLinks: null, checks: [], failures: [] };

  if (LIVE_LINKS) {
    const live = runLiveLinks();
    result.liveLinks = { ok: live.ok, status: live.status };
    if (!live.ok) {
      result.ok = false;
      result.failures.push('validate-links-live failed (exit ' + live.status + ')');
    }
    console.log((live.ok ? 'PASS ' : 'FAIL ') + 'live link check' + (live.ok ? '' : ' -> ' + live.output));
  }

  const checks = await smokePass();
  result.checks = checks.map((c) => ({ route: c.route, status: c.status, ok: c.ok }));
  for (const c of checks) {
    console.log((c.ok ? 'PASS ' : 'FAIL ') + 'smoke ' + c.route + ' [' + c.status + ']' + (c.ok ? '' : ' -> ' + c.problems.join('; ')));
    if (!c.ok) {
      result.ok = false;
      result.failures.push(c.route + ' (' + c.problems.join('; ') + ')');
    }
  }

  console.log(result.ok ? '\nPOST-DEPLOY PASS' : '\nPOST-DEPLOY FAIL');
  if (JSON_OUT) console.log('POST_DEPLOY_RESULT ' + JSON.stringify(result));
  process.exit(result.ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
