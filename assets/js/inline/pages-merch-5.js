const _revObs=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');_revObs.unobserve(e.target);}});},{threshold:0.07});
document.querySelectorAll('.reveal').forEach(el=>_revObs.observe(el));
