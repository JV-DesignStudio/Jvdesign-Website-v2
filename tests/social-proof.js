#!/usr/bin/env node
/*
 * tests/social-proof.js - A648
 *
 * The site audit found no testimonials or social proof anywhere. The honest fix
 * is not to invent reviews: /testimonials.js renders a curated, permission-based
 * strip and, while the list is empty, an invite that points at a real collection
 * form (Formspree) on /about. This test proves the mechanism is live and that
 * nothing fabricated is shown:
 *   - the [data-testimonials] container renders on the homepage and about page
 *   - rendered cards always equal the curated list length (0 today)
 *   - the homepage shows the honest invite linking to the form
 *   - the about page carries the collection form with name/role/note/permission
 *   - note text is escaped, so a quote can never inject markup
 *   - no page errors and no mobile overflow at 390px
 *
 * Run: node tests/social-proof.js
 */
const { withServer } = require('./story-run-harness.cjs');

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/ERR_|Failed to load resource|favicon|Manifest/.test(t)) return;
    errors.push('console: ' + t);
  });
  return errors;
}

async function load(browser, base, url, width) {
  const page = await browser.newPage();
  const errors = watchErrors(page);
  await page.setViewport({ width, height: 900 });
  await page.goto(base + url, { waitUntil: 'load', timeout: 30000 });
  await new Promise(r => setTimeout(r, 500));
  return { page, errors };
}

async function home(browser, base, width) {
  const { page, errors } = await load(browser, base, '/index.html', width);
  const info = await page.evaluate(() => {
    const host = document.querySelector('[data-testimonials]');
    const list = (window.JVDS_TESTIMONIALS || []).filter(t => t && t.quote && t.approved !== false);
    const invite = host && host.querySelector('.jvds-testimonial-invite');
    const link = invite && invite.querySelector('a');
    return {
      hasHost: !!host,
      ready: !!(host && host.getAttribute('data-testimonials-ready') === 'true'),
      cards: host ? host.querySelectorAll('.jvds-testimonial-card').length : -1,
      listLen: list.length,
      hasInvite: !!invite,
      inviteHref: link ? link.getAttribute('href') : null,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });
  check('home ' + width + ': testimonials container renders', info.hasHost && info.ready);
  check('home ' + width + ': card count matches curated list', info.cards === info.listLen, info.cards + '/' + info.listLen);
  check('home ' + width + ': honest invite shown while list is empty', info.listLen > 0 || info.hasInvite);
  check('home ' + width + ': invite links to the collection form', info.listLen > 0 || info.inviteHref === '/about#share-feedback', String(info.inviteHref));
  check('home ' + width + ': no horizontal overflow', info.overflow <= 2, String(info.overflow));
  check('home ' + width + ': no page errors', errors.length === 0, errors.join(' | '));

  // Escaping: a hostile quote must render as text, never as markup.
  const escaped = await page.evaluate(() => {
    window.JVDS_TESTIMONIALS = [{ quote: '<img src=x onerror=alert(1)>', name: '<b>Bad</b>', role: 'Parent' }];
    window.JVDSTestimonials.render();
    const host = document.querySelector('[data-testimonials]');
    return {
      cards: host.querySelectorAll('.jvds-testimonial-card').length,
      injectedImg: !!host.querySelector('.jvds-testimonial-card img'),
      injectedBold: !!host.querySelector('.jvds-testimonial-card b'),
      text: (host.querySelector('.jvds-testimonial-quote') || {}).textContent || ''
    };
  });
  check('home ' + width + ': hostile quote renders as text only', escaped.cards === 1 && !escaped.injectedImg && !escaped.injectedBold && escaped.text.includes('<img'), JSON.stringify(escaped));
  await page.close();
}

async function about(browser, base, width) {
  const { page, errors } = await load(browser, base, '/pages/about.html', width);
  const info = await page.evaluate(() => {
    const host = document.querySelector('[data-testimonials]');
    const form = document.querySelector('[data-testimonial-form]');
    const q = sel => form && form.querySelector(sel);
    const perm = q('input[name="permission"][type="checkbox"]');
    return {
      sectionId: !!(document.getElementById('share-feedback')),
      hasHost: !!host,
      cards: host ? host.querySelectorAll('.jvds-testimonial-card').length : -1,
      form: !!form,
      method: form ? form.method : null,
      action: form ? form.getAttribute('action') : null,
      name: !!q('input[name="name"]'),
      role: !!q('select[name="role"]'),
      note: !!q('textarea[name="note"]'),
      permission: !!perm,
      permissionRequired: !!(perm && perm.hasAttribute('required')),
      honeypot: !!q('input[name="_gotcha"]'),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });
  check('about ' + width + ': share-feedback section has the #share-feedback anchor', info.sectionId);
  check('about ' + width + ': testimonials container renders', info.hasHost);
  check('about ' + width + ': no fabricated quotes (cards match data)', info.cards === 0, String(info.cards));
  check('about ' + width + ': collection form present', info.form);
  check('about ' + width + ': form posts to Formspree', /formspree\.io/.test(info.action || '') && (info.method || '').toLowerCase() === 'post', info.action + ' ' + info.method);
  check('about ' + width + ': form has name, role, note fields', info.name && info.role && info.note);
  check('about ' + width + ': permission is required before sharing', info.permission && info.permissionRequired);
  check('about ' + width + ': honeypot present', info.honeypot);
  check('about ' + width + ': no horizontal overflow', info.overflow <= 2, String(info.overflow));
  check('about ' + width + ': no page errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

(async () => {
  await withServer(async ({ base, browser }) => {
    for (const width of [390, 1440]) {
      await home(browser, base, width);
      await about(browser, base, width);
    }
  });
  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL SOCIAL PROOF CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
