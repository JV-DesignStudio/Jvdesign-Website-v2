const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const WDIR = path.join(ROOT, 'workshops');
const OGDIR = path.join(ROOT, 'og');
const SITE = 'https://jvdesignstudio.co.uk';
const GENERIC = SITE + '/logo.png';
const APPLY = process.argv.includes('--apply');

// Classify a workshop file into a series look (color, emoji, label).
function classify(f) {
  const n = f.toLowerCase();
  const M = [
    [/scratch/, ['#ff7700', '🐱', 'Scratch Workshop']],
    [/roblox/, ['#00b4ff', '🎮', 'Roblox Studio']],
    [/unity/, ['#5bc0f8', '🔷', 'Unity Workshop']],
    [/unreal/, ['#60a5fa', '🏗️', 'Unreal Engine']],
    [/mugen|add-your-own-stage/, ['#f87171', '⚔️', 'MUGEN Fighting']],
    [/(^|[^a-z])js-|javascript/, ['#ffd166', '🟨', 'JavaScript']],
    [/python/, ['#4bbf6b', '🐍', 'Python Workshop']],
    [/java-/, ['#f59e0b', '☕', 'Java Workshop']],
    [/cpp|c\+\+/, ['#a78bfa', '⚙️', 'C++ Workshop']],
    [/gml|gamemaker/, ['#fb923c', '🎯', 'GameMaker']],
    [/blender/, ['#ff70b8', '🎨', 'Blender 3D']],
    [/tinkercad|3d-print/, ['#f5a623', '🖨️', 'TinkerCAD 3D']],
    [/minecraft/, ['#5fa83a', '⛏️', 'Minecraft Modding']],
    [/openrct2/, ['#4ade80', '🎢', 'OpenRCT2 Modding']],
    [/castle-siege|diablo|pirate-cannon|pirate-ship|steampunk|robot-builder|rocket-builder|sci-fi-runner/, ['#ffd166', '🏗️', 'Builder Workshop']],
    [/godot|night-watch|barrel|pixel-quest|jump-jump|nuclear|fairy|space_invaders|race-builder|racing|fnaf/, ['#06d6a0', '🕹️', 'Godot Engine']],
    [/cheatsheet/, ['#4dd9e0', '📋', 'Cheat Sheet']],
  ];
  for (const [re, v] of M) if (re.test(n)) return { color: v[0], emoji: v[1], label: v[2] };
  return { color: '#4dd9e0', emoji: '✨', label: 'Free Workshop' };
}

function attr(html, re) { const m = html.match(re); return m ? m[1].trim() : null; }
function cleanTitle(t) { return (t || '').split('|')[0].replace(/\s+/g, ' ').trim(); }
function truncate(s, n) { s = (s || '').replace(/\s+/g, ' ').trim(); if (s.length <= n) return s; return s.slice(0, n).replace(/\s+\S*$/, '') + '…'; }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

