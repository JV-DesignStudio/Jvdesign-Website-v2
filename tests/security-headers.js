#!/usr/bin/env node
// tests/security-headers.js (A781): production security headers + redirects gate.
//
// Checks the repo delivers what it can without DNS/host access:
//  1. _headers is production-ready (no NOT APPLIED marker) and carries HSTS,
//     X-Content-Type-Options, X-Frame-Options SAMEORIGIN, Referrer-Policy,
//     Permissions-Policy and a CSP whose frame rules allow the site's own
//     same-origin game wrappers, workshop srcdoc previews and YouTube/itch
//     embeds (frame-ancestors 'self', frame-src allowlist; DENY/'none'
//     would break Play/Create, see games/lumo-dash-page.html).
//  2. _redirects is production-ready with at least one working 301 whose
//     target exists, and tool stubs match redirects.json (A670).
//  3. Every full HTML page carries the meta CSP + referrer fallback (GitHub
//     Pages ignores _headers), exactly once, in sync with _headers.
// Exit 0 PASS, 1 FAIL with [FAIL] lines.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let fails = 0;
const ok = (m) => console.log('  [OK] ' + m);
const fail = (m) => { fails++; console.log('  [FAIL] ' + m); };

// --- 1. _headers ---
const headers = fs.readFileSync(path.join(ROOT, '_headers'), 'utf8');
if (/NOT APPLIED/.test(headers)) fail('_headers still carries a NOT APPLIED marker');
else ok('_headers has no NOT APPLIED marker');
for (const h of ['Strict-Transport-Security', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy', 'Content-Security-Policy']) {
  if (headers.includes(h)) ok('_headers carries ' + h);
  else fail('_headers missing ' + h);
}
if (/X-Frame-Options:\s*SAMEORIGIN/.test(headers)) ok('X-Frame-Options SAMEORIGIN (DENY would break same-origin game wrappers)');
else fail('X-Frame-Options must be SAMEORIGIN');
const cspLine = headers.split('\n').find((l) => l.includes('Content-Security-Policy')) || '';
const csp = cspLine.replace(/^\s*Content-Security-Policy:\s*/, '').trim();
for (const d of ["default-src 'self'", "script-src", 'frame-ancestors', 'frame-src', "object-src 'none'", "base-uri 'self'"]) {
  if (csp.includes(d)) ok('header CSP has ' + d);
  else fail('header CSP missing ' + d);
}
if (csp.includes("frame-ancestors 'self'")) ok("header CSP frame-ancestors 'self'");
else fail("header CSP frame-ancestors must be 'self' ('none' blocks same-origin game wrappers)");
if (csp.includes("frame-src 'none'")) fail("header CSP frame-src 'none' blocks game wrappers + workshop previews + video embeds");
else ok('header CSP frame-src allows same-origin + video/itch embeds');
for (const host of ['https://www.youtube.com', 'https://itch.io']) {
  if (csp.includes(host)) ok('header CSP frame-src allows ' + host);
  else fail('header CSP frame-src missing ' + host);
}
// A798: runtime third parties the tools really use (blocked by the first
// A781 draft, caught by tests/arcade-game-maker-smoke.js). web-vitals loads
// as a script after consent; Phaser default sprites and the is.gd shortener
// fetch over connect-src; the footer newsletter posts to Formspree.
for (const host of ['https://unpkg.com', 'https://labs.phaser.io', 'https://is.gd']) {
  if (csp.includes(host)) ok('header CSP allows runtime host ' + host);
  else fail('header CSP missing runtime host ' + host);
}
if (csp.includes("form-action 'self' https://formspree.io")) ok('header CSP form-action allows the newsletter');
else fail('header CSP form-action must allow https://formspree.io');

// --- 2. _redirects ---
const redirects = fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8');
if (/NOT APPLIED|ignores this file/.test(redirects)) fail('_redirects still carries a NOT APPLIED marker');
else ok('_redirects has no NOT APPLIED marker');
const rules = redirects.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
const r301 = rules.filter((l) => /\s301!?(\s|$)/.test(l));
if (r301.length >= 1) ok(r301.length + ' 301 rule(s), e.g. ' + r301[0].split(/\s+/).slice(0, 2).join(' -> '));
else fail('no 301 rule in _redirects');
for (const r of r301) {
  const to = r.split(/\s+/)[1];
  const file = path.join(ROOT, to.replace(/^\//, ''));
  if (fs.existsSync(file)) ok('redirect target exists: ' + to);
  else fail('redirect target missing: ' + to);
}
try {
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'redirects.json'), 'utf8')).redirects;
  for (const [from, entry] of Object.entries(reg)) {
    const want = '/' + from + ' /' + entry.to + ' 301';
    if (redirects.includes('/' + from) && redirects.includes('/' + entry.to)) ok('tools stub mirrored: ' + want);
    else fail('tools stub missing from _redirects: ' + want);
  }
} catch (e) { fail('redirects.json unreadable: ' + e.message); }

