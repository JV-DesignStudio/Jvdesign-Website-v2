/* ============================================================
   assets/js/studio/studio-inspector.js - accessibility inspector

   A quick, local check for the things a learner can fix without
   developer tools: contrast, image text alternatives, tiny text,
   unnamed controls, positive tabindex and horizontally scrolling
   blocks. Report only; it never edits the page.

   This is a helper, not a replacement for axe or a human review.
   ============================================================ */
(function () {
  'use strict';
  var S = window.JVDSStudio = window.JVDSStudio || {};
  var api = S.inspector = S.inspector || {};

  var LIMIT = 240;

  function parseColor(input) {
    if (!input) return { r: 0, g: 0, b: 0, a: 0 };
    var m = String(input).match(/rgba?\(([^)]+)\)/i);
    if (!m) return { r: 0, g: 0, b: 0, a: 1 };
    var parts = m[1].split(',').map(function (v) { return parseFloat(v); });
    return { r: parts[0] || 0, g: parts[1] || 0, b: parts[2] || 0, a: parts.length > 3 ? parts[3] : 1 };
  }

  function blend(fg, bg) {
    var a = fg.a;
    return {
      r: Math.round(fg.r * a + bg.r * (1 - a)),
      g: Math.round(fg.g * a + bg.g * (1 - a)),
      b: Math.round(fg.b * a + bg.b * (1 - a)),
      a: 1
    };
  }

  function backgroundOf(el) {
    var node = el;
    var stack = [];
    while (node && node.nodeType === 1) {
      var bg = parseColor(getComputedStyle(node).backgroundColor);
      if (bg.a > 0) { stack.push(bg); if (bg.a >= 0.999) break; }
      node = node.parentElement;
    }
    var base = { r: 255, g: 255, b: 255, a: 1 };
    for (var i = stack.length - 1; i >= 0; i--) base = blend(stack[i], base);
    return base;
  }

  function luminance(c) {
    var channel = [c.r, c.g, c.b].map(function (v) {
      v = v / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * channel[0] + 0.7152 * channel[1] + 0.0722 * channel[2];
  }

  function ratio(a, b) {
    var l1 = luminance(a);
    var l2 = luminance(b);
    var light = Math.max(l1, l2);
    var dark = Math.min(l1, l2);
    return (light + 0.05) / (dark + 0.05);
  }

  function accessibleName(el) {
    var label = el.getAttribute('aria-label');
    if (label && label.trim()) return label.trim();
    var by = el.getAttribute('aria-labelledby');
    if (by) {
      var text = by.split(/\s+/).map(function (id) {
        var ref = document.getElementById(id);
        return ref ? ref.textContent.trim() : '';
      }).join(' ').trim();
      if (text) return text;
    }
    if (el.tagName === 'IMG') return (el.getAttribute('alt') || '').trim();
    if (el.getAttribute('title')) return el.getAttribute('title').trim();
    var inner = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (inner) return inner;
    if (el.id) {
      var safeId = String(el.id).replace(/["\\]/g, '');
      var explicit = document.querySelector('label[for="' + safeId + '"]');
      if (explicit) return explicit.textContent.trim();
    }
    var parentLabel = el.closest('label');
    if (parentLabel) return parentLabel.textContent.trim();
    return '';
  }

  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    var style = getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity || 1) > 0.05;
  }

  function describe(el) {
    var tag = el.tagName.toLowerCase();
    var id = el.id ? '#' + el.id : '';
    var cls = el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    return tag + id + cls;
  }

  function textNodes() {
    var out = [];
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|OPTION)$/.test(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.closest('[hidden],[aria-hidden="true"]')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var node;
    while ((node = walker.nextNode()) && out.length < LIMIT) out.push(node);
    return out;
  }

  function runChecks() {
    var issues = [];
    var seen = new Set();

    textNodes().forEach(function (node) {
      var el = node.parentElement;
      if (!el || seen.has(el) || !visible(el)) return;
      seen.add(el);
      var style = getComputedStyle(el);
      var size = parseFloat(style.fontSize) || 16;
      var weight = parseInt(style.fontWeight, 10) || 400;
      var large = size >= 24 || (size >= 18.66 && weight >= 700);
      var fg = parseColor(style.color);
      var bg = backgroundOf(el);
      var contrast = ratio(fg.a < 1 ? blend(fg, bg) : fg, bg);
      var need = large ? 3 : 4.5;
      if (contrast + 0.05 < need) {
        issues.push({
          tone: 'danger',
          title: 'Low contrast (' + contrast.toFixed(2) + ':1, needs ' + need + ':1)',
          where: describe(el),
          sample: (node.nodeValue || '').replace(/\s+/g, ' ').trim().slice(0, 70)
        });
      }
      if (size < 12) {
        issues.push({
          tone: 'warn',
          title: 'Tiny text (' + size.toFixed(1) + 'px)',
          where: describe(el),
          sample: (node.nodeValue || '').trim().slice(0, 70)
        });
      }
    });

    Array.prototype.slice.call(document.querySelectorAll('img')).forEach(function (img) {
      if (!visible(img)) return;
      if (!img.hasAttribute('alt')) {
        issues.push({ tone: 'danger', title: 'Image has no alt text', where: describe(img), sample: img.getAttribute('src') || '' });
      }
    });

    Array.prototype.slice.call(document.querySelectorAll('button,a[href],[role="button"],input,select,textarea')).forEach(function (el) {
      if (!visible(el)) return;
      if (el.type === 'hidden') return;
      var name = accessibleName(el);
      if (!name) {
        issues.push({ tone: 'danger', title: 'Control has no accessible name', where: describe(el), sample: (el.getAttribute('href') || el.getAttribute('type') || '') });
      }
    });

    Array.prototype.slice.call(document.querySelectorAll('[tabindex]')).forEach(function (el) {
      var value = Number(el.getAttribute('tabindex'));
      if (value > 0) {
        issues.push({ tone: 'warn', title: 'Positive tabindex (' + value + ')', where: describe(el), sample: 'Use DOM order instead.' });
      }
    });

    Array.prototype.slice.call(document.querySelectorAll('pre,table,img,canvas,.jvs-hint')).slice(0, 120).forEach(function (el) {
      if (!visible(el)) return;
      if (el.scrollWidth > el.clientWidth + 8 && getComputedStyle(el).overflowX !== 'auto' && getComputedStyle(el).overflowX !== 'scroll') {
        issues.push({ tone: 'warn', title: 'Block scrolls sideways', where: describe(el), sample: el.scrollWidth + 'px wide in a ' + el.clientWidth + 'px space' });
      }
    });

    return issues;
  }

  api.run = function () {
    var issues = [];
    try { issues = runChecks(); } catch (e) { issues = [{ tone: 'warn', title: 'The check could not finish', where: '', sample: e.message }]; }
    var danger = issues.filter(function (i) { return i.tone === 'danger'; }).length;
    var summary = danger ? danger + ' serious issue(s), ' + issues.length + ' in total.' : issues.length ? issues.length + ' suggestion(s).' : 'No obvious problems found.';

    var body = S._h('div', {}, [
      S._h('p', { text: 'A quick local check of this page. It looks for contrast, alt text, tiny text, unnamed controls, tab order and sideways scrolling.', style: { lineHeight: '1.6', margin: '0 0 12px' } }),
      S._h('p', {}, [
        S._h('strong', { text: summary }),
        S._h('br'),
        S._h('span', { class: 'jvs-hint', text: 'Echo says: fix the serious ones first, then ask a friend to try the page.' })
      ]),
      S._h('ul', { class: 'jvs-inspector-list' }, issues.slice(0, 40).map(function (issue) {
        return S._h('li', { 'data-tone': issue.tone }, [
          S._h('strong', { text: issue.title }),
          issue.where ? S._h('div', {}, [S._h('code', { text: issue.where })]) : null,
          issue.sample ? S._h('div', { text: issue.sample }) : null
        ]);
      }))
    ]);

    S.drawer({
      title: 'Accessibility check',
      content: body
    });
    return { issues: issues, summary: summary };
  };
})();
