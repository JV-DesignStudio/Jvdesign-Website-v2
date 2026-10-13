const PACKS={
  en:{'pixel.title':'Pixel Studio','pixel.desc':'Draw pixel art, design characters, animate and export.','nav.play':'Play','nav.learn':'Learn','mascot.ember':'Ember - Create'},
  es:{'pixel.title':'Estudio Píxel','pixel.desc':'Dibuja arte píxel, diseña personajes, anima y exporta.','nav.play':'Jugar','nav.learn':'Aprender','mascot.ember':'Ember - Crear'},
  fr:{'pixel.title':'Studio Pixel','pixel.desc':'Dessine en pixel art, conçois des personnages, anime et exporte.','nav.play':'Jouer','nav.learn':'Apprendre','mascot.ember':'Ember - Créer'},
  de:{'pixel.title':'Pixel Studio','pixel.desc':'Zeichne Pixel-Art, entwerfe Charaktere, animiere und exportiere.','nav.play':'Spielen','nav.learn':'Lernen','mascot.ember':'Ember - Erstellen'}
};
const KEY='jvds_locale';
const $=id=>document.getElementById(id);
let lang=localStorage.getItem(KEY)||'en';
function t(k){return (PACKS[lang]&&PACKS[lang][k])||PACKS.en[k]||k;}
function apply(){
  $('toolTitle').textContent=t('pixel.title');
  $('toolDesc').textContent=t('pixel.desc');
  const preview=$('preview');preview.innerHTML='';
  Object.keys(PACKS.en).forEach(k=>{const a=document.createElement('div');a.textContent=k;a.style.color='var(--muted)';a.style.fontFamily='monospace';const b=document.createElement('div');b.textContent=t(k);preview.appendChild(a);preview.appendChild(b);});
  document.querySelectorAll('.lang').forEach(b=>{b.classList.toggle('on',b.dataset.lang===lang);b.setAttribute('aria-selected',b.dataset.lang===lang);});
  $('log').textContent='Language: '+lang+' - offline pack applied. '+new Date().toLocaleTimeString();
  const a=document.getElementById('jvds-announce');if(a){a.textContent='Language '+lang;setTimeout(()=>a.textContent='',1200);}
}
document.querySelectorAll('.lang').forEach(b=>b.onclick=()=>{lang=b.dataset.lang;localStorage.setItem(KEY,lang);apply();if(window.ToolXP)ToolXP.award('localize',10);});
$('btnUse').onclick=()=>location.href='/tools/pixel-studio.html';
$('btnExportPack').onclick=()=>{const blob=new Blob([JSON.stringify(PACKS[lang],null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='jvds-locale-'+lang+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000);};
$('btnAddTrans').onclick=()=>{const k=prompt('Key (e.g. pixel.title):'); if(!k)return;const v=prompt('Translation for '+lang+':'); if(v===null)return;PACKS[lang][k]=v;apply();};
$('btnReset').onclick=()=>{lang='en';localStorage.setItem(KEY,lang);apply();};
apply();
document.addEventListener('DOMContentLoaded',()=>{if(window.EmberGuide)EmberGuide.init({id:'localize',steps:[{target:'.langs',title:'Pick language',text:'Packs work offline - teacher can set once, class stays offline.'},{target:'#preview',title:'Live preview',text:'All tool strings translate instantly, no reload.'}]})});
