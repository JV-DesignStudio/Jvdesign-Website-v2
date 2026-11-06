/* Workshop course nav (A2268).
   Adds a "Step 3 of 8" bar with a real Back and Next link on every workshop
   that belongs to an ordered course, plus a Continue card and a course map on
   the learn hub. The order lives in content/courses.json, built by
   scripts/build-course-map.js from the WS-NEXT blocks the pages already carry. */
(function () {
  'use strict';

  var COURSES_URL = '/content/courses.json';
  var LAST_KEY = 'jvds_last_workshop';
  var LAST_KEY_ALT = 'jvds-last-workshop';
  var COURSE_KEY = 'jvds_last_course_step';
  var HUB_SLUGS = { learn: 1, index: 1, workshop: 1, 'start-here': 1, 'learning-lab': 1, 'tiny-learners': 1, 'my-progress': 1, 'my-first-series': 1 };
  var coursesPromise = null;

  function slug() {
    return (location.pathname.split('/').pop() || '').replace(/\.html?$/i, '');
  }

  function fetchCourses() {
    if (coursesPromise) return coursesPromise;
    coursesPromise = fetch(COURSES_URL, { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('courses ' + r.status);
        return r.json();
      })
      .then(function (data) {
        return Array.isArray(data.courses) ? data.courses : [];
      })
      .catch(function () {
        return [];
      });
    return coursesPromise;
  }

  function findStep(courses, id) {
    for (var i = 0; i < courses.length; i++) {
      var steps = courses[i].steps || [];
      for (var j = 0; j < steps.length; j++) {
        if (steps[j].slug === id) return { course: courses[i], index: j, steps: steps };
      }
    }
    return null;
  }

  function hrefFor(id) {
    return '/workshops/' + id + '.html';
  }

  function safeResume() {
    var raw;
    try {
      raw = localStorage.getItem(COURSE_KEY) || localStorage.getItem(LAST_KEY) || localStorage.getItem(LAST_KEY_ALT);
    } catch (e) {
      return null;
    }
    if (!raw) return null;
    if (/["'<>]/.test(raw) || /^\s*(javascript|data):/i.test(raw)) return null;
    try {
      var url = new URL(raw, location.href);
      if (url.origin !== location.origin) return null;
      if (!/^\/workshops\/[^/]+\.html$/.test(url.pathname)) return null;
      var id = url.pathname.split('/').pop().replace(/\.html?$/i, '');
      if (HUB_SLUGS[id]) return null;
      return url.pathname;
    } catch (e) {
      return null;
    }
  }

  function remember() {
    try {
      localStorage.setItem(COURSE_KEY, location.pathname);
    } catch (e) {}
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function shortLabel(title) {
    var text = String(title || '').replace(/\s+/g, ' ').trim();
    var match = text.match(/^(Episode\s+\d+|Part\s+\d+|Who Goes There\?\s+Part\s+\d+)\s*[:.]?\s*(.*)$/i);
    if (match) {
      text = match[1] + (match[2] ? ': ' + match[2] : '');
    }
    if (text.length > 40) text = text.slice(0, 37).trim() + '\u2026';
    return text;
  }

  function insertNav(nav) {
    if (document.querySelector('[data-course-nav]')) return;
    var anchor = document.getElementById('main-content') || document.querySelector('main');
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(nav, anchor);
    } else {
      document.body.insertBefore(nav, document.body.firstChild);
    }
  }

  function renderNav(courses) {
    var match = findStep(courses, slug());
    if (!match) return;
    var steps = match.steps;
    var index = match.index;
    var course = match.course;
    var prev = index > 0 ? steps[index - 1] : null;
    var next = index < steps.length - 1 ? steps[index + 1] : null;

    var nav = el('nav', 'ws-course-nav');
    nav.setAttribute('data-course-nav', course.id);
    nav.setAttribute('aria-label', course.name + ' course progress');

    var inner = el('div', 'ws-course-nav-inner');
    var top = el('div', 'ws-course-nav-top');
    top.appendChild(el('span', 'ws-course-nav-course', course.name));
    top.appendChild(el('span', 'ws-course-nav-count', 'Step ' + (index + 1) + ' of ' + steps.length));
    inner.appendChild(top);

    var links = el('div', 'ws-course-nav-links');
    var back = el('a', 'ws-course-nav-link ws-course-nav-prev');
    back.href = prev ? hrefFor(prev.slug) : (course.hub || '/workshop');
    back.textContent = prev ? '\u2190 ' + shortLabel(prev.title) : '\u2190 Course map';
    links.appendChild(back);

    var map = el('a', 'ws-course-nav-link ws-course-nav-hub', 'Course map');
    map.href = course.hub || '/workshop';
    links.appendChild(map);

    var forward = el('a', 'ws-course-nav-link ws-course-nav-next');
    forward.href = next ? hrefFor(next.slug) : (course.hub || '/workshop');
    forward.textContent = next ? shortLabel(next.title) + ' \u2192' : 'Course map \u2192';
    links.appendChild(forward);

    inner.appendChild(links);
    nav.appendChild(inner);
    insertNav(nav);
  }

  function renderResume(container, courses) {
    var section = container.closest('[data-learn-resume-section]') || container;
    var path = safeResume();
    if (!path) {
      container.hidden = true;
      if (section !== container) section.hidden = true;
      return;
    }
    var id = path.split('/').pop().replace(/\.html?$/i, '');
    var match = findStep(courses, id);
    var title = match ? match.steps[match.index].title : id.replace(/[-_]/g, ' ');
    var courseName = match ? match.course.name : 'Your last workshop';

    var card = el('a', 'learn-resume-card');
    card.href = path;
    var icon = el('span', 'learn-resume-icon', '\u25B6');
    icon.setAttribute('aria-hidden', 'true');
    card.appendChild(icon);
    var body = el('span', 'learn-resume-body');
    body.appendChild(el('strong', 'learn-resume-title', 'Continue where you left off'));
    body.appendChild(el('span', 'learn-resume-sub', title));
    body.appendChild(el('span', 'learn-resume-meta', courseName + (match ? ' \u00b7 Step ' + (match.index + 1) + ' of ' + match.steps.length : '')));
    card.appendChild(body);
    var cta = el('span', 'learn-resume-cta', 'Resume \u2192');
    card.appendChild(cta);
    container.replaceChildren(card);
  }

  function renderMap(container, courses, resumePath) {
    if (!courses.length) {
      container.replaceChildren();
      return;
    }
    var resumeId = resumePath ? resumePath.split('/').pop().replace(/\.html?$/i, '') : '';
    var frag = document.createDocumentFragment();
    courses.forEach(function (course) {
      var match = findStep([course], resumeId);
      var card = el('a', 'learn-course-card');
      card.href = match ? resumePath : hrefFor(course.steps[0].slug);
      card.appendChild(el('span', 'learn-course-name', course.name));
      card.appendChild(el('span', 'learn-course-meta', match
        ? 'Step ' + (match.index + 1) + ' of ' + course.steps.length + ' \u00b7 continue'
        : course.steps.length + ' step' + (course.steps.length === 1 ? '' : 's')));
      if (match) card.classList.add('is-current');
      frag.appendChild(card);
    });
    container.replaceChildren(frag);
  }

  function initHub(courses) {
    var resumeMount = document.querySelector('[data-learn-resume]');
    var mapMount = document.querySelector('[data-learn-course-map]');
    if (!resumeMount && !mapMount) return;
    var resumePath = safeResume();
    if (resumeMount) renderResume(resumeMount, courses);
    if (mapMount) renderMap(mapMount, courses, resumePath);
  }

  function start() {
    fetchCourses().then(function (courses) {
      if (findStep(courses, slug())) remember();
      renderNav(courses);
      initHub(courses);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
