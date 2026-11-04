#!/usr/bin/env node
/*
 * social-guard.js - shared detector for internal language in social copy.
 * Social drafts are for learners and parents. File paths, card ids, audit notes,
 * local URLs and board machinery must not reach X, Instagram or the newsletter.
 */
'use strict';

const MARKERS = [
  ['file path', /\b[\w-]+\.(?:html|js|css|cjs|json|webp|png)\b/i],
  ['card id', /\bA\d{3,}\b/],
  ['audit ref', /AUD-|\[AUD|audit note|audit:/i],
  ['line reference', /\babout line \d+|\bline \d+\b/i],
  ['local path', /F:\/Website\/|localhost|127\.0\.0\.1/i],
  ['board machinery', /DEV LOG DRAFT|WHEN APPROVED|COPY-READY|source task|draft file|evidence:/i],
  ['internal wording', /\b(must|ticket|backlog|drift|smoke test|puppeteer|npm run|git commit)\b/i],
];

function issues(text) {
  const value = String(text || '');
  const withoutLinks = value.replace(/https?:\/\/\S+/gi, ' ');
  return MARKERS
    .filter(([name, re]) => (name === 'file path' ? re.test(withoutLinks) : re.test(value)))
    .map(([name]) => name);
}

function isClean(text) {
  return issues(text).length === 0;
}

function clean(text) {
  return String(text || '')
    .replace(/\[object Object\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { MARKERS, issues, isClean, clean };
