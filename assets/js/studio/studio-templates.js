/* ============================================================
   assets/js/studio/studio-templates.js - remixable starters

   Reads content/studio-templates.json and shows a small gallery
   inside a modal. Each starter can be downloaded as a real file,
   or opened in the tool it belongs to. No accounts, no network
   beyond the same-origin JSON.
   ============================================================ */
(function () {
  'use strict';
  var S = window.JVDSStudio = window.JVDSStudio || {};
  var api = S.templates = S.templates || {};

  var SOURCE = '/content/studio-templates.json';
  var cache = null;

  function fetchTemplates() {
    if (cache) return Promise.resolve(cache);
    return fetch(SOURCE, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error('Could not load the starter templates.');
      return res.json();
    }).then(function (data) {
      cache = (data && data.templates) || [];
      return cache;
    });
  }

  function bodyOf(template) {
    if (Array.isArray(template.body)) return template.body.join('\n');
    return String(template.body || '');
  }

  function download(template) {
    var blob = new Blob([bodyOf(template)], { type: template.type || 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = template.filename || (template.id + '.txt');
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      try { a.remove(); URL.revokeObjectURL(url); } catch (e) {}
    }, 1200);
    if (S.toast) S.toast('Downloaded ' + (template.filename || template.title), { tone: 'ok' });
    return true;
  }

  api.list = fetchTemplates;

  api.download = function (id) {
    return fetchTemplates().then(function (rows) {
      var template = rows.filter(function (row) { return row.id === id; })[0];
      if (!template) throw new Error('That template is not available.');
      return download(template);
    });
  };

  api.apply = function (id) { return api.download(id); };

  api.open = function () {
    return fetchTemplates().then(function (rows) {
      var cards = rows.map(function (template) {
        var actions = [
          S._h('button', { type: 'button', class: 'jvs-btn-primary', text: 'Download starter', onclick: function () { download(template); } })
        ];
        if (template.tool) {
          actions.push(S._h('a', {
            class: 'jvs-action',
            href: '/tools/' + template.tool + '.html',
            text: 'Open ' + template.tool.replace(/-/g, ' '),
            style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }
          }));
        }
        return S._h('div', { class: 'jvs-group' }, [
          S._h('div', { class: 'jvs-row' }, [
            S._h('strong', { text: template.title }),
            S._h('span', { class: 'jvs-hint', text: template.character || '' })
          ]),
          S._h('p', { class: 'jvs-hint', text: template.description || '' }),
          S._h('div', { class: 'jvs-actions' }, actions)
        ]);
      });

      S.modal({
        title: 'Starter templates',
        body: S._h('div', { style: { display: 'grid', gap: '10px' } }, [
          S._h('p', { class: 'jvs-hint', text: 'Small, safe starting points. Download one, then make it yours.' })
        ].concat(cards)),
        actions: [
          S._h('button', { type: 'button', text: 'Close', onclick: function () { this.closest('.jvs-modal-wrap').remove(); } })
        ]
      });
      return rows;
    }).catch(function (err) {
      if (S.toast) S.toast(err.message || 'Could not open templates.', { tone: 'warn' });
      return [];
    });
  };
})();
