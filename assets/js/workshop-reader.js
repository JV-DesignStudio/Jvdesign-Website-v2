/**
 * workshop-reader.js - Workshop Article Enhancements
 * Auto-generates floating sticky TOC from h2/h3 headings,
 * and injects a "Next Quest" recommender at the bottom.
 * Zero dependencies.
 */
(function () {
  'use strict';

  // ── STYLES ───────────────────────────────────────────────────────────
  const CSS = `
    /* Floating TOC */
    .wsr-toc {
      position: fixed; top: 80px; left: 16px;
      width: 210px; max-height: calc(100vh - 120px);
      overflow-y: auto; z-index: 400;
      background: var(--card, rgba(240,234,214,.95));
      border: 1px solid var(--border, rgba(64,59,51,.15));
      border-radius: 14px; padding: 14px 14px 10px;
      box-shadow: 0 4px 24px rgba(0,0,0,.1);
      font-size: .76rem; line-height: 1.45;
      transition: transform .3s, opacity .3s;
    }
    [data-theme="dark"] .wsr-toc {
      background: rgba(30,27,24,.95);
      border-color: rgba(240,234,214,.1);
    }
    @media (max-width: 1100px) { .wsr-toc { display: none !important; } }
    .wsr-toc-title {
      font-size: .64rem; text-transform: uppercase; letter-spacing: .1em;
      font-weight: 800; color: var(--charcoal-lt, rgba(64,59,51,.55));
      margin-bottom: 8px;
    }
    [data-theme="dark"] .wsr-toc-title { color: rgba(240,234,214,.4); }
    .wsr-toc-list { list-style: none; margin: 0; padding: 0; }
    .wsr-toc-item { margin-bottom: 1px; }
    .wsr-toc-link {
      display: block; padding: 4px 8px; border-radius: 7px;
      color: var(--charcoal, #403B33); text-decoration: none;
      transition: background .12s, color .12s; border-left: 2px solid transparent;
    }
    [data-theme="dark"] .wsr-toc-link { color: rgba(240,234,214,.75); }
    .wsr-toc-link:hover,
    .wsr-toc-link.active {
      background: rgba(112,163,167,.12);
      color: var(--teal-dk, #4d8b90);
      border-left-color: var(--jv-teal, #70A3A7);
    }
    [data-theme="dark"] .wsr-toc-link:hover,
    [data-theme="dark"] .wsr-toc-link.active {
      color: var(--jv-teal, #70A3A7);
      background: rgba(112,163,167,.1);
    }
    .wsr-toc-link.wsr-h3 { padding-left: 18px; font-size: .72rem; }
    .wsr-toc-link.wsr-done::after {
      content: ' ✓'; color: #06d6a0; font-weight: 700;
    }

    /* Next Quest card */
    .wsr-next-quest {
      margin: 32px 0 0;
      border: 1px solid rgba(112,163,167,.25);
      border-radius: 16px; padding: 20px 22px;
      background: var(--card, rgba(240,234,214,.5));
    }
    [data-theme="dark"] .wsr-next-quest {
      background: rgba(30,27,24,.6);
      border-color: rgba(112,163,167,.18);
    }
    .wsr-nq-kicker {
      font-size: .65rem; font-weight: 800; text-transform: uppercase;
      letter-spacing: .1em; color: var(--jv-teal, #70A3A7); margin-bottom: 6px;
    }
    .wsr-nq-title {
      font-family: var(--jv-font-display, 'Fredoka', 'Inter', sans-serif);
      font-size: 1.1rem; font-weight: 700;
      color: var(--charcoal, #403B33); margin-bottom: 6px; line-height: 1.3;
    }
    [data-theme="dark"] .wsr-nq-title { color: var(--jv-beige, #F0EAD6); }
    .wsr-nq-desc {
      font-size: .84rem; color: var(--charcoal-lt, rgba(64,59,51,.65));
      margin-bottom: 14px; line-height: 1.55;
    }
    [data-theme="dark"] .wsr-nq-desc { color: rgba(240,234,214,.55); }
    .wsr-nq-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
    .wsr-nq-tag {
      font-size: .68rem; font-weight: 700; padding: 3px 9px;
      border-radius: 99px; background: rgba(112,163,167,.12);
      color: var(--jv-teal, #70A3A7);
    }
    .wsr-nq-btn {
      display: inline-flex; align-items: center; gap: 8px;
      background: var(--jv-teal, #70A3A7); color: #fff;
      text-decoration: none; border-radius: 10px;
      padding: 10px 18px;
      font-family: var(--jv-font-display, 'Fredoka', 'Inter', sans-serif);
      font-size: .88rem; font-weight: 700;
      box-shadow: 0 2px 12px rgba(112,163,167,.3);
      transition: transform .15s;
    }
    .wsr-nq-btn:hover { transform: translateY(-1px); }
    .wsr-nq-or {
      font-size: .78rem; color: var(--charcoal-lt, rgba(64,59,51,.55));
      margin-top: 10px; display: block;
    }
    [data-theme="dark"] .wsr-nq-or { color: rgba(240,234,214,.4); }
  `;

  const styleEl = document.createElement('style');
  styleEl.id = 'wsr-styles';
  document.head.appendChild(styleEl);
  styleEl.textContent = CSS;

  // ── TOC ──────────────────────────────────────────────────────────────
  function buildTOC() {
    const article = document.querySelector('main, .workshop-content, .article-content, #main-content');
    if (!article) return;

    const headings = article.querySelectorAll('h2, h3');
    if (headings.length < 3) return; // not enough to need a TOC

    // Ensure headings have IDs
    const usedSlugs = {};
    headings.forEach((h) => {
      if (!h.id) {
        let slug = h.textContent.trim().toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 50);
        let base = slug, n = 1;
        while (usedSlugs[slug]) { slug = base + '-' + n++; }
        usedSlugs[slug] = true;
        h.id = slug;
      } else {
        usedSlugs[h.id] = true;
      }
    });

    const nav = document.createElement('nav');
    nav.className = 'wsr-toc';
    nav.setAttribute('aria-label', 'Table of contents');

    const titleEl = document.createElement('div');
    titleEl.className = 'wsr-toc-title';
    titleEl.textContent = 'Contents';
    nav.appendChild(titleEl);

    const ul = document.createElement('ul');
    ul.className = 'wsr-toc-list';

    const links = [];
    headings.forEach((h) => {
      const li = document.createElement('li');
      li.className = 'wsr-toc-item';
      const a = document.createElement('a');
      a.href = '#' + h.id;
      a.className = 'wsr-toc-link' + (h.tagName === 'H3' ? ' wsr-h3' : '');
      a.textContent = h.textContent.trim();
      a.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      li.appendChild(a);
      ul.appendChild(li);
      links.push({ el: a, heading: h });
    });

    nav.appendChild(ul);
    document.body.insertBefore(nav, document.body.firstChild);

    // Intersection observer for active highlight
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const match = links.find((l) => l.heading === entry.target);
          if (match) match.el.classList.toggle('active', entry.isIntersecting);
        });
      },
      { rootMargin: '-60px 0px -70% 0px', threshold: 0 }
    );
    headings.forEach((h) => observer.observe(h));
  }

  // ── NEXT QUEST ───────────────────────────────────────────────────────
  function buildNextQuest() {
    const bd = document.body;
    if (!bd) return;

    // Get current workshop ID from body attribute
    const currentId = (bd.dataset.profileId || bd.dataset.workshopKey || '')
      .replace(/^jvds-?/, '').replace(/-v\d+$/, '');
    if (!currentId) return;

    fetch('/content/workshops.json')
      .then((r) => r.json())
      .then((workshops) => {
        if (!Array.isArray(workshops) || !workshops.length) return;

        const current = workshops.find((w) => w.id === currentId || w.url.includes(currentId));
        if (!current) return;

        // Get completed workshops from playerProfile
        const done = new Set();
        try {
          if (window.playerProfile && window.playerProfile.state) {
            (window.playerProfile.state.completedWorkshops || []).forEach((id) => done.add(id));
          }
        } catch (_) {}

        // Strategy: same engine → same difficulty → anything beginner
        const sameEngine = workshops.filter(
          (w) => w.id !== current.id && w.engine === current.engine && !done.has(w.id)
        );
        const sameDiff = sameEngine.filter((w) => w.difficulty === current.difficulty);
        const nextSteps = sameDiff.length ? sameDiff : sameEngine;

        // Prefer episodes in the same series (title has same prefix before "Episode")
        const seriesPrefix = current.title.split(/episode|ep\s*\d|part\s*\d/i)[0].trim().slice(0, 30);
        const seriesNext = nextSteps.filter((w) => w.title.startsWith(seriesPrefix));
        const candidate = seriesNext[0] || nextSteps[0] || workshops.filter((w) => w.difficulty === 'beginner' && !done.has(w.id))[0];

        if (!candidate) return;

        // Build "Next Quest" card
        const section = document.createElement('section');
        section.className = 'wsr-next-quest';
        section.setAttribute('aria-label', 'Recommended next workshop');

        const tags = [candidate.engine, candidate.difficulty, 'Ages ' + candidate.ageRange]
          .filter(Boolean)
          .map((t) => `<span class="wsr-nq-tag">${t}</span>`)
          .join('');

        section.innerHTML =
          `<div class="wsr-nq-kicker">Next Quest · Based on your progress</div>` +
          `<div class="wsr-nq-title">${candidate.title}</div>` +
          `<p class="wsr-nq-desc">${candidate.desc}</p>` +
          `<div class="wsr-nq-tags">${tags}</div>` +
          `<a class="wsr-nq-btn" href="${candidate.url}">Start next quest →</a>` +
          `<span class="wsr-nq-or"><a href="/workshop">Or browse all workshops</a></span>`;

        // Insert before site footer
        const footer = document.querySelector('footer.site-footer');
        (footer ? footer.parentNode : document.body).insertBefore(section, footer);
      })
      .catch(() => {});
  }

  // ── INIT ─────────────────────────────────────────────────────────────
  function init() {
    buildTOC();
    // Next Quest needs playerProfile for "done" state - wait a tick
    setTimeout(buildNextQuest, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
