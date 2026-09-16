#!/usr/bin/env node
/* Build/refresh comms publish packs on task cards. */
const fs=require('fs');
const path=require('path');
const TASKS='F:/Website/studio-workspace/tasks.json';
const QUEUE='F:/Website/Jvdesign-Website-v2/social-posts/queue';

function block(text, heading){
  const re=new RegExp('## '+heading.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[\\s\\S]*?```\\n([\\s\\S]*?)\\n```','m');
  const m=String(text||'').match(re); return m?m[1].trim():'';
}
function field(desc, label){
  const m=String(desc||'').match(new RegExp(label+':\\s*([^\\n]+)'));
  return m?m[1].trim():'';
}
function firstLineAfter(desc, label){
  const s=String(desc||''); const i=s.indexOf(label+':'); if(i<0) return '';
  return s.slice(i+label.length+1).trim().split(/\n\n|\n[A-Z][A-Z /]+ - |\nWHEN /)[0].trim();
}
function friendly(title, excerpt){
  const clean=String(excerpt||'').replace(/^File:\s*/,'').replace(/\s+/g,' ').trim();
  return {
    what:`${title} is ready for review.`,
    why:'This update helps keep JVDesignStudio easier to use, easier to trust, and easier to share.',
    tryIt:'Open the Dev Log or the linked page to try the change.'
  };
}
function socialFromDraftFile(file){
  try{
    const md=fs.readFileSync(path.join(QUEUE,file),'utf8');
    return {
      x:block(md,'X / Threads (280ch) - copy-paste, keep URL'),
      instagram:block(md,'Instagram / Facebook (long)'),
      newsletter:block(md,'Newsletter blurb (paste into broadcast)')
    };
  }catch{return {};}
}
function makePack(t){
  const isDev=String(t.desc||'').includes('DEV LOG DRAFT - REVIEW/COPY');
  const isSocial=String(t.desc||'').includes('COPY-READY SOCIAL / NEWSLETTER CARD') || String(t.title||'').startsWith('Social:');
  if(!isDev && !isSocial) return null;
  const pack=t.commsPack||{};
  const title=t.title.replace(/^Social:\s*/,'');
  let devlog={...pack.devlog}; let social={...pack.social}; let newsletter=pack.newsletter||''; let image=pack.image||'';
  let kind=isDev?'devlog':'social';
  if(isDev){
    devlog={
      id:(String(t.desc).match(/Target: devlog-data\.js post id (\d+)/)||[])[1]||'',
      title:(String(t.desc).match(/Title:\s*(.+)/)||[])[1]||title,
      date:(String(t.desc).match(/Date:\s*(.+)/)||[])[1]||'',
      tag:(String(t.desc).match(/Tag:\s*(.+)/)||[])[1]||t.tag,
      excerpt:firstLineAfter(t.desc,'Excerpt'),
      content:firstLineAfter(t.desc,'Content')
    };
  }
  if(isSocial){
    image=field(t.desc,'Image card')||image;
    const draft=(field(t.desc,'Draft file')||'').replace(/^.*social-posts\/queue\//,'');
    const fromFile=draft?socialFromDraftFile(draft):{};
    newsletter=fromFile.newsletter || firstLineAfter(t.desc,'NEWSLETTER - copy/paste') || newsletter;
    social={
      x: fromFile.x || firstLineAfter(t.desc,'X / THREADS - copy/paste') || social.x || '',
      instagram: fromFile.instagram || firstLineAfter(t.desc,'INSTAGRAM / FACEBOOK - copy/paste') || social.instagram || ''
    };
  }
  const f=friendly(title, devlog.excerpt||newsletter||social.x);
  return {
    version:1,
    kind,
    status:t.commsStatus||pack.status||'pending',
    title,
    sourceTask:t.id,
    image,
    devlog,
    newsletter,
    social,
    friendly:f,
    declineNote:t.commsDeclineNote||pack.declineNote||'',
    posted:{social:pack.posted?.social||'', newsletter:pack.posted?.newsletter||''}
  };
}
const tasks=JSON.parse(fs.readFileSync(TASKS,'utf8'));
let n=0;
for(const t of tasks){ const p=makePack(t); if(p){ t.commsPack=p; t.commsStatus=p.status; n++; }}
fs.writeFileSync(TASKS,JSON.stringify(tasks,null,2)+'\n');
console.log('refreshed comms packs',n);
