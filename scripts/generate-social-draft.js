#!/usr/bin/env node
/*
 * generate-social-draft.js - devlog to social queue (slow pipeline, same review gate)
 *
 * Reads devlog-data.js (single source of truth) and creates one draft per POST
 * that has no queue file yet. Draft must go through the SAME board flow:
 *   backlog -> claim -> in_progress -> --request-review (bot-verify) -> human_review -> done
 * before it is posted. Posting is manual (human copies X/IG/newsletter sections).
 *
 * Queue files live in social-posts/queue/ and are NOT published to the site.
 * They are validated by board-keeper --check and by npm run social:check.
 *
 * Live board edits remain possible while a social task is in_progress:
 *   node F:/Website/studio-workspace/board-keeper.cjs --update Axx --evidence "..."
 *   node F:/Website/studio-workspace/board-keeper.cjs --sync
 * does not require releasing the in_progress task.
 *
 * Usage:
 *   node scripts/generate-social-draft.js              # create missing drafts (latest 5 by default)
 *   node scripts/generate-social-draft.js --id 94      # force one id
 *   node scripts/generate-social-draft.js --latest 10  # check latest N
 *   node scripts/generate-social-draft.js --check      # report only, no write
 *   node scripts/generate-social-draft.js --all        # all posts
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'devlog-data.js');
const QUEUE_DIR = path.join(ROOT, 'social-posts', 'queue');
const BOARD_KEEPER = path.join(ROOT, '..', 'studio-workspace', 'tasks.json');

function parseArgs() {
  const a = process.argv.slice(2);
  const o = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--id') o.id = String(a[i+1]);
    if (a[i] === '--latest') o.latest = parseInt(a[i+1], 10);
    if (a[i] === '--check') o.check = true;
    if (a[i] === '--all') o.all = true;
    if (a[i] === '--force') o.force = true;
  }
  if (!o.latest && !o.id && !o.all) o.latest = 5;
  return o;
}

function slugify(s) {
  return String(s||'').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .slice(0, 48)
    .replace(/-+$/,'');
}

function shortDate(d) {
  // '9 September 2026' to '2026-09-09'
  const months = { january:'01',february:'02',march:'03',april:'04',may:'05',june:'06',july:'07',august:'08',september:'09',october:'10',november:'11',december:'12' };
  const m = String(d||'').trim().match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) return '2026-01-01';
  const dd = String(m[1]).padStart(2,'0');
  const mm = months[m[2].toLowerCase()] || '01';
  return `${m[3]}-${mm}-${dd}`;
}

function cleanText(value) {
  return String(value || '').replace(/[\u2013\u2014]/g, ' - ');
}

function parsePosts(srcText) {
  // Reuse same parsing as board-keeper devlog check: id, date, title, excerpt, tag, emoji
  const re = /\{\s*id:\s*(\d+)[\s\S]*?date:\s*'([^']+)'[\s\S]*?tag:\s*'([^']+)'[\s\S]*?emoji:\s*'([^']+)'[\s\S]*?title:\s*'([^']+)'[\s\S]*?excerpt:\s*(?:'([^']*)'|"([^"]*)")/g;
  const out = [];
  let m;
  while ((m = re.exec(srcText)) !== null) {
    const id = String(m[1]);
    const date = m[2];
    const tag = m[3];
    const emoji = m[4];
    const title = m[5];
    const excerpt = m[6] != null ? m[6] : (m[7] || '');
    const blockStart = m.index;
    const block = srcText.slice(blockStart, blockStart + 8000);
    // content may use ' or " or ` ; take what we can
    let content = '';
    const cm = block.match(/content:\s*(?:'([\s\S]*?)'|"([\s\S]*?)"|`([\s\S]*?)`)\s*\n\s*\}/);
    if (cm) content = (cm[1] || cm[2] || cm[3] || '').trim();
    out.push({
      id,
      date,
      tag,
      emoji,
      title: cleanText(title),
      excerpt: cleanText(excerpt.trim()),
      content: cleanText(content)
    });
  }
  return out;
}

function buildDraft(post) {
  const iso = shortDate(post.date);
  const slug = slugify(post.title) || `post-${post.id}`;
  const filename = `${iso}-${post.id}-${slug}.md`;
  const url = `https://jvdesignstudio.co.uk/devlog#post-${post.id}`;
  const homepage = `https://jvdesignstudio.co.uk/devlog`;
  // keep X under 280 inc url
  const hashtags = '#JVDesignStudio #gamedev';
  const xBase = `${post.emoji} ${post.title} - ${post.excerpt}`.slice(0, 190);
  const xPost = `${xBase} ${url} ${hashtags}`.slice(0, 280);
  // IG longer
  const igPost = `${post.emoji} ${post.title}\n\n${post.excerpt}\n\n${post.content ? post.content.split('\n\n')[0].slice(0, 220) + '…' : ''}\n\nRead the full note → ${url}\n\n${hashtags} #IndieGameDev #BrowserGames`;

  const newsletterBlurb = `**${post.emoji} ${post.title}** - ${post.date} - ${post.excerpt} [Read note](${url})`;

  return {
    filename,
    content: `# ${post.emoji} ${post.title} - social queue draft\n\n`
      + `> **Status: DRAFT - must pass same board review before posting**\n`
      + `> Pipeline: \`tasks.json\` backlog → \`--claim\` → \`in_progress\` → \`--request-review\` (bot-verify) → \`human_review\` → \`done\` → post manually.\n`
      + `> Live board edits remain possible while this is in_progress: \`--update Axx --evidence \"...\" && --sync\` does not require release.\n\n`
      + `---\n`
      + `id: ${post.id}\n`
      + `date: ${post.date} (${iso})\n`
      + `tag: ${post.tag}\n`
      + `emoji: ${post.emoji}\n`
      + `title: ${post.title}\n`
      + `source: devlog-data.js id=${post.id}\n`
      + `url: ${url}\n`
      + `queue_file: social-posts/queue/${filename}\n`
      + `board_task: Create or link to tasks.json entry with title containing \"Social: ${post.title.slice(0,40)}\" - must go through same review gate\n`
      + `---\n\n`
      + `## Source\n`
      + `- devlog-data.js id=${post.id} tag=${post.tag} date=\"${post.date}\"\n`
      + `- excerpt: ${post.excerpt}\n`
      + `- homepage: ${homepage} | newsletter preview: newsletter.html auto-shows latest 3 via devlog-data.js\n`
      + `- image suggestion: use existing social-posts/*.svg or og/hub-devlog.png + screenshot of devlog modal at 390px/1440px\n\n`
      + `## X / Threads (280ch) - copy-paste, keep URL\n`
      + "```\n" + xPost + "\n```\n\n"
      + `## Instagram / Facebook (long)\n`
      + "```\n" + igPost + "\n```\n\n"
      + `## Newsletter blurb (paste into broadcast)\n`
      + "```\n" + newsletterBlurb + "\n```\n\n"
      + `## Board review checklist (bot-verify will check)\n`
      + `- [ ] tasks.json has entry for this social draft (e.g. A83 sub-task or dedicated Axx) in backlog/in_progress/human_review/done\n`
      + `- [ ] evidence names this queue file + devlog-data.js id=${post.id} + 390/1440 no-overflow check\n`
      + `- [ ] queue file exists in social-posts/queue/ and is not leaked to public sitemap (validate:public)\n`
      + `- [ ] human_review -> done via --approve (bot re-verifies) before posting\n`
      + `- [ ] after done, post manually and record postedAt/postedUrl in task evidence\n\n`
      + `## Live board edit demo (while this draft is in_progress)\n`
      + "```bash\n"
      + `# board stays editable without releasing in_progress:\n`
      + `node F:/Website/studio-workspace/board-keeper.cjs --update A83 --evidence \"Edited live while social draft Axx in_progress - ${iso}\"\n`
      + `node F:/Website/studio-workspace/board-keeper.cjs --sync\n`
      + `node F:/Website/studio-workspace/board-keeper.cjs --check\n`
      + "```\n\n"
      + `---\n`
      + `Generated: ${new Date().toISOString()} by scripts/generate-social-draft.js from devlog-data.js id=${post.id}\n`
  };
}

function main() {
  const opts = parseArgs();
  if (!fs.existsSync(SRC)) { console.error('✗ missing', SRC); process.exit(1); }
  const srcText = fs.readFileSync(SRC, 'utf8');
  let posts = parsePosts(srcText);
  if (!posts.length) { console.error('✗ no POSTS found in', SRC); process.exit(1); }
  // sort newest first: date desc, id desc
  const months = { january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11 };
  function ts(d){ const m=String(d||'').match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/); if(!m) return 0; return Date.UTC(parseInt(m[3]),parseInt(String(months[m[2].toLowerCase()]||0))+1 ? parseInt(String(months[m[2].toLowerCase()])) : 0, parseInt(m[1])); }
  // simpler: reuse shortDate sort
  posts.sort((a,b)=>{
    const ta = shortDate(a.date), tb = shortDate(b.date);
    if (ta !== tb) return tb.localeCompare(ta);
    return parseInt(b.id,10) - parseInt(a.id,10);
  });

  let selected = posts;
  if (opts.id) selected = posts.filter(p=>p.id===opts.id);
  else if (!opts.all) selected = posts.slice(0, opts.latest);

  if (!fs.existsSync(QUEUE_DIR)) fs.mkdirSync(QUEUE_DIR, { recursive: true });

  // existing queue files
  const existing = new Set(fs.existsSync(QUEUE_DIR) ? fs.readdirSync(QUEUE_DIR) : []);
  // also map existing ids
  const existingIds = new Set([...existing].map(f=> (f.match(/-(\d+)-/)||[])[1]).filter(Boolean));

  let created = 0, skipped = 0, would = 0;
  for (const p of selected) {
    // if any existing file contains -{id}- , skip unless --force
    if (existingIds.has(p.id) && !opts.force) { skipped++; continue; }
    if (opts.id && existingIds.has(p.id) && !opts.force) {
      console.log(`→ exists (use --force to overwrite): ${[...existing].find(f=>f.includes(`-${p.id}-`))}`);
      skipped++; continue;
    }
    const draft = buildDraft(p);
    const out = path.join(QUEUE_DIR, draft.filename);
    // dedupe by id: if same id exists under different slug/date, reuse existing name unless --force
    const sameIdFile = [...existing].find(f=>f.includes(`-${p.id}-`));
    const target = sameIdFile && !opts.force ? path.join(QUEUE_DIR, sameIdFile) : out;
    if (opts.check) {
      if (fs.existsSync(target)) { console.log(`✓ exists: ${path.relative(ROOT, target)} (id=${p.id})`); skipped++; }
      else { console.log(`○ would create: ${path.relative(ROOT, out)} - "${p.title}" (${p.date})`); would++; }
      continue;
    }
    if (fs.existsSync(target) && !opts.force) { console.log(`↷ skip exists: ${path.relative(ROOT, target)}`); skipped++; continue; }
    fs.writeFileSync(out, draft.content, 'utf8');
    console.log(`✓ draft: ${path.relative(ROOT, out)} - "${p.title}" (${p.date})`);
    created++;
    existing.add(path.basename(out));
    existingIds.add(p.id);
  }

  if (opts.check) {
    console.log(`\ncheck: ${would} would-create, ${skipped} existing, ${selected.length} selected from ${posts.length} posts`);
    if (would>0) console.log(`Run without --check to create.`);
    process.exit(0);
  }
  console.log(`\ndone: ${created} created, ${skipped} skipped, ${posts.length} total posts, queue dir ${path.relative(ROOT, QUEUE_DIR)}`);
  if (created>0) {
    console.log(`Next: claim a board task for the draft and run through same review:`);
    console.log(`  node F:/Website/studio-workspace/board-keeper.cjs --create --title \"Social: ${selected[0]?.title.slice(0,40)}\" --priority P2 --tag site --desc \"Social queue draft for devlog id=${selected[0]?.id} must pass same review before posting. File social-posts/queue/...\" --done \"Queue file in social-posts/queue/ exists, board task human_review->done via --approve, post manually afterwards, live board edits via --update/--sync work while in_progress\"`);
  }
}

main();
