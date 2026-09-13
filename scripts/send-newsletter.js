#!/usr/bin/env node
// send-newsletter.js - dry-run newsletter broadcast from devlog-data.js
// Reads latest 3 devlog posts and generates a newsletter HTML draft for manual send
// If BREVO_API_KEY or MAILCHIMP_API_KEY is set, it would POST (currently dry-run only)
// Usage: node scripts/send-newsletter.js [--dry] [--check]
const fs=require('fs'), path=require('path');
const ROOT=path.resolve(__dirname,'..');
const DEVLOG=path.join(ROOT,'devlog-data.js');
const OUT_DIR=path.join(ROOT,'social-posts','queue');
const isCheck=process.argv.includes('--check');
const isDry=process.argv.includes('--dry') || !process.env.BREVO_API_KEY;

function parsePosts(src){
  const re=/\{\s*id:\s*(\d+)[\s\S]*?date:\s*'([^']+)'[\s\S]*?tag:\s*'([^']+)'[\s\S]*?emoji:\s*'([^']+)'[\s\S]*?title:\s*'([^']+)'[\s\S]*?excerpt:\s*(?:'([^']*)'|"([^"]*)")/g;
  const out=[]; let m;
  while((m=re.exec(src))!==null) out.push({id:m[1], date:m[2], tag:m[3], emoji:m[4], title:m[5], excerpt:m[6]||m[7]});
  return out;
}
const src=fs.readFileSync(DEVLOG,'utf8');
const posts=parsePosts(src).sort((a,b)=> parseInt(b.id)-parseInt(a.id)).slice(0,3);
if(!posts.length){ console.error('no posts'); process.exit(1); }
const html=`<!doctype html><html><body>
<h1>JVDesignStudio - Latest from the Dev Log</h1>
${posts.map(p=> `<div><h2>${p.emoji} ${p.title}</h2><p><em>${p.date} - ${p.tag}</em></p><p>${p.excerpt}</p><p><a href="https://jvdesignstudio.co.uk/devlog#post-${p.id}">Read note →</a></p></div>`).join('\n')}
<p><a href="https://jvdesignstudio.co.uk/newsletter.html">Subscribe →</a> | <a href="https://jvdesignstudio.co.uk/devlog">Dev Log →</a></p>
</body></html>`;
const fname=`newsletter-draft-${new Date().toISOString().slice(0,10)}-${posts[0].id}.html`;
const outPath=path.join(OUT_DIR, fname);
if(isCheck){
  if(fs.existsSync(outPath)) console.log(`✓ newsletter draft exists: ${path.relative(ROOT,outPath)}`);
  else console.log(`○ would create newsletter draft: ${path.relative(ROOT,outPath)} for devlog ${posts.map(p=>p.id).join(',')}`);
  process.exit(0);
}
fs.mkdirSync(OUT_DIR,{recursive:true});
fs.writeFileSync(outPath, html);
console.log(`✓ newsletter draft: ${path.relative(ROOT,outPath)} for ${posts.map(p=>p.id).join(',')}`);
if(isDry){
  console.log('[dry-run] BREVO_API_KEY not set - draft only, no send. Set BREVO_API_KEY to POST to Brevo /contacts + campaign.');
} else {
  console.log('[live] would POST to Brevo/Mailchimp here with API key');
}
