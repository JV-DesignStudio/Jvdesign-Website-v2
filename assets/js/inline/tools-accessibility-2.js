const KEY='jvds_accessibility';
const $=id=>document.getElementById(id);
const defaults={announce:true,motion:false,contrast:false,textSize:'100',font:false};
const TEXT_SIZES=['100','115','130','150'];
let state={...defaults};
let history=[];
function snapshot(){return JSON.stringify(state);}
function pushHistory(){history.push(snapshot());if(history.length>30)history.shift();}
function valid(next){
  const out={...defaults};
  for(const k of Object.keys(defaults)){
    if(!(k in next))continue;
    if(k==='textSize')out.textSize=TEXT_SIZES.includes(String(next[k]))?String(next[k]):'100';
    else out[k]=!!next[k];
  }
  return out;
}
function load(){try{const r=localStorage.getItem(KEY);if(r)state=valid({...defaults,...JSON.parse(r)});}catch(e){}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){}}
function apply(){
  document.documentElement.style.fontSize=state.textSize+'%';
  const tp=$('textPreview');if(tp)tp.style.fontSize=state.textSize+'%';
  document.body.classList.toggle('jvds-easy-read',!!state.font);
  if(state.contrast){document.body.style.setProperty('--line','rgba(255,255,255,.32)');document.body.classList.add('high-contrast');}else{document.body.style.removeProperty('--line');document.body.classList.remove('high-contrast');}
  if(state.motion){document.documentElement.style.setProperty('--motion','none');const m=$('motionPreview');if(m&&m.firstElementChild)m.firstElementChild.style.animation='none';}else{const m=$('motionPreview');if(m&&m.firstElementChild)m.firstElementChild.style.animation='';}
  if($('swAnnounce')){$('swAnnounce').classList.toggle('on',state.announce);$('swAnnounce').setAttribute('aria-checked',state.announce);}
  if($('swMotion')){$('swMotion').classList.toggle('on',state.motion);$('swMotion').setAttribute('aria-checked',state.motion);}
  if($('swContrast')){$('swContrast').classList.toggle('on',state.contrast);$('swContrast').setAttribute('aria-checked',state.contrast);}
  if($('swFont')){$('swFont').classList.toggle('on',!!state.font);$('swFont').setAttribute('aria-checked',!!state.font);}
  if($('textSize'))$('textSize').value=state.textSize;
  if(window.JVDSToolKit)window.JVDSToolKit.applyAccessibility();
}
function pipSay(msg){const a=document.getElementById('jvds-announce');if(a){a.textContent='';setTimeout(()=>a.textContent=msg,50);}const p=$('pipText');if(p)p.textContent=msg;const s=window.speechSynthesis;if(s&&state.announce){try{s.cancel();const u=new SpeechSynthesisUtterance(msg);u.rate=1;u.volume=0.7;s.speak(u);}catch(e){}}}
function status(msg){const st=$('saveStatus');if(st)st.textContent=msg;}
function toggle(key,el){pushHistory();state[key]=!state[key];el.classList.toggle('on',state[key]);el.setAttribute('aria-checked',state[key]);save();apply();pipSay(key==='announce'?(state.announce?'Pip announcements on':'Pip announcements off'):key==='motion'?(state.motion?'Reduced motion on - animations off':'Animations on'):key==='contrast'?(state.contrast?'High contrast on':'High contrast off'):key==='font'?(state.font?'Easier reading font on':'Easier reading font off'):'Saved');}
function encodeState(){try{return btoa(JSON.stringify(state)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}catch(e){return '';}}
function decodeState(s){try{return JSON.parse(atob(s.replace(/-/g,'+').replace(/_/g,'/')));}catch(e){return null;}}
function shareSettings(){
  const url=location.origin+location.pathname+'#a11y='+encodeState();
  const done=()=>{status('Share link copied');pipSay('Share link copied');};
  const fallback=()=>{status('Share link ready');prompt('Copy this settings link:',url);};
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(url).then(done,fallback);}
    else fallback();
  }catch(e){fallback();}
}
function exportSettings(){
  const blob=new Blob([JSON.stringify({tool:'accessibility',settings:state},null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='jvds-accessibility-settings.json';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  status('Exported settings JSON');
  pipSay('Settings exported');
}
function undoLast(){
  if(!history.length){status('Nothing to undo yet');pipSay('Nothing to undo yet');return;}
  state=valid(JSON.parse(history.pop()));
  save();apply();
  status('Undid the last change');
  pipSay('Undid the last change');
}
function applyHash(){
  const m=location.hash.match(/a11y=([^&]+)/);
  if(!m)return false;
  const d=decodeState(decodeURIComponent(m[1]));
  if(!d)return false;
  state=valid(d);save();return true;
}
if($('swAnnounce'))$('swAnnounce').onclick=()=>toggle('announce',$('swAnnounce'));
if($('swMotion'))$('swMotion').onclick=()=>toggle('motion',$('swMotion'));
if($('swContrast'))$('swContrast').onclick=()=>toggle('contrast',$('swContrast'));
if($('swFont'))$('swFont').onclick=()=>toggle('font',$('swFont'));
if($('textSize'))$('textSize').onchange=e=>{pushHistory();state.textSize=TEXT_SIZES.includes(e.target.value)?e.target.value:'100';save();apply();pipSay('Text size '+state.textSize+' percent');};
if($('btnTestSR'))$('btnTestSR').onclick=()=>pipSay('Hello from Pip! This is a screen reader test - Echo says you are doing great.');
if($('btnReadPage'))$('btnReadPage').onclick=()=>pipSay(document.title);
if($('btnSave'))$('btnSave').onclick=()=>{save();status('Saved offline to '+KEY);pipSay('Settings saved offline');if(window.ToolXP)ToolXP.award('accessibility',15);};
if($('btnReset'))$('btnReset').onclick=()=>{pushHistory();state={...defaults};save();apply();status('Reset to defaults');pipSay('Settings reset');};
if($('btnShare'))$('btnShare').onclick=shareSettings;
if($('btnExport'))$('btnExport').onclick=exportSettings;
if($('btnUndo'))$('btnUndo').onclick=undoLast;
window.shareAccessibilitySettings=shareSettings;
load();
if(applyHash())status('Settings applied from the shared link');
apply();
document.addEventListener('DOMContentLoaded',()=>{if(window.EmberGuide)EmberGuide.init({id:'accessibility',steps:[{target:'#swAnnounce',title:'Pip voices',text:'Character-driven - Pip speaks changes so screen reader users know.'},{target:'#swMotion',title:'Reduced motion',text:'Respects prefers-reduced-motion, works offline.'},{target:'#btnShare',title:'Share settings',text:'Set up another computer in one tap.'}]})});
