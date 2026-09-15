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
      image,
      x: codeBlock(md, 'X / Threads (280ch) - copy-paste, keep URL'),
      instagram: codeBlock(md, 'Instagram / Facebook (long)'),
      newsletter: codeBlock(md, 'Newsletter blurb (paste into broadcast)')
    };
  });

  const pending = rows.filter((row) => row.taskStatus !== 'done');
  const done = rows.filter((row) => row.taskStatus === 'done');

  const lines = [];
  lines.push('# Newsletter and Social Queue');
  lines.push('');
  lines.push('Copy-ready drafts live here until Josh has approved the related board task. These files are working notes for manual posting, not public website pages.');
  lines.push('');
  lines.push('## How to use');
  lines.push('- Run `npm run comms:queue` after adding or approving devlog entries.');
  lines.push('- Open the newest draft in `social-posts/queue/` and copy the newsletter, X/Threads, or Instagram/Facebook section.');
  lines.push('- Post only after the linked board task reaches `done`.');
  lines.push('- After posting, record the posted URL/date in the board task evidence.');
  lines.push('');
  lines.push(`Last generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`Pending drafts: ${pending.length}`);
  lines.push(`Approved/postable drafts: ${done.length}`);
  lines.push('');

  for (const [heading, sectionRows] of [['Pending Approval', pending], ['Approved Or Posted', done]]) {
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
