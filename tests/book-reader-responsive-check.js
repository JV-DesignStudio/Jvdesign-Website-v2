#!/usr/bin/env node
/*
 * tests/book-reader-responsive-check.js (A2531)
 *
 * Verifies that the Pip book page:
 *   1. Has no image overflow at a 390px viewport width
 *   2. Has an ARIA-compliant read-aloud audio player
 *
 * Run: node tests/book-reader-responsive-check.js
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
};

/* ── load pages ── */
const pipHtml = read('books/Pip_and_the_night_sky.html');
const pipCss  = read('style-book-Pip_and_the_night_sky.css');

/* ── 1. image overflow guards ── */
// Every <img> in the page body must carry either max-width or width:100%
const imgTags = [...pipHtml.matchAll(/<img\b[^>]*>/gi)].map(m => m[0]);
check('Pip page has at least one img tag', imgTags.length > 0, imgTags.length + ' imgs found');

// cover image uses responsive CSS class
check('book-cover-img class present on cover', /class="[^"]*book-cover-img/.test(pipHtml));
check('book-cover-img styled with max-width in CSS', /\.book-cover-img\s*\{[^}]*max-width/.test(pipCss));

// teaser-gallery uses a grid layout that reflows at narrow widths
check('teaser-gallery CSS has grid-template-columns', /\.teaser-gallery[^{]*\{[^}]*grid-template-columns/.test(pipCss));
check('teaser-gallery has 390px or 360px breakpoint', /max-width:\s*(390|360)px/.test(pipCss));

// body itself cannot scroll horizontally
check('body has overflow-x:hidden', /body\s*\{[^}]*overflow-x\s*:\s*hidden/.test(pipCss));

/* ── 2. ARIA-compliant audio player ── */
check('audio element exists', /<audio\b/i.test(pipHtml));
check('audio element has aria-label', /<audio\b[^>]*aria-label=/i.test(pipHtml));

// play/pause button
check('play button has aria-label', /<button[^>]*id="pipAudioPlay"[^>]*aria-label=/.test(pipHtml) ||
      /<button[^>]*aria-label=[^>]*id="pipAudioPlay"/.test(pipHtml));
check('play button has aria-pressed', /<button[^>]*id="pipAudioPlay"[^>]*aria-pressed=/.test(pipHtml) ||
      /<button[^>]*aria-pressed=[^>]*id="pipAudioPlay"/.test(pipHtml));

// skip-back and skip-forward buttons
check('skip-back button has aria-label', /<button[^>]*aria-label="Skip back/.test(pipHtml));
check('skip-forward button has aria-label', /<button[^>]*aria-label="Skip forward/.test(pipHtml));

// range input (seek bar)
check('seek bar is a range input with aria-label', /<input[^>]*type="range"[^>]*aria-label=/.test(pipHtml) ||
      /<input[^>]*aria-label=[^>]*type="range"/.test(pipHtml));
check('seek bar has aria-valuetext', /<input[^>]*aria-valuetext=/.test(pipHtml));

// controls group
check('player controls wrapped in role=group', /role="group"/.test(pipHtml));
check('player group has aria-label', /role="group"[^>]*aria-label=/.test(pipHtml) ||
      /aria-label=[^>]*role="group"/.test(pipHtml));

// section labelling
check('read-aloud section has aria-labelledby', /aria-labelledby="read-aloud-heading"/.test(pipHtml));
check('read-aloud heading id exists', /id="read-aloud-heading"/.test(pipHtml));

/* ── 3. mobile layout for the player ── */
check('audio player CSS has 480px breakpoint', /max-width:\s*480px[^{]*\{[^}]*book-audio/.test(pipCss) ||
      /@media[^{]*max-width:\s*480px/.test(pipCss));

console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL BOOK-READER RESPONSIVE CHECKS PASSED');
process.exit(failures ? 1 : 0);
