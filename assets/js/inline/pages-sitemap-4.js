const obs=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){const siblings=[...entry.target.parentElement.querySelectorAll('.reveal')];const idx=siblings.indexOf(entry.target);setTimeout(()=>entry.target.classList.add('visible'),Math.min(idx*90,400));obs.unobserve(entry.target);}});},{threshold:.06});
document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));

