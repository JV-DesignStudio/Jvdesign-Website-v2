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
 *   node scripts/generate-social-card.js --id 530 --sizes all
 *       # square 1080, X/OG 1200x630 and portrait 1080x1350
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
    if (a[i] === '--sizes') {
      const value = String(a[i + 1] || 'square');
      o.sizes = value === 'all' ? ['square', 'wide', 'portrait'] : value.split(',').map((size) => size.trim()).filter(Boolean);
    }
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
function relPath(p) { return path.relative(ROOT, p).split(path.sep).join('/'); }

function parsePosts(srcText) {
  const sandbox = { console: { log: () => {}, warn: () => {} }, window: {} };
  vm.createContext(sandbox);
  let raw;
  try {
    raw = vm.runInContext(`(function(){${srcText};return POSTS;})()`, sandbox, { timeout: 5000 });
  } catch (e) {
    console.error('Failed to parse devlog-data.js:', e.message);
    return [];
  }
  if (!raw) raw = sandbox.POSTS || sandbox.posts || [];
  return raw.map(p => ({
    id: String(p.id),
    date: p.date || '',
    tag: p.tag || '',
    emoji: p.emoji || '',
    title: cleanText(p.title || ''),
    excerpt: cleanText((p.excerpt || '').trim()),
    content: cleanText(p.content || ''),
    image: p.image || '',
  }));
}

