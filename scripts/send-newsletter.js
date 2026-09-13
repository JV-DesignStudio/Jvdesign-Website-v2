#!/usr/bin/env node
// send-newsletter.js - weekly digest draft from devlog-data.js (Formspree signup, draft-only review gate)
// Dev Log is source: POSTS in devlog-data.js. Every Friday a digest of that week's dev logs is drafted.
// Draft goes to social-posts/queue/newsletter-week-YYYY-Www.html + board task human_review for edit before release.
// Tick never sends, no BREVO_API_KEY used - you copy-paste HTML to Formspree/Brevo manually after approve.
// Usage: node scripts/send-newsletter.js [--check]  // Friday weekly check, 3-post threshold (you chose 3)
//        node scripts/send-newsletter.js --force      // force draft regardless of day/threshold
const fs=require('fs'), path=require('path');
const ROOT=path.resolve(__dirname,'..');
const DEVLOG=path.join(ROOT,'devlog-data.js');
const OUT_DIR=path.join(ROOT,'social-posts','queue');
const MIN_POSTS=3;

function parsePosts(src){
  // Anchor to POSTS = [ block to avoid matching post content that looks like an entry
  const postsBlock = (src.match(/const POSTS\s*=\s*\[([\s\S]*?)\n\];/)||[])[1] || src;
  const re=/\{\s*id:\s*(\d+)[\s\S]*?date:\s*'([^']+)'[\s\S]*?tag:\s*'([^']+)'[\s\S]*?emoji:\s*'([^']+)'[\s\S]*?title:\s*'([^']+)'[\s\S]*?excerpt:\s*(?:'([^']*)'|"([^"]*)")/g;
  const out=[]; let m;
  while((m=re.exec(postsBlock))!==null) out.push({id:m[1], date:m[2], tag:m[3], emoji:m[4], title:m[5], excerpt:m[6]||m[7]});
  return out;
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
  return `<!doctype html><html><body style="font-family:Inter,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#1a1612;color:#F0EAD6;">
<h1 style="font-family:Fredoka,cursive;">JVDesignStudio - Weekly Dev Log Digest</h1>
<p style="color:rgba(240,234,214,.6);">${label} - ${posts.length} note${posts.length===1?'':'s'} from the dev log. One email per week max.</p>
${posts.map(p=> `<div style="background:#211d18;border:1px solid rgba(240,234,214,.08);border-radius:16px;padding:20px;margin:14px 0;">
<div style="font-size:.7rem;color:#70A3A7;text-transform:uppercase;letter-spacing:.08em;">${p.tag} - ${p.date}</div>
<h2 style="margin:6px 0;">${p.emoji} ${p.title}</h2>
<p style="color:rgba(240,234,214,.7);">${p.excerpt}</p>
<p><a href="https://jvdesignstudio.co.uk/devlog#post-${p.id}" style="color:#70A3A7;font-weight:700;">Read note -></a></p>
</div>`).join('\n')}
<p style="font-size:.75rem;color:rgba(240,234,214,.4);text-align:center;margin-top:24px;">You received this because you subscribed at <a href="https://jvdesignstudio.co.uk/newsletter.html" style="color:#70A3A7;">jvdesignstudio.co.uk/newsletter</a> via Formspree. Weekly on Friday, one email per week max. Unsubscribe via the link in your Formspree confirmation email. <a href="https://jvdesignstudio.co.uk/devlog" style="color:#70A3A7;">Dev Log -></a></p>
</body></html>`;
}
function ensureBoardTask(posts, weekStr, queueFile){
  const title=`Newsletter: ${weekStr} (${posts.map(p=>p.id).join(',')})`;
  const desc=`Weekly newsletter digest for ${weekStr}: ${posts.length} dev log post(s) ${posts.map(p=>`#${p.id} ${p.title.slice(0,40)}`).join('; ')}. File: ${queueFile}. Must pass same board review before manual send via Formspree/Brevo copy-paste. Threshold ${MIN_POSTS} posts.`;
  const done=`Queue file ${queueFile} exists at 390/1440 no overflow, validate:public PASS, board task human_review->done via --approve, then manually copy HTML to Formspree/Brevo broadcast (draft-only, tick never sends).`;
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
console.log('[draft-only] Tick never sends - copy HTML to Formspree/Brevo manually after board approve. Weekly Friday, one email per week max.');
if(!existed) ensureBoardTask(targetPosts, targetKey, `social-posts/queue/${fname}`);
