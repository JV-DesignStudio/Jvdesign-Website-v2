'use strict';
/**
 * apply-workshop-completion.js (A2037)
 *
 * Gives every workshop a finish screen that says what "finished" means and a
 * link to the next thing to do.
 *
 *   engine / steps pages: a compact row inside #finishBanner, so it appears
 *   with the congratulation banner and not before.
 *   builder pages: a closing "finish line" section, because a builder has no
 *   step tracking, the finished build itself is the proof.
 *   canvas pages: nothing here, workshop-canvas-engine.js already shows its
 *   own next box after the last build step.
 *
 * Safe to re-run: the block is wrapped in WS-FINISH markers and replaced.
 *
 * Usage:
 *   node scripts/apply-workshop-completion.js
 *   node scripts/apply-workshop-completion.js --check
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'content', 'workshop-completion.json');
const START = '<!-- WS-FINISH:START -->';
const END = '<!-- WS-FINISH:END -->';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function inlineBlock(entry) {
  const next = entry.next;
  return [
    START,
    `<div class="ws-finish" data-workshop-finish="${esc(entry.id)}" style="margin-top:18px;padding-top:16px;border-top:1px solid var(--border,rgba(64,59,51,.14));font-family:Inter,system-ui,sans-serif">`,
    `  <p class="ws-finish-condition" style="font-size:.82rem;color:var(--charcoal-lt,#3d3224);margin:0 0 10px">Finished when: ${esc(entry.conditionText)}</p>`,
    '  <div class="ws-finish-actions" style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center">',
    `    <a class="ws-finish-next" href="${esc(next.url)}" style="display:inline-flex;align-items:center;gap:8px;background:var(--teal-dk,#4e7d80);color:#fff;font-weight:700;font-size:.9rem;padding:10px 20px;border-radius:10px;text-decoration:none">Next step: ${esc(next.label)} &rarr;</a>`,
    '    <a class="ws-finish-progress" href="my-progress.html" style="display:inline-flex;align-items:center;gap:8px;border:1.5px solid var(--border,rgba(64,59,51,.14));color:inherit;font-weight:700;font-size:.9rem;padding:10px 20px;border-radius:10px;text-decoration:none">See my progress</a>',
    '  </div>',
    '</div>',
    END
  ].join('\n');
}

function closingBlock(entry) {
  const next = entry.next;
  return [
    START,
    `<section class="ws-finish" id="wsFinish" aria-labelledby="ws-finish-title" data-workshop-finish="${esc(entry.id)}" style="max-width:820px;margin:0 auto 48px;padding:0 20px">`,
    '  <div class="ws-finish-inner" style="background:var(--card,#fff);border:1.5px solid var(--border,rgba(64,59,51,.14));border-radius:16px;padding:26px 24px;text-align:center;font-family:Inter,system-ui,sans-serif">',
    '    <p class="ws-finish-kicker" style="display:inline-flex;align-items:center;gap:8px;margin:0 0 8px;font-size:.78rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--teal-dk,#4e7d80)"><img src="/assets/mascots/echo-badge.webp" alt="" width="22" height="22" loading="lazy"> Echo\'s finish line</p>',
    '    <h2 class="ws-finish-title" id="ws-finish-title" style="font-family:Fredoka,cursive;font-size:1.5rem;margin:0 0 8px;color:var(--charcoal,#1a1208)">You\'re finished when...</h2>',
    `    <p class="ws-finish-condition" style="font-size:1rem;line-height:1.6;margin:0 0 8px;color:var(--charcoal,#1a1208)">${esc(entry.conditionText)}</p>`,
    '    <p class="ws-finish-body" style="font-size:.9rem;line-height:1.6;margin:0 0 18px;color:var(--charcoal-lt,#3d3224)">That is the proof you finished: the thing you made plays or opens outside this page. Save or download it, then show it to someone.</p>',
    '    <div class="ws-finish-actions" style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center">',
    `      <a class="ws-finish-next" href="${esc(next.url)}" style="display:inline-flex;align-items:center;gap:8px;background:var(--teal-dk,#4e7d80);color:#fff;font-weight:700;font-size:.9rem;padding:10px 20px;border-radius:10px;text-decoration:none">Next step: ${esc(next.label)} &rarr;</a>`,
    '      <a class="ws-finish-progress" href="my-progress.html" style="display:inline-flex;align-items:center;gap:8px;border:1.5px solid var(--border,rgba(64,59,51,.14));color:inherit;font-weight:700;font-size:.9rem;padding:10px 20px;border-radius:10px;text-decoration:none">See my progress</a>',
    '    </div>',
    '  </div>',
    '</section>',
    END
  ].join('\n');
}

function stripBlock(html) {
  const start = html.indexOf(START);
  const end = html.indexOf(END);
  if (start < 0 || end < start) return html;
  let before = html.slice(0, start);
  let after = html.slice(end + END.length);
  /* Strip the exact newlines the inserter adds, so strip then insert returns
     the same bytes and repeated runs never drift. */
  if (before.endsWith('\n')) before = before.slice(0, -1);
  if (after.startsWith('\n')) after = after.slice(1);
  return before + after;
}

