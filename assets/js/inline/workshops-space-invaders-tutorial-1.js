/* -- Scroll reveal -- */
const obs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if(e.isIntersecting){
      const sibs = [...e.target.parentElement.querySelectorAll('.reveal')];
      setTimeout(() => e.target.classList.add('visible'), Math.min(sibs.indexOf(e.target)*80, 240));
      obs.unobserve(e.target);
    }
  });
},{threshold:0.07});
document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
