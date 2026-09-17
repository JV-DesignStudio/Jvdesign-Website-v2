#!/usr/bin/env node
/* Build branded manual ready-to-post packs from approved comms packs. */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const TASKS = path.join(ROOT, '..', 'studio-workspace', 'tasks.json');
const SOCIAL = path.join(ROOT, 'social-posts');
const READY = path.join(SOCIAL, 'ready');

function ensure(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }
function slugify(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-').slice(0, 60).replace(/-+$/, '') || 'post'; }
function cleanText(s) { return String(s || '').replace(/\r\n/g, '\n').trim() + '\n'; }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function cleanPublicTitle(title) {
  return String(title || 'Studio update')
    .replace(/^\s*[A-Z]\d+\s*[-:]+\s*/i, '')
    .replace(/^\s*🔧\s*/, '')
    .replace(/\s+/g, ' ')
    .trim() || 'Studio update';
}
function stripInternalText(text) {
  let out = String(text || '').replace(/\r\n/g, '\n');
  out = out.replace(/File:\s*[^\n.]+[\n.]?/gi, '');
  out = out.replace(/Evidence:\s*/gi, '');
  out = out.replace(/validate:[^,.;\n]+[,.]?\s*/gi, '');
  out = out.replace(/F:\/Website\/[^ )]+/gi, '');
  out = out.replace(/\([^)]*(?:commit|pkgs|refs|v\d+|\d+[a-f0-9]{5,})[^)]*\)/gi, '');
  out = out.replace(/PASS|FAIL|CACHE=|SHA256|A\d+|\.cjs|\.js|\.html|localStorage|IndexedDB|validate|refs|pkgs|git repos?/gi, '');
  out = out.replace(/\b[a-z0-9]+(?:-[a-z0-9]+){2,}\b/gi, '');
  out = out.replace(/\.{3,}/g, '.');
  return out.replace(/\(\s*\)/g, '').replace(/\s+/g, ' ').trim();
}
function audienceLine(title, source) {
  const hay = `${title || ''} ${source || ''}`.toLowerCase();
  if (/fix|repair|validation|cookie|privacy|audit|update|devlog|github|tracker|reproducible|version control/.test(hay)) return 'It is a behind-the-scenes improvement that keeps the studio smoother, safer, and easier to maintain.';
  if (/workshop|learn|scratch|education|licens/.test(hay)) return 'It helps learners, families, and classrooms find a clearer path from idea to first small win.';
  if (/tool|pixel|studio|create|maker|builder/.test(hay)) return 'It makes the creative tools easier to start, easier to trust, and more useful for young makers.';
  if (/game|play|arcade|roblox|godot/.test(hay)) return 'It helps young creators get into play faster, test ideas, and keep improving what they make.';
  return 'It supports the JVDesignStudio loop: imagine, learn, create, play, improve, and keep going.';
}
function isPublicReady(text) {
  if (!text || text.length < 70) return false;
  if (/File:|Evidence:|validate:|PASS|FAIL|CACHE=|SHA256|F:\/Website|\.cjs|\.js|\.html|localStorage|IndexedDB|\.{3,}|\bA\d+\b/i.test(text)) return false;
  if (/\b[a-z0-9]+(?:-[a-z0-9]+){2,}\b/i.test(text)) return false;
  return true;
}
function publicPolish(text, title, mode) {
  const hook = cleanPublicTitle(title);
  const cleaned = stripInternalText(text);
  const body = isPublicReady(cleaned)
    ? cleaned
    : `This update is ready to share from the studio. ${audienceLine(hook, text)}`;
  const cta = 'Read the Dev Log for the full note.';
  if (mode === 'x') {
    const x = `New from JVDesignStudio: ${hook}. ${audienceLine(hook, text)} ${cta}`;
    return x.length > 250 ? x.slice(0, 250).replace(/\\s+\\S*$/, '').trim() : x;
  }
  if (mode === 'newsletter') return `This week in the studio: ${hook}. ${body} ${cta}`.trim();
  return `${hook}\n\n${body}\n\nBuilt for young creators, families and classrooms. ${cta}`.trim();
}
function statusOf(t) { const p = t.commsPack || {}; if (p.posted && (p.posted.social || p.posted.newsletter)) return 'posted'; return p.status || t.commsStatus || 'pending'; }
function loopFor(t, p) {
  const hay = `${t.tag || ''} ${p.devlog?.tag || ''} ${p.title || t.title}`.toLowerCase();
  if (/game|play|arcade|roblox|godot/.test(hay)) return { name: 'Pip', role: 'Play', color: '#3b82f6' };
  if (/workshop|learn|scratch|education|licens/.test(hay)) return { name: 'Lumo', role: 'Learn', color: '#d97706' };
  if (/tool|pixel|studio|create|maker|builder/.test(hay)) return { name: 'Ember', role: 'Create', color: '#dc2626' };
  if (/fix|repair|validation|cookie|privacy|audit|update|devlog/.test(hay)) return { name: 'Echo', role: 'Improve', color: '#0f766e' };
  return { name: 'Stardust', role: 'Imagine', color: '#7c3aed' };
}
function copyIfExists(srcRel, destDir) {
  if (!srcRel) return '';
  const src = path.join(ROOT, srcRel.replace(/^\.\//, ''));
  if (!fs.existsSync(src)) return '';
  const dest = path.join(destDir, path.basename(src));
  fs.copyFileSync(src, dest);
  return path.basename(dest);
}
function wrapWords(text, maxChars, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    } else {
      line = next;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}
async function createFallbackImage(destDir, title, loop) {
  const file = 'jvds-social-card.png';
  const dest = path.join(destDir, file);
  const cleanTitle = cleanPublicTitle(title);
  const lines = wrapWords(cleanTitle, 22, 4);
  const role = `${loop.name} - ${loop.role}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <rect width="1080" height="1080" fill="#fff8ec"/>
  <rect x="54" y="54" width="972" height="972" rx="44" fill="#1a1612"/>
  <rect x="54" y="54" width="972" height="18" fill="${loop.color}"/>
  <circle cx="148" cy="158" r="48" fill="${loop.color}"/>
  <text x="148" y="176" text-anchor="middle" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="48" font-weight="900" fill="#ffffff">${esc(loop.name[0])}</text>
  <text x="224" y="145" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="34" font-weight="900" fill="#ffffff">JVDesignStudio</text>
  <text x="224" y="188" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="26" font-weight="800" fill="#f6e8d0">${esc(role)}</text>
  ${lines.map((line, i) => `<text x="96" y="${388 + i * 92}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="72" font-weight="900" fill="#ffffff">${esc(line)}</text>`).join('\n  ')}
  <rect x="96" y="812" width="888" height="2" fill="#3b342d"/>
  <text x="96" y="885" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="32" font-weight="800" fill="#f6e8d0">Imagine. Learn. Create. Play. Improve.</text>
  <text x="96" y="944" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="28" font-weight="700" fill="#ffffff">Built for young creators, families and classrooms.</text>
</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(dest);
  return file;
}
function reelsScript(t, p, data) {
  const title = cleanPublicTitle(p.title || t.title);
  const loop = loopFor(t, p);
  const hook = `What changed in JVDesignStudio: ${title}`;
  const caption = (data.x || data.instagram || title).replace(/\s+/g, ' ').trim();
  return cleanText(`# Reels / Shorts Script: ${title}

Format: 15-30 seconds
Character lane: ${loop.name} - ${loop.role}

Hook:
${hook}

Shot list:
1. Open on the tool, game or update title.
2. Show the main change in action for 3-5 seconds.
3. Show the learner benefit: make, learn, play, save or improve.
4. End on the JVDesignStudio page, Dev Log or ready-to-try screen.

Voiceover / on-screen text:
${caption}

Thumbnail idea:
Use the ready-pack image with a short title overlay: "${title}".

Posting note:
Keep it simple, clear and useful. This is a schedule-ready video prompt, not a final filmed asset.
`);
}
function schedulerLinks() {
  return [
    ['Meta Business Suite', 'https://business.facebook.com/latest/composer'],
    ['Instagram', 'https://www.instagram.com/'],
    ['Facebook', 'https://www.facebook.com/'],
    ['X', 'https://x.com/compose/post'],
    ['Threads', 'https://www.threads.net/'],
    ['YouTube Studio', 'https://studio.youtube.com/'],
    ['TikTok Upload', 'https://www.tiktok.com/upload'],
    ['Buffer', 'https://publish.buffer.com/'],
    ['Later', 'https://app.later.com/'],
    ['Metricool', 'https://app.metricool.com/'],
    ['Mailchimp', 'https://mailchimp.com/'],
    ['Brevo', 'https://app.brevo.com/']
  ];
}
function proofTemplate(t, p) {
  return cleanText(`Task: ${t.id}
Title: ${p.title || t.title}
Platform:
Scheduled date/time:
Scheduler used:
Scheduled proof URL or note:
Live post URL:
Status: scheduled / posted / sent
`);
}
function uploadPackHtml(t, p, copiedImage, data) {
  const loop = loopFor(t, p);
  const title = p.title || t.title;
  const reels = reelsScript(t, p, data).trim();
  const link = data.link.trim();
  const img = copiedImage ? `<img class="post-image" src="${esc(copiedImage)}" alt="Ready post image">` : '<div class="image-empty">No image attached</div>';
  const links = schedulerLinks().map(([label, url]) => `<a class="btn" href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(title)} | Upload Pack</title>
<style>
:root{--accent:${loop.color};--ink:#17120f;--paper:#fffaf0;--line:#e6d8bf;--soft:#f4ead8}*{box-sizing:border-box}body{margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;background:#f6efe3;color:var(--ink);line-height:1.5}.wrap{max-width:1180px;margin:0 auto;padding:20px}.hero{background:#17120f;color:#fff;border-top:8px solid var(--accent);border-radius:16px;padding:20px;display:grid;gap:10px}.hero h1{margin:0;font-size:clamp(1.5rem,4vw,2.5rem);line-height:1.05}.chips{display:flex;gap:8px;flex-wrap:wrap}.chip{border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:5px 9px;font-weight:900;font-size:.75rem}.grid{display:grid;grid-template-columns:320px 1fr;gap:14px;margin-top:14px}.panel{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px}.panel h2{margin:0 0 10px;font-size:.9rem;text-transform:uppercase;color:#695f51;letter-spacing:.06em}.post-image{width:100%;border-radius:10px;border:1px solid var(--line)}.image-empty{aspect-ratio:1;border:1px dashed var(--line);border-radius:10px;background:var(--soft);display:grid;place-items:center;font-weight:900;color:#695f51}.copybox{white-space:pre-wrap;background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:12px;min-height:105px}.actions,.links{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.btn{border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--ink);font-weight:900;padding:8px 11px;text-decoration:none;cursor:pointer}.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}.checklist{display:grid;gap:6px}.checklist label{display:flex;gap:8px;align-items:flex-start;background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:8px;font-weight:800}.wide{grid-column:1/-1}@media(max-width:760px){.grid{grid-template-columns:1fr}.wrap{padding:12px}}
</style>
</head>
<body>
<div class="wrap">
<section class="hero"><div class="chips"><span class="chip">${esc(t.id)}</span><span class="chip">${esc(loop.name)} - ${esc(loop.role)}</span><span class="chip">Upload handoff</span></div><h1>${esc(title)}</h1></section>
<main class="grid">
<aside class="panel">${img}<div class="actions"><button class="btn primary" onclick="copyText('imagepath')">Copy image path</button><a class="btn" href="${esc(copiedImage || '#')}">Open image</a></div><div class="copybox" id="imagepath">${esc(copiedImage || '')}</div></aside>
<section class="panel"><h2>Upload Checklist</h2><div class="checklist"><label><input type="checkbox"> Image uploaded</label><label><input type="checkbox"> Caption copied</label><label><input type="checkbox"> Link added</label><label><input type="checkbox"> Scheduled proof saved</label><label><input type="checkbox"> Board marked scheduled/posted/sent</label></div><h2 style="margin-top:14px">Schedulers</h2><div class="links">${links}</div></section>
<section class="panel"><h2>Instagram / Facebook</h2><div class="copybox" id="ig">${esc(data.instagram)}</div><div class="actions"><button class="btn primary" onclick="copyText('ig')">Copy Instagram/Facebook</button></div></section>
<section class="panel"><h2>X / Threads</h2><div class="copybox" id="xcopy">${esc(data.x)}</div><div class="actions"><button class="btn primary" onclick="copyText('xcopy')">Copy X/Threads</button></div></section>
<section class="panel"><h2>Newsletter Block</h2><div class="copybox" id="nl">${esc(data.newsletter)}</div><div class="actions"><button class="btn primary" onclick="copyText('nl')">Copy Newsletter</button></div></section>
<section class="panel"><h2>Link</h2><div class="copybox" id="link">${esc(link)}</div><div class="actions"><button class="btn primary" onclick="copyText('link')">Copy Link</button><a class="btn" href="${esc(link || '#')}" target="_blank" rel="noopener">Open Link</a></div></section>
<section class="panel wide"><h2>Reels / Shorts Script</h2><div class="copybox" id="reels">${esc(reels)}</div><div class="actions"><button class="btn primary" onclick="copyText('reels')">Copy Reels Script</button></div></section>
<section class="panel wide"><h2>Proof Field</h2><div class="copybox" id="proof">${esc(proofTemplate(t, p).trim())}</div><div class="actions"><button class="btn primary" onclick="copyText('proof')">Copy Proof Template</button></div></section>
</main>
</div>
<script>function copyText(id){navigator.clipboard.writeText(document.getElementById(id).innerText)}</script>
</body>
</html>`;
}
function packReadme(t, p, copiedImage) {
  const title = p.title || t.title;
  return cleanText(`# Ready To Post: ${title}

Task: ${t.id}
Status: ${statusOf(t)}
Kind: ${p.kind || 'social'}
Source: ${p.sourceTask || t.id}
Image: ${copiedImage || p.image || 'none'}
Preview: preview.html
Upload pack: upload.html

Manual posting flow:
1. Open preview.html or use the board platform buttons.
2. Upload the image if present.
3. Copy the matching caption text.
4. Paste the link if the platform needs it separately.
5. After posting or sending, use Mark social posted or Mark newsletter sent on the board.

Do not post if the board status is no longer approved.
`);
}
function previewHtml(t, p, copiedImage, data) {
  const loop = loopFor(t, p);
  const title = p.title || t.title;
  const img = copiedImage ? `<img class="post-image" src="${esc(copiedImage)}" alt="Generated post image">` : '<div class="image-empty">No image attached</div>';
  const link = data.link.trim();
  const checks = [
    ['Image attached', Boolean(copiedImage)],
    ['Instagram/Facebook caption', Boolean(data.instagram.trim())],
    ['X/Threads caption', Boolean(data.x.trim())],
    ['Newsletter blurb', Boolean(data.newsletter.trim())],
    ['Link present', Boolean(link)],
    ['Friendly wording check', true]
  ];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(title)} | JVDesignStudio Ready Pack</title>
<style>
:root{--accent:${loop.color};--ink:#1a1612;--paper:#fffaf0;--soft:#f6efe2;--line:#e4d5bd;--muted:#665f55}
*{box-sizing:border-box}body{margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;background:#f5efe4;color:var(--ink);line-height:1.5}.wrap{max-width:1120px;margin:0 auto;padding:24px}.hero{background:#1a1612;color:#fff;border-radius:18px;padding:22px;display:grid;gap:14px;border-top:8px solid var(--accent);box-shadow:0 12px 32px rgba(26,22,18,.18)}.brand{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.mark{width:42px;height:42px;border-radius:50%;background:var(--accent);display:grid;place-items:center;font-weight:900;color:#fff}.hero h1{font-size:clamp(1.55rem,4vw,2.5rem);margin:0;line-height:1.05}.chips{display:flex;gap:8px;flex-wrap:wrap}.chip{border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);border-radius:999px;padding:6px 10px;font-size:.78rem;font-weight:800}.grid{display:grid;grid-template-columns:minmax(260px,.9fr) 1.1fr;gap:18px;margin-top:18px}.panel{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px;box-shadow:0 4px 16px rgba(26,22,18,.06)}.post-image{width:100%;border-radius:12px;border:1px solid var(--line);display:block}.image-empty{aspect-ratio:1;background:var(--soft);border:1px dashed var(--line);border-radius:12px;display:grid;place-items:center;color:var(--muted);font-weight:800}.panel h2{font-size:.9rem;margin:0 0 10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}.copybox{width:100%;min-height:130px;border:1px solid var(--line);border-radius:10px;background:var(--paper);padding:12px;white-space:pre-wrap;font:inherit;color:var(--ink)}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.btn{border:1px solid var(--line);background:#fff;border-radius:999px;padding:8px 12px;font-weight:900;color:var(--ink);text-decoration:none;cursor:pointer}.btn.primary{background:var(--accent);color:#fff;border-color:var(--accent)}.check{display:grid;gap:7px}.check div{display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid #f1e6d5;padding:5px 0}.ok{color:#166534;font-weight:900}.warn{color:#b45309;font-weight:900}.platforms{display:flex;gap:8px;flex-wrap:wrap}.platforms a{background:var(--soft);border:1px solid var(--line);border-radius:999px;padding:8px 11px;text-decoration:none;color:var(--ink);font-weight:900;font-size:.82rem}@media(max-width:760px){.grid{grid-template-columns:1fr}.wrap{padding:14px}.hero{border-radius:14px}}
</style>
</head>
<body>
<div class="wrap">
  <section class="hero">
    <div class="brand"><div class="mark">${esc(loop.name[0])}</div><strong>JVDesignStudio Publishing Desk</strong><span class="chip">${esc(loop.name)} · ${esc(loop.role)}</span><span class="chip">${esc(statusOf(t))}</span><span class="chip">${esc(t.id)}</span></div>
    <h1>${esc(title)}</h1>
    <div class="chips"><span class="chip">Dev Log</span><span class="chip">Newsletter</span><span class="chip">Social</span><span class="chip">Manual post pack</span></div>
  </section>
  <main class="grid">
    <aside class="panel">${img}<div class="actions"><a class="btn primary" href="${esc(link || '#')}">Open link</a><button class="btn" onclick="navigator.clipboard.writeText('${esc(link).replace(/'/g, '&#39;')}')">Copy link</button></div></aside>
    <section class="panel"><h2>Post quality</h2><div class="check">${checks.map(([label, ok]) => `<div><span>${esc(label)}</span><span class="${ok ? 'ok' : 'warn'}">${ok ? 'Ready' : 'Missing'}</span></div>`).join('')}</div><h2 style="margin-top:18px">Platforms</h2><div class="platforms"><a href="https://www.instagram.com/">Instagram</a><a href="https://www.facebook.com/">Facebook</a><a href="https://x.com/compose/post">X</a><a href="https://www.threads.net/">Threads</a><a href="https://www.youtube.com/">YouTube</a></div></section>
    <section class="panel"><h2>Instagram / Facebook</h2><div class="copybox" id="ig">${esc(data.instagram)}</div><div class="actions"><button class="btn primary" onclick="navigator.clipboard.writeText(document.getElementById('ig').innerText)">Copy Instagram/Facebook</button></div></section>
    <section class="panel"><h2>X / Threads</h2><div class="copybox" id="xcopy">${esc(data.x)}</div><div class="actions"><button class="btn primary" onclick="navigator.clipboard.writeText(document.getElementById('xcopy').innerText)">Copy X/Threads</button></div></section>
    <section class="panel"><h2>Newsletter</h2><div class="copybox" id="nl">${esc(data.newsletter)}</div><div class="actions"><button class="btn primary" onclick="navigator.clipboard.writeText(document.getElementById('nl').innerText)">Copy newsletter</button></div></section>
  </main>
</div>
</body>
</html>`;
}
async function main() {
  ensure(READY);
  if (!fs.existsSync(TASKS)) throw new Error('Missing tasks.json: ' + TASKS);
  const tasks = JSON.parse(fs.readFileSync(TASKS, 'utf8'));
  const approved = tasks.filter(t => t.commsPack && statusOf(t) === 'approved');
  let made = 0;
  for (const t of approved) {
    const p = t.commsPack;
    const dir = path.join(READY, `${t.id}-${slugify(p.title || t.title)}`);
    ensure(dir);
    const loop = loopFor(t, p);
    const copiedImage = copyIfExists(p.image, dir) || await createFallbackImage(dir, p.title || t.title, loop);
    const data = {
      instagram: publicPolish(p.social?.instagram || p.devlog?.excerpt || p.friendly?.what || '', p.title || t.title, 'instagram'),
      x: publicPolish(p.social?.x || p.friendly?.what || p.devlog?.excerpt || '', p.title || t.title, 'x'),
      newsletter: publicPolish(p.newsletter || p.devlog?.excerpt || p.friendly?.what || '', p.title || t.title, 'newsletter'),
      link: p.devlog?.id ? `https://jvdesignstudio.co.uk/devlog#post-${p.devlog.id}` : ''
    };
    fs.writeFileSync(path.join(dir, 'README.md'), packReadme(t, p, copiedImage), 'utf8');
    fs.writeFileSync(path.join(dir, 'caption-instagram-facebook.txt'), cleanText(data.instagram), 'utf8');
    fs.writeFileSync(path.join(dir, 'caption-x-threads.txt'), cleanText(data.x), 'utf8');
    fs.writeFileSync(path.join(dir, 'newsletter-blurb.txt'), cleanText(data.newsletter), 'utf8');
    fs.writeFileSync(path.join(dir, 'reels-script.txt'), reelsScript(t, p, data), 'utf8');
    fs.writeFileSync(path.join(dir, 'link.txt'), cleanText(data.link), 'utf8');
    fs.writeFileSync(path.join(dir, 'platforms.txt'), cleanText(['Instagram: https://www.instagram.com/','Facebook: https://www.facebook.com/','X: https://x.com/compose/post','Threads: https://www.threads.net/','YouTube Community: https://www.youtube.com/','Newsletter: open your email/newsletter tool'].join('\n')), 'utf8');
    fs.writeFileSync(path.join(dir, 'scheduler-links.txt'), cleanText(schedulerLinks().map(([label, url]) => label + ': ' + url).join('\\n')), 'utf8');
    fs.writeFileSync(path.join(dir, 'proof-template.txt'), proofTemplate(t, p), 'utf8');
    fs.writeFileSync(path.join(dir, 'preview.html'), previewHtml(t, p, copiedImage, data), 'utf8');
    fs.writeFileSync(path.join(dir, 'upload.html'), uploadPackHtml(t, p, copiedImage, data), 'utf8');
    made++;
  }
  console.log(`Ready-to-post packs built: ${made} approved pack(s) in social-posts/ready`);
}
main().catch(err => { console.error(err); process.exit(1); });










