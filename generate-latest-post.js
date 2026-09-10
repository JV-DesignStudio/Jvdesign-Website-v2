#!/usr/bin/env node
/*
 * generate-latest-post.js , emits latest-post.json for the homepage banner.
 *
 * The homepage used to fetch the whole of pages/devlog.html (232KB) and regex it
 * for the newest entry, which was about a third of the homepage's total transfer
 * on every visit, for three lines of text. This writes the same three fields to a
 * ~250 byte file instead. devlog-data.js is the single source of truth (pages/devlog.html
 * and newsletter.html both load it). Falls back to pages/devlog.html if devlog-data.js missing.
 *
 * Run: node generate-latest-post.js   (npm run build:latest, and part of build)
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CANDIDATES = [path.join(ROOT, 'devlog-data.js'), path.join(ROOT, 'pages', 'devlog.html')];
const OUT = path.join(ROOT, 'latest-post.json');

function pick(src, field) {
  let m = src.match(new RegExp(field + "\\s*:\\s*'((?:[^'\\\\]|\\\\.)*)'"));
  if (!m) m = src.match(new RegExp(field + '\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"'));
  return m ? m[1].replace(/\\(['"])/g, '$1').replace(/\\\\/g, '\\') : null;
}

function parseDate(s) {
  // devlog-data uses '8 September 2026'; parse reliably without Date locale quirks
  const months = { january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11 };
  const m = String(s||'').trim().match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) return 0;
  const mon = months[m[2].toLowerCase()];
  if (mon == null) return 0;
  return Date.UTC(parseInt(m[3],10), mon, parseInt(m[1],10));
}

let SRC = null;
let srcText = null;
for (const p of CANDIDATES) {
  try { srcText = fs.readFileSync(p, 'utf8'); SRC = p; break; } catch {}
}
if (!srcText) { console.error('✗ generate-latest-post: no source found (tried devlog-data.js, pages/devlog.html)'); process.exit(1); }

const idx = srcText.indexOf('const POSTS');
if (idx < 0) { console.error('✗ generate-latest-post: no POSTS array in ' + SRC); process.exit(1); }

// collect all POSTS entries and pick newest by date, then by highest id as tiebreaker (avoid overflow)
const re = /\{\s*id:\s*(\d+)[\s\S]*?date:\s*'(.*?)'[\s\S]*?title:\s*'(.*?)'/g;
let best = null;
let match;
let count = 0;
while ((match = re.exec(srcText)) !== null) {
  count++;
  const id = parseInt(match[1],10);
  const blockStart = match.index;
  const block = srcText.slice(blockStart, blockStart + 5000);
  const emoji = pick(block, 'emoji') || '';
  const date = pick(block, 'date') || match[2] || '';
  const title = pick(block, 'title') || match[3] || '';
  const excerpt = pick(block, 'excerpt') || '';
  const ts = parseDate(date);
  const better = !best || ts > best.ts || (ts === best.ts && id > best.id);
  if (better) best = { emoji, date, title, excerpt, id, ts };
}

if (!best || !best.title) { console.error('✗ generate-latest-post: could not read a title from ' + SRC); process.exit(1); }

const post = { emoji: best.emoji, date: best.date, title: best.title, excerpt: best.excerpt };
fs.writeFileSync(OUT, JSON.stringify(post) + '\n');
const kb = (fs.statSync(OUT).size / 1024).toFixed(2);
const was = (fs.statSync(SRC).size / 1024).toFixed(0);
const rel = path.relative(ROOT, SRC);
console.log(`✓ generate-latest-post: latest-post.json written (${kb}KB, source ${rel} ` + count + ` posts, newest id=${best.id}) , "${post.title}"`);
