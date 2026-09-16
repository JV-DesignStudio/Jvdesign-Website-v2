#!/usr/bin/env node
/* Audit ready-to-post packs for missing assets, jargon and weak public copy. */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const READY = path.join(ROOT, 'social-posts', 'ready');
const REPORT = path.join(READY, 'QUALITY_REPORT.md');
const JARGON = [/\bFile:/i,/\bEvidence:/i,/validate:/i,/\bPASS\b|\bFAIL\b/i,/F:\\\\Website/i,/\.cjs|\.js|\.html/i,/localStorage|IndexedDB|SHA256|CACHE=/i,/\bA\d+\b/];
function read(file){ try{return fs.readFileSync(file,'utf8').trim();}catch{return '';} }
function scoreText(text, min){
  const issues=[];
  if(!text) issues.push('missing copy');
  if(text.length && text.length<min) issues.push('too short');
  if(text.includes('...')) issues.push('truncated ellipsis');
  for(const re of JARGON) if(re.test(text)) issues.push('technical jargon: '+re.source.replace(/\\b/g,''));
  if(!/young|creator|learn|create|play|studio|family|classroom|JVDesignStudio/i.test(text)) issues.push('weak audience wording');
  return issues;
}
function main(){
  if(!fs.existsSync(READY)) throw new Error('Missing ready dir');
  const dirs=fs.readdirSync(READY).filter(f=>fs.statSync(path.join(READY,f)).isDirectory()).sort();
  const rows=[];
  for(const dir of dirs){
    const full=path.join(READY,dir);
    const ig=read(path.join(full,'caption-instagram-facebook.txt'));
    const x=read(path.join(full,'caption-x-threads.txt'));
    const nl=read(path.join(full,'newsletter-blurb.txt'));
    const link=read(path.join(full,'link.txt'));
    const preview=fs.existsSync(path.join(full,'preview.html'));
    const image=fs.readdirSync(full).some(f=>/\.(png|jpg|jpeg|webp)$/i.test(f));
    const issues=[...scoreText(ig,80).map(i=>'Instagram/Facebook '+i),...scoreText(x,40).map(i=>'X/Threads '+i),...scoreText(nl,80).map(i=>'Newsletter '+i)];
    if(!link) issues.push('missing link');
    if(!preview) issues.push('missing preview.html');
    if(!image) issues.push('missing image');
    const score=Math.max(0,100-(issues.length*12));
    rows.push({dir,score,issues});
  }
  const lines=['# Ready Pack Quality Report','',`Generated: ${new Date().toISOString()}`,'',`Packs audited: ${rows.length}`,''];
  for(const r of rows){
    lines.push(`## ${r.dir}`);
    lines.push(`- score: ${r.score}/100`);
    if(r.issues.length) lines.push(...r.issues.map(i=>`- issue: ${i}`)); else lines.push('- ready: no issues found');
    lines.push('');
  }
  fs.writeFileSync(REPORT,lines.join('\n'),'utf8');
  console.log(`Audited ${rows.length} ready packs -> social-posts/ready/QUALITY_REPORT.md`);
  const bad=rows.filter(r=>r.score<70);
  if(bad.length){ console.log(`Needs polish: ${bad.map(r=>r.dir+' '+r.score).join(', ')}`); }
}
main();

