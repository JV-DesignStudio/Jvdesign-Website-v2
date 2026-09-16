#!/usr/bin/env node
/*
 * generate-social-draft.js - auto-generate social post drafts from devlog entries
 *
 * Reads devlog-data.js via vm (handles any key format) and writes a .md draft
 * to social-posts/queue/ with platform-specific copy ready to edit and post.
 *
 * Usage:
 *   node scripts/generate-social-draft.js --id 335          # one entry
 *   node scripts/generate-social-draft.js --latest 3        # 3 most recent
 *   node scripts/generate-social-draft.js --check           # report missing drafts
 *   node scripts/generate-social-draft.js --force           # overwrite existing
 *
 * After generating: run node scripts/ai-proofread.js on the .md to review.
 * After reviewing:  run node scripts/generate-social-card.js --id <id> for the PNG.
 */

'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'devlog-data.js');
const QUEUE_DIR = path.join(ROOT, 'social-posts', 'queue');
const SITE = 'https://jvdesignstudio.co.uk';

const TAG_HASHTAGS = {
  games:     ['GameDev', 'IndieGame', 'KidsCoding', 'JVDesignStudio'],
  workshops: ['LearnToCode', 'KidsCoding', 'GameDev', 'JVDesignStudio', 'FreeWorkshop'],
  tools:     ['CreativeCoding', 'WebDev', 'KidsCoding', 'JVDesignStudio'],
  books:     ['KidsBooks', 'Reading', 'JVDesignStudio'],
  life:      ['JVDesignStudio'],
  process:   ['IndieGameDev', 'GameDev', 'JVDesignStudio'],
  update:    ['JVDesignStudio', 'Update'],
  site:      ['JVDesignStudio'],
  apps:      ['MobileGames', 'IndieGame', 'JVDesignStudio'],
  brand:     ['JVDesignStudio'],
};

function parseArgs() {
  const a = process.argv.slice(2);
  const o = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--id') o.id = String(a[i + 1]);
    if (a[i] === '--latest') o.latest = parseInt(a[i + 1], 10);
    if (a[i] === '--check') o.check = true;
    if (a[i] === '--all') o.all = true;
    if (a[i] === '--force') o.force = true;
  }
  if (!o.latest && !o.id && !o.all) o.latest = 5;
  return o;
}

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-').slice(0, 48).replace(/-+$/, '');
}

function shortDate(d) {
  const months = { january: '01', february: '02', march: '03', april: '04', may: '05', june: '06', july: '07', august: '08', september: '09', october: '10', november: '11', december: '12' };
  const m = String(d || '').trim().match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) return '2026-01-01';
  return `${m[3]}-${months[m[2].toLowerCase()] || '01'}-${String(m[1]).padStart(2, '0')}`;
}

function cleanText(v) {
  return String(v || '').replace(/[–—]/g, '-').trim();
}

function loadPosts() {
  if (!fs.existsSync(SRC)) { console.error('missing', SRC); process.exit(1); }
  const src = fs.readFileSync(SRC, 'utf8');
  const sandbox = { console: { log: () => {}, warn: () => {} }, window: {} };
  vm.createContext(sandbox);
  let raw;
  try {
    raw = vm.runInContext(`(function(){${src};return POSTS;})()`, sandbox, { timeout: 5000 });
  } catch (e) {
    console.error('Failed to parse devlog-data.js:', e.message);
    process.exit(1);
  }
  if (!raw) raw = sandbox.POSTS || sandbox.posts || [];
  return raw.map(p => ({
    id: String(p.id),
    date: p.date || '',
    tag: p.tag || '',
    emoji: p.emoji || '',
    title: cleanText(p.title || ''),
    excerpt: cleanText(p.excerpt || ''),
    content: cleanText(p.content || ''),
    url: p.url ? (p.url.startsWith('http') ? p.url : `${SITE}/${p.url}`) : `${SITE}/devlog#post-${p.id}`,
  }));
}

