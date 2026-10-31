#!/usr/bin/env node
// tests/devlog-media.js - every dev log picture and link must point at something real.
// The dev log is written by hand, so a typo in an image path or a url silently ships a
// broken card (the page falls back to an emoji) or a dead "read more" link. This guards:
//   1. every post.image file exists on disk
//   2. every post.url / post.links[].href resolves to a real page (or is external)
//   3. links carry a label
//   4. pages/devlog.html actually renders related links + understands #post-<id> deep links
// Run: node tests/devlog-media.js
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.resolve(__dirname, '..');
var errors = [];
var checkedImages = 0, checkedLinks = 0;

var src = fs.readFileSync(path.join(ROOT, 'devlog-data.js'), 'utf8');
var sandbox = { console: { log: function () {}, warn: function () {} }, window: {} };
vm.createContext(sandbox);
var posts;
try {
  posts = vm.runInContext('(function(){' + src + ';return POSTS;})()', sandbox, { timeout: 5000 }) || [];
} catch (e) {
  console.error('FAIL: cannot parse devlog-data.js: ' + e.message);
  process.exit(1);
}

var isExternal = function (h) { return /^https?:/i.test(String(h || '')) || String(h || '').startsWith('//'); };

// Resolve a post href the way the page does: /root or relative to /pages/.
function resolve(href) {
  var h = String(href || '').trim();
  if (!h) return null;
  if (isExternal(h) || h.charAt(0) === '#') return { ext: true };
  var hash = '';
  var hi = h.indexOf('#');
  if (hi >= 0) { hash = h.slice(hi + 1); h = h.slice(0, hi); }
  var abs = h.charAt(0) === '/'
    ? path.join(ROOT, h)
    : path.join(ROOT, 'pages', h.replace(/^\.\//, ''));
  return { ext: false, abs: abs, hash: hash };
}

function existingFile(p) {
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  if (fs.existsSync(p + '.html')) return p + '.html';
  if (fs.existsSync(path.join(p, 'index.html'))) return path.join(p, 'index.html');
  return null;
}

function exists(p) {
  return !!existingFile(p);
}

function redirectTarget(html) {
  var m = html.match(/http-equiv=["']refresh["']\s+content=["']\d+;\s*url=([^"']+)["']/i);
  return m ? m[1].trim() : null;
}

function anchorExists(p, hash, depth) {
  if (!hash) return true;
  depth = depth || 0;
  var file = existingFile(p);
  if (!file) return false;
  var html = fs.readFileSync(file, 'utf8');
  var safe = hash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp("(?:id|name)=[\"']" + safe + "[\"']").test(html)) return true;
  // A root page may just redirect to the real /pages/ copy (e.g. /teachers).
  if (depth >= 3) return false;
  var target = redirectTarget(html);
  if (!target) return false;
  var abs = target.charAt(0) === '/'
    ? path.join(ROOT, target)
    : path.join(path.dirname(file), target);
  return anchorExists(abs, hash, depth + 1);
}

// Every new post must ship a picture of what actually changed. Capture it with
// scripts/capture-devlog-images.cjs, then paste the reported image: line.
var MIN_IMAGE_POST_ID = 525;
var missingImage = posts
  .filter(function (p) { return Number(p.id) >= MIN_IMAGE_POST_ID && !p.image; })
  .map(function (p) { return p.id; });
if (missingImage.length) {
  errors.push('posts from id ' + MIN_IMAGE_POST_ID + ' need an image: - run scripts/capture-devlog-images.cjs, missing on ' + missingImage.join(', '));
}

posts.forEach(function (p) {
  if (p.image) {
    checkedImages++;
    var r = resolve(p.image);
    if (!r || r.ext || !exists(r.abs)) {
      errors.push('post ' + p.id + ': image not found: ' + p.image);
    }
  }
  if (p.url) {
    checkedLinks++;
    var u = resolve(p.url);
    if (u && !u.ext && !exists(u.abs)) errors.push('post ' + p.id + ': url not found: ' + p.url);
    else if (u && !u.ext && !anchorExists(u.abs, u.hash)) errors.push('post ' + p.id + ': anchor not found: ' + p.url);
  }
  if (p.links) {
    if (!Array.isArray(p.links)) { errors.push('post ' + p.id + ': links is not an array'); return; }
    p.links.forEach(function (l, i) {
      if (!l || typeof l !== 'object') { errors.push('post ' + p.id + ': links[' + i + '] is not an object'); return; }
      if (!l.label) errors.push('post ' + p.id + ': links[' + i + '] has no label');
      if (!l.href) { errors.push('post ' + p.id + ': links[' + i + '] has no href'); return; }
      checkedLinks++;
      var lr = resolve(l.href);
      if (lr && !lr.ext && !exists(lr.abs)) errors.push('post ' + p.id + ': links[' + i + '] not found: ' + l.href);
      else if (lr && !lr.ext && !anchorExists(lr.abs, lr.hash)) errors.push('post ' + p.id + ': links[' + i + '] anchor not found: ' + l.href);
    });
  }
});

// The page must render links and deep links, or the data above is invisible.
var page = fs.readFileSync(path.join(ROOT, 'pages', 'devlog.html'), 'utf8');
if (!/modal-links|postLinkList/.test(page)) errors.push('pages/devlog.html does not render related links (modal-links / postLinkList missing)');
if (!/#post-/.test(page) || !/hashchange/.test(page)) errors.push('pages/devlog.html does not handle #post-<id> deep links');

if (errors.length) {
  console.error('FAIL: ' + errors.length + ' devlog media issue(s):');
  errors.forEach(function (e) { console.error('  ' + e); });
  process.exit(1);
}
console.log('PASS: ' + checkedImages + ' post image(s) and ' + checkedLinks + ' link(s) resolve from ' + posts.length + ' posts; devlog renders links + deep links.');
