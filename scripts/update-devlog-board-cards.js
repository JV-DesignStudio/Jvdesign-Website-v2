#!/usr/bin/env node
/*
 * update-devlog-board-cards.js - put private devlog draft JSON into board cards.
 * This does not publish devlog-data.js. It only makes draft text visible on cards.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TASKS_PATH = 'F:/Website/studio-workspace/tasks.json';
const DRAFT_DIR = 'F:/Website/studio-workspace/verification';

function unescapeJsString(value) {
  return String(value || '')
    .replace(/\\\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\'/g, "'")
    .replace(/\\`/g, '`')
    .replace(/\\\\/g, '\\');
}

function field(entry, name) {
  const re = new RegExp(name + ":\\s*'([\\s\\S]*?)'\\s*(?:,|\\n\\s*})");
  const match = String(entry || '').match(re);
  return match ? unescapeJsString(match[1]) : '';
}

function latestDrafts() {
  const files = fs.readdirSync(DRAFT_DIR)
    .filter((file) => /^devlog-draft-A\d+-\d+\.json$/.test(file))
    .map((file) => {
      const full = path.join(DRAFT_DIR, file);
      const parsed = JSON.parse(fs.readFileSync(full, 'utf8'));
      return { file, full, parsed, mtime: fs.statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);

  const byTask = new Map();
  for (const draft of files) {
    if (!byTask.has(draft.parsed.sourceTask)) byTask.set(draft.parsed.sourceTask, draft);
  }
  return byTask;
}

function buildDevlogBlock(draft, task) {
  const entry = draft.parsed.entry || '';
  const title = field(entry, 'title') || task.title;
  const date = field(entry, 'date') || draft.parsed.date || '';
  const tag = field(entry, 'tag') || task.tag || '';
  const emoji = field(entry, 'emoji') || '';
  const excerpt = field(entry, 'excerpt');
  const content = field(entry, 'content');
  return [
    'DEV LOG DRAFT - REVIEW/COPY',
    '',
    `Draft file: F:/Website/studio-workspace/verification/${draft.file}`,
    `Target: devlog-data.js post id ${draft.parsed.devlogId}`,
    `Source task: ${draft.parsed.sourceTask}`,
    '',
    'PROPOSED ENTRY:',
    `Title: ${emoji} ${title}`,
    `Date: ${date}`,
    `Tag: ${tag}`,
    '',
    'Excerpt:',
    excerpt || '(missing excerpt)',
    '',
    'Content:',
    content || '(missing content)',
    '',
    'WHEN APPROVED:',
    '1. Publish this entry to devlog-data.js, or run the existing promote-to-devlog apply flow.',
    '2. Rebuild/check latest post and public validation as normal.',
    '3. Submit/approve this card once the dev log entry is live.',
  ].join('\n');
}

function stripOldBlock(desc) {
  const marker = '--- ORIGINAL TASK ---';
  const text = String(desc || '');
  const idx = text.indexOf(marker);
  return idx === -1 ? text : text.slice(idx + marker.length).trim();
}

function main() {
  const tasks = JSON.parse(fs.readFileSync(TASKS_PATH, 'utf8'));
  const drafts = latestDrafts();
  let updated = 0;

  for (const [taskId, draft] of drafts.entries()) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) continue;
    const originalDesc = stripOldBlock(task.desc);
    task.desc = `${buildDevlogBlock(draft, task)}\n\n--- ORIGINAL TASK ---\n${originalDesc}`;
    const evidenceLine = `Dev log draft visible on board card 15 September 2026: ${draft.file} -> proposed devlog id ${draft.parsed.devlogId}.`;
    if (!String(task.evidence || '').includes('Dev log draft visible on board card')) {
      task.evidence = `${task.evidence || ''}${task.evidence ? '\n' : ''}${evidenceLine}`;
    }
    updated++;
    console.log(`updated ${task.id}: ${task.title} (${draft.file})`);
  }

  fs.writeFileSync(TASKS_PATH, JSON.stringify(tasks, null, 2) + '\n', 'utf8');
  console.log(`updated ${updated} devlog draft cards`);
}

main();
