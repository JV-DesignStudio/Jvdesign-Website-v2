#!/usr/bin/env node
/**
 * devlog-guard.js - shared detector for internal draft text in devlog-data.js.
 *
 * The public dev log is hand-written for learners and parents. Internal board
 * drafts ("DEV LOG DRAFT - REVIEW/COPY", local file paths, "Source task:" ids,
 * "Draft file:" fields and "WHEN APPROVED:" notes) must never be published.
 * They leaked in once; this is the single detector shared by the reporter,
 * generate-latest-post.js and the generated-drift gate.
 *
 * Usage:
 *   const { loadPosts, findDrafts, markersIn } = require('./lib/devlog-guard');
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DEVLOG = path.join(ROOT, 'devlog-data.js');

// Any of these appearing inside a POSTS entry means it is not publication-clean.
const MARKERS = [
  ['draft header', /DEV LOG DRAFT/i],
  ['local path', /F:\/Website\//i],
  ['source task', /Source task\s*:/i],
  ['draft file', /Draft file\s*:/i],
  ['when approved', /WHEN APPROVED\s*:/i],
  ['promote target', /Target\s*:\s*devlog-data\.js/i],
  // Board machinery (AGENTS.md: never publish ticket titles, drift fixes or evidence text)
  ['board machinery', /Created via board web UI/i],
  ['ready to claim', /ready to claim/i],
  ['auto-flagged', /auto-flagged/i],
  ['admin annotation', /\[[^\]]*\b(josh|force|opencode)\b[^\]]*\]/i],
];

function readSource(srcPath) {
  return fs.readFileSync(srcPath || DEVLOG, 'utf8');
}

/**
 * String-aware scan of the `const POSTS = [...]` array.
 * Returns entry spans so a reviewer can delete specific entries with a minimal diff.
 */
function parseEntries(text) {
  const start = text.indexOf('const POSTS');
  if (start < 0) throw new Error('devlog-guard: const POSTS not found');
  const open = text.indexOf('[', start);
  const entries = [];
  let i = open + 1;
  let depth = 0;
  let inStr = null;
  let entryStart = -1;
  let escaped = false;
  for (; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '\'' || c === '"' || c === '`') { inStr = c; continue; }
    if (c === '{') {
      if (depth === 0) entryStart = i;
      depth++;
      continue;
    }
    if (c === '}') {
      depth--;
      if (depth === 0 && entryStart >= 0) {
        let end = i + 1;
        let j = i + 1;
        while (j < text.length && /\s/.test(text[j])) j++;
        const hasComma = text[j] === ',';
        if (hasComma) end = j + 1;
        const raw = text.slice(entryStart, end);
        const idm = raw.match(/["']?id["']?\s*:\s*(\d+)/);
        const tm = raw.match(/["']?title["']?\s*:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/);
        const em = raw.match(/["']?excerpt["']?\s*:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/);
        entries.push({
          id: idm ? idm[1] : null,
          title: tm ? (tm[1] || tm[2] || '') : '',
          excerpt: em ? (em[1] || em[2] || '') : '',
          start: entryStart,
          end,
          raw,
        });
        entryStart = -1;
      }
      continue;
    }
    if (c === ']' && depth === 0) break;
  }
  return { open, closeBracket: i, entries };
}

function markersIn(raw) {
  return MARKERS.filter(([, re]) => re.test(raw)).map(([name]) => name);
}

function loadPosts(srcPath) {
  const text = readSource(srcPath);
  const parsed = parseEntries(text);
  return parsed.entries.map(e => ({ ...e, markers: markersIn(e.raw) }));
}

function findDrafts(posts) {
  return posts.filter(p => p.markers.length > 0);
}

// Softer signal: internal release/audit notes that are not learner-facing, even
// without a hard draft marker. Used to keep the public dev log to real studio
// journal posts. These are reported, not auto-deleted (see scrubber --internal).
// Words are case-insensitive; real filenames are case-sensitive and lowercase-first
// so proper nouns like "Three.js" / "Node.js" are not false positives.
const INTERNAL_WORDS = /(site (health )?audit|arcade audit|workshop audit|tools (device )?audit|auto-flagged|version drift|play store|store listing|versioncode|admob|smoke test|integration|\bpartials\/|\bwww\/|formspree|https?:\/\/|npm run|puppeteer|\bgit\b|\bA\d{3,}\b)/i;
const INTERNAL_FILE = /\b[a-z0-9_-]+\.(?:html|js|css)\b/;
function isInternalText(...parts) {
  const s = parts.filter(Boolean).join(' ');
  return INTERNAL_WORDS.test(s) || INTERNAL_FILE.test(s);
}
function isPublicationClean(post) {
  // Title is what readers see in the feed and on cards, so gate on title (plus hard markers).
  return post && post.markers.length === 0 && !isInternalText(post.title);
}
function findUnpublishable(posts) {
  return posts.filter(p => !isPublicationClean(p));
}

module.exports = { ROOT, DEVLOG, MARKERS, INTERNAL_WORDS, INTERNAL_FILE, readSource, parseEntries, markersIn, loadPosts, findDrafts, isInternalText, isPublicationClean, findUnpublishable };