// Where the post's screenshot is composited, or null when the post has no image.
function photoBox(post) {
  if (!post.image) return null;
  const abs = path.join(ROOT, post.image.replace(/^\//, ''));
  if (!fs.existsSync(abs)) return null;
  return { x: 120, y: 150, w: 840, h: 430, r: 22, file: abs };
}

const SIZES = {
  square: { key: 'square', w: 1080, h: 1080, suffix: '' },
  wide: { key: 'wide', w: 1200, h: 630, suffix: '-1200x630' },
  portrait: { key: 'portrait', w: 1080, h: 1350, suffix: '-1080x1350' },
};

function photoBoxFor(post, sizeKey) {
  if (!post.image) return null;
  const abs = path.join(ROOT, post.image.replace(/^\//, ''));
  if (!fs.existsSync(abs)) return null;
  if (sizeKey === 'wide') return { x: 56, y: 150, w: 510, h: 400, r: 18, file: abs };
  if (sizeKey === 'portrait') return { x: 120, y: 170, w: 840, h: 480, r: 22, file: abs };
  return { x: 120, y: 150, w: 840, h: 430, r: 22, file: abs };
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
  const photo = photoBox(post);
  const titleMaxLines = photo ? 2 : 3;
  const excerptMaxLines = photo ? 1 : 3;
  const titleSize = photo ? 46 : 54;
  const titleLines = wrapText(post.title, photo ? 34 : 28).slice(0, titleMaxLines);
  // pad title to keep layout stable if short
  const excerptLines = wrapText(post.excerpt, photo ? 76 : 54).slice(0, excerptMaxLines);
  const url = `jvdesignstudio.co.uk/devlog#post-${post.id}`;

  // layout constants 1080x1080, pad 60
  const W = 1080, H = 1080;
  const pad = 60;

  // Title block: start y 360 (or below the photo when there is a screenshot)
  const titleStartY = photo ? 648 : 360;
  const titleLineH = photo ? 56 : 64;
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

  <!-- screenshot frame (composited later) or emoji -->
  ${photo ? `<rect x="${photo.x}" y="${photo.y}" width="${photo.w}" height="${photo.h}" rx="${photo.r}" fill="${accent}" opacity="0.08" stroke="${accent}" stroke-width="2"/>
  <g transform="translate(${photo.x + 4},${photo.y + 4})">
    <circle cx="22" cy="22" r="22" fill="#1a1612" opacity="0.78"/>
    <text x="22" y="31" font-family="sans-serif" font-size="24" text-anchor="middle">${escXml(post.emoji)}</text>
  </g>`
  : `<text x="${W/2}" y="280" font-family="sans-serif" font-size="92" text-anchor="middle">${escXml(post.emoji)}</text>`}

  <!-- title -->
  <text x="${W/2}" y="${titleStartY}" font-family="'Fredoka','Segoe UI',sans-serif" font-size="${titleSize}" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="-0.5">
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

function buildWideSvg(post) {
  const W = 1200, H = 630, pad = 56;
  const accent = TAG_ACCENT[post.tag] || TAG_ACCENT.site;
  const label = TAG_LABEL[post.tag] || post.tag.toUpperCase();
  const iso = shortDate(post.date);
  const photo = photoBoxFor(post, 'wide');
  const colX = 620;
  const titleLines = wrapText(post.title, 27).slice(0, 4);
  const excerptLines = wrapText(post.excerpt, 50).slice(0, 3);
  const titleSize = 36, titleLineH = 42;
  const titleY = 205;
  const excerptY = titleY + titleLines.length * titleLineH + 24;
  const url = `jvdesignstudio.co.uk/devlog#post-${post.id}`;
  const titleTspans = titleLines.map((l, i) => `<tspan x="${colX}" dy="${i === 0 ? 0 : titleLineH}">${escXml(l)}</tspan>`).join('');
  const excerptTspans = excerptLines.map((l, i) => `<tspan x="${colX}" dy="${i === 0 ? 0 : 28}">${escXml(l)}</tspan>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" role="img">
  <title>${escXml(post.emoji + ' ' + post.title)}</title>
  <defs>
    <radialGradient id="glow" cx="24%" cy="24%" r="70%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#1a1612"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="0" y="0" width="${W}" height="6" fill="${accent}"/>
  <text x="${pad}" y="64" font-family="'Fredoka','Segoe UI',sans-serif" font-size="22" font-weight="800" fill="#F0EAD6">JVDesignStudio</text>
  <text x="${W - pad}" y="64" font-family="'Inter',sans-serif" font-size="13" font-weight="700" fill="#F0EAD6" opacity="0.55" text-anchor="end">${escXml(iso)} - ${escXml(label)}</text>
  <g transform="translate(${pad},96)">
    <rect width="150" height="30" rx="15" fill="${accent}" opacity="0.18" stroke="${accent}" stroke-width="1.2"/>
    <text x="75" y="20" font-family="'Inter',sans-serif" font-size="12" font-weight="800" fill="${accent}" text-anchor="middle" letter-spacing="0.8">${escXml(label)}</text>
  </g>
  ${photo ? `<rect x="${photo.x}" y="${photo.y}" width="${photo.w}" height="${photo.h}" rx="${photo.r}" fill="${accent}" opacity="0.08" stroke="${accent}" stroke-width="2"/>`
    : `<text x="${pad + 260}" y="360" font-family="sans-serif" font-size="120" text-anchor="middle">${escXml(post.emoji)}</text>`}
  <text x="${colX}" y="${titleY}" font-family="'Fredoka','Segoe UI',sans-serif" font-size="${titleSize}" font-weight="800" fill="#ffffff" letter-spacing="-0.5">${titleTspans}</text>
  <rect x="${colX}" y="${excerptY - 22}" width="56" height="3" rx="1.5" fill="${accent}"/>
  <text x="${colX}" y="${excerptY + 16}" font-family="'Inter',sans-serif" font-size="20" font-weight="500" fill="#F0EAD6" opacity="0.72">${excerptTspans}</text>
  <g transform="translate(${colX},${H - 112})">
    <rect width="360" height="48" rx="24" fill="${accent}"/>
    <text x="180" y="31" font-family="'Fredoka','Inter',sans-serif" font-size="18" font-weight="800" fill="#1a1612" text-anchor="middle">Read the note</text>
  </g>
  <text x="${colX}" y="${H - 38}" font-family="'Inter',sans-serif" font-size="14" font-weight="600" fill="#F0EAD6" opacity="0.42">${escXml(url)}</text>
</svg>`;
}

function buildPortraitSvg(post) {
  const W = 1080, H = 1350, pad = 60;
  const accent = TAG_ACCENT[post.tag] || TAG_ACCENT.site;
  const label = TAG_LABEL[post.tag] || post.tag.toUpperCase();
  const iso = shortDate(post.date);
  const photo = photoBoxFor(post, 'portrait');
  const titleLines = wrapText(post.title, 30).slice(0, 3);
  const excerptLines = wrapText(post.excerpt, 62).slice(0, 4);
  const titleY = photo ? 735 : 360;
  const titleLineH = 56;
  const excerptY = titleY + titleLines.length * titleLineH + 30;
  const url = `jvdesignstudio.co.uk/devlog#post-${post.id}`;
  const titleTspans = titleLines.map((l, i) => `<tspan x="${W / 2}" dy="${i === 0 ? 0 : titleLineH}">${escXml(l)}</tspan>`).join('');
  const excerptTspans = excerptLines.map((l, i) => `<tspan x="${W / 2}" dy="${i === 0 ? 0 : 30}">${escXml(l)}</tspan>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" role="img">
  <title>${escXml(post.emoji + ' ' + post.title)}</title>
  <defs>
    <radialGradient id="glow" cx="50%" cy="20%" r="70%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#1a1612"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="0" y="0" width="${W}" height="6" fill="${accent}"/>
  <text x="${pad}" y="72" font-family="'Fredoka','Segoe UI',sans-serif" font-size="22" font-weight="800" fill="#F0EAD6">JVDesignStudio</text>
  <text x="${W - pad}" y="72" font-family="'Inter',sans-serif" font-size="13" font-weight="700" fill="#F0EAD6" opacity="0.55" text-anchor="end">${escXml(iso)} - ${escXml(label)}</text>
  <g transform="translate(${W / 2 - 90},110)">
    <rect width="180" height="34" rx="17" fill="${accent}" opacity="0.18" stroke="${accent}" stroke-width="1.2"/>
    <text x="90" y="23" font-family="'Inter',sans-serif" font-size="13" font-weight="800" fill="${accent}" text-anchor="middle" letter-spacing="0.8">${escXml(label)}</text>
  </g>
  ${photo ? `<rect x="${photo.x}" y="${photo.y}" width="${photo.w}" height="${photo.h}" rx="${photo.r}" fill="${accent}" opacity="0.08" stroke="${accent}" stroke-width="2"/>`
    : `<text x="${W / 2}" y="320" font-family="sans-serif" font-size="110" text-anchor="middle">${escXml(post.emoji)}</text>`}
  <text x="${W / 2}" y="${titleY}" font-family="'Fredoka','Segoe UI',sans-serif" font-size="46" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="-0.5">${titleTspans}</text>
  <rect x="${W / 2 - 32}" y="${titleY + titleLines.length * titleLineH - 18}" width="64" height="3" rx="1.5" fill="${accent}" opacity="0.9"/>
  <text x="${W / 2}" y="${excerptY}" font-family="'Inter',sans-serif" font-size="22" font-weight="500" fill="#F0EAD6" opacity="0.72" text-anchor="middle">${excerptTspans}</text>
  <g transform="translate(${W / 2 - 210},${H - 170})">
    <rect width="420" height="54" rx="27" fill="${accent}"/>
    <text x="210" y="36" font-family="'Fredoka','Inter',sans-serif" font-size="20" font-weight="800" fill="#1a1612" text-anchor="middle">Read the note</text>
  </g>
  <text x="${W / 2}" y="${H - 78}" font-family="'Inter',sans-serif" font-size="16" font-weight="600" fill="#F0EAD6" opacity="0.42" text-anchor="middle">${escXml(url)}</text>
  <text x="${W / 2}" y="${H - 38}" font-family="'Inter',sans-serif" font-size="11" font-weight="600" fill="#F0EAD6" opacity="0.26" text-anchor="middle" letter-spacing="2">BOOKS - GAMES - CREATIVE ADVENTURES</text>
</svg>`;
}

async function generateCard(post, outPath, sizeKey) {
  const spec = SIZES[sizeKey] || SIZES.square;
  const svg = sizeKey === 'wide' ? buildWideSvg(post) : sizeKey === 'portrait' ? buildPortraitSvg(post) : buildSvg(post);
  // sharp needs explicit density for emoji/text crisp
  const png = await require('sharp')(Buffer.from(svg), { density: 300 }).png({ compressionLevel: 9 }).toBuffer();
  // Ensure 1080x1080 exactly (sharp from SVG viewBox should already be, but resize as guard)
  let card = await require('sharp')(png).resize(spec.w,spec.h,{fit:'cover'}).png().toBuffer();
  // Composite the post's screenshot into the frame when it exists.
  const photo = photoBoxFor(post, sizeKey);
  if (photo) {
    const inset = 2;
    const iw = photo.w - inset * 2, ih = photo.h - inset * 2;
    const mask = Buffer.from(`<svg width="${iw}" height="${ih}" xmlns="http://www.w3.org/2000/svg"><rect width="${iw}" height="${ih}" rx="${photo.r - inset}" ry="${photo.r - inset}" fill="#fff"/></svg>`);
    const shot = await require('sharp')(photo.file)
      .resize(iw, ih, { fit: 'cover' })
      .composite([{ input: mask, blend: 'dest-in' }])
      .png().toBuffer();
    card = await require('sharp')(card)
      .composite([{ input: shot, left: photo.x + inset, top: photo.y + inset }])
      .png().toBuffer();
  }
  const out = await require('sharp')(card).png().toFile(outPath);
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
  if (opts.id) selected = posts.filter(p=>String(p.id)===String(opts.id));
  else if (!opts.all) selected = posts.slice(0, opts.latest);

  if (!fs.existsSync(QUEUE_DIR)) fs.mkdirSync(QUEUE_DIR, {recursive:true});
  const existing = new Set(fs.existsSync(QUEUE_DIR) ? fs.readdirSync(QUEUE_DIR) : []);
  const existingIds = new Set([...existing].map(f=> (f.match(/^\d{4}-\d{2}-\d{2}-(\d+)-/)||[])[1]).filter(Boolean));

  const sizes = (opts.sizes && opts.sizes.length ? opts.sizes : ['square']).filter((size) => SIZES[size]);
  let created=0, skipped=0, would=0;
  for (const p of selected) {
    const iso = shortDate(p.date);
    const slug = slugify(p.title) || `post-${p.id}`;
    for (const sizeKey of sizes) {
      const spec = SIZES[sizeKey] || SIZES.square;
      const pngName = `${iso}-${p.id}-${slug}${spec.suffix}.png`;
      const outPath = path.join(QUEUE_DIR, pngName);
      const exists = fs.existsSync(outPath);

      if (opts.check) {
        if (exists && !opts.force) { console.log(`✓ exists: ${relPath(outPath)} (id=${p.id}, ${spec.w}x${spec.h})`); skipped++; }
        else { console.log(`○ would create: ${relPath(outPath)} - "${p.title}" (${p.date}, ${spec.w}x${spec.h})`); would++; }
        continue;
      }
      if (exists && !opts.force) { console.log(`↷ skip exists: ${relPath(outPath)}`); skipped++; continue; }
      try {
        await generateCard(p, outPath, sizeKey);
        const stat = fs.statSync(outPath);
        console.log(`✓ card: ${relPath(outPath)} - "${p.title}" (${p.date}) ${Math.round(stat.size/1024)}kB ${spec.w}x${spec.h}`);
        created++;
        existing.add(path.basename(outPath));
        existingIds.add(p.id);
        if (sizeKey === 'square') {
          const mdSame = [...existing].find(f=> f.endsWith('.md') && f.includes(`-${p.id}-`));
          if (mdSame) {
            const mdPath = path.join(QUEUE_DIR, mdSame);
            try {
              let md = fs.readFileSync(mdPath,'utf8');
              const rel = `social-posts/queue/${path.basename(outPath)}`;
              if (md.includes('image suggestion:')) {
                md = md.replace(/- image suggestion:.*/, `- image: ${rel} (1080x1080 auto-generated via generate-social-card.js)`);
                md = md.replace(/- image: social-posts\/queue\/.*1080x1080.*/, `- image: ${rel} (1080x1080 auto-generated via generate-social-card.js)`);
                fs.writeFileSync(mdPath, md);
              } else if (!md.includes(rel)) {
                md = md.replace(/(queue_file:.*\n)/, `$1image: ${rel}\n`);
                fs.writeFileSync(mdPath, md);
              }
            } catch(e) { console.log(`  [md patch skip] ${e.message}`); }
          }
        }
      } catch(e) {
        console.error(`✗ card failed id=${p.id} ${sizeKey}: ${e.message}`);
      }
    }
  }

  if (opts.check) {
    console.log(`\ncheck: ${would} would-create, ${skipped} existing, ${selected.length} selected from ${posts.length} posts`);
    if (would>0) console.log('Run without --check to create.');
    process.exit(0);
  }
  console.log(`\ndone: ${created} created, ${skipped} skipped, ${posts.length} total posts, queue dir ${relPath(QUEUE_DIR)}`);
}

main().catch(e=>{ console.error(e); process.exit(1); });
