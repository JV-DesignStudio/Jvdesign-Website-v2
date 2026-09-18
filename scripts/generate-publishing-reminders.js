#!/usr/bin/env node
/* Build daily publishing reminders and missed-upload report from approved comms packs. */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TASKS = path.join(ROOT, '..', 'studio-workspace', 'tasks.json');
const OUT_DIR = path.join(ROOT, 'social-posts', 'ready');
const REPORT = path.join(OUT_DIR, 'PUBLISHING_REMINDERS.md');
const ICS = path.join(OUT_DIR, 'publishing-reminders.ics');

function iso(d) { return d.toISOString().slice(0,10); }
function today() { const d = new Date(); d.setHours(0,0,0,0); return d; }
function add(d,n){ const x = new Date(d); x.setDate(x.getDate()+n); return x; }
function nextDow(base,dow){ const d = new Date(base); const delta = (dow - d.getDay() + 7) % 7; d.setDate(d.getDate()+delta); return d; }
function statusOf(t){ const p=t.commsPack||{}; if(p.posted?.social||p.posted?.newsletter)return 'posted'; return p.schedule?.status||p.status||t.commsStatus||'pending'; }
function titleOf(t){ return String(t.commsPack?.title || t.title || 'Untitled').trim(); }
function due(t, channel, base){ const s=t.commsPack?.schedule||{}; if(s[channel]?.date)return s[channel].date; if(channel==='newsletter')return iso(nextDow(base,5)); if(channel==='video')return iso(add(nextDow(base,5),2)); if(channel==='devlog')return iso(base); return iso(add(base,1)); }
function isBefore(a,b){ return new Date(a+'T00:00:00') < b; }
function icsDate(date){ return String(date).replace(/-/g,''); }
function main(){
  if(!fs.existsSync(TASKS)) throw new Error('Missing tasks.json: '+TASKS);
  fs.mkdirSync(OUT_DIR,{recursive:true});
  const base=today();
  const tasks=JSON.parse(fs.readFileSync(TASKS,'utf8'));
  const approved=tasks.filter(t=>t.commsPack && ['approved','scheduled'].includes(statusOf(t)));
  const rows=[];
  for(const t of approved){
    const p=t.commsPack||{};
    const channels=[];
    if(!p.posted?.social) channels.push('social');
    if(!p.posted?.newsletter) channels.push('newsletter');
    if(/video|reel|youtube|workshop|game|arcade|play/i.test([titleOf(t),t.tag,t.desc].join(' '))) channels.push('video');
    for(const channel of channels){ rows.push({id:t.id,title:titleOf(t),channel,date:due(t,channel,base),status:statusOf(t)}); }
  }
  rows.sort((a,b)=>a.date.localeCompare(b.date)||a.channel.localeCompare(b.channel)||a.id.localeCompare(b.id));
  const dueToday=rows.filter(r=>r.date===iso(base));
  const missed=rows.filter(r=>isBefore(r.date,base));
  const lines=['# Publishing Reminders','',`Generated: ${new Date().toISOString()}`,'',`Today: ${iso(base)}`,'',`Due today: ${dueToday.length}`,'',`Missed uploads: ${missed.length}`,'','## Due Today',''];
  if(!dueToday.length) lines.push('Nothing scheduled for today.');
  for(const r of dueToday) lines.push(`- ${r.id} - ${r.channel}: ${r.title}`);
  lines.push('','## Missed Uploads','');
  if(!missed.length) lines.push('No missed uploads.');
  for(const r of missed) lines.push(`- ${r.id} - ${r.channel} was due ${r.date}: ${r.title}`);
  lines.push('','## Upcoming','');
  for(const r of rows.filter(r=>!isBefore(r.date,base)).slice(0,20)) lines.push(`- ${r.date} - ${r.channel} - ${r.id}: ${r.title}`);
  lines.push('','## Daily Use','');
  lines.push('1. Open the board Publishing Command Centre.');
  lines.push('2. Open each Upload pack due today.');
  lines.push('3. Schedule or upload on the external platform.');
  lines.push('4. Paste proof back into the board.');
  lines.push('5. Mark posted or sent when live.');
  fs.writeFileSync(REPORT,lines.join('\n'),'utf8');
  const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//JVDesignStudio//Publishing Reminders//EN'];
  for(const r of rows.slice(0,30)){
    ics.push('BEGIN:VEVENT');
    ics.push(`UID:${r.id}-${r.channel}-${r.date}@jvdesignstudio`);
    ics.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z')}`);
    ics.push(`DTSTART;VALUE=DATE:${icsDate(r.date)}`);
    ics.push(`SUMMARY:JVDS ${r.channel}: ${r.title.replace(/[,;]/g,' ')}`);
    ics.push(`DESCRIPTION:Open board upload pack for ${r.id}. Schedule/upload externally, paste proof back into board.`);
    ics.push('END:VEVENT');
  }
  ics.push('END:VCALENDAR');
  fs.writeFileSync(ICS,ics.join('\r\n'),'utf8');
  console.log(`Publishing reminders built: ${path.relative(ROOT,REPORT)} and ${path.relative(ROOT,ICS)}`);
}
main();
