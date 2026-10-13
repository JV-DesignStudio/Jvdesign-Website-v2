const obs=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');obs.unobserve(entry.target);}});},{threshold:.08});
document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));
