#!/usr/bin/env node
/*
 * generate-friday-digest.js - the Friday-morning "best bits" email draft.
 *
 * Hand-picked source: newsletter-queue.json. Nothing is pulled automatically from
 * the dev log, Instagram packs, or the board. You add items to the queue; this
 * picks the newest ones that fit, ranked so releases lead over small fixes, and
 * writes a ready-to-send draft.
 *
 * Draft-only by design: it never sends. Copy the HTML into Brevo/Formspree.
 *
 * Usage:
 *   node scripts/generate-friday-digest.js            write the draft
 *   node scripts/generate-friday-digest.js --check    preview only, write nothing
 *   node scripts/generate-friday-digest.js --cap 3    override the item cap
 *   node scripts/generate-friday-digest.js --asof 2026-09-18  rank as of a date
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const QUEUE = path.join(ROOT, 'newsletter-queue.json');
const OUT_DIR = path.join(ROOT, 'social-posts', 'ready');
const OUT_MD = path.join(OUT_DIR, 'FRIDAY_DIGEST.md');
const OUT_HTML = path.join(OUT_DIR, 'FRIDAY_DIGEST.html');
const SITE = 'https://jvdesignstudio.co.uk';

const MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
};

function parseDate(s) {
  const str = String(s || '').trim();
  let m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = str.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (m) return new Date(+m[3], MONTHS[m[2].toLowerCase()] ?? 0, +m[1]);
  return null;
}

function fridayOf(d) {
  const c = new Date(d); c.setHours(0, 0, 0, 0);
  const delta = (5 - c.getDay() + 7) % 7;
  c.setDate(c.getDate() + delta);
  return c;
}
function fmtDate(d) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Releases lead, housekeeping trails. Lower rank wins. */
const KIND_RANK = { book: 0, game: 0, workshop: 0, tool: 1, app: 1, studio: 2, fix: 3 };
const KIND_LABEL = {
  book: 'New book', game: 'New game', workshop: 'New workshop',
  tool: 'New tool', app: 'New app', studio: 'Studio update', fix: 'Improved'
};

function buildHtml(picked) {
  const rows = picked.map(it => `
  <tr><td style="padding:0 0 18px 0;">
    <div style="background:#211d18;border:1px solid rgba(240,234,214,.08);border-radius:16px;padding:20px;">
      <div style="font-size:.7rem;color:#70A3A7;text-transform:uppercase;letter-spacing:.08em;">${esc(KIND_LABEL[it.kind] || 'Update')} &middot; ${esc(it.date)}</div>
      <h2 style="margin:8px 0 6px;font-family:Fredoka,sans-serif;color:#F0EAD6;font-size:1.15rem;">${it.pinned ? '&#128204; ' : ''}${esc(it.title)}</h2>
      <p style="margin:0 0 10px;color:rgba(240,234,214,.75);line-height:1.6;">${esc(it.blurb)}</p>
      ${it.link ? `<a href="${esc(it.link)}" style="color:#70A3A7;font-weight:700;text-decoration:none;">Have a look &rarr;</a>` : ''}
    </div>
  </td></tr>`).join('\n');

  return `<!doctype html>
<html><body style="margin:0;background:#1a1612;font-family:Inter,Arial,sans-serif;color:#F0EAD6;">
<div style="max-width:620px;margin:0 auto;padding:28px 20px;">
  <h1 style="font-family:Fredoka,sans-serif;font-size:1.5rem;margin:0 0 6px;">JVDesignStudio &middot; Friday</h1>
  <p style="color:rgba(240,234,214,.6);margin:0 0 22px;line-height:1.6;">Morning! Here is the best of what the studio made this week, for young creators, families and classrooms.</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}
  </table>
  <p style="color:rgba(240,234,214,.55);line-height:1.6;">That is the week. More browser-first games, workshops and tools are on the way. No installs, no accounts, no cost.</p>
  <p style="font-size:.75rem;color:rgba(240,234,214,.4);text-align:center;margin-top:24px;">You subscribed at <a href="${SITE}/newsletter.html" style="color:#70A3A7;">jvdesignstudio.co.uk/newsletter</a>. One email a week, unsubscribe any time from the link in your confirmation email.</p>
</div>
</body></html>`;
}

