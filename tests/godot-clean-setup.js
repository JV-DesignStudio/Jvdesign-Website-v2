#!/usr/bin/env node
/**
 * godot-clean-setup.js (A1873)
 *
 * End-to-end checks that do not need a Godot install: every published Godot
 * workshop resolves, names Godot 4, keeps balanced code blocks, points only at
 * downloads that exist, and the game-build pages tell a first-time learner how
 * to open the project in Godot and export a game they can keep.
 *
 * The browser step-by-step driving lives in tests/<page>-http.js. This test
 * covers the clean-setup and export gaps those cannot see.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const catalogue = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'workshops.json'), 'utf8'));
const godot = catalogue.filter(w => /godot/i.test(w.engine || ''));
const pages = [...new Set(godot.map(w => w.url).filter(Boolean))];

const GAME_BUILDERS = new Set([
  '/workshops/godot_tutorial.html',
  '/workshops/godot-gdscript-essentials.html',
  '/workshops/godot-racing-workshop.html',
  '/workshops/godot-racing-workshop-2.html',
  '/workshops/godot-gatekeeper-3d-part1.html',
  '/workshops/godot-gatekeeper-3d-part2.html'
]);

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' : ' + detail : ''));
  if (!ok) failures++;
}

function localDownloads(html) {
  const out = [];
  const re = /href=["']([^"'#?]+\.(?:zip|pdf|pck|exe))["']/gi;
  let m;
  while ((m = re.exec(html))) {
    if (!/^https?:/i.test(m[1])) out.push(m[1]);
  }
  return [...new Set(out)];
}

function resolve(url, href) {
  if (href.startsWith('/')) return path.join(ROOT, href.replace(/^\//, ''));
  return path.resolve(path.dirname(path.join(ROOT, url.replace(/^\//, ''))), href);
}

check('catalogue lists Godot workshops', pages.length >= 10, pages.length + ' pages');

for (const url of pages) {
  const file = path.join(ROOT, url.replace(/^\//, ''));
  const label = url.replace('/workshops/', '');
  if (!fs.existsSync(file)) { check(label + ' exists', false, 'missing file'); continue; }
  const html = fs.readFileSync(file, 'utf8');
  const noindex = /<meta\s+name=["']robots["'][^>]*noindex/i.test(html);
  // The -canvas pages are noindex in-school build canvases, not workshop pages.
  // They still have to resolve and stay valid, but the public/version rules do
  // not apply to them.
  if (!noindex) {
    check(label + ' is public', true);
    check(label + ' names Godot 4', /Godot\s*4/i.test(html));
  }

  const preOpen = (html.match(/<pre\b/gi) || []).length;
  const preClose = (html.match(/<\/pre>/gi) || []).length;
  const codeOpen = (html.match(/<code\b/gi) || []).length;
  const codeClose = (html.match(/<\/code>/gi) || []).length;
  check(label + ' has balanced code blocks', preOpen === preClose && codeOpen === codeClose,
    `pre ${preOpen}/${preClose}, code ${codeOpen}/${codeClose}`);

  const missing = localDownloads(html).filter(href => !fs.existsSync(resolve(url, href)));
  check(label + ' downloads exist', missing.length === 0, missing.join(', ') || 'all found');
}

for (const url of GAME_BUILDERS) {
  const file = path.join(ROOT, url.replace(/^\//, ''));
  const label = url.replace('/workshops/', '');
  if (!fs.existsSync(file)) { check(label + ' export guidance', false, 'missing file'); continue; }
  const html = fs.readFileSync(file, 'utf8');
  const hasBlock = /<!--\s*WS-EXPORT:START\s*-->/i.test(html);
  const hasExport = /Export Project/i.test(html) && /Export Templates/i.test(html);
  const hasProject = /project\.godot/i.test(html);
  check(label + ' export guidance', hasBlock && hasExport && hasProject,
    [hasBlock ? 'block' : 'no block', hasExport ? 'export steps' : 'no export steps', hasProject ? 'project.godot' : 'no project.godot'].join(', '));
}

console.log(failures === 0 ? '\ngodot-clean-setup: PASS' : `\ngodot-clean-setup: ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
