const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if(e.isIntersecting){ e.target.classList.add('visible'); obs.unobserve(e.target); }});
}, {threshold:0, rootMargin:"0px 0px -30px 0px"});
document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
// Trigger any already-visible elements immediately
setTimeout(function(){
    document.querySelectorAll('.reveal:not(.visible)').forEach(function(el){
        var rect = el.getBoundingClientRect();
        if(rect.top < window.innerHeight) el.classList.add('visible');
    });
}, 100);

// Mobile nav toggle handled by the BUILD:nav-content partial.
