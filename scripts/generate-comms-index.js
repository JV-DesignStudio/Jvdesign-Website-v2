#!/usr/bin/env node
/*
 * generate-comms-index.js - readable index for newsletter/social queue drafts.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const QUEUE_DIR = path.join(ROOT, 'social-posts', 'queue');
const INDEX = path.join(QUEUE_DIR, 'INDEX.md');
const TASKS = path.join(ROOT, '..', 'studio-workspace', 'tasks.json');

function readTasks() {
  try {
    if (!fs.existsSync(TASKS)) return [];
    return JSON.parse(fs.readFileSync(TASKS, 'utf8'));
  } catch {
    return [];
  }
}

function frontMatter(md) {
  const match = md.match(/^---\n([\s\S]*?)\n---/m);
  if (!match) return {};
  return Object.fromEntries(match[1].split(/\r?\n/).map((line) => {
    const idx = line.indexOf(':');
    if (idx === -1) return null;
    return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
  }).filter(Boolean));
}

function codeBlock(md, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('## ' + escaped + '[\\s\\S]*?```\\n([\\s\\S]*?)\\n```', 'm');
  const match = md.match(re);
  return match ? match[1].trim() : '';
}

function short(text, max = 180) {
  const compact = String(text || '').replace(/\s+/g, ' ').trim();
  return compact.length > max ? compact.slice(0, max - 1).trimEnd() + '...' : compact;
}

function commsStatus(task) {
  const pack = task && task.commsPack;
  if (!pack) return '';
  if (pack.posted && (pack.posted.social || pack.posted.newsletter)) return 'posted';
  return pack.status || task.commsStatus || task.status || '';
}

function taskForDraft(tasks, id, title) {
  const needle = 'devlog id=' + id;
  return tasks.find((task) => {
    const hay = `${task.id || ''} ${task.title || ''} ${task.desc || ''} ${task.evidence || ''}`;
    return hay.includes(needle) || (title && hay.includes('Social: ' + title.slice(0, 20)));
  });
}

function main() {
  if (!fs.existsSync(QUEUE_DIR)) fs.mkdirSync(QUEUE_DIR, { recursive: true });

  const tasks = readTasks();
  const queueFiles = fs.readdirSync(QUEUE_DIR);
  const files = queueFiles
    .filter((file) => /^\d{4}-\d{2}-\d{2}-\d+-.*\.md$/.test(file))
    .sort()
    .reverse();

  const rows = files.map((file) => {
    const full = path.join(QUEUE_DIR, file);
    const md = fs.readFileSync(full, 'utf8');
    const meta = frontMatter(md);
    const id = meta.id || (file.match(/^\d{4}-\d{2}-\d{2}-(\d+)-/) || [])[1] || '';
    const title = meta.title || file;
    const task = taskForDraft(tasks, id, title);
    const image = queueFiles.find((candidate) => candidate.endsWith('.png') && candidate.includes('-' + id + '-'));
    return {
      file,
      id,
      date: meta.date || '',
      title,
      tag: meta.tag || '',
      url: meta.url || '',
      taskId: task ? task.id : '',
      taskStatus: task ? task.status : 'needs board task',
      commsStatus: task ? commsStatus(task) : 'needs board task',
      image,
      x: codeBlock(md, 'X / Threads (280ch) - copy-paste, keep URL'),
      instagram: codeBlock(md, 'Instagram / Facebook (long)'),
      newsletter: codeBlock(md, 'Newsletter blurb (paste into broadcast)')
    };
  });

  const needsReview = rows.filter((row) => !['approved', 'posted'].includes(row.commsStatus));
  const ready = rows.filter((row) => row.commsStatus === 'approved');
  const posted = rows.filter((row) => row.commsStatus === 'posted');

  const lines = [];
  lines.push('# Newsletter and Social Queue');
  lines.push('');
  lines.push('Copy-ready drafts live here only while they still need review, posting, or send confirmation. Approved work should move from review into Ready; posted/sent work should be recorded and kept out of the daily action pile.');
  lines.push('');
  lines.push('## How to use');
  lines.push('- Run `npm run comms:queue` after adding or approving devlog entries.');
  lines.push('- Open the newest draft in `social-posts/queue/` and copy the newsletter, X/Threads, or Instagram/Facebook section.');
  lines.push('- Post/send only after the comms pack is approved.');
  lines.push('- After posting or sending, mark the comms pack posted/sent so it leaves the action view.');
  lines.push('');
  lines.push(`Last generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`Needs review: ${needsReview.length}`);
  lines.push(`Ready to post/send: ${ready.length}`);
  lines.push(`Posted or sent: ${posted.length}`);
  lines.push('');

  for (const [heading, sectionRows] of [['Needs Review', needsReview], ['Ready To Post Or Send', ready], ['Posted Or Sent', posted]]) {
    lines.push(`## ${heading}`);
    lines.push('');
    if (!sectionRows.length) {
      lines.push('_None right now._');
      lines.push('');
      continue;
    }
    for (const row of sectionRows) {
      lines.push(`### ${row.title}`);
      lines.push(`- draft: \`${row.file}\``);
      lines.push(`- devlog: id ${row.id}, ${row.date}, ${row.tag}`);
      lines.push(`- board: ${row.taskId ? `${row.taskId} (${row.taskStatus})` : row.taskStatus}`);
      lines.push(`- comms: ${row.commsStatus}`);
      lines.push(`- image: ${row.image ? `\`${row.image}\`` : 'needs social card'}`);
      if (row.url) lines.push(`- url: ${row.url}`);
      if (row.newsletter) lines.push(`- newsletter: ${short(row.newsletter)}`);
      if (row.x) lines.push(`- X/Threads: ${short(row.x)}`);
      lines.push('');
    }
  }

  fs.writeFileSync(INDEX, lines.join('\n'), 'utf8');
  console.log(`Wrote ${path.relative(ROOT, INDEX)} (${rows.length} drafts)`);
}

main();
