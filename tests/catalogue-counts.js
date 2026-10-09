// catalogue-counts.js (A947): every displayed product count agrees with content/marketing.json,
// which itself is checked against the generated catalogue in content/stats.json.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const marketing = JSON.parse(read('content/marketing.json'));
const stats = JSON.parse(read('content/stats.json'));

let failures = 0;
const check = (name, ok, detail = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; };

// marketing displays must never overstate the generated catalogue
for (const key of ['workshops', 'games', 'tools', 'books']) {
  const num = parseInt(String(marketing[key].display).replace(/[^0-9]/g, ''), 10);
  check(`marketing.${key} "${marketing[key].display}" is within stats.${key} (${stats[key]})`, num <= stats[key], `${num} > ${stats[key]}`);
}

// headline stat elements on the four marketing pages must show the canonical display
const statRe = /class="[^"]*(?:hero-stat-num|stat-num|stat-val)[^"]*">\s*([^<]+?)\s*<\/div>\s*<div class="[^"]*(?:hero-stat-label|stat-label|stat-lbl)[^"]*">\s*([^<]+?)\s*<\/div>/g;
const entityOf = (label) => {
  const l = label.toLowerCase();
  if (/books?/.test(l)) return 'books';
  if (/workshops?/.test(l)) return 'workshops';
  if (/games?/.test(l)) return 'games';
  if (/tools?/.test(l)) return 'tools';
  return null;
};
for (const f of ['index.html', 'pages/about.html', 'pages/learn-hub.html', 'pages/parents.html']) {
  const html = read(f);
  let m;
  while ((m = statRe.exec(html))) {
    const value = m[1].trim().replace(/&amp;/g, '&');
    const ent = entityOf(m[2]);
    if (!ent) continue;
    check(`${f}: "${m[2].trim()}" shows "${value}" (expected "${marketing[ent].display}")`, value === marketing[ent].display);
  }
}

// catalogue pages state the same count
const gamesHtml = read('pages/games.html');
const gamesHeader = (gamesHtml.match(/id="gameResultCount"[^>]*>\s*([^<]+?)\s*</) || [])[1] || '';
check(`pages/games.html catalogue header "${gamesHeader.trim()}" matches marketing.games "${marketing.games.display}"`,
  parseInt(gamesHeader, 10) === parseInt(marketing.games.display, 10));
check('pages/games.html states prototypes are included', /playable browser games and experiments/i.test(gamesHtml));
check(`pages/dev-tools.html states the tools count "${marketing.tools.display}"`, read('pages/dev-tools.html').includes(marketing.tools.display));

// homepage JSON-LD must use the exact workshop count
const n = (read('index.html').match(/"numberOfItems"\s*:\s*(\d+)/) || [])[1];
check(`index.html numberOfItems ${n} matches stats.workshops ${stats.workshops}`, Number(n) === stats.workshops);

// no page may reintroduce a contradicting games count
for (const f of ['index.html', 'pages/about.html', 'pages/press.html', 'pages/parent-guide.html', 'pages/games.html']) {
  const bad = (read(f).match(/\b40\s+(?:free\s+|listed\s+|browser\s+)?games?/i) || [])[0];
  check(`${f}: no stale "40 games" copy`, !bad, bad || '');
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL CATALOGUE COUNT CHECKS PASSED');
process.exit(failures ? 1 : 0);
