(function () {
const footerRevealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const parent = entry.target.parentElement;
            const siblings = [...parent.querySelectorAll('.reveal')];
            const idx = siblings.indexOf(entry.target);
            setTimeout(() => entry.target.classList.add('visible'), Math.min(idx * 80, 400));
            footerRevealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0 });
document.querySelectorAll('.reveal').forEach(el => footerRevealObserver.observe(el));
  setTimeout(() => document.querySelectorAll('.reveal:not(.visible)').forEach(el => el.classList.add('visible')), 2000);
})();
