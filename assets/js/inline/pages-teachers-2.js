(function(){
"use strict";
var SEQ=[
{id:'dot-smash',title:'Dot Smash taster'},
{id:'scratch-catch',title:'Fruit Catch in Scratch'},
{id:'python-catch',title:'Fruit Catch in Python'},
{id:'js-snake',title:'Snake in JavaScript'},
{id:'scratch-clicker',title:'Clicker free build'}];
var picked={};SEQ.forEach(function(s){picked[s.id]=1;});
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function renderShare(){
document.getElementById('tp-share-list').innerHTML=SEQ.map(function(s){
return '<label class="tp-student"><input type="checkbox" data-seq="'+s.id+'"'+(picked[s.id]?' checked':'')+' style="width:18px;height:18px"> <span>'+esc(s.title)+'</span></label>';
}).join('');
updateLink();
}
function buildLink(){
var ids=SEQ.filter(function(s){return picked[s.id];}).map(function(s){return s.id;});
var name=document.getElementById('tp-share-name').value.trim().slice(0,40);
var url='https://jvdesignstudio.co.uk/class?w='+ids.join(',');
if(name)url+='&n='+encodeURIComponent(name);
return url;
}
function updateLink(){
document.getElementById('tp-share-out').innerHTML='Your class link: <a id="tp-share-a" href="'+esc(buildLink())+'">'+esc(buildLink())+'</a>';
}
document.getElementById('tp-share-list').addEventListener('change',function(e){
var c=e.target.closest('[data-seq]');
if(!c)return;
picked[c.getAttribute('data-seq')]=c.checked?1:0;
updateLink();
});
document.getElementById('tp-share-name').addEventListener('input',updateLink);
document.getElementById('tp-share-copy').addEventListener('click',function(){
var url=buildLink();
function done(btn){var old=btn.textContent;btn.textContent='✅ Copied!';setTimeout(function(){btn.textContent=old;},2000);}
var btn=document.getElementById('tp-share-copy');
function fallback(){try{var ta=document.createElement('textarea');ta.value=url;ta.style.cssText='position:fixed;left:-9999px;top:0;opacity:0';document.body.appendChild(ta);ta.focus();ta.select();document.execCommand('copy');ta.remove();done(btn);}catch(e){window.prompt('Copy your class link:',url);}}
if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(url).then(function(){done(btn);}).catch(fallback);}
else fallback();
});
renderShare();
})();
