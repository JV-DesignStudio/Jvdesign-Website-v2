(function () {
  'use strict';

  var ENGINE_FILES = {
    scratch: '/data/error-guide/errors-scratch.json',
    roblox: '/data/error-guide/errors-roblox.json',
    godot: '/data/error-guide/errors-godot.json',
    unity: '/data/error-guide/errors-unity.json',
    python: '/data/error-guide/errors-python.json',
    javascript: '/data/error-guide/errors-javascript.json'
  };
  var ENGINE_LABELS = {
    scratch: 'Scratch',
    roblox: 'Roblox',
    godot: 'Godot',
    unity: 'Unity',
    python: 'Python / Pygame',
    javascript: 'JavaScript'
  };
  var SYMPTOM_LABELS = {
    'physics-fall': 'falls through the floor',
    'physics-stuck': 'gets stuck in a wall',
    'visual-wrong': 'screen colour looks wrong',
    'visual-jitter': 'animations are jittery',
    'visual-blank': 'screen stays blank',
    'visual-silent': 'there is no sound',
    'logic-score': 'score will not go up',
    'logic-not-responding': 'game will not respond or restart'
  };

  var tabs = Array.prototype.slice.call(document.querySelectorAll('.engine-tab'));
  var sections = Array.prototype.slice.call(document.querySelectorAll('.engine-section'));
  var searchInput = document.getElementById('searchInput');
  var searchCount = document.getElementById('searchCount');
  var searchClear = document.getElementById('searchClear');
  var noResults = document.getElementById('noResults');
  var noResultsTerm = document.getElementById('noResultsTerm');
  var symptomGrid = document.getElementById('symptomGrid');
  var symptomStatus = document.getElementById('symptomStatus');
  var diagnosis = document.getElementById('egDiagnosis');
  var egEngine = document.getElementById('egEngine');
  var egKidTitle = document.getElementById('egKidTitle');
  var egChar = document.getElementById('egChar');
  var egPlain = document.getElementById('egPlain');
  var egProblem = document.getElementById('egProblem');
  var egPrevent = document.getElementById('egPrevent');
  var egChecklist = document.getElementById('egChecklist');
  var egProgress = document.getElementById('egProgress');
  var egSnippet = document.getElementById('egSnippet');
  var egSquash = document.getElementById('egSquash');
  var egDone = document.getElementById('egDone');
  var egClose = document.getElementById('egClose');
  var egPlanLink = document.getElementById('egPlanLink');

  var data = {};
  var allLoaded = false;
  var worker = null;
  var workerReady = false;
  var workerSeq = 0;
  var workerPending = {};
  var lastMatches = [];
  var lastQuery = '';
  var currentCard = null;
  var currentGroups = [];
  var lastTicket = null;

  try {
    worker = new Worker('/assets/js/error-guide-worker.js');
    worker.onmessage = function (event) {
      var message = event.data || {};
      var resolve = workerPending[message.id];
      if (!resolve) return;
      delete workerPending[message.id];
      resolve(message.matches || []);
    };
    worker.onerror = function () {
      workerReady = false;
      worker = null;
    };
    workerReady = true;
  } catch (error) {
    worker = null;
    workerReady = false;
  }

  function fetchJSON(url) {
    return fetch(url, { credentials: 'same-origin' }).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    });
  }

  function loadEngine(engine) {
    if (data[engine]) return Promise.resolve(data[engine]);
    if (!ENGINE_FILES[engine]) return Promise.resolve([]);
    return fetchJSON(ENGINE_FILES[engine]).then(function (cards) {
      data[engine] = cards;
      assignIds(engine, cards);
      return cards;
    }).catch(function () {
      data[engine] = [];
      return [];
    });
  }

  function loadAll() {
    if (allLoaded) return Promise.resolve(allCards());
    return Promise.all(Object.keys(ENGINE_FILES).map(loadEngine)).then(function () {
      allLoaded = true;
      return allCards();
    });
  }

  function allCards() {
    var cards = [];
    Object.keys(ENGINE_FILES).forEach(function (engine) {
      cards = cards.concat(data[engine] || []);
    });
    return cards;
  }

  function cardById(id) {
    var found = null;
    allCards().forEach(function (card) {
      if (card.id === id) found = card;
    });
    return found;
  }

  function assignIds(engine, cards) {
    var section = document.getElementById('engine-' + engine);
    if (!section) return;
    var domCards = section.querySelectorAll('.error-card');
    cards.forEach(function (card, index) {
      var el = domCards[index];
      if (!el) return;
      el.setAttribute('data-card-id', card.id);
      el.setAttribute('data-engine', engine);
      decorateCard(el);
    });
  }

  function cardIdForElement(cardEl) {
    if (!cardEl) return null;
    var assigned = cardEl.getAttribute('data-card-id');
    if (assigned) return assigned;
    var section = cardEl.closest('.engine-section');
    if (!section) return null;
    var engine = section.id.replace('engine-', '');
    var cards = Array.prototype.slice.call(section.querySelectorAll('.error-card'));
    var index = cards.indexOf(cardEl);
    var model = (data[engine] || [])[index];
    return model ? model.id : null;
  }

  function decorateCard(cardEl) {
    var title = cardEl.querySelector('.error-title');
    if (!title) return;
    if (!title.querySelector('.card-copy')) {
      var copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'card-copy';
      copy.textContent = 'Copy fix';
      copy.setAttribute('aria-label', 'Copy this fix to the clipboard');
      copy.addEventListener('click', function () {
        var heading = (cardEl.querySelector('.error-title').textContent || '').replace('Copy fix', '').replace('Get the plan', '').trim();
        var steps = Array.prototype.map.call(cardEl.querySelectorAll('.solution-steps li'), function (li) {
          return li.textContent.replace(/\s+/g, ' ').trim();
        });
        var text = heading + '\n\n' + steps.map(function (step, i) { return (i + 1) + '. ' + step; }).join('\n');
        copyText(text, copy, true);
      });
      title.appendChild(copy);
    }
    if (!title.querySelector('.card-diagnose')) {
      var plan = document.createElement('button');
      plan.type = 'button';
      plan.className = 'card-diagnose';
      plan.textContent = 'Get the plan';
      plan.setAttribute('aria-label', 'Open the step-by-step plan for this bug');
      plan.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        var id = cardIdForElement(cardEl);
        if (!id) return;
        var model = cardById(id);
        openDiagnosis(id, groupsForQuery(model, lastQuery));
      });
      title.appendChild(plan);
    }
  }

  function syncClear() {
    if (searchClear) searchClear.hidden = !(searchInput && searchInput.value);
  }

  function resetCards() {
    document.querySelectorAll('.error-card').forEach(function (card) {
      card.classList.remove('hidden');
    });
    if (noResults) noResults.hidden = true;
  }

  function setActiveTab(engine) {
    tabs.forEach(function (tab) {
      var on = tab.getAttribute('data-engine') === engine;
      tab.classList.toggle('active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.setAttribute('tabindex', on ? '0' : '-1');
    });
  }

  function showEngine(engine) {
    closeDiagnosis();
    setActiveTab(engine);
    sections.forEach(function (section) {
      section.style.display = '';
      section.classList.toggle('visible', section.id === 'engine-' + engine);
    });
    if (searchInput) searchInput.value = '';
    if (searchCount) searchCount.textContent = '';
    if (symptomStatus) symptomStatus.textContent = '';
    syncClear();
    resetCards();
    loadEngine(engine);
  }

  function clearSearch() {
    var active = document.querySelector('.engine-tab.active');
    showEngine(active ? active.getAttribute('data-engine') : 'scratch');
    if (searchInput) searchInput.focus();
  }

  function sanitize(text) {
    var value = String(text == null ? '' : text);
    value = value.replace(/^\s*at\s+.*$/gmi, ' ');
    value = value.replace(/[A-Za-z]:[\\/][^\s'"()]+/g, ' ');
    value = value.replace(/(?:^|\s)(?:file:\/\/\/)?(?:\.{0,2}\/|\/)(?:[^\s'"():]+[\\/])+[^\s'"():]+/g, ' ');
    value = value.replace(/\b0x[0-9a-f]+\b/gi, ' ');
    value = value.replace(/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\b/g, ' ');
    value = value.replace(/\b\d{1,2}:\d{2}:\d{2}(?:\.\d+)?\b/g, ' ');
    value = value.replace(/\bline\s+\d+(?::\d+)?\b/gi, ' ');
    value = value.replace(/\s+/g, ' ').trim();
    return value;
  }

  function groupsForQuery(card, query) {
    if (!card || !card.raw_signature || !query) return [];
    try {
      var match = new RegExp(card.raw_signature, 'i').exec(query);
      if (!match) return [];
      return match.slice(1).filter(function (group) { return group != null && group !== ''; });
    } catch (error) {
      return [];
    }
  }

  function matchCard(card, query) {
    var groups = [];
    if (card.raw_signature) {
      try {
        var match = new RegExp(card.raw_signature, 'i').exec(query);
        if (match) {
          groups = match.slice(1).filter(function (group) { return group != null && group !== ''; });
          return { hit: true, groups: groups };
        }
      } catch (error) {}
    }
    var haystack = [
      card.kid_title,
      card.plain_translation,
      card.keywords,
      (card.checklist_fixes || []).join(' ')
    ].join(' ').toLowerCase();
    if (haystack.indexOf(String(query).toLowerCase()) !== -1) return { hit: true, groups: groups };
    return { hit: false, groups: groups };
  }

  function localSearch(query, cards) {
    var results = [];
    cards.forEach(function (card) {
      var matched = matchCard(card, query);
      if (matched.hit) results.push({ id: card.id, groups: matched.groups });
    });
    return results;
  }

  function workerSearch(query, cards) {
    if (!worker || !workerReady) return Promise.resolve(localSearch(query, cards));
    return new Promise(function (resolve) {
      var id = ++workerSeq;
      var timer = setTimeout(function () {
        delete workerPending[id];
        resolve(localSearch(query, cards));
      }, 700);
      workerPending[id] = function (matches) {
        clearTimeout(timer);
        resolve(matches);
      };
      worker.postMessage({
        id: id,
        query: query,
        cards: cards.map(function (card) {
          return {
            id: card.id,
            raw_signature: card.raw_signature,
            kid_title: card.kid_title,
            plain_translation: card.plain_translation,
            keywords: card.keywords,
            checklist_fixes: card.checklist_fixes
          };
        })
      });
    });
  }

  function searchCards(query) {
    return loadAll().then(function (cards) {
      return workerSearch(query, cards);
    });
  }

  function filterCards(matches, term, options) {
    var ids = {};
    matches.forEach(function (match) { ids[match.id] = match; });
    var useFallback = !!(options && options.fallback && term);
    var found = 0;
    document.querySelectorAll('.error-card').forEach(function (card) {
      var id = card.getAttribute('data-card-id');
      var hit = !!(id && ids[id]);
      if (!hit && useFallback) {
        var text = (card.textContent + ' ' + (card.dataset.keywords || '')).toLowerCase();
        hit = text.indexOf(String(term).toLowerCase()) !== -1;
      }
      card.classList.toggle('hidden', !hit);
      if (hit) found++;
    });
    return found;
  }

  function runSearch(rawQuery) {
    var query = sanitize(rawQuery);
    lastQuery = query;
    if (!query) {
      var active = document.querySelector('.engine-tab.active') || tabs[0];
      showEngine(active.getAttribute('data-engine'));
      return;
    }
    sections.forEach(function (section) {
      section.style.display = '';
      section.classList.add('visible');
    });
    if (searchCount) searchCount.textContent = 'Searching...';
    searchCards(query).then(function (matches) {
      lastMatches = matches;
      var found = filterCards(matches, query, { fallback: true });
      if (searchCount) searchCount.textContent = found + ' error' + (found === 1 ? '' : 's') + ' found';
      if (noResults) {
        if (noResultsTerm) noResultsTerm.textContent = rawQuery.trim();
        noResults.hidden = found !== 0;
      }
    });
  }

  function showSymptom(symptom) {
    var label = SYMPTOM_LABELS[symptom] || 'that symptom';
    loadAll().then(function (cards) {
      var matches = [];
      cards.forEach(function (card) {
        if ((card.symptoms || []).indexOf(symptom) !== -1) matches.push({ id: card.id, groups: [] });
      });
      sections.forEach(function (section) {
        section.style.display = '';
        section.classList.add('visible');
      });
      var found = filterCards(matches, '', { fallback: false });
      if (searchInput) searchInput.value = '';
      syncClear();
      if (searchCount) searchCount.textContent = found + ' fix' + (found === 1 ? '' : 'es') + ' for ' + label;
      if (symptomStatus) symptomStatus.textContent = found ? 'Showing ' + found + ' fix' + (found === 1 ? '' : 'es') + ' for ' + label + '.' : 'No fix is tagged for that symptom yet. Try the search box.';
      if (noResults) noResults.hidden = found !== 0;
      if (matches.length) {
        openDiagnosis(matches[0].id, []);
      }
    });
  }

  function plainFor(card, groups) {
    var value = (groups || []).filter(Boolean)[0] || 'that value';
    return String(card.plain_translation || '').replace(/\{value\}/g, value);
  }

  function openDiagnosis(cardId, groups) {
    loadAll().then(function () {
      var card = cardById(cardId);
      if (!card) return;
      currentCard = card;
      currentGroups = groups || [];
      lastTicket = null;
      if (egDone) {
        egDone.textContent = 'Bug squashed';
        egDone.disabled = true;
      }
      if (diagnosis) diagnosis.hidden = false;
      document.body.classList.add('eg-diagnosis-open');
      if (egEngine) egEngine.textContent = (ENGINE_LABELS[card.engine] || card.engine) + ' · ' + (card.ip_character || 'Echo') + ' is looking at it';
      if (egKidTitle) egKidTitle.textContent = card.kid_title;
      if (egChar) {
        var character = String(card.ip_character || 'Echo').toLowerCase();
        egChar.src = '/assets/mascots/' + character + '-badge.webp';
        egChar.alt = card.ip_character || 'Echo';
      }
      if (egPlain) egPlain.textContent = plainFor(card, currentGroups);
      if (egProblem) egProblem.innerHTML = card.problem_html || '';
      if (egPrevent) egPrevent.innerHTML = card.prevention_html || '';
      renderChecklist(card);
      if (egSnippet) {
        if (card.snippet_handoff_id) {
          egSnippet.href = '/tools/code-snippet-generator.html#snippet=' + encodeURIComponent(card.snippet_handoff_id);
          egSnippet.hidden = false;
        } else {
          egSnippet.hidden = true;
          egSnippet.removeAttribute('href');
        }
      }
      if (egSquash) {
        egSquash.disabled = false;
        egSquash.textContent = 'Squash the Bug';
      }
      if (egPlanLink) {
        egPlanLink.hidden = !lastTicket;
        if (lastTicket) egPlanLink.href = '/tools/quest-board.html';
      }
      if (diagnosis) diagnosis.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (diagnosis) diagnosis.focus({ preventScroll: true });
    });
  }

  function renderChecklist(card) {
    if (!egChecklist) return;
    egChecklist.innerHTML = '';
    var fixes = card.checklist_fixes || [];
    fixes.forEach(function (text) {
      var li = document.createElement('li');
      var label = document.createElement('label');
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'eg-check';
      var span = document.createElement('span');
      span.textContent = text;
      label.appendChild(input);
      label.appendChild(span);
      li.appendChild(label);
      egChecklist.appendChild(li);
      input.addEventListener('change', updateProgress);
    });
    updateProgress();
  }

  function updateProgress() {
    if (!egChecklist) return;
    var checks = Array.prototype.slice.call(egChecklist.querySelectorAll('input[type="checkbox"]'));
    var done = checks.filter(function (check) { return check.checked; }).length;
    if (egProgress) egProgress.textContent = done + ' of ' + checks.length + ' checks done';
    if (egDone) egDone.disabled = !(checks.length && done === checks.length);
  }

  function addToGamePlan(card) {
    var key = 'qb-data-v1';
    var plan = {
      columns: [
        { id: 'todo', title: 'To Do', colour: '#42d3b2' },
        { id: 'doing', title: 'In Progress', colour: '#f5c842' },
        { id: 'done', title: 'Complete', colour: '#9eacc4' }
      ],
      cards: [],
      nextId: 1
    };
    try {
      var saved = JSON.parse(localStorage.getItem(key) || 'null');
      if (saved && Array.isArray(saved.cards)) plan = saved;
    } catch (error) {}
    if (!Array.isArray(plan.columns) || !plan.columns.length) {
      plan.columns = [
        { id: 'todo', title: 'To Do', colour: '#42d3b2' },
        { id: 'doing', title: 'In Progress', colour: '#f5c842' },
        { id: 'done', title: 'Complete', colour: '#9eacc4' }
      ];
    }
    var id = 'q' + (Number(plan.nextId) || 1);
    plan.cards.push({
      id: id,
      title: 'Fix: ' + card.kid_title,
      desc: (card.checklist_fixes || []).map(function (step, index) { return (index + 1) + '. ' + step; }).join('\n'),
      colId: 'todo',
      priority: 'high',
      createdAt: new Date().toISOString()
    });
    plan.nextId = (Number(plan.nextId) || 1) + 1;
    localStorage.setItem(key, JSON.stringify(plan));
    try { localStorage.setItem('jvds-tracker-v2', JSON.stringify(plan)); } catch (error) {}
    lastTicket = id;
    return id;
  }

  function announceBugSquashed(card) {
    var payload = {
      type: 'bug_squashed',
      engine: card.engine,
      id: card.id,
      title: card.kid_title
    };
    try {
      if (window.parent && window.parent !== window) window.parent.postMessage(payload, '*');
    } catch (error) {}
    try {
      window.dispatchEvent(new CustomEvent('bug_squashed', { detail: payload }));
    } catch (error) {}
  }

  function closeDiagnosis() {
    if (diagnosis) diagnosis.hidden = true;
    document.body.classList.remove('eg-diagnosis-open');
    currentCard = null;
    currentGroups = [];
  }

  function flashCopied(el) {
    if (!el) return;
    el.classList.add('copied');
    setTimeout(function () { el.classList.remove('copied'); }, 1200);
  }

  function legacyCopy(text, done) {
    try {
      var textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      done();
    } catch (error) {}
  }

  function copyText(text, el, label) {
    var done = function () {
      if (el && label) {
        var old = el.textContent;
        el.textContent = 'Copied!';
        flashCopied(el);
        setTimeout(function () { el.textContent = old; }, 1200);
      } else {
        flashCopied(el);
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () { legacyCopy(text, done); });
    } else {
      legacyCopy(text, done);
    }
  }

  tabs.forEach(function (tab, index) {
    tab.addEventListener('click', function () { showEngine(tab.getAttribute('data-engine')); });
    tab.addEventListener('keydown', function (event) {
      var next = null;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      if (next !== null) {
        event.preventDefault();
        tabs[next].focus();
        showEngine(tabs[next].getAttribute('data-engine'));
      }
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      syncClear();
      var raw = this.value;
      if (!raw.trim()) {
        var active = document.querySelector('.engine-tab.active') || tabs[0];
        showEngine(active.getAttribute('data-engine'));
        return;
      }
      runSearch(raw);
    });
    searchInput.addEventListener('paste', function (event) {
      var clipboard = event.clipboardData || window.clipboardData;
      if (!clipboard) return;
      var text = clipboard.getData('text');
      if (!text) return;
      event.preventDefault();
      this.value = sanitize(text);
      syncClear();
      runSearch(this.value);
    });
    searchInput.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') clearSearch();
      if (event.key === 'Enter' && lastMatches.length) {
        event.preventDefault();
        openDiagnosis(lastMatches[0].id, lastMatches[0].groups || []);
      }
    });
  }

  var noResultsClear = document.getElementById('noResultsClear');
  if (noResultsClear) noResultsClear.addEventListener('click', clearSearch);
  if (searchClear) searchClear.addEventListener('click', clearSearch);

  var heroFind = document.getElementById('heroFind');
  if (heroFind) heroFind.addEventListener('click', function () {
    if (!searchInput) return;
    searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    searchInput.focus();
  });

  document.querySelectorAll('.qf-chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var query = chip.getAttribute('data-search') || chip.textContent.trim();
      if (searchInput) {
        searchInput.value = query;
        syncClear();
        runSearch(query);
        searchInput.focus();
      }
    });
  });

  if (symptomGrid) {
    symptomGrid.addEventListener('click', function (event) {
      var button = event.target.closest('.symptom-card');
      if (!button) return;
      showSymptom(button.getAttribute('data-symptom'));
    });
  }

  sections.forEach(function (section) {
    var badge = section.querySelector('.engine-badge');
    if (!badge) return;
    var count = section.querySelectorAll('.error-card').length;
    badge.textContent = count + ' Error' + (count === 1 ? '' : 's');
  });

  document.querySelectorAll('.error-card code').forEach(function (code) {
    code.classList.add('copyable');
    code.setAttribute('title', 'Click to copy');
    code.addEventListener('click', function () { copyText(code.textContent, code, false); });
  });

  if (egClose) egClose.addEventListener('click', function () {
    closeDiagnosis();
    if (searchInput) searchInput.focus();
  });

  if (egSquash) egSquash.addEventListener('click', function () {
    if (!currentCard) return;
    var id = addToGamePlan(currentCard);
    egSquash.textContent = 'Added to Game Planner';
    egSquash.disabled = true;
    if (egPlanLink) {
      egPlanLink.hidden = false;
      egPlanLink.href = '/tools/quest-board.html';
    }
    if (symptomStatus) symptomStatus.textContent = 'Quest ' + id + ' added to your Game Planner.';
  });

  if (egDone) egDone.addEventListener('click', function () {
    if (!currentCard || egDone.disabled) return;
    announceBugSquashed(currentCard);
    egDone.textContent = 'Bug squashed!';
    egDone.disabled = true;
  });

  window.ErrorGuide = {
    sanitize: sanitize,
    search: function (query) { return searchCards(sanitize(query)); },
    openDiagnosis: openDiagnosis,
    close: closeDiagnosis,
    get workerUsed() { return workerReady; },
    get data() { return data; }
  };

  document.querySelectorAll('.error-card').forEach(decorateCard);
  loadEngine('scratch');
})();
