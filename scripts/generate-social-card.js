#!/usr/bin/env node
/*
 * generate-social-card.js - 1080x1080 PNG social cards for devlog posts
 *
 * Reads devlog-data.js POSTS and generates one 1080x1080 PNG per post via sharp+SVG.
 * Cards live in social-posts/queue alongside markdown drafts (queue is excluded from
 * sitemap via validate-public-boundary, so drafts don't leak).
 * Reuses same parsing/filtering as generate-social-draft.js.
 *
 * Usage:
 *   node scripts/generate-social-card.js              # latest 5 missing
 *   node scripts/generate-social-card.js --id 333     # one id
 *   node scripts/generate-social-card.js --latest 10
 *   node scripts/generate-social-card.js --check      # report only
 *   node scripts/generate-social-card.js --all
 *   node scripts/generate-social-card.js --force      # overwrite
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'devlog-data.js');
const QUEUE_DIR = path.join(ROOT, 'social-posts', 'queue');

// Tag -> accent color (matches site vars)
const TAG_ACCENT = {
  books: '#D2B48C',
  games: '#BC4749',
  life: '#f0c060',
  process: '#9b6bff',
  update: '#70A3A7',
  site: '#70A3A7',
  tools: '#70A3A7',
  workshops: '#D2B48C',
  brand: '#D2B48C',
  apps: '#BC4749',
};
const TAG_LABEL = {
  books: 'BOOKS', games: 'GAMES', life: 'LIFE', process: 'PROCESS', update: 'UPDATE', site: 'STUDIO',
  tools: 'TOOLS', workshops: 'LEARN', brand: 'STUDIO', apps: 'APPS'
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
function cleanText(v) { return String(v || '').replace(/[\u2013\u2014]/g, ' - '); }
function escXml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function parsePosts(srcText) {
  const re = /\{\s*"?id"?:\s*(\d+)[\s\S]*?"?date"?:\s*["']([^"']+)["'][\s\S]*?"?tag"?:\s*["']([^"']+)["'][\s\S]*?"?emoji"?:\s*["']([^"']+)["'][\s\S]*?"?title"?:\s*["']([^"']+)["'][\s\S]*?"?excerpt"?:\s*(?:"([^"]*)"|'([^']*)')/g;
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
    let content = '';
    const cm = block.match(/"?content"?:\s*(?:"([\s\S]*?)"|'([\s\S]*?)'|`([\s\S]*?)`)\s*\n\s*\}/);
    if (cm) content = (cm[1] || cm[2] || cm[3] || '').trim();
    out.push({ id, date, tag, emoji, title: cleanText(title), excerpt: cleanText(excerpt.trim()), content: cleanText(content) });
  }
  return out;
}

function wrapText(text, maxChars) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) {
      if (cur) lines.push(cur.trim());
      cur = w;
      // hard break very long word
      if (w.length > maxChars) {
        while (cur.length > maxChars) { lines.push(cur.slice(0, maxChars)); cur = cur.slice(maxChars); }
      }
    } else {
      cur = cur ? cur + ' ' + w : w;
    }
  }
  if (cur) lines.push(cur.trim());
  return lines;
}

function buildSvg(post) {
  const accent = TAG_ACCENT[post.tag] || TAG_ACCENT.site;
  const label = TAG_LABEL[post.tag] || post.tag.toUpperCase();
  const iso = shortDate(post.date);
  const titleLines = wrapText(post.title, 28).slice(0, 3);
  // pad title to keep layout stable if short
  const excerptLines = wrapText(post.excerpt, 54).slice(0, 3);
  const url = `jvdesignstudio.co.uk/devlog#post-${post.id}`;

  // layout constants 1080x1080, pad 60
  const W = 1080, H = 1080;
  const pad = 60;

  // Title block: start y 340, line height 62
  const titleStartY = 360;
  const titleLineH = 64;
  const excerptStartY = titleStartY + titleLines.length * titleLineH + 28;
  const excerptLineH = 32;

  // Build title tspans
  const titleTspans = titleLines.map((l, i) =>
    `<tspan x="${W/2}" dy="${i===0 ? 0 : titleLineH}">${escXml(l)}</tspan>`
  ).join('');

  const excerptTspans = excerptLines.map((l, i) =>
    `<tspan x="${W/2}" dy="${i===0 ? 0 : excerptLineH}">${escXml(l)}</tspan>`
  ).join('');

  // subtle radial highlight
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" role="img">
  <title>${escXml(post.emoji + ' ' + post.title)}</title>
  <defs>
    <radialGradient id="glow" cx="50%" cy="22%" r="70%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${accent}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0.7"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#1a1612"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="0" y="0" width="${W}" height="6" fill="${accent}"/>

  <!-- header -->
  <text x="${pad}" y="72" font-family="'Fredoka','Segoe UI',sans-serif" font-size="22" font-weight="800" fill="#F0EAD6">JVDesignStudio</text>
  <text x="${W - pad}" y="72" font-family="'Inter',sans-serif" font-size="13" font-weight="700" fill="#F0EAD6" opacity="0.55" text-anchor="end">${escXml(iso)} • ${escXml(label)}</text>

  <!-- tag pill -->
  <g transform="translate(${W/2 - 90},110)">
    <rect width="180" height="34" rx="17" fill="${accent}" opacity="0.18" stroke="${accent}" stroke-width="1.2"/>
    <text x="90" y="23" font-family="'Inter',sans-serif" font-size="13" font-weight="800" fill="${accent}" text-anchor="middle" letter-spacing="0.8">${escXml(label)}</text>
  </g>

  <!-- emoji -->
  <text x="${W/2}" y="280" font-family="sans-serif" font-size="92" text-anchor="middle">${escXml(post.emoji)}</text>

  <!-- title -->
  <text x="${W/2}" y="${titleStartY}" font-family="'Fredoka','Segoe UI',sans-serif" font-size="54" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="-0.5">
    ${titleTspans}
  </text>

  <!-- divider -->
  <rect x="${W/2 - 32}" y="${titleStartY + titleLines.length * titleLineH - 18}" width="64" height="3" rx="1.5" fill="${accent}" opacity="0.9"/>

  <!-- excerpt -->
  <text x="${W/2}" y="${excerptStartY}" font-family="'Inter',sans-serif" font-size="22" font-weight="500" fill="#F0EAD6" opacity="0.72" text-anchor="middle">
    ${excerptTspans}
  </text>

  <!-- CTA pill -->
  <g transform="translate(${W/2 - 210}, ${H - 150})">
    <rect width="420" height="56" rx="28" fill="${accent}"/>
    <text x="210" y="37" font-family="'Fredoka','Inter',sans-serif" font-size="20" font-weight="800" fill="#1a1612" text-anchor="middle">Read the note →</text>
  </g>
  <text x="${W/2}" y="${H - 68}" font-family="'Inter',sans-serif" font-size="16" font-weight="600" fill="#F0EAD6" opacity="0.42" text-anchor="middle">${escXml(url)}</text>
  <text x="${W/2}" y="${H - 32}" font-family="'Inter',sans-serif" font-size="11" font-weight="600" fill="#F0EAD6" opacity="0.26" text-anchor="middle" letter-spacing="2">BOOKS • GAMES • CREATIVE ADVENTURES</text>
</svg>`;
}

async function generateCard(post, outPath) {
  const svg = buildSvg(post);
  // sharp needs explicit density for emoji/text crisp
  const png = await require('sharp')(Buffer.from(svg), { density: 300 }).png({ compressionLevel: 9 }).toBuffer();
  // Ensure 1080x1080 exactly (sharp from SVG viewBox should already be, but resize as guard)
  const out = await require('sharp')(png).resize(1080,1080,{fit:'cover'}).png().toFile(outPath);
  return out;
}

async function main() {
  const opts = parseArgs();
  if (!fs.existsSync(SRC)) { console.error('✗ missing', SRC); process.exit(1); }
  const srcText = fs.readFileSync(SRC, 'utf8');
  let posts = parsePosts(srcText);
  if (!posts.length) { console.error('✗ no POSTS found in', SRC); process.exit(1); }
  posts.sort((a,b)=> {
    const ta = shortDate(a.date), tb = shortDate(b.date);
    if (ta !== tb) return tb.localeCompare(ta);
    return parseInt(b.id,10) - parseInt(a.id,10);
  });
  let selected = posts;
  if (opts.id) selected = posts.filter(p=>p.id===opts.id);
  else if (!opts.all) selected = posts.slice(0, opts.latest);

  if (!fs.existsSync(QUEUE_DIR)) fs.mkdirSync(QUEUE_DIR, {recursive:true});
  const existing = new Set(fs.existsSync(QUEUE_DIR) ? fs.readdirSync(QUEUE_DIR) : []);
  const existingIds = new Set([...existing].map(f=> (f.match(/^\d{4}-\d{2}-\d{2}-(\d+)-/)||[])[1]).filter(Boolean));

  let created=0, skipped=0, would=0;
  for (const p of selected) {
    const iso = shortDate(p.date);
    const slug = slugify(p.title) || `post-${p.id}`;
    const pngName = `${iso}-${p.id}-${slug}.png`;
    const outPath = path.join(QUEUE_DIR, pngName);
    // dedupe: if any png for this id exists, treat as existing (even with different slug)
    const sameIdPng = [...existing].find(f=> f.endsWith('.png') && f.match(new RegExp(`^\\d{4}-\\d{2}-\\d{2}-${p.id}-`)));
    const target = sameIdPng && !opts.force ? path.join(QUEUE_DIR, sameIdPng) : outPath;
    const exists = sameIdPng ? true : fs.existsSync(outPath);

    if (opts.check) {
      if (exists && !opts.force) { console.log(`✓ exists: ${path.relative(ROOT, target)} (id=${p.id})`); skipped++; }
      else { console.log(`○ would create: ${path.relative(ROOT, outPath)} - "${p.title}" (${p.date})`); would++; }
      continue;
    }
    if (exists && !opts.force) { console.log(`↷ skip exists: ${path.relative(ROOT, target)}`); skipped++; continue; }
    const finalPath = opts.force && sameIdPng ? path.join(QUEUE_DIR, sameIdPng) : outPath;
    // if forcing and slug changed, remove old if name differs
    if (opts.force && sameIdPng && sameIdPng !== path.basename(finalPath) && sameIdPng !== pngName) {
      try { fs.unlinkSync(path.join(QUEUE_DIR, sameIdPng)); }catch{}
    }
    try {
      await generateCard(p, finalPath);
      const stat = fs.statSync(finalPath);
      console.log(`✓ card: ${path.relative(ROOT, finalPath)} - "${p.title}" (${p.date}) ${Math.round(stat.size/1024)}kB 1080x1080`);
      created++;
      existing.add(path.basename(finalPath));
      existingIds.add(p.id);
      // If markdown draft exists, patch its image suggestion line to point to real card
      const mdSame = [...existing].find(f=> f.endsWith('.md') && f.includes(`-${p.id}-`));
      if (mdSame) {
        const mdPath = path.join(QUEUE_DIR, mdSame);
        try {
          let md = fs.readFileSync(mdPath,'utf8');
          const rel = `social-posts/queue/${path.basename(finalPath)}`;
          if (md.includes('image suggestion:')) {
            md = md.replace(/- image suggestion:.*/, `- image: ${rel} (1080x1080 auto-generated via generate-social-card.js)`);
            md = md.replace(/- image: social-posts\/queue\/.*1080x1080.*/, `- image: ${rel} (1080x1080 auto-generated via generate-social-card.js)`);
            fs.writeFileSync(mdPath, md);
          } else if (!md.includes(rel)) {
            // inject image line after source block
            md = md.replace(/(queue_file:.*\n)/, `$1image: ${rel}\n`);
            fs.writeFileSync(mdPath, md);
          }
        } catch(e) { console.log(`  [md patch skip] ${e.message}`); }
      }
    } catch(e) {
      console.error(`✗ card failed id=${p.id}: ${e.message}`);
    }
  }

  if (opts.check) {
    console.log(`\ncheck: ${would} would-create, ${skipped} existing, ${selected.length} selected from ${posts.length} posts`);
    if (would>0) console.log('Run without --check to create.');
    process.exit(0);
  }
  console.log(`\ndone: ${created} created, ${skipped} skipped, ${posts.length} total posts, queue dir ${path.relative(ROOT, QUEUE_DIR)}`);
}

main().catch(e=>{ console.error(e); process.exit(1); });
