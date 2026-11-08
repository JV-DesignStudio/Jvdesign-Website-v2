#!/usr/bin/env node
// tests/printable-pdf-link-audit.js (A2534)
// Checks the Echo book page offers real printable resources:
//   1. a "Print and play" block exists,
//   2. at least one PDF colouring link and one activity page are linked,
//   3. every linked resource returns 200 from a real static server,
//   4. the PDF opens (starts with %PDF and is not empty),
//   5. the activity page has a print action,
//   6. the PDF link downloads instead of navigating away.
// Run: node tests/printable-pdf-link-audit.js
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PAGE = 'books/Echo_and_the_mountain_of_choice.html';
let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
  if (!ok) failures++;
}

(async () => {
  const html = fs.readFileSync(path.join(ROOT, PAGE), 'utf8');
  check('the page has a print and play block', /id="a2534-printables"/.test(html) && /Print and play/.test(html));

  const hrefs = [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gi)].map((m) => m[1]);
  const pdfs = [...new Set(hrefs.filter((h) => /\.pdf(?:[?#]|$)/i.test(h)))];
  const activities = [...new Set(hrefs.filter((h) => /activity-pack|colouring/i.test(h) && !/\.pdf(?:[?#]|$)/i.test(h)))];
  check('links at least one printable PDF', pdfs.length >= 1, pdfs.join(','));
  check('links at least one activity page', activities.length >= 1, activities.join(','));
  check('the PDF link downloads rather than navigating', /<a\b[^>]*href="[^"]*\.pdf"[^>]*\bdownload\b/i.test(html));

  const toPath = (h) => new URL(h, 'http://x/' + PAGE).pathname;
  const targets = [
    ...pdfs.map((h) => ({ href: h, path: toPath(h), pdf: true })),
    ...activities.map((h) => ({ href: h, path: toPath(h), pdf: false }))
  ];

  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.normalize(path.join(ROOT, p));
    if (!file.startsWith(path.normalize(ROOT))) { res.writeHead(403); return res.end('Forbidden'); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200);
      res.end(data);
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  try {
    for (const target of targets) {
      const res = await fetch(origin + target.path);
      check('200 for ' + target.path, res.status === 200, 'status ' + res.status);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (target.pdf) {
        const magic = buf.subarray(0, 4).toString('latin1');
        check('PDF opens for ' + target.path, magic === '%PDF' && buf.length > 1000, magic + ' bytes=' + buf.length);
      } else {
        const body = buf.toString('utf8');
        check('activity page has a print action for ' + target.path, /Print This Pack/i.test(body), 'bytes=' + buf.length);
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nPRINTABLE PDF LINK AUDIT PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
