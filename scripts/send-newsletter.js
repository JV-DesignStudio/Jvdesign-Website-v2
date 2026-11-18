#!/usr/bin/env node
// send-newsletter.js - weekly digest draft from devlog-data.js, with optional Beehiiv broadcast draft creation.
// Dev Log is source: POSTS in devlog-data.js. Every Friday a digest of that week's dev logs is drafted.
// Draft goes to social-posts/queue/newsletter-week-YYYY-Www.html + board task human_review for edit before release.
// With BEEHIIV_API_KEY + BEEHIIV_PUBLICATION_ID set, also creates a Beehiiv broadcast draft (not published).
// Usage: node scripts/send-newsletter.js [--check]   // Friday weekly check, 3-post threshold
//        node scripts/send-newsletter.js --force       // force draft regardless of day/threshold
const fs=require('fs'), path=require('path');
const vm=require('vm');
const ROOT=path.resolve(__dirname,'..');
const DEVLOG=path.join(ROOT,'devlog-data.js');
const OUT_DIR=path.join(ROOT,'social-posts','queue');
const MIN_POSTS=3;
const { SITE, siteUrl, primaryHref } = require('./lib/devlog-links');

function parsePosts(src){
  const sandbox={console:{log:()=>{},warn:()=>{}}, window:{}};
  vm.createContext(sandbox);
  let raw=[];
  try{ raw=vm.runInContext(`(function(){${src};return POSTS;})()`, sandbox, {timeout:5000})||[]; }
  catch(e){ console.error('[newsletter] devlog parse failed:', e.message); process.exit(1); }
  return raw.map(p=>{
    const primary=primaryHref(p);
    return {
      id:String(p.id), date:p.date||'', tag:p.tag||'', emoji:p.emoji||'',
      title:p.title||'', excerpt:p.excerpt||'',
      image: p.image ? (p.image.startsWith('http') ? p.image : SITE + p.image) : '',
      url: primary ? siteUrl(primary) : `${SITE}/devlog#post-${p.id}`,
      hasLink: !!primary,
    };
  });
}
function parseDateStr(s){
  const m=String(s).match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if(!m) return null;
  const months={january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11};
  return new Date(parseInt(m[3]), months[m[2].toLowerCase()]||0, parseInt(m[1]));
}
const src=fs.readFileSync(DEVLOG,'utf8');
let allPosts=parsePosts(src).map(p=>({...p, _d: parseDateStr(p.date)})).filter(p=>p._d);
// Dedupe by id - keep newest (last in file wins for duplicates)
const seen=new Map(); for(const p of allPosts) seen.set(p.id, p);
allPosts=[...seen.values()].filter(p=> !String(p.title).startsWith('Fix ') ).sort((a,b)=> b._d - a._d || parseInt(b.id)-parseInt(a.id));

function mondayKey(d){
  const c=new Date(d); const day=(c.getDay()+6)%7; c.setDate(c.getDate()-day); c.setHours(0,0,0,0);
  return c.toISOString().slice(0,10);
}
const byWeek=new Map();
for(const p of allPosts){
  const k=mondayKey(p._d);
  if(!byWeek.has(k)) byWeek.set(k, []);
  byWeek.get(k).push(p);
}
const args=process.argv.slice(2);
const isCheck=args.includes('--check');
const isForce=args.includes('--force');

