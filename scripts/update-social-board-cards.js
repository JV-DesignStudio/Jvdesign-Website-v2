#!/usr/bin/env node
/*
 * update-social-board-cards.js - put copy-ready social/newsletter drafts into board cards.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const QUEUE_DIR = path.join(ROOT, 'social-posts', 'queue');
const TASKS_PATH = path.join(ROOT, '..', 'studio-workspace', 'tasks.json');

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

function socialTaskForDraft(tasks, id, title) {
  const devlogNeedle = 'devlog id=' + id;
  const titleNeedle = 'Social: ' + String(title || '').slice(0, 20);
  return tasks.find((task) => {
    const hay = `${task.id || ''} ${task.title || ''} ${task.desc || ''} ${task.done || ''} ${task.evidence || ''}`;
    return String(task.title || '').startsWith('Social:') && (hay.includes(devlogNeedle) || hay.includes(titleNeedle));
  });
}

function buildCard({ meta, file, image, x, instagram, newsletter }) {
  const title = meta.title || file;
  const url = meta.url || '';
  return [
    'COPY-READY SOCIAL / NEWSLETTER CARD',
    '',
    `Devlog: id=${meta.id} | ${meta.date || ''} | ${meta.tag || ''}`,
    `Draft file: social-posts/queue/${file}`,
    `Image card: ${image ? `social-posts/queue/${image}` : 'needs social card image'}`,
    url ? `Link: ${url}` : '',
    '',
    'NEWSLETTER - copy/paste:',
    newsletter || '(missing newsletter blurb)',
    '',
    'X / THREADS - copy/paste:',
    x || '(missing X/Threads copy)',
    '',
    'INSTAGRAM / FACEBOOK - copy/paste:',
    instagram || '(missing Instagram/Facebook copy)',
    '',
    'WHEN POSTED:',
    '1. Add the posted URL/date to evidence on this card.',
    '2. Request review, then approve/done once posted.',
  ].filter((line) => line !== '').join('\n');
}

function main() {
  if (!fs.existsSync(TASKS_PATH)) throw new Error('Missing tasks.json: ' + TASKS_PATH);
  if (!fs.existsSync(QUEUE_DIR)) throw new Error('Missing queue dir: ' + QUEUE_DIR);

  const tasks = JSON.parse(fs.readFileSync(TASKS_PATH, 'utf8'));
  const queueFiles = fs.readdirSync(QUEUE_DIR);
  const drafts = queueFiles
    .filter((file) => /^\d{4}-\d{2}-\d{2}-\d+-.*\.md$/.test(file))
    .sort()
    .reverse();

  let updated = 0;
  for (const file of drafts) {
    const md = fs.readFileSync(path.join(QUEUE_DIR, file), 'utf8');
    const meta = frontMatter(md);
    const id = meta.id || (file.match(/^\d{4}-\d{2}-\d{2}-(\d+)-/) || [])[1];
    const title = meta.title || file;
    const task = socialTaskForDraft(tasks, id, title);
    if (!task) {
      console.log(`skip no board task: ${file}`);
      continue;
    }

    const image = queueFiles.find((candidate) => candidate.endsWith('.png') && candidate.includes('-' + id + '-'));
    const x = codeBlock(md, 'X / Threads (280ch) - copy-paste, keep URL');
    const instagram = codeBlock(md, 'Instagram / Facebook (long)');
    const newsletter = codeBlock(md, 'Newsletter blurb (paste into broadcast)');
    const card = buildCard({ meta: { ...meta, id, title }, file, image, x, instagram, newsletter });

    task.desc = card;
    task.done = 'Copy is approved, newsletter/social post has been manually posted or scheduled, and evidence records postedAt/postedUrl. Do not post before this card reaches done.';
    const evidenceLine = `Copy-ready board card refreshed 15 September 2026: devlog id=${id}; draft social-posts/queue/${file}; image ${image ? `social-posts/queue/${image}` : 'missing'}.`;
    if (!String(task.evidence || '').includes('Copy-ready board card refreshed')) {
      task.evidence = `${task.evidence || ''}${task.evidence ? '\n' : ''}${evidenceLine}`;
    }
    updated++;
    console.log(`updated ${task.id}: ${title}`);
  }

  fs.writeFileSync(TASKS_PATH, JSON.stringify(tasks, null, 2) + '\n', 'utf8');
  console.log(`updated ${updated} board cards`);
}

main();
