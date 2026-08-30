#!/usr/bin/env node
/*
 * generate-latest-post.js — emits latest-post.json for the homepage banner.
 *
 * The homepage used to fetch the whole of pages/devlog.html (232KB) and regex it
 * for the newest entry, which was about a third of the homepage's total transfer
 * on every visit, for three lines of text. This writes the same three fields to a
 * ~250 byte file instead. pages/devlog.html stays the single source of truth.
 *
 * Run: node generate-latest-post.js   (npm run build:latest, and part of build)
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'pages', 'devlog.html');
const OUT = path.join(ROOT, 'latest-post.json');

/* POSTS entries mix quote styles: date/emoji/title use '...', excerpt uses "...". */
function pick(src, field) {
  let m = src.match(new RegExp(field + "\\s*:\\s*'((?:[^'\\\\]|\\\\.)*)'"));
  if (!m) m = src.match(new RegExp(field + '\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"'));
  return m ? m[1].replace(/\\(['"])/g, '$1').replace(/\\\\/g, '\\') : null;
}

const html = fs.readFileSync(SRC, 'utf8');
const i = html.indexOf('const POSTS');
if (i < 0) { console.error('✗ generate-latest-post: no POSTS array in pages/devlog.html'); process.exit(1); }

const block = html.slice(i, i + 4000);   // newest entry sits at the top of the array
const post = {
  emoji: pick(block, 'emoji') || '',
  date: pick(block, 'date') || '',
  title: pick(block, 'title') || '',
  excerpt: pick(block, 'excerpt') || ''
};

if (!post.title) { console.error('✗ generate-latest-post: could not read a title'); process.exit(1); }

fs.writeFileSync(OUT, JSON.stringify(post) + '\n');
const kb = (fs.statSync(OUT).size / 1024).toFixed(2);
const was = (fs.statSync(SRC).size / 1024).toFixed(0);
console.log(`✓ generate-latest-post: latest-post.json written (${kb}KB, replaces a ${was}KB fetch) — "${post.title}"`);
