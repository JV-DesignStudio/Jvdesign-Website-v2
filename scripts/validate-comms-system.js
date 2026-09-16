#!/usr/bin/env node
/* Validate the local Comms Publishing Desk data. */
const fs=require('fs');
const path=require('path');
const TASKS='F:/Website/studio-workspace/tasks.json';
const SITE='F:/Website/Jvdesign-Website-v2';
const QUEUE=path.join(SITE,'social-posts','queue');
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
  warnings:warnings.length
};
console.log(JSON.stringify(summary,null,2));
if(warnings.length) console.log('\nWarnings:\n- '+warnings.join('\n- '));
if(errors.length){ console.error('\nErrors:\n- '+errors.join('\n- ')); process.exit(1); }
