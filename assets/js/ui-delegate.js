// assets/js/ui-delegate.js (A1503/A1506/A1509/A1485): replaces site-wide inline
// handlers so they no longer need script-src 'unsafe-inline'.
(function () {
  if (window.__jvdsUiDelegateLoaded) return; // idempotent: safe to include more than once
  window.__jvdsUiDelegateLoaded = true;

  // Image fallback (was: onerror="this.onerror=null;this.src='...'")
  // Also handles data-fallback-hide: hide the element on error instead of swapping src.
  window.addEventListener('error', function (e) {
    var t = e.target;
    if (!t || !t.getAttribute) return;
    if (t.tagName === 'IMG' && t.getAttribute('data-fallback')) {
      var fb = t.getAttribute('data-fallback');
      t.removeAttribute('data-fallback');
      t.onerror = null;
      t.src = fb;
    } else if (t.getAttribute('data-fallback-hide')) {
      t.removeAttribute('data-fallback-hide');
      t.style.display = 'none';
    } else if (t.getAttribute('data-fallback-hide-parent')) {
      t.removeAttribute('data-fallback-hide-parent');
      if (t.parentElement) t.parentElement.style.display = 'none';
    } else if (t.hasAttribute('data-fallback-parent-text')) {
      var txt = t.getAttribute('data-fallback-parent-text');
      t.removeAttribute('data-fallback-parent-text');
      if (t.parentElement) t.parentElement.textContent = txt;
    } else if (t.hasAttribute('data-fallback-show-sibling')) {
      var disp = t.getAttribute('data-fallback-show-sibling') || 'block';
      t.removeAttribute('data-fallback-show-sibling');
      t.style.display = 'none';
      if (t.nextElementSibling) t.nextElementSibling.style.display = disp;
    } else if (t.hasAttribute('data-fallback-hide-closest')) {
      var sel = t.getAttribute('data-fallback-hide-closest');
      t.removeAttribute('data-fallback-hide-closest');
      var anc = t.closest(sel);
      if (anc) { anc.style.display = 'none'; if (anc.nextElementSibling) anc.nextElementSibling.style.display = 'block'; }
    } else if (t.hasAttribute('data-fallback-replace')) {
      var html = t.getAttribute('data-fallback-replace');
      t.removeAttribute('data-fallback-replace');
      t.outerHTML = html;
    } else if (t.hasAttribute('data-fallback-parent-html')) {
      var html = t.getAttribute('data-fallback-parent-html');
      t.removeAttribute('data-fallback-parent-html');
      if (t.parentNode) t.parentNode.innerHTML = html;
    } else if (t.hasAttribute('data-fallback-bg')) {
      var bg = t.getAttribute('data-fallback-bg');
      t.removeAttribute('data-fallback-bg');
      t.style.background = bg;
    }
  }, true);

  function resolve(path) {
    return path.split('.').reduce(function (o, k) { return o ? o[k] : undefined; }, window);
  }

  // Hover styles (was: onmouseover/onmouseout="this.style.x='y';..."). Declarations
  // are camelCase properties, so assign via el.style[name] directly.
  function applyDecls(el, str) {
    if (!str) return;
    str.split(';').forEach(function (d) {
      var i = d.indexOf(':');
      if (i < 0) return;
      var k = d.slice(0, i).trim();
      var val = d.slice(i + 1).trim();
      if (k) { try { el.style[k] = val; } catch (e) {} }
    });
  }
  document.addEventListener('mouseover', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-hover]') : null;
    if (el) applyDecls(el, el.getAttribute('data-hover'));
  });
  document.addEventListener('mouseout', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-hover-out]') : null;
    if (el) applyDecls(el, el.getAttribute('data-hover-out'));
  });

  // Compile an argument spec into real values. Tokens are separated by "|":
  //   this  value  nval(=+value)  checked  event  true  false  <number>
  //   s:<urlenc string>  c:<selector>  id:<elementId>  a:<urlenc JSON array>
  function parseArgs(spec, el, ev) {
    if (spec === null) return null;
    if (!spec) return [];
    return spec.split('|').map(function (t) {
      if (t === 'this') return el;
      if (t === 'value') return el.value;
      if (t === 'nval') return +el.value;
      if (t === 'checked') return el.checked;
      if (t === 'event') return ev;
      if (t === 'true') return true;
      if (t === 'false') return false;
      if (/^-?\d+(?:\.\d+)?$/.test(t)) return Number(t);
      if (t.slice(0, 2) === 'c:') return el.closest(t.slice(2));
      if (t.slice(0, 2) === 's:') { try { return decodeURIComponent(t.slice(2)); } catch (e) { return t.slice(2); } }
      if (t.slice(0, 3) === 'id:') {
        var idParts = t.slice(3).split('.');
        var idEl = document.getElementById(idParts[0]);
        return idParts.length > 1 && idEl ? idEl[idParts[1]] : idEl;
      }
      if (t.slice(0, 2) === 'a:') { try { return JSON.parse(decodeURIComponent(t.slice(2))); } catch (e) { return []; } }
      return undefined;
    });
  }

  function buildArgs(el, ev) {
    if (el.hasAttribute('data-on-args')) return parseArgs(el.getAttribute('data-on-args'), el, ev);
    if (el.hasAttribute('data-on-closest')) return [el.closest(el.getAttribute('data-on-closest'))];
    var arg = el.getAttribute('data-on-arg');
    var hasArg = arg !== null;
    if (hasArg) {
      if (el.hasAttribute('data-on-num')) arg = Number(arg);
      else if (el.hasAttribute('data-on-bool')) arg = arg === 'true';
    }
    var plain = el.hasAttribute('data-on-plain');
    return plain ? (hasArg ? [arg] : []) : (hasArg ? [el, arg] : [el]);
  }

  function callHandler(el, ev) {
    var name = el.getAttribute('data-on');
    if (!name) return;
    var parts = name.split('.');
    var recv = null, fn;
    if (parts.length > 1) { recv = resolve(parts.slice(0, -1).join('.')); fn = recv ? recv[parts[parts.length - 1]] : undefined; }
    else { fn = window[name]; }
    if (typeof fn !== 'function') return;
    try { fn.apply(recv, buildArgs(el, ev)); } catch (err) { /* surface via the page's own error handling */ }
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

    var cookie = t.closest('[data-cookie-settings]');
    if (cookie) { e.preventDefault(); if (window.JVDSCookies && typeof window.JVDSCookies.reopen === 'function') window.JVDSCookies.reopen(); return; }

    var mailto = t.closest('[data-mailto]');
    if (mailto) { mailto.href = 'mailto:' + mailto.dataset.mail + '@' + mailto.dataset.dom + '?subject=' + encodeURIComponent(mailto.dataset.sub); return; }

    var go = t.closest('[data-go]');
    if (go) { e.preventDefault(); location.href = go.getAttribute('data-go'); return; }

    var rm = t.closest('[data-remove-closest]');
    if (rm) { var target = rm.closest(rm.getAttribute('data-remove-closest')); if (target) target.remove(); return; }

    var hc = t.closest('[data-hide-closest]');
    if (hc) { var hid = hc.closest(hc.getAttribute('data-hide-closest')); if (hid) hid.style.display = 'none'; return; }

    var tcls = t.closest('[data-toggle-class]');
    if (tcls) { tcls.classList.toggle(tcls.getAttribute('data-toggle-class')); return; }

    var act = t.closest('[data-action]');
    if (act) { if (act.getAttribute('data-action') === 'print') window.print(); return; }

    var clickId = t.closest('[data-click-id]');
    if (clickId) { var cEl = document.getElementById(clickId.getAttribute('data-click-id')); if (cEl) cEl.click(); return; }

    var scrollTo = t.closest('[data-scroll-to]');
    if (scrollTo) { var sEl = document.getElementById(scrollTo.getAttribute('data-scroll-to')); if (sEl) sEl.scrollIntoView({behavior:'smooth'}); return; }

    var focusId = t.closest('[data-focus-id]');
    if (focusId) { var fEl = document.getElementById(focusId.getAttribute('data-focus-id')); if (fEl) fEl.focus(); return; }

    var sessSet = t.closest('[data-session-set]');
    if (sessSet) {
      var kv = sessSet.getAttribute('data-session-set').split(':');
      try { sessionStorage.setItem(kv[0], kv.slice(1).join(':')); } catch(ex){}
      var rmId = sessSet.getAttribute('data-remove-id');
      if (rmId) { var rmEl = document.getElementById(rmId); if (rmEl) rmEl.remove(); }
      return;
    }

    var clsRm = t.closest('[data-cls-remove-id]');
    if (clsRm) { var cr = clsRm.getAttribute('data-cls-remove-id').split(':'); var crEl = document.getElementById(cr[0]); if (crEl) crEl.classList.remove(cr[1]); return; }

    var clsAdd = t.closest('[data-cls-add-id]');
    if (clsAdd) { var ca = clsAdd.getAttribute('data-cls-add-id').split(':'); var caEl = document.getElementById(ca[0]); if (caEl) caEl.classList.add(ca[1]); return; }

    var clsTog = t.closest('[data-cls-toggle-id]');
    if (clsTog) { var ct = clsTog.getAttribute('data-cls-toggle-id').split(':'); var ctEl = document.getElementById(ct[0]); if (ctEl) ctEl.classList.toggle(ct[1]); return; }

    var pill = t.closest('[data-pill]');
    if (pill) {
      var pillId = pill.getAttribute('data-pill');
      if (typeof window.activePill === 'function') window.activePill(pillId, pill);
      var setProp = pill.getAttribute('data-set');
      if (setProp) {
        var setVal = pill.getAttribute('data-val');
        var pp = setProp.split('.'); var oo = window;
        for (var pi = 0; pi < pp.length - 1; pi++) oo = oo[pp[pi]];
        // Parse value: number, bool, null, or string
        if (setVal === 'true') oo[pp[pp.length-1]] = true;
        else if (setVal === 'false') oo[pp[pp.length-1]] = false;
        else if (setVal === 'null') oo[pp[pp.length-1]] = null;
        else if (/^-?\d+(?:\.\d+)?$/.test(setVal)) oo[pp[pp.length-1]] = Number(setVal);
        else oo[pp[pp.length-1]] = setVal;
      }
      var setProp2 = pill.getAttribute('data-set2');
      if (setProp2) {
        var setVal2 = pill.getAttribute('data-val2');
        var pp2 = setProp2.split('.'); var oo2 = window;
        for (var pi2 = 0; pi2 < pp2.length - 1; pi2++) oo2 = oo2[pp2[pi2]];
        if (setVal2 === 'true') oo2[pp2[pp2.length-1]] = true;
        else if (setVal2 === 'false') oo2[pp2[pp2.length-1]] = false;
        else if (/^-?\d+(?:\.\d+)?$/.test(setVal2)) oo2[pp2[pp2.length-1]] = Number(setVal2);
        else oo2[pp2[pp2.length-1]] = setVal2;
      }
      var pillOn = pill.getAttribute('data-on');
      if (pillOn) {
        var poFn = resolve(pillOn);
        if (typeof poFn === 'function') {
          var poArg = pill.getAttribute('data-on-arg');
          poFn.call(null, poArg !== null ? poArg : undefined);
        }
      }
      var pillThen = pill.getAttribute('data-then');
      if (pillThen) { var ptFn = resolve(pillThen); if (typeof ptFn === 'function') ptFn(); }
      return;
    }

    var el = t.closest('[data-on]');
    if (!el) return;
    var bound = el.getAttribute('data-on-event');
    if (bound && bound !== 'click') return;
    if (el.hasAttribute('data-on-self') && e.target !== el) return;
    if (el.hasAttribute('data-prevent')) e.preventDefault();
    callHandler(el, e);
  });

  // Property binding: data-bind="OBJ.prop" + data-bind-type + data-then="rebuildFn"
  // Replaces patterns like: oninput="P.hullLen=parseFloat(this.value);buildSub()"
  function handleBind(el, ev) {
    var bind = el.getAttribute('data-bind');
    if (!bind) return false;
    var parts = bind.split('.');
    var obj = window;
    for (var i = 0; i < parts.length - 1; i++) { obj = obj[parts[i]]; if (!obj) return false; }
    var prop = parts[parts.length - 1];
    var btype = el.getAttribute('data-bind-type') || 'value';
    var val;
    if (btype === 'checked') val = el.checked;
    else if (btype === 'float') val = parseFloat(el.value);
    else if (btype === 'int') val = parseInt(el.value, 10);
    else if (btype === 'nval') val = +el.value;
    else val = el.value;
    var scale = el.getAttribute('data-bind-scale');
    if (scale) val = val * parseFloat(scale);
    obj[prop] = val;
    // Update a display element with formatted value
    var display = el.getAttribute('data-bind-display');
    if (display) {
      var fmt = el.getAttribute('data-bind-fmt');
      var dEl = display === 'next' ? el.nextElementSibling : document.getElementById(display);
      if (dEl) {
        var txt = String(val);
        if (fmt) {
          // e.g. "0.1" -> toFixed(1), "0.01" -> toFixed(2), "0.1m" -> toFixed(1)+'m'
          var fmtMatch = /^(\d+\.(\d+))(.*)$/.exec(fmt);
          if (fmtMatch) txt = Number(val).toFixed(fmtMatch[2].length) + fmtMatch[3];
          else txt = String(val) + fmt;
        }
        dEl.textContent = txt;
      }
    }
    var then = el.getAttribute('data-then');
    if (then) { var fn = resolve(then); if (typeof fn === 'function') fn(); }
    return true;
  }

  // Non-click events (mostly form controls and drag handles).
  function runEvent(type) {
    return function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var bel = t.closest('[data-bind]');
      if (bel && handleBind(bel, e)) return;
      var el = t.closest('[data-on-event="' + type + '"]');
      if (!el) return;
      var keyFilter = el.getAttribute('data-on-key');
      if (keyFilter && keyFilter.indexOf(' ') >= 0 ? keyFilter.split(' ').indexOf(e.key) < 0 : (keyFilter && e.key !== keyFilter)) return;
      if (el.hasAttribute('data-on-self') && e.target !== el) return;
      callHandler(el, e);
    };
  }
  ['input', 'change', 'keydown', 'keyup', 'keypress', 'submit', 'touchstart', 'touchend', 'touchmove']
    .forEach(function (ev) { document.addEventListener(ev, runEvent(ev), false); });
  ['focus', 'blur'].forEach(function (ev) { document.addEventListener(ev, runEvent(ev), true); });
})();
