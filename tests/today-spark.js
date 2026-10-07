// today-spark.js - A801. Asserts the daily/weekly challenge spark is mounted
// on the homepage and the hubs, and that the arcade still carries both.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

let fail = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) fail++; };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const FULL = [
  'index.html',
  'pages/dev-tools.html',
  'pages/books.html',
  'pages/learn-hub.html',
  'learn/scratch-for-kids.html',
  'learn/make-a-game-on-a-school-chromebook.html',
  'learn/godot-for-beginners.html',
  'learn/roblox-studio-beginner-tutorials.html',
  'learn/python-games-for-kids.html',
];
const WEEKLY = ['pages/workshop.html', 'pages/games.html', 'me.html'];

for (const f of FULL) {
  const h = read(f);
  ok(f + ': daily-challenge.js', h.includes('daily-challenge.js'));
  ok(f + ': weekly-challenge.js', h.includes('weekly-challenge.js'));
  ok(f + ': today spark slot', h.includes('jvds-today-spark'));
  ok(f + ': player-profile.js', h.includes('player-profile.js'));
}
for (const f of WEEKLY) {
  const h = read(f);
  ok(f + ': weekly-challenge.js', h.includes('weekly-challenge.js'));
  ok(f + ': today spark slot', h.includes('jvds-today-spark'));
}

const arcade = read('arcade.html');
ok('arcade.html: daily + weekly', arcade.includes('daily-challenge.js') && arcade.includes('weekly-challenge.js'));

console.log(fail === 0 ? '\nALL TODAY-SPARK CHECKS PASSED' : '\n' + fail + ' FAILURES');
process.exit(fail ? 1 : 0);
