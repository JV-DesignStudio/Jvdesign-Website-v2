// Mobile nav toggle handled by the BUILD:nav-content partial above.

// Dark mode
document.addEventListener('DOMContentLoaded',()=>{
  const btn=document.getElementById('themeBtn');
  if(btn){
    const saved=localStorage.getItem('jv_theme');
    if(saved){document.documentElement.setAttribute('data-theme',saved);btn.textContent=saved==='dark'?'☀️':'🌙';}
    btn.addEventListener('click',()=>{
      const isDark=document.documentElement.getAttribute('data-theme')==='dark';
      document.documentElement.setAttribute('data-theme',isDark?'light':'dark');
      btn.textContent=isDark?'🌙':'☀️';
      localStorage.setItem('jv_theme',isDark?'light':'dark');
    });
  }
});

