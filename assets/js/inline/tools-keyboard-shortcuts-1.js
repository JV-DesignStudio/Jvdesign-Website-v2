(function () {
/* Tab switching */
var btns = document.querySelectorAll('.tab-btn');
var sections = document.querySelectorAll('.engine-section');
btns.forEach(function (btn) {
    btn.addEventListener('click', function () {
        btns.forEach(function (b) { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
        sections.forEach(function (s) { s.classList.remove('active'); });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        var id = 'section-' + btn.getAttribute('data-engine');
        var sec = document.getElementById(id);
        if (sec) sec.classList.add('active');
    });
});

/* Footer reveal */
var footerRevealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
        if (entry.isIntersecting) {
            var parent = entry.target.parentElement;
            var siblings = Array.prototype.slice.call(parent.querySelectorAll('.reveal'));
            var idx = siblings.indexOf(entry.target);
            setTimeout(function () { entry.target.classList.add('visible'); }, Math.min(idx * 80, 400));
            footerRevealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0 });
document.querySelectorAll('.reveal').forEach(function (el) { footerRevealObserver.observe(el); });
setTimeout(function () { document.querySelectorAll('.reveal:not(.visible)').forEach(function (el) { el.classList.add('visible'); }); }, 2000);
})();