let targetKey=null, targetPosts=[];
if(isForce){
  const weeks=[...byWeek.entries()].sort((a,b)=> b[0].localeCompare(a[0]));
  targetKey=weeks[0]?.[0];
  targetPosts=(weeks[0]?.[1]||[]).slice(0,5);
} else {
  const today=new Date(); today.setHours(0,0,0,0);
  targetKey=mondayKey(today);
  targetPosts=(byWeek.get(targetKey)||[]).slice(0,5);
  const isFriday=today.getDay()===5;
  if(!isFriday && !isCheck){
    console.log(`[newsletter] today is not Friday (${today.toLocaleDateString('en-GB', {weekday:'long'})}) - draft only on Friday. Use --force to draft now or --check to preview.`);
    process.exit(0);
  }
}
function weekLabel(k){
  const d=new Date(k); const opts={day:'numeric', month:'long'}; return `Week of ${d.toLocaleDateString('en-GB', opts)}`;
}
function buildHtml(posts, weekStr){
  const label=weekLabel(weekStr)||'This week';
  const topTitle = posts[0] ? posts[0].title : 'Studio update';
  return `<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Studio Dev Log — ${label}</title></head>
<body style="margin:0;padding:0;background:#0f0d0b;font-family:Inter,Arial,sans-serif;color:#F0EAD6;">

<!-- wrapper -->
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0d0b;">
<tr><td align="center" style="padding:24px 16px 0;">

<!-- email card -->
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1a1612;border-radius:20px;overflow:hidden;">

<!-- HEADER -->
<tr><td style="background:linear-gradient(160deg,#1f1309 0%,#1a1612 100%);padding:36px 32px 28px;border-bottom:1px solid rgba(188,71,73,.25);">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td>
      <div style="font-size:1.5rem;font-weight:900;color:#fff;letter-spacing:-.02em;line-height:1;">JV<span style="color:#BC4749;">Design</span>Studio</div>
      <div style="font-size:.65rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#70A3A7;margin-top:5px;">Weekly Dev Log</div>
    </td>
    <td align="right" style="vertical-align:top;">
      <div style="font-size:.7rem;color:rgba(240,234,214,.4);text-align:right;line-height:1.5;">${label}</div>
    </td>
  </tr></table>
</td></tr>

<!-- INTRO -->
<tr><td style="padding:28px 32px 20px;">
  <p style="margin:0;font-size:.95rem;color:rgba(240,234,214,.75);line-height:1.7;">Hey — here's what's been happening in the studio this week. ${posts.length} note${posts.length===1?'':'s'} from the dev log below.</p>
</td></tr>

<!-- POSTS -->
<tr><td style="padding:0 24px 24px;">
${posts.map((p,i)=> `
<!-- post card -->
<table width="100%" cellpadding="0" cellspacing="0" style="background:#211d18;border:1px solid rgba(240,234,214,.08);border-radius:16px;overflow:hidden;margin-bottom:14px;border-top:3px solid ${['#BC4749','#D2B48C','#70A3A7','#9b6bff'][i%4]};">
<tr><td style="padding:20px 22px;">
${p.image?`<img src="${p.image}" alt="" width="556" style="width:100%;max-width:556px;height:auto;border-radius:10px;display:block;margin:0 0 16px;">`:''}
<div style="font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#70A3A7;margin-bottom:6px;">${p.tag}  ·  ${p.date}</div>
<div style="font-size:1.15rem;font-weight:800;color:#fff;line-height:1.3;margin-bottom:10px;">${p.emoji} ${p.title}</div>
<p style="margin:0 0 16px;font-size:.88rem;color:rgba(240,234,214,.65);line-height:1.7;">${p.excerpt}</p>
<table cellpadding="0" cellspacing="0"><tr>
${p.hasLink?`<td style="padding-right:12px;"><a href="${p.url}" style="display:inline-block;background:#BC4749;color:#fff;font-weight:700;font-size:.82rem;padding:9px 20px;border-radius:999px;text-decoration:none;letter-spacing:.02em;">Try it →</a></td>`:''}
<td><a href="https://jvdesignstudio.co.uk/devlog#post-${p.id}" style="display:inline-block;color:#70A3A7;font-weight:700;font-size:.82rem;text-decoration:none;border:1.5px solid rgba(112,163,167,.35);padding:9px 18px;border-radius:999px;">Read note →</a></td>
</tr></table>
</td></tr></table>`).join('\n')}
</td></tr>

<!-- FOOTER -->
<tr><td style="background:#120f0c;padding:28px 32px;border-top:1px solid rgba(240,234,214,.06);">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="vertical-align:top;">
      <div style="font-size:.85rem;font-weight:900;color:rgba(240,234,214,.5);letter-spacing:-.01em;">JV<span style="color:rgba(188,71,73,.6);">Design</span>Studio</div>
      <div style="font-size:.7rem;color:rgba(240,234,214,.3);margin-top:4px;line-height:1.6;">Made with ☕ in the studio.<br>One email a week, no spam.</div>
    </td>
    <td align="right" style="vertical-align:top;">
      <a href="https://jvdesignstudio.co.uk/devlog" style="font-size:.72rem;color:#70A3A7;text-decoration:none;display:block;text-align:right;margin-bottom:6px;">Dev Log →</a>
      <a href="https://jvdesignstudio.co.uk/newsletter.html" style="font-size:.72rem;color:rgba(240,234,214,.3);text-decoration:none;display:block;text-align:right;">Manage subscription</a>
    </td>
  </tr></table>
  <p style="margin:20px 0 0;font-size:.65rem;color:rgba(240,234,214,.2);text-align:center;line-height:1.7;">You received this because you subscribed at jvdesignstudio.co.uk/newsletter via Beehiiv · Unsubscribe via the link at the bottom of this email</p>
</td></tr>

</table>
<!-- /email card -->

</td></tr></table>
<!-- /wrapper -->

</body></html>`;
}
async function createBeehiivDraft(subject, html){
  const apiKey=process.env.BEEHIIV_API_KEY;
  const pubId=process.env.BEEHIIV_PUBLICATION_ID;
  if(!apiKey || !pubId){
    console.log('[beehiiv] BEEHIIV_API_KEY or BEEHIIV_PUBLICATION_ID not set - skipping broadcast draft creation.');
    return null;
  }
  try{
    const https=require('https');
    const body=JSON.stringify({
      subject,
      content: { free: { web: html, email: html } },
      status: 'draft',
      send_at: null,
    });
    return await new Promise((resolve,reject)=>{
      const req=https.request({
        hostname:'api.beehiiv.com',
        path:`/v2/publications/${pubId}/posts`,
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`,'Content-Length':Buffer.byteLength(body)},
      },res=>{
        let data='';
        res.on('data',c=>data+=c);
        res.on('end',()=>{
          if(res.statusCode>=200 && res.statusCode<300){
            const r=JSON.parse(data);
            resolve(r?.data?.id||null);
          } else {
            console.error(`[beehiiv] API error ${res.statusCode}: ${data.slice(0,200)}`);
            resolve(null);
          }
        });
      });
      req.on('error',e=>{ console.error('[beehiiv] request error:', e.message); resolve(null); });
      req.write(body);
      req.end();
    });
  }catch(e){ console.error('[beehiiv] unexpected error:', e.message); return null; }
}
function ensureBoardTask(posts, weekStr, queueFile){
  const title=`Newsletter: ${weekStr} (${posts.map(p=>p.id).join(',')})`;
  const desc=`Weekly newsletter digest for ${weekStr}: ${posts.length} dev log post(s) ${posts.map(p=>`#${p.id} ${p.title.slice(0,40)}`).join('; ')}. File: ${queueFile}. Must pass board review before publishing Beehiiv broadcast draft. Threshold ${MIN_POSTS} posts.`;
  const done=`Queue file ${queueFile} exists, validate:public PASS, board task human_review->done via --approve, then publish Beehiiv broadcast draft from app.beehiiv.com.`;
  try{
    const {execSync}=require('child_process');
    const boardKeeper='F:/Website/studio-workspace/board-keeper.cjs';
    const tasks=JSON.parse(require('fs').readFileSync('F:/Website/studio-workspace/tasks.json','utf8'));
    const exists=tasks.some(t=> (t.title||'').includes(weekStr) && (t.title||'').includes('Newsletter:'));
    if(exists){ console.log(`[board] task for ${weekStr} already exists`); return; }
    execSync(`node "${boardKeeper}" --create --title "${title.replace(/"/g,'\\"')}" --priority P2 --tag site --desc "${desc.replace(/"/g,'\\"')}" --done "${done.replace(/"/g,'\\"')}"`, {stdio:'inherit'});
  }catch(e){ console.log('[board] auto-create skipped', e.message.split('\n')[0]); }
}
if(!targetKey){
  console.log('[newsletter] no posts for this week');
  process.exit(0);
}
if(targetPosts.length < MIN_POSTS){
  if(isCheck){
    console.log(`[newsletter] ${targetKey} (${weekLabel(targetKey)}): only ${targetPosts.length} post(s) (< ${MIN_POSTS} threshold) - no digest this week. Posts: ${targetPosts.map(p=>p.id).join(',')||'none'}`);
    process.exit(0);
  }
  console.log(`[newsletter] ${targetKey}: only ${targetPosts.length} post(s) < ${MIN_POSTS} - skip (use --force to draft anyway)`);
  process.exit(0);
}
const fname=`newsletter-week-${targetKey}.html`;
const outPath=path.join(OUT_DIR, fname);
const html=buildHtml(targetPosts, targetKey);
if(isCheck){
  if(require('fs').existsSync(outPath)) console.log(`would keep: ${path.relative(ROOT,outPath)} for ${targetKey} (${targetPosts.length} posts: ${targetPosts.map(p=>p.id).join(',')})`);
  else console.log(`would create: ${path.relative(ROOT,outPath)} for ${targetKey} (${targetPosts.length} posts: ${targetPosts.map(p=>p.id).join(',')})`);
  process.exit(0);
}
require('fs').mkdirSync(OUT_DIR,{recursive:true});
const existed=require('fs').existsSync(outPath);
require('fs').writeFileSync(outPath, html);
console.log(`${existed?'updated':'draft'}: ${path.relative(ROOT,outPath)} for ${targetKey} (${targetPosts.length} posts: ${targetPosts.map(p=>`#${p.id}`).join(', ')})`);
const subject=`Studio log: ${targetPosts[0]?.title||'Weekly digest'} (${weekLabel(targetKey)})`;
(async()=>{
  const draftId=await createBeehiivDraft(subject, html);
  if(draftId) console.log(`[beehiiv] broadcast draft created: ${draftId} - review and publish at app.beehiiv.com`);
  else console.log('[beehiiv] no draft created - open app.beehiiv.com and paste the HTML from '+path.relative(ROOT,outPath));
  if(!existed) ensureBoardTask(targetPosts, targetKey, `social-posts/queue/${fname}`);
})();
