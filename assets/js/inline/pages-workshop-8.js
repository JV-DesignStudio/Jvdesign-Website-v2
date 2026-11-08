(function(){
    var b = document.getElementById('wsTopBtn');
    if (!b) return;
    window.addEventListener('scroll', function(){ b.classList.toggle('show', window.scrollY > 800); }, { passive:true });
})();
/* Mobile: keep the search row visible and tuck the selects behind a toggle. */
(function(){
    var shell = document.querySelector('.ws-finder-shell');
    var btn = document.getElementById('wsFilterToggle');
    var countEl = document.getElementById('wsFilterCount');
    if (!shell || !btn) return;

    var search = document.getElementById('workshopSearch');
    var tool = document.getElementById('workshopTool');
    var experience = document.getElementById('workshopExperience');
    var difficulty = document.getElementById('workshopDifficulty');

    function activeCount(){
        var n = 0;
        if (search && search.value.trim()) n++;
        if (tool && tool.value) n++;
        if (experience && experience.value && experience.value !== 'all') n++;
        if (difficulty && difficulty.value) n++;
        var age = document.querySelector('#ageBar [data-age-filter].active');
        if (age && age.getAttribute('data-age-filter') !== 'all') n++;
        var noInstall = document.getElementById('noInstallFilter');
        if (noInstall && noInstall.getAttribute('aria-pressed') === 'true') n++;
        return n;
    }

    function sync(openIt){
        var n = activeCount();
        if (countEl) {
            countEl.textContent = n;
            countEl.hidden = n === 0;
        }
        btn.setAttribute('aria-label', n ? 'Filters, ' + n + ' active' : 'Filters');
        if (openIt && n > 0 && !shell.classList.contains('filters-open')) {
            shell.classList.add('filters-open');
            btn.setAttribute('aria-expanded', 'true');
        }
    }

    btn.addEventListener('click', function(){
        var open = shell.classList.toggle('filters-open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    ['change', 'click', 'input'].forEach(function(evt){
        document.addEventListener(evt, function(e){
            if (!e.target.closest) return;
            var auto = !!e.target.closest('#workshopTool, #workshopExperience, #workshopDifficulty, #ageBar, #noInstallFilter, #browse-engines');
            var relevant = !!e.target.closest('#workshopTool, #workshopExperience, #workshopDifficulty, #ageBar, #noInstallFilter, #workshopReset, #activeFilters, #browse-engines, #workshopSearch');
            if (!relevant) return;
            var clearing = !!e.target.closest('#workshopReset, #activeFilters');
            setTimeout(function(){ sync(auto && !clearing); }, 30);
        }, true);
    });

    sync(false);
    setTimeout(function(){ sync(false); }, 500);
})();
/* Sticky finder: add a shadow once the search bar pins to the top. */
(function(){
    var shell = document.querySelector('.ws-finder-shell');
    if (!shell || !window.IntersectionObserver) return;
    var sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'height:1px;margin-bottom:-1px';
    shell.parentNode.insertBefore(sentinel, shell);
    new IntersectionObserver(function(entries){
        shell.classList.toggle('is-stuck', !entries[0].isIntersecting);
    }, { threshold: 0 }).observe(sentinel);
})();