function insertIntoFinishBanner(html, want) {
  const m = html.match(/<div[^>]*id=["']finishBanner["'][^>]*>/i);
  if (!m) return null;
  const at = m.index + m[0].length;
  return html.slice(0, at) + '\n' + want + '\n' + html.slice(at);
}

function insertClosing(html, want) {
  const main = html.lastIndexOf('</main>');
  if (main >= 0) return html.slice(0, main) + '\n' + want + '\n' + html.slice(main);
  const footer = html.search(/<footer[\s>]/i);
  if (footer >= 0) {
    const lead = footer > 0 && html[footer - 1] !== '\n' ? '\n' : '';
    return html.slice(0, footer) + lead + want + '\n' + html.slice(footer);
  }
  const body = html.lastIndexOf('</body>');
  if (body >= 0) return html.slice(0, body) + want + '\n' + html.slice(body);
  return null;
}

function ensureStepRestore(html, key) {
  if (!key) return html;
  const body = html.match(/<body\b[^>]*>/i);
  if (body && !/data-steps-key=/.test(body[0])) {
    const tag = body[0].replace(/>$/, ' data-steps-key="' + esc(key) + '">');
    html = html.slice(0, body.index) + tag + html.slice(body.index + body[0].length);
  }
  if (!/workshop-restore-steps\.js/.test(html)) {
    const end = html.lastIndexOf('</body>');
    if (end >= 0) html = html.slice(0, end) + '<script defer src="workshop-restore-steps.js"></script>\n' + html.slice(end);
  }
  return html;
}

function apply(options) {
  const check = !!(options && options.check);
  const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const updated = [];
  const clean = [];
  const stale = [];
  const failed = [];

  for (const entry of data.workshops) {
    const file = path.join(ROOT, entry.page);
    if (!fs.existsSync(file)) { failed.push(entry.id + ' (missing file)'); continue; }

    /* Canvas pages and reference pages must not carry a stamped block: the
       canvas engine draws its own next box, and reference pages have no steps.
       Strip any stale block left by an earlier mode. */
    if (!['engine', 'steps', 'builder'].includes(entry.mode)) {
      const html = fs.readFileSync(file, 'utf8');
      const start = html.indexOf(START);
      const end = html.indexOf(END);
      if (start >= 0 && end > start) {
        const next = stripBlock(html);
        if (check) { stale.push(entry.id + ' (block on ' + entry.mode + ' page)'); continue; }
        fs.writeFileSync(file, next);
        updated.push(entry.id);
      }
      continue;
    }

    const original = fs.readFileSync(file, 'utf8');
    /* Always start from a page with no stamped block, then place the current
       one. That keeps a mode change (a page moving to the shared canvas
       engine, or a builder later gaining a finish banner) clean instead of
       leaving the old block at the wrong spot. */
    const stripped = stripBlock(original);
    const bannerMode = entry.mode !== 'builder' || entry.hasFinishBanner;
    const want = bannerMode ? inlineBlock(entry) : closingBlock(entry);
    let next = bannerMode ? insertIntoFinishBanner(stripped, want) : insertClosing(stripped, want);

    if (!next) next = insertClosing(stripped, want);
    if (!next) { failed.push(entry.id + ' (no insert point)'); continue; }
    if (entry.mode === 'steps') next = ensureStepRestore(next, entry.storageKey);
    if (next === original) { clean.push(entry.id); continue; }
    if (check) { stale.push(entry.id); continue; }
    fs.writeFileSync(file, next);
    updated.push(entry.id);
  }

  if (check) {
    console.log('Workshop finish blocks: ' + clean.length + ' in sync, ' + stale.length + ' out of date');
    if (stale.length) console.error('Out of date (run without --check): ' + stale.join(', '));
    if (failed.length) console.error('Could not place: ' + failed.join(', '));
    if (stale.length || failed.length) process.exitCode = 1;
    return { clean, stale, failed };
  }

  console.log('Applied workshop finish blocks: ' + updated.length + ' updated, ' + clean.length + ' already in sync');
  if (failed.length) {
    console.error('Could not place: ' + failed.join(', '));
    process.exitCode = 1;
  }
  return { updated, clean, failed };
}

if (require.main === module) apply({ check: process.argv.includes('--check') });
module.exports = { apply, inlineBlock, closingBlock };
