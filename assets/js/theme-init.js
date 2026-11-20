(function(){try{var t=localStorage.getItem('jvds-theme');if(t==='dark'||t==='contrast')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();
/* A3136: most workshop pages are permanently dark chrome but do not set a
   theme, so light-theme tokens left their body copy unreadable. Mark those
   pages as a dark surface once the document is styled. */
(function(){
  if(!/\/workshops\//i.test(location.pathname)) return;
  function apply(){
    try{
      var root=document.documentElement;
      var theme=root.getAttribute('data-theme');
      if(theme==='contrast') return;
      var layers=[document.body,root];
      for(var i=0;i<layers.length;i++){
        var el=layers[i]; if(!el) continue;
        var m=(getComputedStyle(el).backgroundColor||'').match(/[\d.]+/g);
        if(!m) continue;
        var alpha=m.length>3?parseFloat(m[3]):1;
        if(alpha===0) continue;
        var lum=0.299*+m[0]+0.587*+m[1]+0.114*+m[2];
        if(lum<128) root.setAttribute('data-surface','dark');
        return;
      }
    }catch(e){}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();
})();