function main() {
  const args = process.argv.slice(2);
  const isCheck = args.includes('--check');
  const capArg = args.indexOf('--cap');
  const asofArg = args.indexOf('--asof');

  if (!fs.existsSync(QUEUE)) {
    console.error('Missing newsletter-queue.json at ' + QUEUE);
    process.exit(1);
  }
  const queue = JSON.parse(fs.readFileSync(QUEUE, 'utf8'));
  const cap = capArg >= 0 ? Math.max(1, parseInt(args[capArg + 1], 10) || 5) : (queue.cap || 5);
  const asof = asofArg >= 0 ? (parseDate(args[asofArg + 1]) || new Date()) : new Date();

  const items = (queue.items || [])
    .map(it => ({ ...it, _d: parseDate(it.date), _rank: KIND_RANK[it.kind] ?? 9 }))
    .filter(it => it._d)
    .sort((a, b) => {
      const ap = a.pinned ? 0 : 1, bp = b.pinned ? 0 : 1;
      if (ap !== bp) return ap - bp;
      if (b._d - a._d !== 0) return b._d - a._d;
      if (a._rank !== b._rank) return a._rank - b._rank;
      return String(a.title).localeCompare(String(b.title));
    });

  const picked = items.slice(0, cap);

  let lastSent = null;
  try {
    const st = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'FRIDAY_DIGEST.json'), 'utf8'));
    lastSent = st.sentAt || null;
  } catch { /* first run */ }

  const friday = fridayOf(asof);
  const subject = picked.length
    ? `This week at JVDesignStudio: ${picked[0].title}`
    : 'This week at JVDesignStudio';

  const md = [];
  md.push('# Friday Digest (draft)');
  md.push('');
  md.push(`Target send: ${friday.toISOString().slice(0, 10)} (${fmtDate(friday)}, Friday morning)`);
  md.push(`Subject idea: ${subject}`);
  if (lastSent) md.push(`Last sent: ${lastSent}`);
  md.push('');
  md.push('Opening:');
  md.push('Morning! Here is the best of what the studio made this week, for young creators, families and classrooms.');
  md.push('');
  md.push('## The best bits');
  md.push('');
  if (!picked.length) {
    md.push('No items in the queue yet. Add entries to `newsletter-queue.json`, then rerun `npm run newsletter:digest`.');
    md.push('');
  }
  for (const it of picked) {
    md.push(`### ${it.pinned ? '📌 ' : ''}${it.title}`);
    md.push(`${KIND_LABEL[it.kind] || 'Update'} · ${it.date}`);
    md.push('');
    md.push(it.blurb);
    if (it.link) { md.push(''); md.push(`Link: ${it.link}`); }
    md.push('');
  }
  md.push('## Closing');
  md.push('That is the week. More browser-first games, workshops and tools are on the way. No installs, no accounts, no cost.');
  md.push('');
  md.push('## Send checklist');
  md.push('- Read it once out loud.');
  md.push('- Check every link opens.');
  md.push('- Copy the HTML below into Brevo/Formspree and send Friday morning.');
  md.push('- Record the send date in FRIDAY_DIGEST.json (sentAt) so next week knows what is new.');
  md.push('');
  md.push('## HTML');
  md.push('');
  md.push('```html');
  md.push(buildHtml(picked));
  md.push('```');
  md.push('');

  if (isCheck) {
    console.log(`[digest] check: queue ${items.length} item(s), would pick ${picked.length} (cap ${cap})`);
    picked.forEach(p => console.log(`  - ${p.date} | ${p.kind} | ${p.title}`));
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_MD, md.join('\n'), 'utf8');
  fs.writeFileSync(OUT_HTML, buildHtml(picked), 'utf8');
  console.log(`Friday digest built: ${path.relative(ROOT, OUT_MD)} (${picked.length} item(s), cap ${cap})`);
  if (lastSent) console.log(`[digest] last sent ${lastSent}; review what is new before sending.`);
  console.log('[draft-only] Never sends. Copy the HTML into Brevo/Formspree after your read-through.');
}

main();