function truncate(str, max) {
  if (str.length <= max) return str;
  return str.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

function buildXCopy(post) {
  const tags = (TAG_HASHTAGS[post.tag] || TAG_HASHTAGS.site).map(t => `#${t}`).join(' ');
  const url = post.url;
  // budget: 280 - url(23 twitter counts) - space - tags - emoji - space = ~230 for text
  const tagLen = tags.length + 1; // +space
  const urlLen = 24; // twitter url = 23 + space
  const budget = 280 - tagLen - urlLen - 4; // 4 = emoji + spaces
  const body = truncate(`${post.excerpt}`, budget);
  return `${post.emoji} ${body} ${url} ${tags}`;
}

function buildInstagramCopy(post) {
  const tags = (TAG_HASHTAGS[post.tag] || TAG_HASHTAGS.site).concat(['LearnToCode', 'GameMaker', 'FreeResources']).filter((v, i, a) => a.indexOf(v) === i).map(t => `#${t}`).join(' ');
  // Pull first 2 sentences from content as the hook, fall back to excerpt
  const hook = post.content
    ? post.content.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ')
    : post.excerpt;
  return [
    `${post.emoji} ${post.title}`,
    '',
    hook,
    '',
    `Read the full note: ${post.url}`,
    '',
    tags,
  ].join('\n');
}

function buildNewsletterBlurb(post) {
  const iso = shortDate(post.date);
  return `**${post.emoji} ${post.title}** - ${post.date} - ${post.excerpt} [Read more](${post.url})`;
}

function buildDraft(post) {
  const iso = shortDate(post.date);
  const slug = slugify(post.title) || `post-${post.id}`;
  const mdName = `${iso}-${post.id}-${slug}.md`;
  const pngName = `${iso}-${post.id}-${slug}.png`;

  const xCopy = buildXCopy(post);
  const igCopy = buildInstagramCopy(post);
  const newsletter = buildNewsletterBlurb(post);

  const xLen = [...xCopy].length; // emoji-aware length

  return { mdName, pngName, content: [
    `# ${post.emoji} ${post.title}`,
    '',
    '> **Status: DRAFT - must pass board review before posting**',
    '',
    '---',
    `id: ${post.id}`,
    `date: ${post.date} (${iso})`,
    `tag: ${post.tag}`,
    `emoji: ${post.emoji}`,
    `title: ${post.title}`,
    `source: devlog-data.js id=${post.id}`,
    `url: ${post.url}`,
    `queue_file: social-posts/queue/${mdName}`,
    `image: social-posts/queue/${pngName}`,
    '---',
    '',
    `## X / Threads (${xLen}/280ch)`,
    '```',
    xCopy,
    '```',
    '',
    '## Instagram / Facebook (long)',
    '```',
    igCopy,
    '```',
    '',
    '## Newsletter blurb',
    '```',
    newsletter,
    '```',
    '',
  ].join('\n') };
}

function main() {
  const opts = parseArgs();
  let posts = loadPosts();

  posts.sort((a, b) => {
    const ta = shortDate(a.date), tb = shortDate(b.date);
    if (ta !== tb) return tb.localeCompare(ta);
    return parseInt(b.id, 10) - parseInt(a.id, 10);
  });

  if (opts.id) posts = posts.filter(p => p.id === opts.id);
  else if (!opts.all) posts = posts.slice(0, opts.latest);

  if (!fs.existsSync(QUEUE_DIR)) fs.mkdirSync(QUEUE_DIR, { recursive: true });
  const existing = new Set(fs.readdirSync(QUEUE_DIR));
  const existingIds = new Set([...existing].map(f => (f.match(/^\d{4}-\d{2}-\d{2}-(\d+)-/) || [])[1]).filter(Boolean));

  let created = 0, skipped = 0, would = 0;
  for (const p of posts) {
    const { mdName, content } = buildDraft(p);
    const hasMd = [...existing].some(f => f.endsWith('.md') && f.includes(`-${p.id}-`));
    const outPath = path.join(QUEUE_DIR, mdName);

    if (opts.check) {
      if (hasMd) { console.log(`✓ exists: social-posts/queue/ md for id=${p.id}`); skipped++; }
      else { console.log(`○ missing draft for id=${p.id}: "${p.title}" (${p.date})`); would++; }
      continue;
    }

    if (hasMd && !opts.force) { console.log(`↷ skip: md exists for id=${p.id}`); skipped++; continue; }

    fs.writeFileSync(outPath, content, 'utf8');
    console.log(`✓ draft: social-posts/queue/${mdName} - "${p.title}"`);
    created++;
    existing.add(mdName);
  }

  if (opts.check) {
    console.log(`\ncheck: ${would} missing, ${skipped} exist, ${posts.length} selected`);
    if (would > 0) console.log('Run without --check to generate.');
    return;
  }

  console.log(`\ndone: ${created} created, ${skipped} skipped`);
  if (created > 0) {
    console.log('\nNext steps:');
    console.log('  node scripts/ai-proofread.js social-posts/queue/<file>.md');
    console.log('  node scripts/generate-social-card.js --id <id>');
  }
}

main();
