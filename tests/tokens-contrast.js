#!/usr/bin/env node
/*
 * tests/tokens-contrast.js, checks the colour pairs in assets/css/tokens.css (A257).
 *
 * Reads the tokens file itself, follows var() chains, composites translucent
 * tints onto the ground they sit on, and measures WCAG contrast for every pair
 * the tokens are meant to be used in: light and dark theme, with no character
 * and with each data-character theme. Text pairs need 4.5:1. Exits 1 on a miss.
 *
 * Run: node tests/tokens-contrast.js
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'assets', 'css', 'tokens.css');
const css = fs.readFileSync(FILE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

function block(selector) {
  const out = {};
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    if (!m[1].split(',').map(s => s.trim()).includes(selector)) continue;
    m[2].replace(/--(jv-[\w-]+)\s*:\s*([^;]+);/g, (_, k, v) => { out[k] = v.trim(); });
  }
  return out;
}

function resolve(map, v, depth = 0) {
  if (depth > 20) throw new Error('var() loop at ' + v);
  const m = /^var\(--(jv-[\w-]+)\)$/.exec(v);
  if (!m) return v;
  if (!(m[1] in map)) throw new Error('undefined token --' + m[1]);
  return resolve(map, map[m[1]], depth + 1);
}

function colour(v) {
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (m) {
    let h = m[1];
    if (h.length === 3) h = h.replace(/./g, c => c + c);
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).concat(1);
  }
  m = /^rgba?\(([^)]+)\)$/.exec(v);
  if (m) { const p = m[1].split(',').map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
  throw new Error('not a colour: ' + v);
}

const over = (fg, bg) => [0, 1, 2].map(i => fg[3] * fg[i] + (1 - fg[3]) * bg[i]).concat(1);
const lum = c => {
  const g = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * g(c[0]) + 0.7152 * g(c[1]) + 0.0722 * g(c[2]);
};
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

let pass = 0;
const fails = [];
const tok = (map, name) => colour(resolve(map, 'var(--' + name + ')'));

// fg on bg, where bg may be a translucent tint lying on `under`
function check(label, map, fg, bg, under = 'jv-bg', need = 4.5) {
  const ground = over(tok(map, bg), tok(map, under));
  const r = ratio(over(tok(map, fg), ground), ground);
  if (r >= need) pass++;
  else fails.push(`${label}: --${fg} on --${bg}${bg.endsWith('soft') ? ' (over --' + under + ')' : ''} = ${r.toFixed(2)}:1, need ${need}`);
}

const CHARS = ['stardust', 'lumo', 'ember', 'pip', 'echo'];
const light = block(':root');
const themes = { light, dark: Object.assign({}, light, block('[data-theme="dark"]')) };
const GROUNDS = ['jv-bg', 'jv-surface', 'jv-surface-2'];
const TEXT = ['jv-text', 'jv-text-muted', 'jv-link', 'jv-accent-ink', 'jv-success', 'jv-warn', 'jv-danger'];

for (const [theme, base] of Object.entries(themes)) {
  TEXT.forEach(t => GROUNDS.forEach(g => check(theme, base, t, g)));
  check(theme, base, 'jv-on-accent', 'jv-accent');
  check(theme, base, 'jv-on-night', 'jv-night');
  check(theme, base, 'jv-on-night', 'jv-night-2');

  for (const who of ['(none)'].concat(CHARS)) {
    const own = who === '(none)' ? {} : block(`[data-character="${who}"]`);
    if (who !== '(none)' && !own['jv-char']) { fails.push(`${theme} ${who}: no [data-character="${who}"] theme`); continue; }
    const map = Object.assign({}, base, who === '(none)' ? {} : block('[data-character]'), own);
    const label = `${theme} ${who}`;
    GROUNDS.forEach(g => check(label, map, 'jv-char-ink', g));
    check(label, map, 'jv-char-ink', 'jv-char-soft', 'jv-bg');
    check(label, map, 'jv-char-ink', 'jv-char-soft', 'jv-surface');
    check(label, map, 'jv-char-on', 'jv-char');
  }
}

const colours = Object.values(light).filter(v => /^(#|rgba?\()/.test(v));
if (fails.length) {
  console.log(`✗ tokens-contrast: ${fails.length} pair(s) below WCAG AA (${pass} passed):`);
  fails.forEach(f => console.log('    ' + f));
  process.exit(1);
}
console.log(`✓ tokens-contrast: ${pass} pairs PASS WCAG AA across light + dark, no character + ${CHARS.length} character themes (${colours.length} colour values, ${new Set(colours.map(c => c.toUpperCase())).size} distinct)`);
