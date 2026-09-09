/* ember-guide.js - Ember first-visit spotlight tour
   Usage per tool:
     EmberGuide.init({ id:'pixel-studio', steps:[{target:'.tool-grid', title:'Tools', text:'...'}, ...] })
     EmberGuide.show()  // Help button
   Auto-shows once per browser (localStorage ember-guide-{id}-seen)
*/
(function(){
  const STORAGE_PREFIX = 'ember-guide-';
  let cfg = null, idx = 0, overlay = null, highlightEl = null;

  function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function lsSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }

  function ensureOverlay(){
    if(overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'ember-guide-overlay';
    overlay.id = 'emberGuideOverlay';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label','Ember quick guide');
    overlay.innerHTML = '<div class="ember-guide-card" role="document">'
      + '<img src="/assets/mascots/ember-badge.webp" alt="" width="48" height="48" onerror="this.style.display=\'none\'">'
      + '<div class="ember-guide-body">'
      +   '<div class="ember-guide-eyebrow">Ember shows you around</div>'
      +   '<h2 class="ember-guide-title" id="emberGuideTitle"></h2>'
      +   '<p class="ember-guide-text" id="emberGuideText"></p>'
      +   '<div class="ember-guide-actions">'
      +     '<button class="ember-guide-btn ghost" id="emberGuidePrev" type="button">Back</button>'
      +     '<button class="ember-guide-btn primary" id="emberGuideNext" type="button">Next</button>'
      +     '<div class="ember-guide-progress" id="emberGuideDots" aria-hidden="true"></div>'
      +     '<button class="ember-guide-skip" id="emberGuideSkip" type="button">Skip</button>'
      +   '</div>'
      + '</div></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e){
      if(e.target === overlay) close();
    });
    overlay.querySelector('#emberGuideNext').addEventListener('click', next);
    overlay.querySelector('#emberGuidePrev').addEventListener('click', prev);
    overlay.querySelector('#emberGuideSkip').addEventListener('click', closeAndMark);
    document.addEventListener('keydown', function(e){
      if(!overlay.classList.contains('open')) return;
      if(e.key === 'Escape') close();
      if(e.key === 'ArrowRight') next();
      if(e.key === 'ArrowLeft') prev();
    });
    return overlay;
  }

  function clearHighlight(){
    if(highlightEl){
      highlightEl.classList.remove('ember-guide-highlight');
      highlightEl = null;
    }
  }

  function applyStep(){
    if(!cfg || !cfg.steps.length) return;
    var step = cfg.steps[idx];
    var titleEl = document.getElementById('emberGuideTitle');
    var textEl = document.getElementById('emberGuideText');
    var nextBtn = document.getElementById('emberGuideNext');
    var prevBtn = document.getElementById('emberGuidePrev');
    var dots = document.getElementById('emberGuideDots');
    if(!titleEl) return;

    clearHighlight();
    var target = null;
    if(step.target){
      try{ target = document.querySelector(step.target); }catch(e){ target=null; }
      // try fallback targets
      if(!target && step.fallback){
        for(var f=0; f<step.fallback.length; f++){
          try{ target = document.querySelector(step.fallback[f]); if(target) break; }catch(e){}
        }
      }
    }
    if(target){
      target.classList.add('ember-guide-highlight');
      highlightEl = target;
      try{ target.scrollIntoView({behavior:'smooth', block:'center', inline:'nearest'}); }catch(e){}
    }

    titleEl.textContent = step.title || '';
    textEl.textContent = step.text || '';
    prevBtn.style.display = idx===0 ? 'none' : '';
    if(idx === cfg.steps.length - 1){
      nextBtn.textContent = 'Got it';
    } else {
      nextBtn.textContent = 'Next';
    }
    // dots
    if(dots){
      dots.innerHTML='';
      for(var i=0;i<cfg.steps.length;i++){
        var d=document.createElement('span');
        d.className='ember-guide-dot'+(i===idx?' on':'');
        dots.appendChild(d);
      }
    }
    // announce
    var ann=document.getElementById('jvds-announce');
    if(ann) ann.textContent = step.title + ': ' + step.text;
  }

  function openAt(i){
    if(!cfg) return;
    idx = Math.max(0, Math.min(cfg.steps.length-1, i));
    ensureOverlay();
    overlay.classList.add('open');
    document.body.style.overflow='hidden';
    applyStep();
    var nextBtn=document.getElementById('emberGuideNext');
    if(nextBtn) nextBtn.focus();
  }

  function next(){
    if(idx < cfg.steps.length - 1){
      idx++; applyStep();
    } else {
      closeAndMark();
    }
  }
  function prev(){
    if(idx>0){ idx--; applyStep(); }
  }
  function close(){
    clearHighlight();
    if(overlay) overlay.classList.remove('open');
    document.body.style.overflow='';
  }
  function closeAndMark(){
    close();
    if(cfg && cfg.id) lsSet(STORAGE_PREFIX + cfg.id + '-seen','1');
  }
  function shouldAutoShow(){
    if(!cfg || !cfg.id) return false;
    if(lsGet(STORAGE_PREFIX + cfg.id + '-seen') === '1') return false;
    // don't auto-show if some other modal is already open
    var openModal = document.querySelector('.modal-overlay.open, #startModal[style*="flex"], #start-overlay[style*="flex"], #restore-modal[style*="flex"]');
    if(openModal) return false;
    return true;
  }

  window.EmberGuide = {
    init: function(c){
      cfg = c;
      ensureOverlay();
      // auto-show on first visit after short delay
      if(shouldAutoShow()){
        setTimeout(function(){
          if(shouldAutoShow()) openAt(0);
        }, 900);
      }
    },
    show: function(){ openAt(0); },
    next: next,
    prev: prev,
    close: close
  };
})();
