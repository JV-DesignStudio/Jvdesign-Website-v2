/*!
 * testimonials.js - honest social proof for JVDesignStudio (A648).
 *
 * The studio does not invent reviews. This file renders a testimonials strip
 * from a hand-curated list and, until real notes exist, shows an honest invite
 * that points at a lightweight collection form. A note only appears here once
 * a family, learner or teacher has given permission and it has been added to
 * the list below by hand. Full names, emails and anything about a child are
 * never published.
 *
 * Markup (any page):
 *   <div data-testimonials></div>            strip + invite when empty
 *   <div data-testimonials="quiet"></div>    strip only (no invite copy)
 *
 * Collection form (optional, same page): <form data-testimonial-form>.
 * The strip's "share" link targets that form, else /about#share-feedback.
 *
 * To publish a note, add one object per quote:
 *   { quote: 'What they said', name: 'Sam', role: 'Parent', date: 'October 2026' }
 *
 * No build step: <script defer src="/testimonials.js"></script>
 */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;

  /* Hand-curated, permission-granted quotes live here. Empty on purpose: the
   * studio will not fabricate social proof. Add real notes as they arrive. */
  window.JVDS_TESTIMONIALS = window.JVDS_TESTIMONIALS || [];

  var FALLBACK_FORM = '/about#share-feedback';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function approved() {
    var list = window.JVDS_TESTIMONIALS;
    if (!Array.isArray(list)) return [];
    return list.filter(function (t) { return t && t.quote && t.approved !== false; });
  }

  function injectStyles() {
    if (document.getElementById('jvds-testimonials-style')) return;
    var css = [
      '.jvds-testimonials{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));margin:0}',
      '.jvds-testimonial-card{background:var(--card,#fff);border:1.5px solid var(--border,rgba(64,59,51,.14));border-radius:14px;padding:16px 18px;box-shadow:0 2px 10px rgba(0,0,0,.05)}',
      '.jvds-testimonial-quote{margin:0 0 12px;font-size:1.02rem;line-height:1.6;color:var(--charcoal,#1a1208)}',
      '.jvds-testimonial-quote::before{content:"\\201C"}',
      '.jvds-testimonial-quote::after{content:"\\201D"}',
      '.jvds-testimonial-meta{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}',
      '.jvds-testimonial-name{font-weight:800;color:var(--charcoal,#1a1208)}',
      '.jvds-testimonial-role{font-size:.82rem;font-weight:700;color:var(--teal-dk,#4e7d80)}',
      '.jvds-testimonial-note{font-size:.78rem;color:var(--charcoal-lt,#3d3224);opacity:.8;margin-top:4px}',
      '.jvds-testimonial-invite{background:var(--teal-lt,#e8f2f3);border:1.5px solid rgba(112,163,167,.5);border-radius:14px;padding:18px 20px;max-width:640px}',
      '.jvds-testimonial-invite p{margin:0 0 14px;line-height:1.6;color:var(--charcoal,#1a1208)}',
      '.jvds-testimonial-invite .jvds-testimonial-echo{font-weight:800;color:var(--teal-dk,#4e7d80);display:block;margin-bottom:6px}',
      '.jvds-testimonial-btn{display:inline-block;background:var(--teal-dk,#4e7d80);color:#fff;border:0;border-radius:10px;padding:11px 20px;font:700 .95rem Inter,system-ui,sans-serif;cursor:pointer;text-decoration:none}',
      '.jvds-testimonial-btn:hover{background:var(--teal,#70A3A7)}',
      /* Collection form */
      '.jvds-tform{display:flex;flex-direction:column;gap:14px;max-width:640px;margin-top:16px;text-align:left}',
      '.jvds-tform-row{display:flex;gap:14px;flex-wrap:wrap}',
      '.jvds-tform-field{display:flex;flex-direction:column;gap:6px;font-weight:700;font-size:.86rem;color:var(--charcoal-lt,#3d3224);flex:0 0 auto}',
      '.jvds-tform-row .jvds-tform-field{flex:1 1 220px}',
      '.jvds-tform-field input,.jvds-tform-field select,.jvds-tform-field textarea{font:400 .95rem Inter,system-ui,sans-serif;color:var(--charcoal,#1a1208);background:#fff;border:1.5px solid var(--border,rgba(64,59,51,.3));border-radius:10px;padding:10px 12px;width:100%;box-sizing:border-box}',
      '.jvds-tform-field textarea{resize:vertical;min-height:96px}',
      '.jvds-tform-field input:focus,.jvds-tform-field select:focus,.jvds-tform-field textarea:focus{outline:3px solid var(--teal,#70A3A7);outline-offset:1px}',
      '.jvds-tform-permission{display:flex;gap:10px;align-items:flex-start;font-size:.86rem;line-height:1.5;color:var(--charcoal-lt,#3d3224)}',
      '.jvds-tform-permission input{margin-top:3px;flex:none;width:20px;height:20px}',
      '.jvds-tform-btn{align-self:flex-start;background:var(--teal-dk,#4e7d80);color:#fff;border:0;border-radius:10px;padding:12px 24px;font:700 .98rem Inter,system-ui,sans-serif;cursor:pointer}',
      '.jvds-tform-btn:hover{background:var(--teal,#70A3A7)}',
      '.jvds-tform-help{font-size:.8rem;color:var(--charcoal-lt,#3d3224);opacity:.85;margin:0}',
      '@media(max-width:520px){.jvds-testimonials{grid-template-columns:1fr}.jvds-tform-row{flex-direction:column}.jvds-tform-row .jvds-tform-field{flex:0 0 auto}}'
    ].join('\n');
    var style = document.createElement('style');
    style.id = 'jvds-testimonials-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function cardHTML(t) {
    var meta = '<span class="jvds-testimonial-name">' + esc(t.name || 'Anonymous') + '</span>';
    if (t.role) meta += '<span class="jvds-testimonial-role">' + esc(t.role) + '</span>';
    var date = t.date ? '<div class="jvds-testimonial-note">Shared with permission' + (t.date ? ' · ' + esc(t.date) : '') + '</div>' : '<div class="jvds-testimonial-note">Shared with permission</div>';
    return '<figure class="jvds-testimonial-card">' +
      '<blockquote class="jvds-testimonial-quote">' + esc(t.quote) + '</blockquote>' +
      '<figcaption><div class="jvds-testimonial-meta">' + meta + '</div>' + date + '</figcaption>' +
      '</figure>';
  }

  function formTarget(host) {
    var form = document.querySelector('[data-testimonial-form]');
    if (form) return '#' + (form.id || 'share-feedback');
    return FALLBACK_FORM;
  }

  function inviteHTML(anchor) {
    return '<div class="jvds-testimonial-invite">' +
      '<span class="jvds-testimonial-echo">Echo here. No notes to show yet, and that is fine.</span>' +
      '<p>We only share words from real families, learners and teachers, and only with permission. If something here helped you, a short note would mean a lot and could help someone else find their way in.</p>' +
      '<a class="jvds-testimonial-btn" href="' + anchor + '">Share your story</a>' +
      '</div>';
  }

  function render() {
    var hosts = document.querySelectorAll('[data-testimonials]');
    if (!hosts.length) return;
    injectStyles();
    var list = approved();
    hosts.forEach(function (host) {
      host.setAttribute('data-testimonials-ready', 'true');
      if (list.length) {
        host.innerHTML = '<div class="jvds-testimonials">' + list.map(cardHTML).join('') + '</div>';
      } else if (host.getAttribute('data-testimonials') !== 'quiet') {
        host.innerHTML = inviteHTML(formTarget(host));
      } else {
        host.innerHTML = '';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render, { once: true });
  } else {
    render();
  }

  window.JVDSTestimonials = { list: approved, render: render };
})();
