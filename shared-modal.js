/* ============================================================
   shared-modal.js — JVDesignStudio
   Standard welcome modal + toast component.
   Include after style-shared.css in tool pages.
   ============================================================ */
(function(){
  'use strict';

  // ── Toast ──────────────────────────────────────────────────
  // Ensure #toast element exists
  if(!document.getElementById('toast')){
    var t=document.createElement('div');
    t.id='toast';
    t.setAttribute('role','status');
    t.setAttribute('aria-live','polite');
    document.body.appendChild(t);
  }

  var _toastTimer=null;
  function showToast(msg,duration){
    var el=document.getElementById('toast');
    if(!el)return;
    el.textContent=msg;
    el.style.opacity='1';
    clearTimeout(_toastTimer);
    _toastTimer=setTimeout(function(){el.style.opacity='0';},duration||2600);
  }
  window.showToast=showToast;

  // ── Welcome Modal ──────────────────────────────────────────
  // Standard pattern: .modal-overlay#xxxWelcomeModal with .open class
  // Expected HTML structure:
  //   <div class="modal-overlay" id="xxxWelcomeModal" role="dialog" aria-modal="true">
  //     <div class="modal"> ... content ... </div>
  //   </div>
  //
  // Expected CSS (already in style-shared.css or tool's inline styles):
  //   .modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:500;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(6px);}
  //   .modal-overlay.open{display:flex;}
  //   .modal{background:var(--panel2);border:1px solid var(--border2);border-radius:16px;padding:20px;width:min(460px,94vw);max-height:82vh;overflow:auto;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.6);}
  //   .modal h3{font-family:'Fredoka',cursive;font-size:1.05rem;margin-bottom:10px;}
  //   .modal-btns{display:flex;gap:8px;margin-top:12px;}
  //   .m-ok{flex:1;padding:9px;border-radius:9px;border:none;cursor:pointer;font-family:'Fredoka',cursive;font-weight:700;}
  //   .m-cancel{flex:1;padding:9px;border-radius:9px;border:1px solid var(--border2);cursor:pointer;font-family:'Fredoka',cursive;background:rgba(255,255,255,.06);}

  function setupWelcome(config){
    // config: { modalId, seenKey, onReady }
    var modal=document.getElementById(config.modalId);
    if(!modal)return;

    function close(){
      try{localStorage.setItem(config.seenKey,'1');}catch(e){}
      modal.classList.remove('open');
    }

    function open(){
      modal.classList.add('open');
    }

    function shouldShow(){
      try{return localStorage.getItem(config.seenKey)!=='1';}catch(e){return true;}
    }

    // Close on overlay click
    modal.addEventListener('click',function(e){if(e.target===modal)close();});

    // Close on Escape
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape'&&modal.classList.contains('open')){close();e.preventDefault();}
    });

    // ? key opens modal (always, even after dismissed)
    document.addEventListener('keydown',function(e){
      if(e.key==='?'&&!e.ctrlKey&&!e.metaKey){
        var tag=(e.target.tagName||'').toLowerCase();
        if(tag==='input'||tag==='textarea'||tag==='select')return;
        e.preventDefault();
        open();
      }
    });

    // Expose for manual use
    window.openWelcome=open;
    window.closeWelcome=close;

    // Auto-show on first visit
    if(shouldShow()){
      // Small delay to let page render
      setTimeout(function(){open();},300);
    }

    if(config.onReady)config.onReady({open:open,close:close});
  }
  window.setupWelcome=setupWelcome;

})();
