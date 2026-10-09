#!/usr/bin/env node
// A964: icon-only controls must have an accessible name.
// The shared game shell gives #soundBtn a spoken name at runtime, so games that
// define an icon-only sound button must load game-shell.js. Direct controls
// (for example the Story Editor passage search) must carry aria-label inline.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' -- ' + extra : ''));
  if (!cond) failures++;
};

const shell = fs.readFileSync(path.join(ROOT, 'game-shell.js'), 'utf8');
ok('game-shell.js names the icon-only sound button', /getElementById\('soundBtn'\)[\s\S]{0,200}aria-label/.test(shell));

const gameDir = path.join(ROOT, 'games');
const soundGames = [];
for (const f of fs.readdirSync(gameDir)) {
  if (!f.endsWith('.html')) continue;
  const html = fs.readFileSync(path.join(gameDir, f), 'utf8');
  if (!/id=["']soundBtn["']/.test(html)) continue;
  soundGames.push(f);
  const inlineNamed = /<button[^>]*id=["']soundBtn["'][^>]*(aria-label|aria-labelledby|title)=/i.test(html);
  const loadsShell = /game-shell\.js/.test(html);
  ok('games/' + f + ': sound button has a name (inline or via game-shell.js)', inlineNamed || loadsShell,
    inlineNamed ? 'inline label' : (loadsShell ? 'game-shell.js' : 'no name and no game-shell.js'));
}
ok('found the games that use #soundBtn', soundGames.length >= 6, soundGames.length + ' games: ' + soundGames.join(', '));

const story = fs.readFileSync(path.join(ROOT, 'tools', 'story-editor.html'), 'utf8');
ok('tools/story-editor.html: passage search has an accessible name',
  /id=["']drawerSearch["'][^>]*(aria-label|aria-labelledby)/i.test(story));

console.log(failures === 0 ? 'ALL A11Y CONTROL-LABEL CHECKS PASSED' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
