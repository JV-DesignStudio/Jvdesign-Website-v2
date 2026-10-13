document.addEventListener('keydown',e=>{
  if(e.key==='?'&&!e.ctrlKey&&!e.metaKey){
    const tag=(e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea'||tag==='select') return;
    e.preventDefault();
    showToast('Tip: Use keyboard shortcuts! '+
      '\n Ctrl+Z Undo  Ctrl+Y Redo  Ctrl+S Save  Ctrl+E Export'+
      '\n Press ? anytime to see this help.');
  }
});
