(function(){
  var COPY='Copy',DONE='Copied!';
  document.querySelectorAll('.code-wrap').forEach(function(wrap){
    var label=wrap.querySelector('.code-label'),body=wrap.querySelector('.code-body');
    if(!label||!body)return;
    var btn=document.createElement('button');btn.className='copy-btn';btn.textContent=COPY;
    btn.addEventListener('click',function(){
      var text=body.innerText||body.textContent;
      function flash(){btn.textContent=DONE;btn.classList.add('copied');setTimeout(function(){btn.textContent=COPY;btn.classList.remove('copied');},2000);}
      if(navigator.clipboard){navigator.clipboard.writeText(text).then(flash);}
      else{var t=document.createElement('textarea');t.value=text;t.style.cssText='position:fixed;opacity:0';document.body.appendChild(t);t.select();document.execCommand('copy');document.body.removeChild(t);flash();}
    });
    label.appendChild(btn);
  });
})();
