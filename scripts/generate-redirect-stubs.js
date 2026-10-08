#!/usr/bin/env node
/**
 * scripts/generate-redirect-stubs.js (A670)
 *
 * Single source: redirects.json. Renders the thin noindex redirect stubs in
 * tools/*.html and patches the matching 404.html clean-URL route lines.
 * Stubs forward search + hash to the merged tool (plus a default mode hash
 * where the merged tool has one). Run: npm run build:redirects
 * Check only (CI): node scripts/generate-redirect-stubs.js --check
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY = path.join(ROOT, 'redirects.json');
const PAGE_404 = path.join(ROOT, '404.html');
const MARK = '// redirects.json';

function stubFor(from, r) {
  const toFile = path.relative(path.dirname(from), r.to).split(path.sep).join('/');
  const canonical = 'https://jvdesignstudio.co.uk/' + r.to;
  const hashFrag = r.hash ? '#' + r.hash : '';
  const title = `${r.name} moved to ${r.merged} | JVDesignStudio`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="${canonical}">
<link rel="manifest" href="../manifest.json">
<meta name="theme-color" content="${r.theme}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' blob: https://www.googletagmanager.com https://www.google-analytics.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; media-src 'self' https: blob:; connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://labs.phaser.io https://is.gd; frame-src 'self' blob: https://www.youtube.com https://www.youtube-nocookie.com https://itch.io; object-src 'none'; base-uri 'self'; form-action 'self' https://formspree.io; worker-src 'self' blob:; child-src 'self' blob:">
<script>(function(){try{var t=localStorage.getItem('jvds-theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();</script>
<title>${title}</title>
<meta name="description" content="${r.description}">
<meta property="og:type" content="website">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${title}">
<meta property="og:image" content="${r.ogImage}">
<link rel="icon" href="../logo.png" type="image/png">
<!-- BUILD:head-icons -->
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" href="/icons/icon-192.png" sizes="192x192">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<!-- /BUILD:head-icons -->
<script>location.replace("${toFile}"+location.search+(location.hash||"${hashFrag}"));</script>
<meta http-equiv="refresh" content="0; url=${toFile}${hashFrag}">
<script defer src="../analytics-loader.js"></script>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0a0514;color:#f0ead6;font-family:Inter,system-ui,sans-serif;text-align:center;padding:24px}a{color:#f5c842;font-weight:700}</style>
</head>
<body>
<p>${r.name} is now part of <a href="${toFile}">${r.merged}</a>.<br>Redirecting…</p>
<script defer src="/feedback-widget.js"></script>
<script defer src="/jvds-funnel.js"></script>
<script defer src="/creation-share.js"></script>
</body>
</html>
`;
}

function patch404(src, redirects) {
  const lines = src.split('\n');
  let patched = 0;
  const out = lines.map((line) => {
    for (const [from, r] of Object.entries(redirects)) {
      const key = '/' + from.replace(/\.html$/, '');
      const m = line.match(new RegExp(`^(\\s*'${key.replace(/\//g, '\\/')}'\\s*:)(\\s*)'[^']*'(,)(\\s*(?://.*)?)$`));
      if (m) {
        patched++;
        return `${m[1]}${m[2]}'/${r.to}'${m[3]}${MARK ? ' ' + MARK : ''}`;
      }
    }
    return line;
  });
  return { src: out.join('\n'), patched };
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const reg = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
  const redirects = reg.redirects;
  const failures = [];

  for (const [from, r] of Object.entries(redirects)) {
    for (const f of [from, r.to]) {
      if (!fs.existsSync(path.join(ROOT, f))) failures.push(`missing file ${f}`);
    }
    if (!r.name || !r.merged || !r.theme || !r.description || !r.ogImage) {
      failures.push(`${from}: incomplete registry entry`);
    }
  }
  if (failures.length) {
    failures.forEach((f) => console.log(`  [FAIL] ${f}`));
    process.exit(1);
  }

  let changed = [];
  for (const [from, r] of Object.entries(redirects)) {
    const file = path.join(ROOT, from);
    const want = stubFor(from, r);
    const have = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (have !== want) {
      changed.push(from);
      if (!checkOnly) fs.writeFileSync(file, want);
    }
  }

  const src404 = fs.readFileSync(PAGE_404, 'utf8');
  const { src: want404, patched } = patch404(src404, redirects);
  const expectedKeys = Object.keys(redirects).length;
  if (patched !== expectedKeys) {
    console.log(`  [FAIL] 404.html: patched ${patched} route lines, expected ${expectedKeys}`);
    process.exit(1);
  }
  if (src404 !== want404) {
    changed.push('404.html');
    if (!checkOnly) fs.writeFileSync(PAGE_404, want404);
  }

  if (checkOnly) {
    if (changed.length) {
      console.log(`  [FAIL] drift: ${changed.join(', ')} differs from redirects.json output`);
      process.exit(1);
    }
    console.log(`  [PASS] redirects in sync (${expectedKeys} stubs + 404 routes)`);
    return;
  }
  console.log(`  [OK] redirects: ${expectedKeys} stubs verified, ${changed.length ? 'wrote ' + changed.join(', ') : 'no changes needed'}`);
}

main();
