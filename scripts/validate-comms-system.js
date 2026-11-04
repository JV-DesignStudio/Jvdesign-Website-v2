#!/usr/bin/env node
/* Validate the local Comms Publishing Desk data. */
const fs=require('fs');
const path=require('path');
const TASKS='F:/Website/studio-workspace/tasks.json';
const SITE='F:/Website/Jvdesign-Website-v2';
const QUEUE=path.join(SITE,'social-posts','queue');
const guard=require('./lib/social-guard');
const tasks=JSON.parse(fs.readFileSync(TASKS,'utf8'));
const packs=tasks.filter(t=>t.commsPack);
const errors=[];
const warnings=[];
for(const t of packs){
  const p=t.commsPack;
  if(!p.title) errors.push(`${t.id}: pack missing title`);
  if(!['pending','approved','declined'].includes(p.status) && !(p.posted&&Object.values(p.posted).some(Boolean))) warnings.push(`${t.id}: unusual status ${p.status}`);
  if(p.kind==='devlog'){
    if(!p.devlog?.title) errors.push(`${t.id}: devlog pack missing title`);
    if(!p.devlog?.excerpt) warnings.push(`${t.id}: devlog pack missing excerpt`);
    if(!p.devlog?.content) warnings.push(`${t.id}: devlog pack missing content`);
  }
  if(p.kind==='social'){
    if(!p.newsletter) warnings.push(`${t.id}: social pack missing newsletter copy`);
    if(!p.social?.instagram && !p.social?.x) warnings.push(`${t.id}: social pack missing social copy`);
    if(!p.image) warnings.push(`${t.id}: social pack missing image path`);
    else if(!fs.existsSync(path.join(SITE,p.image))) errors.push(`${t.id}: image path does not exist ${p.image}`);
    for(const [label,text] of [['X',p.social?.x],['Instagram',p.social?.instagram],['newsletter',p.newsletter]]){
      if(!text) continue;
      const found=guard.issues(text);
      if(found.length) warnings.push(`${t.id}: ${label} copy has internal language (${found.join(', ')})`);
    }
  }
}
const queueCopyWarnings=[];
if(fs.existsSync(QUEUE)){
  const block=(md,heading)=>{ const re=new RegExp('##\\s*'+heading.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[^\\n]*\\n+```\\n([\\s\\S]*?)\\n```','i'); const m=md.match(re); return m?m[1].trim():''; };
  const files=fs.readdirSync(QUEUE).filter(f=>/^\d{4}-\d{2}-\d{2}-.*\.md$/.test(f));
  for(const file of files){
    let md='';
    try{ md=fs.readFileSync(path.join(QUEUE,file),'utf8'); }catch{ continue; }
    const found=new Set();
    for(const [label,heading] of [['X','X / Threads'],['Instagram','Instagram / Facebook'],['newsletter','Newsletter blurb']]){
      const text=block(md,heading);
      if(!text) continue;
      for(const issue of guard.issues(text)) found.add(label+' '+issue);
    }
    if(found.size) queueCopyWarnings.push(`${file}: ${Array.from(found).join(', ')}`);
  }
}
const summary={
  total:packs.length,
  devlog:packs.filter(t=>t.commsPack.kind==='devlog').length,
  social:packs.filter(t=>t.commsPack.kind==='social').length,
  pending:packs.filter(t=>(t.commsPack.status||'pending')==='pending').length,
  approved:packs.filter(t=>t.commsPack.status==='approved').length,
  declined:packs.filter(t=>t.commsPack.status==='declined').length,
  images:packs.filter(t=>t.commsPack.image).length,
  errors:errors.length,
  warnings:warnings.length,
  queueCopyWarnings:queueCopyWarnings.length
};
console.log(JSON.stringify(summary,null,2));
if(warnings.length) console.log('\nWarnings:\n- '+warnings.join('\n- '));
if(queueCopyWarnings.length) console.log(`\nQueue copy warnings (${queueCopyWarnings.length}):\n- ${queueCopyWarnings.slice(0,10).join('\n- ')}${queueCopyWarnings.length>10?'\n- ...':''}`);
if(errors.length){ console.error('\nErrors:\n- '+errors.join('\n- ')); process.exit(1); }
