(function(){
    var b = document.getElementById('wsTopBtn');
    if (!b) return;
    window.addEventListener('scroll', function(){ b.classList.toggle('show', window.scrollY > 800); }, { passive:true });
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
