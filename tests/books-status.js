#!/usr/bin/env node
/*
 * tests/books-status.js (A1417)
 *
 * Every book on the bookshelf must state its status, and a book that is still
 * in progress must never be presented as finished. This guards the shelf in
 * pages/books.html against a forthcoming title slipping through with no label
 * (or worse, a "Published" label), and checks the shelf still agrees with the
 * source data in content/books.json.
 *
 * Run: node tests/books-status.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
};

const shelf = read('pages/books.html');
const css = read('style-books.css');
const data = JSON.parse(read('content/books.json'));

const cards = [];
const cardRe = /<a href="([^"]+)" class="book-card reveal">([\s\S]*?)<\/a>/g;
let m;
while ((m = cardRe.exec(shelf))) {
  const body = m[2];
  const badge = /<span class="book-badge([^"]*)">([^<]*)<\/span>/.exec(body);
  const cta = /<span class="book-cta">([^<]*)<\/span>/.exec(body);
  const title = /<h3 class="book-title">([^<]*)<\/h3>/.exec(body);
  cards.push({
    href: m[1],
    badgeClass: badge ? badge[1].trim() : '',
    badgeText: badge ? badge[2].trim() : '',
    cta: cta ? cta[1].trim() : '',
    title: title ? title[1].trim() : ''
  });
}

check('bookshelf renders the expected 5 book cards', cards.length === 5, cards.length + ' cards');
check('every book card states a status badge',
  cards.length > 0 && cards.every(c => c.badgeClass), cards.map(c => c.badgeText || '(none)').join(', '));

const published = cards.filter(c => c.badgeClass === 'published');
const preview = cards.filter(c => c.badgeClass === 'preview');
check('published books are labelled Published', published.length === 4, published.length + ' published');
check('the in-progress book is labelled Preview', preview.length === 1,
  preview.map(c => c.title).join(', ') || 'none');
check('no book uses a vague or outdated status badge',
  cards.every(c => ['published', 'preview'].includes(c.badgeClass)),
  [...new Set(cards.map(c => c.badgeClass))].join(', '));

// a preview is a teaser, never sold as a finished read
for (const c of preview) {
  check('preview book "' + c.title + '" is offered as a teaser', /teaser/i.test(c.cta), c.cta);
}
for (const c of published) {
  check('published book "' + c.title + '" is not a teaser',
    /read the book/i.test(c.cta) && !/teaser|preview/i.test(c.cta), c.cta);
}

check('the shelf no longer shows a Coming Soon badge', !/book-badge coming/.test(shelf));
check('status badges are visually distinguished',
  /\.book-badge\.published\b/.test(css) && /\.book-badge\.preview\b/.test(css));

// the shelf agrees with the source data: published count, and which one is upcoming
const dataPublished = data.filter(b => b.status === 'published');
const dataUpcoming = data.filter(b => b.status !== 'published');
check('shelf published count matches content/books.json',
  dataPublished.length === published.length, dataPublished.length + ' vs ' + published.length);
check('shelf preview count matches content/books.json',
  dataUpcoming.length === preview.length, dataUpcoming.length + ' vs ' + preview.length);

// each card links to a real page
for (const c of cards) {
  const target = path.join(ROOT, 'pages', c.href);
  check('card "' + c.title + '" links to an existing page', fs.existsSync(target), c.href);
}

console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL BOOK STATUS CHECKS PASSED');
process.exit(failures ? 1 : 0);
