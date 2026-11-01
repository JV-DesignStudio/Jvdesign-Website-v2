// A786/A2026: privacy policy must name every data party, carry a children
// section, agree with the per-app policies, use rel=noopener on outbound
// links, and cover every third-party host the public pages actually load.
// Pure Node, no browser.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const POLICY = path.join(ROOT, 'pages', 'privacy-policy.html');
const html = fs.readFileSync(POLICY, 'utf8');

let failures = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' -- ' + extra : ''));
  if (!cond) failures++;
};

const lower = html.toLowerCase();
for (const term of ['formspree', 'ga4', 'google fonts', 'admob', 'open-meteo', 'jsdelivr', 'is.gd', 'web-vitals']) {
  ok('policy names "' + term + '"', lower.includes(term));
}
ok('policy has a children section', /<h2>[^<]*children/i.test(html));
ok('policy mentions parental consent', /parental consent|parent, guardian or teacher|parents and teachers/i.test(html));
ok('policy mentions cookie consent withdrawal', /cookie settings/i.test(html));

// Every target=_blank link must carry rel=noopener.
const blanks = [...html.matchAll(/<a[^>]*target="_blank"[^>]*>/gi)].map((m) => m[0]);
ok('policy has outbound blank links to check', blanks.length >= 1, 'found ' + blanks.length);
const withoutNoopener = blanks.filter((a) => !/rel="[^"]*noopener/i.test(a));
ok('all target=_blank links use rel=noopener', withoutNoopener.length === 0,
  withoutNoopener.slice(0, 2).join(' ') || 'all covered');

// Agreement with per-app policies: the main page must point at each one,
// and each per-app page must exist with a matching ads/no-ads statement.
const appPages = {
  'biscuit-tin-privacy.html': 'admob',
  'cozy-cafe-privacy.html': 'admob',
  'sky-high-squirt-privacy.html': 'admob',
  'questlog-privacy.html': 'no adverts and no analytics',
  'arcade-privacy.html': 'no adverts and no analytics',
  'game-maker-privacy.html': 'no adverts and no analytics',
  'pocket-crew-privacy.html': 'no analytics',
};
for (const [file, marker] of Object.entries(appPages)) {
  const p = path.join(ROOT, 'pages', file);
  ok('per-app page exists: ' + file, fs.existsSync(p));
  if (fs.existsSync(p)) {
    const body = fs.readFileSync(p, 'utf8').toLowerCase();
    ok(file + ' matches main policy on "' + marker + '"', body.includes(marker));
  }
  const slug = '/' + file.replace('.html', '');
  ok('main policy links to ' + slug, html.includes(slug));
}
// Cozy Cafe weather alignment.
const cozy = fs.readFileSync(path.join(ROOT, 'pages', 'cozy-cafe-privacy.html'), 'utf8').toLowerCase();
ok('cozy page names open-meteo', cozy.includes('open-meteo'));

// A2026 release trigger: every third-party host a public page loads must be
// named in the policy. A new CDN or analytics host fails the release gate until
// the policy (and this map) are updated.
const HOST_TERMS = {
  'fonts.googleapis.com': 'google fonts',
  'fonts.gstatic.com': 'google fonts',
  'www.googletagmanager.com': 'ga4',
  'www.google-analytics.com': 'ga4',
  'cdn.jsdelivr.net': 'jsdelivr',
  'unpkg.com': 'unpkg',
  'cdnjs.cloudflare.com': 'cdnjs',
  'api.open-meteo.com': 'open-meteo',
};
const SKIP_DIRS = new Set(['node_modules', '.git', '.worktrees', '.claude', 'tmp', 'reports', 'generated-images', 'downloads', 'social-posts', 'quest-board-deploy']);
const hostFiles = new Map();
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(p);
    } else if (entry.name.endsWith('.html')) {
      const body = fs.readFileSync(p, 'utf8');
      for (const m of body.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["'](https?:\/\/([^"'/]+)[^"']*)["']/gi)) {
        const host = m[2].toLowerCase();
        if (/jvdesignstudio\.co\.uk$/.test(host)) continue;
        if (!hostFiles.has(host)) hostFiles.set(host, new Set());
        hostFiles.get(host).add(path.relative(ROOT, p));
      }
    }
  }
})(ROOT);
for (const [host, files] of hostFiles) {
  const term = HOST_TERMS[host];
  const covered = !!term && lower.includes(term);
  ok('third-party host ' + host + ' is named in the policy', covered,
    covered ? [...files][0] : 'add it to pages/privacy-policy.html and HOST_TERMS (' + [...files].slice(0, 2).join(', ') + ')');
}

// No em/en dashes in the edited policy body (dash-guard).
const bodyOnly = html.slice(html.indexOf('<div class="container">'), html.indexOf('<!-- BUILD:footer-content -->'));
ok('no em/en dashes in policy body', !/[\u2013\u2014]/.test(bodyOnly));

console.log(failures === 0 ? 'ALL PRIVACY POLICY CHECKS PASSED' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
