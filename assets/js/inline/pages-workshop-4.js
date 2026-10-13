(function(){
    var overlay = document.getElementById('liveOverlay');
    if (!overlay) return;
    var stage  = overlay.querySelector('.ws-live-stage');
    var closeBtn = overlay.querySelector('.ws-live-close');

    function open(src, title){
        overlay.removeAttribute('hidden');
        document.body.style.overflow = 'hidden';
        stage.innerHTML = '<iframe src="' + src + '" title="' + title + '" allow="fullscreen"></iframe>';
    }
    function close(){
        overlay.setAttribute('hidden','');
        document.body.style.overflow = '';
        stage.innerHTML = '';
    }

    document.querySelectorAll('.ws-live-frame').forEach(function(f){
        function load(){ open(f.dataset.src, f.dataset.title || 'Live builder'); }
        f.addEventListener('click', load);
        f.addEventListener('keydown', function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); load(); }});
    });

    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', function(e){ if(e.target === overlay) close(); });
    document.addEventListener('keydown', function(e){ if(e.key==='Escape' && !overlay.hidden) close(); });
})();
