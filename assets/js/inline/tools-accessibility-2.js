const KEY='jvds_accessibility';
const $=id=>document.getElementById(id);
const defaults={announce:true,motion:false,contrast:false,textSize:'100'};
let state={...defaults};
function load(){try{const r=localStorage.getItem(KEY);if(r)state={...defaults,...JSON.parse(r)};}catch(e){}}
function save(){localStorage.setItem(KEY,JSON.stringify(state));}
function apply(){
  document.documentElement.style.fontSize=state.textSize+'%';
  $('textPreview').style.fontSize=state.textSize+'%';
  if(state.contrast){document.body.style.setProperty('--line','rgba(255,255,255,.32)');document.body.classList.add('high-contrast');} else {document.body.style.removeProperty('--line');document.body.classList.remove('high-contrast');}
  if(state.motion){document.documentElement.style.setProperty('--motion','none');$('motionPreview').firstElementChild.style.animation='none';} else {$('motionPreview').firstElementChild.style.animation='';}
  $('swAnnounce').classList.toggle('on',state.announce);$('swAnnounce').setAttribute('aria-checked',state.announce);
  $('swMotion').classList.toggle('on',state.motion);$('swMotion').setAttribute('aria-checked',state.motion);
  $('swContrast').classList.toggle('on',state.contrast);$('swContrast').setAttribute('aria-checked',state.contrast);
  $('textSize').value=state.textSize;
}
function pipSay(msg){if(!state.announce)return;const a=document.getElementById('jvds-announce');if(a){a.textContent='';setTimeout(()=>a.textContent=msg,50);} $('pipText').textContent=msg; const s=window.speechSynthesis; if(s&&state.announce){try{s.cancel();const u=new SpeechSynthesisUtterance(msg);u.rate=1;u.volume=0.7;s.speak(u);}catch(e){}}}
function toggle(key,el){state[key]=!state[key];el.classList.toggle('on',state[key]);el.setAttribute('aria-checked',state[key]);save();apply();pipSay(key==='announce'?(state.announce?'Pip announcements on':'Pip announcements off'):key==='motion'?(state.motion?'Reduced motion on - animations off':'Animations on'):key==='contrast'?(state.contrast?'High contrast on':'High contrast off'):'Saved');}
$('swAnnounce').onclick=()=>toggle('announce',$('swAnnounce'));
$('swMotion').onclick=()=>toggle('motion',$('swMotion'));
$('swContrast').onclick=()=>toggle('contrast',$('swContrast'));
$('textSize').onchange=e=>{state.textSize=e.target.value;save();apply();pipSay('Text size '+state.textSize+' percent');};
$('btnTestSR').onclick=()=>pipSay('Hello from Pip! This is a screen reader test - Echo says you are doing great.');
$('btnReadPage').onclick=()=>pipSay(document.title);
$('btnSave').onclick=()=>{save();$('saveStatus').textContent='Saved offline to '+KEY;pipSay('Settings saved offline');if(window.ToolXP)ToolXP.award('accessibility',15);};
$('btnReset').onclick=()=>{state={...defaults};save();apply();$('saveStatus').textContent='Reset to defaults';pipSay('Settings reset');};
load();apply();
document.addEventListener('DOMContentLoaded',()=>{if(window.EmberGuide)EmberGuide.init({id:'accessibility',steps:[{target:'#swAnnounce',title:'Pip voices',text:'Character-driven - Pip speaks changes so screen reader users know.'},{target:'#swMotion',title:'Reduced motion',text:'Respects prefers-reduced-motion, works offline.'}]})});