// --- 3. meta CSP + referrer on every full page ---
function walk(d, out) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === '.git' || e.name === 'tmp') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}
const pages = walk(ROOT, []).filter((p) => !p.includes(path.sep + 'partials' + path.sep));
let withCsp = 0;
const missing = [];
const dupes = [];
for (const p of pages) {
  const s = fs.readFileSync(p, 'utf8');
  if (!s.includes('<head')) continue; // fragment, not a full page
  const count = s.split('http-equiv="Content-Security-Policy"').length - 1;
  if (count === 0) { missing.push(path.relative(ROOT, p)); continue; }
  if (count > 1) { dupes.push(path.relative(ROOT, p)); continue; }
  withCsp++;
  const m = s.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/);
  const meta = m ? m[1] : '';
  if (meta.includes('frame-ancestors')) {
    fail('meta CSP must not carry frame-ancestors in ' + path.relative(ROOT, p) + ' (browsers ignore it in <meta> and log noise)');
  } else if (!meta.includes("frame-src 'self'") || meta.includes("frame-src 'none'")) {
    fail('stale meta CSP in ' + path.relative(ROOT, p));
  }
  if (!s.includes('name="referrer"')) fail('missing referrer meta in ' + path.relative(ROOT, p));
}
if (missing.length) fail('pages without meta CSP (' + missing.length + '): ' + missing.slice(0, 5).join(', '));
else ok('meta CSP on ' + withCsp + ' full pages (more than the homepage)');
if (dupes.length) fail('duplicate meta CSP in: ' + dupes.slice(0, 5).join(', '));
else ok('no duplicate meta CSP');
if (!csp || !pages.length) fail('empty inputs');
else {
  // Meta fallback equals the header CSP minus frame-ancestors (meta-ignored, logs noise).
  const expectedMeta = csp.replace(/frame-ancestors 'self';\s*/g, '');
  const sample = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/);
  if (sample && sample[1] === expectedMeta) ok('index.html meta CSP matches _headers CSP (minus frame-ancestors)');
  else fail('index.html meta CSP differs from _headers CSP');
}

// --- 4. single policy: partial + stub template match _headers (minus frame-ancestors) ---
const expectedMeta = csp.replace(/frame-ancestors 'self';\s*/g, '');
for (const src of ['partials/head-icons.html', 'scripts/generate-redirect-stubs.js']) {
  const body = fs.readFileSync(path.join(ROOT, src), 'utf8');
  const m = body.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/);
  if (m && m[1] === expectedMeta) ok(src + ' meta CSP matches _headers');
  else fail(src + ' meta CSP differs from _headers');
}

console.log(fails ? '\nsecurity-headers: FAIL (' + fails + ')' : '\nsecurity-headers: PASS');
process.exit(fails ? 1 : 0);
