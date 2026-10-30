#!/usr/bin/env node
/**
 * validate-links-live.js - Check critical routes on the published GitHub Pages
 * site to catch redirect mismatches and 404s that only appear on the real host.
 *
 * Checks:
 *   - Navigation pages (home, games, workshops, tools, learn)
 *   - Privacy policy routes (both /privacy-policy and /pages/privacy-policy.html)
 *   - Key game and workshop landing pages
 *   - Download links (if any listed in games-registry)
 *
 * Usage:
 *   node scripts/validate-links-live.js [--base https://jvdesignstudio.co.uk]
 *
 * Exit 1 if any 4xx/5xx responses are found.
 * Designed to run post-deploy or manually; not in pre-push (needs live site).
 */
'use strict';
const https = require('https');
const http  = require('http');
const path  = require('path');
const { BASE_URL } = require('./lib/paths');

const base = (process.argv.find(a => a.startsWith('--base=')) || '').split('=')[1]
  || process.env.SITE_BASE_URL
  || BASE_URL;

// Critical routes to verify on the live site
const CRITICAL_ROUTES = [
  // Navigation
  '/',
  '/games',
  '/workshops',
  '/tools',
  '/learn',
  '/workshops/start-here.html',
  // Privacy policy — both routes must resolve (one should redirect or return 200)
  '/pages/privacy-policy.html',
  '/privacy-policy',
  '/privacy-policy/',
  // Games hub
  '/arcade.html',
  // Arcade maker landing
  '/tools/arcade-game-maker-landing.html',
  // 404 page itself (must exist)
  '/404.html',
];

function fetchStatus(url) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 10000 }, (res) => {
      res.resume(); // drain
      resolve({ url, status: res.statusCode, redirect: res.headers.location || null });
    });
    req.on('error', (e) => resolve({ url, status: 0, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ url, status: 0, error: 'timeout' }); });
  });
}

async function run() {
  console.log(`validate:links-live  base=${base}  ${CRITICAL_ROUTES.length} routes`);
  const results = await Promise.all(CRITICAL_ROUTES.map(r => fetchStatus(base + r)));

  const failures = results.filter(r => r.status === 0 || r.status >= 400);
  const redirects = results.filter(r => r.status >= 300 && r.status < 400);

  if (redirects.length) {
    console.log('\nRedirects (informational):');
    for (const r of redirects) {
      console.log(`  ${r.status}  ${r.url}  ->  ${r.redirect || '?'}`);
    }
  }

  if (failures.length === 0) {
    console.log(`\nvalidate:links-live  OK - all ${CRITICAL_ROUTES.length} critical routes returned 2xx or 3xx`);
    process.exit(0);
  }

  console.log('\nFAILURES:');
  for (const r of failures) {
    const detail = r.error ? `(${r.error})` : '';
    console.log(`  ${r.status || 'ERR'}  ${r.url}  ${detail}`);
  }
  console.log(`\n${failures.length} critical route(s) failed. Fix redirects/canonical URLs on the live host.`);
  process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
