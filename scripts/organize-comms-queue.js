#!/usr/bin/env node
/*
 * Keep social-posts/queue focused on current review work.
 * Moves drafts with no linked board task into social-posts/archive/unlinked.
 * Creates ready/posted/archive folders for the cleaner comms workflow.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOCIAL = path.join(ROOT, 'social-posts');
const QUEUE = path.join(SOCIAL, 'queue');
const READY = path.join(SOCIAL, 'ready');
const POSTED = path.join(SOCIAL, 'posted');
const ARCHIVE = path.join(SOCIAL, 'archive');
const UNLINKED = path.join(ARCHIVE, 'unlinked');
const TASKS = path.join(ROOT, '..', 'studio-workspace', 'tasks.json');

function ensure(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }
function frontMatter(md) {
  const match = md.match(/^---\n([\s\S]*?)\n---/m);
  if (!match) return {};
  return Object.fromEntries(match[1].split(/\r?\n/).map((line) => {
    const idx = line.indexOf(':');
    if (idx === -1) return null;
    return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
  }).filter(Boolean));
}
function taskForDraft(tasks, id, title, file) {
  const devlogNeedle = 'devlog id=' + id;
  const titleNeedle = 'Social: ' + String(title || '').slice(0, 20);
  return tasks.find((task) => {
    const hay = `${task.id || ''} ${task.title || ''} ${task.desc || ''} ${task.done || ''} ${task.evidence || ''}`;
    return hay.includes(file) || hay.includes(devlogNeedle) || hay.includes(titleNeedle);
  });
}
function movePair(file, destDir, reason) {
  const src = path.join(QUEUE, file);
  const dest = path.join(destDir, file);
  if (!fs.existsSync(src)) return false;
  if (fs.existsSync(dest)) fs.unlinkSync(src);
  else fs.renameSync(src, dest);
  const id = (file.match(/^\d{4}-\d{2}-\d{2}-(\d+)-/) || [])[1];
  const files = fs.readdirSync(QUEUE);
  for (const candidate of files) {
    if (!id || !candidate.endsWith('.png') || !candidate.includes('-' + id + '-')) continue;
    const imgSrc = path.join(QUEUE, candidate);
    const imgDest = path.join(destDir, candidate);
    if (fs.existsSync(imgDest)) fs.unlinkSync(imgSrc);
    else fs.renameSync(imgSrc, imgDest);
  }
  return reason;
}
function main() {
  [QUEUE, READY, POSTED, ARCHIVE, UNLINKED].forEach(ensure);
  if (!fs.existsSync(TASKS)) throw new Error('Missing tasks.json: ' + TASKS);
  const tasks = JSON.parse(fs.readFileSync(TASKS, 'utf8'));
  const files = fs.readdirSync(QUEUE).filter((file) => /^\d{4}-\d{2}-\d{2}-\d+-.*\.md$/.test(file));
  let archived = 0;
  let kept = 0;
  for (const file of files) {
    const md = fs.readFileSync(path.join(QUEUE, file), 'utf8');
    const meta = frontMatter(md);
    const id = meta.id || (file.match(/^\d{4}-\d{2}-\d{2}-(\d+)-/) || [])[1] || '';
    const title = meta.title || file;
    const task = taskForDraft(tasks, id, title, file);
    if (!task) {
      movePair(file, UNLINKED, 'no linked board task');
      archived++;
    } else {
      kept++;
    }
  }
  console.log(`Comms queue organized: ${kept} kept in queue, ${archived} archived to social-posts/archive/unlinked`);
  console.log('Workflow folders ready: social-posts/queue, ready, posted, archive');
}
main();
