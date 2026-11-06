/* Quest standalone HTML exporter (A2579)
   Turns a Quest Builder node into one self-contained .html file. The file has
   no external src or href, runs from a USB stick or a school desktop, and never
   calls the network. It is a plain classic script so the Quest Builder can load
   it without changing its inline CSP hash. */
(function (global) {
  'use strict';

  var MAX_BYTES = 120 * 1024;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function safeText(value, fallback) {
    var text = String(value == null ? '' : value).trim();
    return text || fallback || '';
  }

  function safeName(node) {
    var raw = safeText(node && (node.id || node.title), 'quest');
    return 'quest-' + raw.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) + '.html';
  }

  function normaliseNode(node) {
    var input = node && typeof node === 'object' ? node : {};
    var tests = Array.isArray(input.testCases) ? input.testCases : [];
    return {
      id: safeText(input.id, 'node-XXX'),
      title: safeText(input.title, 'Untitled Quest'),
      mascot: safeText(input.mascot, 'Lumo'),
      xp: Math.max(0, Number(input.xp) || 0),
      prerequisites: Array.isArray(input.prerequisites)
        ? input.prerequisites.map(function (p) { return safeText(p, ''); }).filter(Boolean)
        : [],
      briefing: String(input.briefing == null ? '' : input.briefing),
      initialCode: String(input.initialCode == null ? '' : input.initialCode),
      testCases: tests
        .map(function (test) {
          return {
            description: safeText(test && test.description, ''),
            assertion: safeText(test && test.assertion, '')
          };
        })
        .filter(function (test) { return test.description && test.assertion; })
    };
  }

  // The briefing allows a small set of formatting tags. Escape everything, then
  // restore exactly those tags so a pasted <script> can never survive.
  function safeBriefing(value) {
    return esc(value)
      .replace(/&lt;(\/?)(code|b|strong|em|br)\s*\/?&gt;/gi, function (m, slash, tag) {
        return '<' + slash + tag.toLowerCase() + (tag.toLowerCase() === 'br' ? '' : '') + '>';
      });
  }

  function jsonForScript(value) {
    return JSON.stringify(value)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
  }

  function build(node) {
    var data = normaliseNode(node);
    var prereq = data.prerequisites.length
      ? '<p class="prereq">Before this quest: ' + data.prerequisites.map(esc).join(', ') + '</p>'
      : '';
    var briefing = data.briefing
      ? '<div class="briefing">' + safeBriefing(data.briefing) + '</div>'
      : '<div class="briefing"><p>Read the brief, write your code and run the tests.</p></div>';

    return '<!DOCTYPE html>\n' +
      '<html lang="en">\n' +
      '<head>\n' +
      '<meta charset="UTF-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      '<meta name="robots" content="noindex, nofollow">\n' +
      '<title>' + esc(data.title) + ' - JVDesignStudio Quest</title>\n' +
      '<style>\n' +
      ':root{--bg:#fbf8f2;--card:#fff;--border:rgba(64,59,51,.14);--ink:#1a1208;--ink2:#3d3224;--teal:#4e7d80;--teal-lt:#e8f2f3;--gold:#c98a2e;--rose:#BC4749;--mono:"JetBrains Mono",monospace}\n' +
      '@media (prefers-color-scheme:dark){:root{--bg:#1e1c18;--card:#28241e;--border:rgba(240,234,214,.14);--ink:#f5efe0;--ink2:#e8ddd0;--teal-lt:#264044}}\n' +
      '*{box-sizing:border-box}\n' +
      'body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 Inter,system-ui,sans-serif}\n' +
      'main{max-width:880px;margin:0 auto;padding:24px 16px 48px}\n' +
      '.kicker{font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;color:var(--teal);font-weight:800;margin:0 0 4px}\n' +
      'h1{font-size:clamp(1.5rem,4vw,2.1rem);line-height:1.2;margin:0 0 8px}\n' +
      '.meta{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 16px}\n' +
      '.pill{font-size:.78rem;font-weight:800;padding:3px 10px;border-radius:999px;background:var(--teal-lt);color:var(--teal);border:1px solid var(--teal)}\n' +
      '.prereq{margin:0 0 12px;color:var(--ink2);font-size:.9rem}\n' +
      '.card{background:var(--card);border:1.5px solid var(--border);border-radius:12px;padding:16px;margin:0 0 14px;box-shadow:0 2px 8px rgba(0,0,0,.06)}\n' +
      '.briefing p{margin:0 0 8px}\n' +
      '.briefing code{font-family:var(--mono);background:rgba(78,125,128,.12);padding:1px 5px;border-radius:4px}\n' +
      'label{display:block;font-size:.78rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--ink2);margin:0 0 6px}\n' +
      'textarea{width:100%;min-height:170px;resize:vertical;border:1.5px solid var(--border);border-radius:10px;padding:12px;background:var(--bg);color:var(--ink);font-family:var(--mono);font-size:.86rem;line-height:1.7}\n' +
      'textarea:focus-visible,button:focus-visible{outline:3px solid currentColor;outline-offset:2px}\n' +
      '.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}\n' +
      'button{font:inherit;font-weight:800;border-radius:8px;padding:9px 16px;cursor:pointer;border:1.5px solid transparent}\n' +
      '.primary{background:var(--teal);color:#fff}\n' +
      '.ghost{background:transparent;color:var(--ink);border-color:var(--border)}\n' +
      '#results{margin:12px 0 0;padding:0;list-style:none;font-size:.9rem}\n' +
      '#results li{padding:6px 0;border-top:1px solid var(--border)}\n' +
      '#results li:first-child{border-top:0}\n' +
      '.pass{color:var(--teal);font-weight:700}\n' +
      '.fail{color:var(--rose);font-weight:700}\n' +
      '.logs{margin:8px 0 0;font-family:var(--mono);font-size:.78rem;color:var(--ink2);white-space:pre-wrap}\n' +
      '.lumo{display:flex;gap:10px;align-items:flex-start;font-size:.9rem;color:var(--ink2)}\n' +
      '.lumo b{color:var(--ink)}\n' +
      'footer{margin-top:18px;color:var(--ink2);font-size:.8rem;text-align:center}\n' +
      '@media (max-width:520px){main{padding:16px 12px 36px}.card{padding:13px}textarea{min-height:150px}}\n' +
      '</style>\n' +
      '</head>\n' +
      '<body>\n' +
      '<main>\n' +
      '  <p class="kicker">JVDesignStudio Quest</p>\n' +
      '  <h1>' + esc(data.title) + '</h1>\n' +
      '  <div class="meta"><span class="pill">' + esc(data.mascot) + '</span><span class="pill">' + data.xp + ' XP</span><span class="pill">' + data.testCases.length + ' test' + (data.testCases.length === 1 ? '' : 's') + '</span></div>\n' +
      '  ' + prereq + '\n' +
      '  <section class="card">' + briefing + '</section>\n' +
      '  <section class="card">\n' +
      '    <label for="code">Your code</label>\n' +
      '    <textarea id="code" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Your code"></textarea>\n' +
      '    <div class="row"><button type="button" class="primary" id="run">Run tests</button><button type="button" class="ghost" id="reset">Start again</button></div>\n' +
      '    <ul id="results" aria-live="polite"></ul>\n' +
      '    <div class="logs" id="logs" aria-live="polite"></div>\n' +
      '  </section>\n' +
      '  <section class="card lumo"><span aria-hidden="true">Lumo</span><p><b>Lumo says:</b> run the tests, change one thing, then run them again. Small steps win.</p></section>\n' +
      '  <footer>Made with JVDesignStudio. This file works offline and keeps your work on this device.</footer>\n' +
      '</main>\n' +
      '<script id="quest-data" type="application/json">' + jsonForScript(data) + '</script>\n' +
      '<script>\n' +
      '(function(){\n' +
      '  var data=JSON.parse(document.getElementById("quest-data").textContent);\n' +
      '  var code=document.getElementById("code");\n' +
      '  var results=document.getElementById("results");\n' +
      '  var logsBox=document.getElementById("logs");\n' +
      '  code.value=data.initialCode||"";\n' +
      '  function runTests(source,cases){\n' +
      '    var logs=[];\n' +
      '    var cc={log:function(){logs.push([].slice.call(arguments).map(String).join(" "))},warn:function(){logs.push("[warn] "+[].slice.call(arguments).map(String).join(" "))},error:function(){logs.push("[error] "+[].slice.call(arguments).map(String).join(" "))}};\n' +
      '    try{ new Function("console",source)(cc); }catch(e){ logs.push("[error] "+e.message); }\n' +
      '    var out=cases.map(function(t){\n' +
      '      try{ var val=new Function("userCode","console",source+"; return ("+t.assertion+");")(source,cc); return {description:t.description,passed:!!val,error:null}; }\n' +
      '      catch(e){ return {description:t.description,passed:false,error:e.message}; }\n' +
      '    });\n' +
      '    return {logs:logs,results:out};\n' +
      '  }\n' +
      '  function show(){\n' +
      '    var run=runTests(code.value,data.testCases);\n' +
      '    results.textContent="";\n' +
      '    if(!data.testCases.length){\n' +
      '      var empty=document.createElement("li"); empty.textContent="No tests in this quest yet."; results.appendChild(empty);\n' +
      '    }\n' +
      '    run.results.forEach(function(r){\n' +
      '      var li=document.createElement("li");\n' +
      '      var mark=document.createElement("span"); mark.className=r.passed?"pass":"fail"; mark.textContent=r.passed?"PASS":"TRY AGAIN";\n' +
      '      li.appendChild(mark); li.appendChild(document.createTextNode(" "+r.description+(r.error?" ("+r.error+")":"")));\n' +
      '      results.appendChild(li);\n' +
      '    });\n' +
      '    logsBox.textContent=run.logs.join("\\n");\n' +
      '  }\n' +
      '  document.getElementById("run").addEventListener("click",show);\n' +
      '  document.getElementById("reset").addEventListener("click",function(){ code.value=data.initialCode||""; show(); });\n' +
      '  document.addEventListener("keydown",function(e){ if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){ e.preventDefault(); show(); } });\n' +
      '  show();\n' +
      '})();\n' +
      '<\/script>\n' +
      '</body>\n' +
      '</html>\n';
  }

  function download(node) {
    var html = build(node);
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    var url = global.URL.createObjectURL(blob);
    var a = global.document.createElement('a');
    a.href = url;
    a.download = safeName(node);
    global.document.body.appendChild(a);
    a.click();
    a.remove();
    global.setTimeout(function () { global.URL.revokeObjectURL(url); }, 5000);
    return { html: html, filename: a.download, bytes: blob.size };
  }

  function readBuilderNode() {
    var val = function (id) {
      var el = global.document.getElementById(id);
      return el ? el.value : '';
    };
    var tests = [].map.call(global.document.querySelectorAll('.test-row'), function (row) {
      return {
        description: (row.querySelector('.tc-desc') || {}).value || '',
        assertion: (row.querySelector('.tc-assertion') || {}).value || ''
      };
    });
    return {
      id: val('f-id'),
      title: val('f-title'),
      mascot: val('f-mascot'),
      xp: val('f-xp'),
      prerequisites: val('f-prereqs').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      briefing: val('f-briefing'),
      initialCode: val('f-starter'),
      testCases: tests.filter(function (t) { return t.description && t.assertion; })
    };
  }

  function wireBuilder() {
    var btn = global.document.getElementById('btn-export-standalone');
    if (!btn || btn.dataset.wired === '1') return;
    btn.dataset.wired = '1';
    var status = global.document.getElementById('export-status');
    btn.addEventListener('click', function () {
      try {
        var out = download(readBuilderNode());
        if (status) {
          status.textContent = 'Downloaded ' + out.filename + ' (' + Math.ceil(out.bytes / 1024) + ' KB). It plays offline.';
          status.hidden = false;
        }
      } catch (e) {
        if (status) {
          status.textContent = 'This browser blocked the download. Open the builder in Chrome or Edge and try again.';
          status.hidden = false;
        }
      }
    });
  }

  global.QuestHtmlExport = {
    build: build,
    download: download,
    safeName: safeName,
    normaliseNode: normaliseNode,
    MAX_BYTES: MAX_BYTES
  };

  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', wireBuilder);
    } else {
      wireBuilder();
    }
  }
})(typeof window !== 'undefined' ? window : this);
