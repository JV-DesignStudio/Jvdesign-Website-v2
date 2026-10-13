(function(){
  function addBadge(a,text,cls){var s=document.createElement('span');s.className='ws-progress-badge '+(cls||'');s.textContent=text;(a.querySelector('.course-body')||a).appendChild(s);}
  function markCards(){
    try{
      var done=(window.playerProfile&&playerProfile.state&&Array.isArray(playerProfile.state.completedWorkshops))?playerProfile.state.completedWorkshops:[];
      var doneSet={};done.forEach(function(id){doneSet[id]=1;});
      var last=localStorage.getItem('jvds_last_workshop')||localStorage.getItem('jvds-last-workshop')||'';
      var lastId=(last.match(/workshops\/([^\/#?]+)\.html/)||[])[1];
      var cards=document.querySelectorAll('a.article-card[href*="workshops/"], a.course-card[href*="workshops/"]');
      for(var c=0;c<cards.length;c++){
        var a=cards[c],href=a.getAttribute('href')||'',m=href.match(/workshops\/([^\/#?]+)\.html/);
        if(!m)continue;
        var id=m[1],old=a.querySelector('.ws-progress-badge');if(old)old.remove();
        a.classList.remove('ws-done','ws-inprogress');
        if(doneSet[id]){a.classList.add('ws-done');addBadge(a,'✓ Completed','ws-progress-badge--done');}
        else if(lastId===id){a.classList.add('ws-inprogress');addBadge(a,'Continue','ws-progress-badge--doing');}
      }
    }catch(e){}
  }
  function run(){markCards();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(run,400);});else setTimeout(run,400);
  window.addEventListener('load',function(){setTimeout(run,800);});
})();
