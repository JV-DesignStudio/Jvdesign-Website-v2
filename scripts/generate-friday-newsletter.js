#!/usr/bin/env node
/* Build a Friday newsletter prep file from approved comms packs. */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TASKS = path.join(ROOT, '..', 'studio-workspace', 'tasks.json');
const OUT_DIR = path.join(ROOT, 'social-posts', 'ready');
const OUT = path.join(OUT_DIR, 'FRIDAY_NEWSLETTER.md');

function statusOf(t) {
  const p = t.commsPack || {};
  if (p.posted && p.posted.newsletter) return 'sent';
  return p.status || t.commsStatus || 'pending';
}
function clean(s) { return String(s || '').replace(/\r\n/g, '\n').trim(); }
function titleOf(t) { return clean(t.commsPack?.title || t.title || 'Studio update'); }
function fridayFromToday() {
  const d = new Date(); d.setHours(0,0,0,0);
  const delta = (5 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0,10);
}
function blurb(t) {
  const p = t.commsPack || {};
  return clean(p.newsletter || p.devlog?.excerpt || p.friendly?.what || `${titleOf(t)} is ready to share from the studio.`)
    .replace(/\s+/g, ' ');
}
function link(t) {
  const p = t.commsPack || {};
  return p.devlog?.id ? `https://jvdesignstudio.co.uk/devlog#post-${p.devlog.id}` : 'https://jvdesignstudio.co.uk/devlog';
}
function main() {
  if (!fs.existsSync(TASKS)) throw new Error('Missing tasks.json: ' + TASKS);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const tasks = JSON.parse(fs.readFileSync(TASKS, 'utf8'));
  const approved = tasks.filter(t => t.commsPack && ['approved','scheduled'].includes(statusOf(t)) && !t.commsPack?.posted?.newsletter)
    .sort((a,b) => String(a.id).localeCompare(String(b.id)))
    .slice(0, 8);
  const friday = fridayFromToday();
  const lines = [
    '# Friday Newsletter Pack',
    '',
    `Target send: ${friday}`,
    '',
    'Subject idea: This week at JVDesignStudio',
    '',
    'Opening:',
    'A quick studio update for young creators, families and classrooms. Here is what is ready to try, read or share this week.',
    '',
    '## Main Updates',
    ''
  ];
  if (!approved.length) lines.push('No approved newsletter items yet. Approve comms cards first, then rerun `npm run newsletter:friday`.');
  for (const t of approved) {
    lines.push(`### ${titleOf(t)}`);
    lines.push(blurb(t));
    lines.push('');
    lines.push(`Link: ${link(t)}`);
    lines.push('');
  }
  lines.push('## Closing');
  lines.push('Thanks for following the studio. More browser-first creative tools, games and workshops are on the way.');
  lines.push('');
  lines.push('## Send Checklist');
  lines.push('- Read it once out loud.');
  lines.push('- Check every link opens.');
  lines.push('- Send on Friday.');
  lines.push('- Mark newsletter sent on the board.');
  lines.push('');
  fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
  console.log(`Friday newsletter pack built: ${path.relative(ROOT, OUT)} (${approved.length} item(s))`);
}
main();
