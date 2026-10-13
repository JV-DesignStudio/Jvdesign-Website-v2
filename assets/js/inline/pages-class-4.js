(function(){
"use strict";
var CATALOG={
'dot-smash':{title:'Build a Game in 15 Minutes: Dot Smash',url:'/workshops/build-a-game-15-min.html',time:'15 min',age:'Ages 7+'},
'scratch-catch':{title:'Do Not Drop It! Build a Fruit Catch Game in Scratch',url:'/workshops/scratch-catch-workshop.html',time:'60 min',age:'Ages 7-10'},
'python-catch':{title:'My First Python Game Ep 1: Fruit Catch',url:'/workshops/python-catch-workshop.html',time:'60 min',age:'Ages 9-13'},
'js-snake':{title:'My First Browser Game Ep 4: Snake',url:'/workshops/js-snake-workshop.html',time:'60-90 min',age:'Ages 10-14'},
'scratch-clicker':{title:'Click Frenzy! Build an Idle Clicker Game in Scratch',url:'/workshops/scratch-clicker-workshop.html',time:'45-60 min',age:'Ages 7-11'}};
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
var q={};
try{location.search.slice(1).split('&').forEach(function(p){var kv=p.split('=');if(kv[0])q[decodeURIComponent(kv[0])]=decodeURIComponent((kv[1]||'').replace(/\+/g,' '));});}catch(e){}
var ids=(q.w||'').split(',').map(function(s){return s.trim();}).filter(Boolean).slice(0,12);
var className=(q.n||'').slice(0,40);
if(className)document.getElementById('class-title').textContent=className+': today\u2019s lessons';
var storeKey='jvds_class_'+ids.join(',');
function load(){try{return JSON.parse(localStorage.getItem(storeKey))||{};}catch(e){return{};}}
function save(v){try{localStorage.setItem(storeKey,JSON.stringify(v));}catch(e){}}
function render(){
var done=load();
var list=document.getElementById('class-list');
if(!ids.length){
list.innerHTML='<div class="class-card"><h2>No lessons in this link yet</h2><p>Ask your teacher for the full class link, or browse every workshop below.</p><div class="class-row"><a class="link-btn" href="/workshop" style="font-weight:700">Browse workshops</a></div></div>';
return;
}
list.innerHTML=ids.map(function(id,i){
var w=CATALOG[id];
var inner=w?'<h2>'+esc(w.title)+'</h2><div class="tp-meta"><span class="badge">'+esc(w.time)+'</span><span class="badge">'+esc(w.age)+'</span></div><div class="class-row"><a class="link-btn" href="'+w.url+'" style="background:var(--teal-dk);color:#fff;border-radius:8px;padding:10px 18px;text-decoration:none;font-weight:700">Start lesson '+(i+1)+'</a><button class="link-btn class-tick" data-tick="'+esc(id)+'" style="border-radius:8px;padding:10px 18px;font:inherit;font-weight:700;cursor:pointer">'+(done[id]?'✅ Done':'⬜ Mark done')+'</button></div>'
:'<h2>Workshop link</h2><p>This step points somewhere unknown. Ask your teacher, or browse the hub.</p><div class="class-row"><a class="link-btn" href="/workshop" style="font-weight:700">Browse workshops</a></div>';
return '<div class="class-card'+(done[id]?' done':'')+'"><span class="class-num">'+(i+1)+'</span>'+inner+'</div>';
}).join('');
}
document.getElementById('class-list').addEventListener('click',function(e){
var b=e.target.closest('[data-tick]');
if(!b)return;
var d=load(),id=b.getAttribute('data-tick');
if(d[id])delete d[id];else d[id]=1;
save(d);render();
});
document.getElementById('class-print').addEventListener('click',function(){window.print();});
render();
})();
