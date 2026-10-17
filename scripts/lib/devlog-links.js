#!/usr/bin/env node
/*
 * scripts/lib/devlog-links.js - one place to resolve the ways a dev log post can
 * point at something.
 *
 * A post can carry any of:
 *   url     a single primary link (older posts, still supported)
 *   links   a list of { label, href } related links (newer posts)
 *   cta     a label for the primary link
 *
 * Hrefs may be root-relative ('/games/foo.html'), page-relative ('../books/x.html',
 * 'sitemap.html' - the page lives at /pages/devlog.html) or absolute. The social
 * draft, the newsletter digest and the test all need the same resolution, and the
 * old copy in generate-social-draft.js got it wrong (it prefixed the site root to
 * '../...' paths). This is the single source.
 */
'use strict';

const SITE = 'https://jvdesignstudio.co.uk';

function isExternal(href) {
  return /^https?:/i.test(String(href || '')) || String(href || '').startsWith('//');
}

// Resolve any post href to a root-relative path (or leave external/anchor as-is).
function normalizeHref(href) {
  const h = String(href || '').trim();
  if (!h) return '';
  if (isExternal(h) || h.startsWith('#')) return h;
  if (h.startsWith('/')) return h;
  // Page-relative: pretend we started at /pages/ (where devlog.html is served).
  const parts = ('pages/' + h.replace(/^\.\//, '')).split('/');
  const out = [];
  for (const seg of parts) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') { out.pop(); continue; }
    out.push(seg);
  }
  return '/' + out.join('/');
}

function siteUrl(href) {
  if (!href) return SITE + '/devlog';
  if (isExternal(href)) return href;
  return SITE + normalizeHref(href);
}

function primaryHref(post) {
  if (post.url) return post.url;
  const l = post.links && post.links[0];
  return (l && l.href) || null;
}

// A label that tells a reader where a single-link post goes, without inventing a name.
function primaryLabel(post) {
  if (post.cta) return post.cta;
  const href = String(primaryHref(post) || '');
  if (/\/games\//.test(href)) return 'Play the game';
  if (/\/books\//.test(href)) return 'Read the book';
  if (/\/workshops\//.test(href)) return 'Open the workshop';
  if (/\/tools\//.test(href)) return 'Open the tool';
  if (/\/learn\//.test(href)) return 'Read the guide';
  return 'Open the link';
}

// Ordered, de-duplicated list of { href, label } for a post. The primary (url)
// link comes first; links[] follows.
function postLinks(post) {
  const out = [];
  const seen = new Set();
  const add = (href, label) => {
    if (!href || seen.has(href)) return;
    seen.add(href);
    out.push({ href, label: label || href });
  };
  if (post.url) add(post.url, post.cta || primaryLabel(post));
  if (Array.isArray(post.links)) post.links.forEach((l, i) => add(l.href, (i === 0 && !post.url && post.cta) ? post.cta : l.label));
  return out;
}

module.exports = { SITE, isExternal, normalizeHref, siteUrl, primaryHref, primaryLabel, postLinks };