const SHELL = `<!DOCTYPE html><html><head><meta charset="utf8">
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1200px;height:630px;overflow:hidden}
  #card{width:1200px;height:630px;position:relative;background:#0d0d12;font-family:Inter,sans-serif;overflow:hidden}
  #accentbar{position:absolute;top:0;left:0;width:100%;height:8px;background:var(--c)}
  #glow{position:absolute;top:-160px;right:-160px;width:620px;height:620px;border-radius:50%;background:radial-gradient(circle,var(--c) 0%,transparent 70%);opacity:.22}
  #inner{position:absolute;inset:0;padding:64px 72px;display:flex;flex-direction:column;height:100%}
  #brand{font-size:22px;font-weight:800;letter-spacing:5px;color:#F0EAD6;opacity:.85}
  #kicker{margin-top:26px;font-size:22px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--c)}
  #title{margin-top:14px;font-family:Fredoka,sans-serif;font-weight:700;color:#fff;line-height:1.06;max-width:900px}
  #sub{margin-top:20px;font-size:26px;font-weight:400;color:rgba(240,234,214,.72);line-height:1.45;max-width:840px}
  #emoji{position:absolute;right:70px;top:150px;font-size:190px;line-height:1;filter:drop-shadow(0 8px 24px rgba(0,0,0,.5))}
  #foot{margin-top:auto;display:flex;align-items:center;gap:18px}
  #pill{background:var(--c);color:#0d0d12;font-family:Fredoka,sans-serif;font-weight:700;font-size:22px;padding:8px 20px;border-radius:999px}
  #url{font-family:Fredoka,sans-serif;font-weight:600;font-size:26px;color:#F0EAD6}
</style></head>
<body><div id="card">
  <div id="accentbar"></div><div id="glow"></div>
  <div id="inner">
    <div id="brand">JVDESIGNSTUDIO</div>
    <div id="kicker"></div>
    <div id="title"></div>
    <div id="sub"></div>
    <div id="foot"><span id="pill">✓ FREE</span><span id="url">jvdesignstudio.co.uk</span></div>
  </div>
  <div id="emoji"></div>
</div></body></html>`;

(async () => {
  if (!fs.existsSync(OGDIR)) fs.mkdirSync(OGDIR);
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await page.setContent(SHELL, { waitUntil: 'networkidle0' });
  try { await page.evaluateHandle('document.fonts.ready'); } catch (e) {}

  const files = fs.readdirSync(WDIR).filter(n => n.endsWith('.html'));
  let made = 0, wired = 0, skipped = [];
  for (const f of files) {
    const p = path.join(WDIR, f);
    let html = fs.readFileSync(p, 'utf8');
    // only replace the generic logo.png OG; preserve any existing custom art
    const cur = attr(html, /og:image"\s*content="([^"]*)"/i);
    if (cur && cur !== GENERIC) { skipped.push(f + ' (custom og)'); continue; }
    const title = cleanTitle(attr(html, /<title>([^<]*)<\/title>/i));
    const desc = attr(html, /<meta\s+name="description"\s+content="([^"]*)"/i) || '';
    if (!title) { skipped.push(f + ' (no title)'); continue; }
    const look = classify(f);
    const slug = f.replace(/\.html$/, '');
    const titleSize = title.length > 46 ? 58 : title.length > 30 ? 68 : 80;

    await page.evaluate((d) => {
      document.getElementById('card').style.setProperty('--c', d.color);
      document.getElementById('kicker').textContent = d.label;
      const t = document.getElementById('title');
      t.textContent = d.title; t.style.fontSize = d.titleSize + 'px';
      document.getElementById('sub').textContent = d.sub;
      document.getElementById('emoji').textContent = d.emoji;
    }, { color: look.color, label: look.label, title, titleSize, sub: truncate(desc, 120), emoji: look.emoji });

    const out = path.join(OGDIR, slug + '.png');
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1200, height: 630 } });
    made++;

    if (APPLY) {
      const newUrl = SITE + '/og/' + slug + '.png';
      html = html.replace(/(og:image"\s*content=")[^"]*(")/i, '$1' + newUrl + '$2');
      if (/twitter:image/i.test(html)) {
        html = html.replace(/(twitter:image"\s*content=")[^"]*(")/i, '$1' + newUrl + '$2');
      } else if (/twitter:card/i.test(html)) {
        html = html.replace(/(<meta\s+name="twitter:card"[^>]*>)/i, '$1\n<meta name="twitter:image" content="' + newUrl + '">');
      }
      fs.writeFileSync(p, html, 'utf8');
      wired++;
    }
  }
  await browser.close();
  console.log(APPLY ? 'APPLIED' : 'GENERATED (no html changes)');
  console.log('images made:', made, '| html wired:', wired, '| skipped:', skipped.length);
  if (skipped.length) console.log(skipped.slice(0, 20).join('\n'));
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
