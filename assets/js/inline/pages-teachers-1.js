(function(){
"use strict";
var ROSTER_KEY='jvds_teacher_roster_v1', PROG_KEY='jvds_teacher_progress_v1';
var WORKSHOPS=[
{id:'scratch-catch-workshop',short:'Fruit Catch (Scratch)',cert:'Fruit Catch in Scratch'},
{id:'python-catch-workshop',short:'Fruit Catch (Python)',cert:'Fruit Catch in Python'},
{id:'js-snake-workshop',short:'Snake (JavaScript)',cert:'Snake in JavaScript'}];
function load(k,f){try{var v=JSON.parse(localStorage.getItem(k));return v==null?f:v;}catch(e){return f;}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function uid(){return 's'+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36);}
function render(){
var roster=load(ROSTER_KEY,[]), prog=load(PROG_KEY,{});
var list=document.getElementById('tp-roster-list');
list.innerHTML=roster.length?roster.map(function(s){
return '<div class="tp-student"><span>'+esc(s.name)+'</span><button class="link-btn" data-remove="'+s.id+'" aria-label="Remove '+esc(s.name)+'">✕</button></div>';
}).join(''):'<p style="color:var(--charcoal-lt)">No pupils yet. Add your first pupil above.</p>';
var g=document.getElementById('tp-grid');
var head='<tr><th>Pupil</th>'+WORKSHOPS.map(function(w){return '<th>'+esc(w.short)+'</th>';}).join('')+'<th>Certificates</th></tr>';
var rows=roster.map(function(s){
var st=prog[s.id]||{};
var cells=WORKSHOPS.map(function(w){
var v=st[w.id]||'';
var label=v==='done'?'✅ Done':(v==='started'?'🟡 Started':'⬜ Not started');
return '<td><button class="link-btn tp-status" data-cycle="'+s.id+':'+w.id+'">'+label+'</button></td>';
}).join('');
var done=WORKSHOPS.filter(function(w){return (prog[s.id]||{})[w.id]==='done';});
var certs=done.length?done.map(function(w){
return '<a href="/tools/certificate.html?name='+encodeURIComponent(s.name)+'&title='+encodeURIComponent(w.cert)+'">🎓 '+esc(w.short)+'</a>';
}).join('<br>'):'<span style="color:var(--charcoal-lt)">Complete a workshop first</span>';
return '<tr><td><strong>'+esc(s.name)+'</strong></td>'+cells+'<td>'+certs+'</td></tr>';
}).join('');
g.innerHTML=head+(rows||'<tr><td colspan="5">Add pupils to start tracking.</td></tr>');
var rep=document.getElementById('tp-report');
var date=new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
var repRows=roster.map(function(s){
var st=prog[s.id]||{};
return '<tr><td>'+esc(s.name)+'</td>'+WORKSHOPS.map(function(w){
var v=st[w.id]==='done'?'Done':(st[w.id]==='started'?'Started':'Not started');
return '<td>'+v+'</td>';
}).join('')+'</tr>';
}).join('');
rep.innerHTML='<h3>Class progress report, '+date+'</h3><p>'+roster.length+' pupils tracked on this device. Progress is ticked by the teacher and stays in this browser.</p><div class="tp-grid-wrap"><table class="tp-grid"><tr><th>Pupil</th>'+WORKSHOPS.map(function(w){return '<th>'+esc(w.short)+'</th>';}).join('')+'</tr>'+(repRows||'<tr><td colspan="4">No pupils yet.</td></tr>')+'</table></div>';
}
document.getElementById('tp-roster-add').addEventListener('click',function(){
var inp=document.getElementById('tp-roster-name');
var name=inp.value.trim().slice(0,30);
if(!name)return;
var roster=load(ROSTER_KEY,[]);
roster.push({id:uid(),name:name});
save(ROSTER_KEY,roster);inp.value='';inp.focus();render();
});
document.getElementById('tp-roster-name').addEventListener('keydown',function(e){
if(e.key==='Enter'){e.preventDefault();document.getElementById('tp-roster-add').click();}
});
document.getElementById('tp-roster-list').addEventListener('click',function(e){
var b=e.target.closest('[data-remove]');
if(!b)return;
var roster=load(ROSTER_KEY,[]).filter(function(s){return s.id!==b.getAttribute('data-remove');});
save(ROSTER_KEY,roster);
var prog=load(PROG_KEY,{});delete prog[b.getAttribute('data-remove')];save(PROG_KEY,prog);
render();
});
document.getElementById('tp-grid').addEventListener('click',function(e){
var b=e.target.closest('[data-cycle]');
if(!b)return;
var parts=b.getAttribute('data-cycle').split(':'),sid=parts[0],wid=parts[1];
var prog=load(PROG_KEY,{});
prog[sid]=prog[sid]||{};
var cur=prog[sid][wid]||'';
prog[sid][wid]=cur===''?'started':(cur==='started'?'done':'');
save(PROG_KEY,prog);render();
});
document.getElementById('tp-export').addEventListener('click',function(){
var roster=load(ROSTER_KEY,[]),prog=load(PROG_KEY,{});
var lines=['Pupil,'+WORKSHOPS.map(function(w){return '"'+w.short+'"';}).join(',')];
roster.forEach(function(s){
var st=prog[s.id]||{};
lines.push('"'+s.name.replace(/"/g,'""')+'",'+WORKSHOPS.map(function(w){return st[w.id]==='done'?'Done':(st[w.id]==='started'?'Started':'Not started');}).join(','));
});
var blob=new Blob([lines.join('\n')],{type:'text/csv'});
var a=document.createElement('a');
a.href=URL.createObjectURL(blob);a.download='class-progress.csv';
document.body.appendChild(a);a.click();
setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},500);
});
document.getElementById('tp-clear').addEventListener('click',function(){
if(!window.confirm('Remove the whole class list and all ticks from this device?'))return;
try{localStorage.removeItem(ROSTER_KEY);localStorage.removeItem(PROG_KEY);}catch(e){}
render();
});
function clearPrint(){
document.body.classList.remove('tp-print-plan');
document.querySelectorAll('.tp-print-scope').forEach(function(el){el.classList.remove('tp-print-scope');});
document.querySelectorAll('.tp-print-this').forEach(function(el){el.classList.remove('tp-print-this');});
}
function printScope(sectionSel,innerSel){
clearPrint();
var scope=document.querySelector(sectionSel),inner=scope?scope.querySelector(innerSel):null;
if(!scope||!inner)return;
scope.classList.add('tp-print-scope');inner.classList.add('tp-print-this');
document.body.classList.add('tp-print-plan');
window.print();
}
document.querySelectorAll('.tp-print-plan').forEach(function(b){
b.addEventListener('click',function(){printScope(b.getAttribute('data-scope')||'#tp-toolkit','#'+b.getAttribute('data-plan'));});
});
document.getElementById('tp-print-report').addEventListener('click',function(){printScope('#tp-tracker','#tp-report');});
window.addEventListener('afterprint',clearPrint);
render();
})();
