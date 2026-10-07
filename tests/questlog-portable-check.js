// A702: QuestLog portable reconciliation guard. Verifies every shipped build
// (PWA, Capacitor www, Android assets) is generated from the canonical
// questlog-app/v2/index.html portable source with no rich-app leftovers, the
// store listing matches the portable feature set, screenshots are 1080x1920,
// and a signed portable bundle exists. Pure Node, no browser.
const fs = require('fs');
const path = require('path');

const SITE = path.resolve(__dirname, '..');
const APP = path.join(SITE, '..', 'questlog-app');
const PWA = path.join(SITE, '..', 'yourquestlog');

let failures = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' -- ' + extra : ''));
  if (!cond) failures++;
};

const read = (p) => fs.readFileSync(p, 'utf8');
const exists = (p) => fs.existsSync(p);

const SRC = path.join(APP, 'v2', 'index.html');
ok('canonical portable source exists', exists(SRC));
const src = exists(SRC) ? read(SRC) : '';
ok('source is the portable planner', src.includes('Portable Game Planner') && src.includes('qb-data-v1'));
ok('source has no rich-app markers', !src.includes('boss-hp-fill') && !src.includes('RAIDS'));

// Every build output must carry the portable markers and no rich markers.
for (const [label, p] of [
  ['PWA yourquestlog/index.html', path.join(PWA, 'index.html')],
  ['Capacitor www/index.html', path.join(APP, 'www', 'index.html')],
  ['Android assets public/index.html', path.join(APP, 'android', 'app', 'src', 'main', 'assets', 'public', 'index.html')],
]) {
  ok(label + ' exists', exists(p));
  if (!exists(p)) continue;
  const h = read(p);
  ok(label + ' is portable', h.includes('Portable Game Planner') && h.includes('qb-data-v1'));
  ok(label + ' has no rich leftovers', !h.includes('boss-hp-fill') && !h.includes('RAIDS'));
}

// PWA meta must not advertise retired boss challenges.
const pwa = exists(path.join(PWA, 'index.html')) ? read(path.join(PWA, 'index.html')) : '';
ok('PWA meta matches portable set', pwa.includes('Three columns') && !pwa.includes('boss challenges'));

// Store listing must describe the portable app, not the retired rich one.
const listingPath = path.join(APP, 'store-assets', 'listing.md');
ok('store listing exists', exists(listingPath));
const listing = exists(listingPath) ? read(listingPath).toLowerCase() : '';
for (const retired of ['boss quest', 'habits that stick', 'streak', 'review/done', 'up next', 'boss hp', 'raids']) {
  ok('listing drops retired "' + retired + '"', !listing.includes(retired), '');
}
for (const live of ['to do, in progress, complete', '50 xp', 'export', 'import', 'offline', 'no account']) {
  ok('listing names live feature "' + live + '"', listing.includes(live));
}

// Screenshots: the four portable shots at Play phone size, no stale rich shots.
const shots = ['screenshot-1-board.png', 'screenshot-2-today.png', 'screenshot-3-complete.png', 'screenshot-4-settings.png'];
const stale = ['screenshot-1-dashboard.png', 'screenshot-3-habits.png', 'screenshot-4-character.png'];
const sizeOf = (p) => {
  const b = Buffer.alloc(24);
  const fd = fs.openSync(p, 'r');
  fs.readSync(fd, b, 0, 24, 0);
  fs.closeSync(fd);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};
for (const s of shots) {
  const p = path.join(APP, 'store-assets', s);
  ok('shot exists: ' + s, exists(p));
  if (exists(p)) {
    const [w, h] = sizeOf(p);
    ok(s + ' is 1080x1920', w === 1080 && h === 1920, w + 'x' + h);
  }
}
for (const s of stale) {
  ok('stale rich shot removed: ' + s, !exists(path.join(APP, 'store-assets', s)));
}

// Signed portable bundle from the current source.
ok('signed portable bundle exists', exists(path.join(APP, 'release', 'QuestLog-1.0-portable.aab')));

console.log(failures === 0 ? 'ALL QUESTLOG PORTABLE CHECKS PASSED' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
