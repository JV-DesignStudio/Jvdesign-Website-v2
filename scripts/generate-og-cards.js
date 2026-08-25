#!/usr/bin/env node
/*
  generate-og-cards.js
  ─────────────────────
  Single source of truth for the site's social share cards.

  Renders a branded 1200x630 card (og/<slug>.png) for every page in the
  CARDS list, then rewrites that page's <meta property="og:image"> and
  <meta name="twitter:image"> to point at it (adding a twitter:image if the
  page only had og:image). A handful of pages already have real artwork and
  are listed under ART — those are wired to the existing image, no card drawn.

  Why this exists: Facebook, X, LinkedIn, Discord and iMessage do NOT render
  SVG og:images, and a bare logo makes every share look identical. Each card
  here carries the page's real title, tagline, section and brand accent so a
  shared link reads as a real product.

  Add a new game/page: append an entry to CARDS (or ART) and re-run:
      node scripts/generate-og-cards.js
  Re-running is idempotent: it redraws every card and re-points the tags.

  Requires puppeteer (already a devDependency). Uses system fonts so it works
  offline; no webfont fetch.
*/
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const OGDIR = path.join(ROOT, 'og');
const BASE = 'https://jvdesignstudio.co.uk/';
const OG = BASE + 'og/';
const logoB64 = fs.readFileSync(path.join(ROOT, 'logo.png')).toString('base64');

// page = html path relative to repo root. slug = og/<slug>.png filename.
const CARDS = [
  // ── Arcade games ──
  { page: 'games/bread-blocks.html',       slug: 'bread-blocks',      title: 'Bread Blocks',        tag: 'Stack the falling blocks, clear the rows.',            accent: '#7cb342', emoji: '🍞', eyebrow: 'JVDesignStudio Arcade · Puzzle' },
  { page: 'games/bubble-pop-galaxy.html',  slug: 'bubble-pop-galaxy', title: 'Bubble Pop Galaxy',   tag: 'Clear the bubbles, trigger chain reactions.',          accent: '#7b6cf0', emoji: '🫧', eyebrow: 'JVDesignStudio Arcade · Puzzle' },
  { page: 'games/critter-whack-page.html', slug: 'critter-whack',     title: 'Critter Whack',       tag: 'Tap the critters before they duck. Mind the bombs!',   accent: '#BC4749', emoji: '🐹', eyebrow: 'JVDesignStudio Arcade · Arcade' },
  { page: 'games/dough-dash.html',         slug: 'dough-dash',        title: 'Dough Dash',          tag: 'Match 3+ dough tiles to clear the board.',             accent: '#ff6b9d', emoji: '🥐', eyebrow: 'JVDesignStudio Arcade · Match-3' },
  { page: 'games/echos-flight.html',       slug: 'echos-flight',      title: "Echo's Flight",       tag: 'Tap to flap, weave through the pipes, earn medals.',   accent: '#63c7ff', emoji: '🕊️', eyebrow: 'JVDesignStudio Arcade · Arcade' },
  { page: 'games/little_steps.html',       slug: 'little-steps',      title: 'Little Steps',        tag: 'A cosmic endless runner. Choose your path.',           accent: '#8a5cf0', emoji: '🌌', eyebrow: 'JVDesignStudio Arcade · Runner' },
  { page: 'games/lumo-dash-page.html',     slug: 'lumo-dash',         title: 'Lumo Dash',           tag: 'Guide Lumo the fox through 3 colourful biomes.',       accent: '#BC4749', emoji: '🦊', eyebrow: 'JVDesignStudio Arcade · Runner' },
  { page: 'games/millionaire-quiz.html',   slug: 'quiz-quest',        title: 'Quiz Quest',          tag: 'A free trivia game. How far can you go?',              accent: '#F2A541', emoji: '🧠', eyebrow: 'JVDesignStudio Arcade · Trivia' },
  { page: 'games/neon-tiles.html',         slug: 'neon-tiles',        title: 'Neon Tiles',          tag: 'A neon rhythm runner. Keep the combo alive.',          accent: '#00d2ff', emoji: '🎵', eyebrow: 'JVDesignStudio Arcade · Rhythm' },
  { page: 'games/nibble-quest-page.html',  slug: 'nibble-quest',      title: 'Nibble Quest',        tag: 'Classic snake. Eat, grow longer, chase the score.',    accent: '#6BCB77', emoji: '🐍', eyebrow: 'JVDesignStudio Arcade · Arcade' },
  { page: 'games/paper-toss-deluxe.html',  slug: 'paper-toss-deluxe', title: 'Paper Toss Deluxe',   tag: 'Drag to aim, mind the wind, sink the shot.',           accent: '#4895EF', emoji: '🗑️', eyebrow: 'JVDesignStudio Arcade · Physics' },
  { page: 'games/pastry-match.html',       slug: 'pastry-match',      title: 'Pastry Match',        tag: 'Flip the cards, find the matching pairs.',             accent: '#c56cf0', emoji: '🧁', eyebrow: 'JVDesignStudio Arcade · Memory' },
  { page: 'games/pips-bakery-empire.html', slug: 'pips-bakery-empire',title: "Pip's Bakery Empire", tag: 'Build a bakery idle empire from one oven.',            accent: '#F2A541', emoji: '🥖', eyebrow: 'JVDesignStudio Arcade · Idle' },
  { page: 'games/stack-attack-page.html',  slug: 'stack-attack',      title: 'Stack Attack',        tag: 'Tap to drop blocks, build the tallest tower.',         accent: '#BC4749', emoji: '🧱', eyebrow: 'JVDesignStudio Arcade · Arcade' },
  { page: 'games/star-chef.html',          slug: 'star-chef',         title: 'Star Chef',           tag: 'Serve hungry customers, grow your restaurant.',        accent: '#fb5607', emoji: '👨‍🍳', eyebrow: 'JVDesignStudio Arcade · Manager' },

  // ── Homepage + hubs ──
  { page: 'arcade.html',                   slug: 'arcade',        title: 'JVDS Arcade',        tag: 'Every game in one app. One profile, 29 games, playable offline.', accent: '#A583CE', emoji: '🕹️', eyebrow: 'JVDesignStudio · Install the Arcade' },
  { page: 'index.html',                    slug: 'home',          title: 'JVDesignStudio',     tag: "Children's books, free browser games & creative adventures.", accent: '#BC4749', emoji: '🎨', eyebrow: 'Made with heart by J. Valentine' },
  { page: 'pages/games.html',              slug: 'hub-games',     title: 'Free Browser Games', tag: 'Play instantly. No downloads, no sign-ups.',                  accent: '#7b6cf0', emoji: '🎮', eyebrow: 'JVDesignStudio Arcade' },
  { page: 'pages/books.html',              slug: 'hub-books',     title: "Children's Books",   tag: 'Picture books about courage, calm & curiosity.',              accent: '#F2A541', emoji: '📚', eyebrow: 'JVDesignStudio Books' },
  { page: 'pages/freebies.html',           slug: 'hub-freebies',  title: 'Free Downloads',     tag: 'Books, games, activity kits & guides, all free.',             accent: '#6BCB77', emoji: '🎁', eyebrow: 'JVDesignStudio' },
  { page: 'pages/content_hub.html',        slug: 'hub-everything',title: 'Everything',         tag: 'Every game, book, course, tool & download in one place.',     accent: '#4895EF', emoji: '🗂️', eyebrow: 'JVDesignStudio' },
  { page: 'pages/dev-tools.html',          slug: 'hub-devtools',  title: 'Game Dev Toolbox',   tag: '20 free browser tools, sprites, music, levels & more.',       accent: '#00b894', emoji: '🛠️', eyebrow: 'JVDesignStudio' },
  { page: 'pages/videos.html',             slug: 'hub-videos',    title: 'Videos',             tag: 'Devlogs & project showcases on the Studio YouTube.',          accent: '#e74c3c', emoji: '📺', eyebrow: 'JVDesignStudio' },
  { page: 'pages/gallery.html',            slug: 'hub-gallery',   title: 'The Making Wall',    tag: 'See what people built with our free tools.',                  accent: '#c56cf0', emoji: '🖼️', eyebrow: 'JVDesignStudio' },
  { page: 'pages/merch.html',              slug: 'hub-merch',     title: 'Merch Shop',         tag: 'Exclusive designs, prints & goodies.',                        accent: '#fd79a8', emoji: '🛍️', eyebrow: 'JVDesignStudio' },
  { page: 'pages/leaderboards.html',       slug: 'hub-leaderboards',title: 'Your Progress',    tag: 'Best scores, XP, achievements & streaks across every game.',  accent: '#F2A541', emoji: '🏆', eyebrow: 'JVDesignStudio Arcade' },
  { page: 'pages/quest-board.html',        slug: 'hub-questboard',title: 'Quest Board',        tag: 'Complete quests across workshops & games. Unlock rewards.',   accent: '#8a5cf0', emoji: '🗡️', eyebrow: 'JVDesignStudio' },
  { page: 'pages/newsletter.html',         slug: 'hub-newsletter',title: 'Stay in the Loop',   tag: 'New books, games & tools, straight to your inbox.',           accent: '#63c7ff', emoji: '✉️', eyebrow: 'JVDesignStudio' },
  { page: 'pages/follow_along.html',       slug: 'hub-follow',    title: 'Follow Along',       tag: 'Studio updates on YouTube, Instagram & Itch.',                accent: '#fb5607', emoji: '🧭', eyebrow: 'JVDesignStudio' },
  { page: 'pages/about.html',              slug: 'hub-about',     title: 'About J. Valentine', tag: 'The story & values behind JVDesignStudio.',                   accent: '#BC4749', emoji: '👋', eyebrow: 'JVDesignStudio' },
  { page: 'pages/contact.html',            slug: 'hub-contact',   title: 'Contact',            tag: 'Collaborations, press & educational enquiries.',              accent: '#4895EF', emoji: '💬', eyebrow: 'JVDesignStudio' },
  { page: 'pages/faq.html',                slug: 'hub-faq',       title: 'FAQ',                tag: 'Questions about our books, games & downloads.',               accent: '#6BCB77', emoji: '❓', eyebrow: 'JVDesignStudio' },
  { page: 'pages/devlog.html',             slug: 'hub-devlog',    title: 'Dev Log',            tag: 'Behind the scenes on books, games & the process.',            accent: '#F2A541', emoji: '📓', eyebrow: 'JVDesignStudio' },
  { page: 'pages/press.html',              slug: 'hub-press',     title: 'Press Kit',          tag: 'Logos, screenshots, bio & media resources.',                  accent: '#2B2D42', emoji: '📰', eyebrow: 'JVDesignStudio' },
  { page: 'pages/pitch.html',              slug: 'hub-pitch',     title: 'JVDesignStudio',     tag: 'One-page overview: books, games & creative learning.',        accent: '#BC4749', emoji: '📄', eyebrow: 'One-Page Overview' },
  { page: 'pages/search.html',             slug: 'hub-search',    title: 'Search',             tag: 'Find any book, game, guide or freebie instantly.',            accent: '#4895EF', emoji: '🔍', eyebrow: 'JVDesignStudio' },
  { page: 'pages/sitemap.html',            slug: 'hub-sitemap',   title: 'Sitemap',            tag: 'Every book, game, tool & page on the site.',                  accent: '#6c5ce7', emoji: '🗺️', eyebrow: 'JVDesignStudio' },
  { page: 'pages/darkmode.html',           slug: 'hub-darkmode',  title: 'Dark Mode',          tag: 'A cosy dark theme across the whole studio.',                  accent: '#2B2D42', emoji: '🌙', eyebrow: 'JVDesignStudio' },
  { page: 'pages/privacy-policy.html',     slug: 'hub-privacy',   title: 'Privacy Policy',     tag: 'How we handle data, cookies & your rights.',                  accent: '#636e72', emoji: '🔒', eyebrow: 'JVDesignStudio' },
  { page: 'pages/terms-of-service.html',   slug: 'hub-terms',     title: 'Terms of Service',   tag: 'The rules for using our site, games & tools.',                accent: '#636e72', emoji: '📜', eyebrow: 'JVDesignStudio' },

  // ── Books ──
  { page: 'books/activity-pack.html',                  slug: 'book-activity',  title: 'Free Activity Pack',              tag: 'Word search, mazes, connect-the-dots & more.', accent: '#6BCB77', emoji: '🧩', eyebrow: 'Free Printable' },
  { page: 'books/colouring-book.html',                 slug: 'book-colouring', title: 'Free Colouring Kit',              tag: 'Printable pages with Lumo, Echo & friends.',   accent: '#ff6b9d', emoji: '🖍️', eyebrow: 'Free Printable' },
  { page: 'books/Echo_and_the_mountain_of_choice.html',slug: 'book-echo',      title: 'Echo and the Mountain of Choices',tag: 'A picture book about decisions & resilience.', accent: '#63c7ff', emoji: '🏔️', eyebrow: 'JVDesignStudio Books' },
  { page: 'books/next_book_projects.html',             slug: 'book-next',      title: 'Next Book Projects',              tag: 'Upcoming picture books from J. Valentine.',    accent: '#F2A541', emoji: '📖', eyebrow: 'Coming Soon' },

  // ── Tools ──
  { page: 'tools/bitmap-font-maker.html', slug: 'tool-bitmapfont', title: 'Bitmap Font Maker', tag: 'Draw pixel fonts, preview live, export PNG.',        accent: '#00b894', emoji: '🔤', eyebrow: 'Free Dev Tool' },
  { page: 'tools/game-logo-maker.html',   slug: 'tool-logomaker',  title: 'Game Logo Maker',   tag: 'Design your game logo right in the browser.',        accent: '#6c5ce7', emoji: '🎨', eyebrow: 'Free Dev Tool' },
  { page: 'tools/icon-generator.html',    slug: 'tool-icongen',    title: 'Icon Generator',    tag: 'Pixel-art icons for your Quest Board RPG.',          accent: '#F2A541', emoji: '🎯', eyebrow: 'Free Dev Tool' },
  { page: 'tools/music-maker.html',       slug: 'tool-musicmaker', title: 'Music Maker',       tag: 'Make beats & melodies in your browser.',  accent: '#fd79a8', emoji: '🎹', eyebrow: 'Free Dev Tool' },
  { page: 'tools/sprite-animator.html',   slug: 'tool-spriteanim', title: 'Sprite Animator',   tag: 'Upload a spritesheet, preview animation live.',      accent: '#00d2ff', emoji: '🎞️', eyebrow: 'Free Dev Tool' },
  { page: 'tools/quest-board-page.html',  slug: 'tool-questlog',   title: 'QuestLog',          tag: 'Turn tasks & habits into an RPG. Earn XP, level up.',accent: '#8a5cf0', emoji: '⚔️', eyebrow: 'Free RPG App' },
  { page: 'tools/quest-board.html',       slug: 'tool-questboard', title: 'Quest Board RPG',   tag: 'Turn daily tasks into quests. Defeat boss challenges.',accent: '#8a5cf0', emoji: '🛡️', eyebrow: 'Free RPG App' },

  // ── Utility ──
  { page: '404.html',     slug: 'sys-404',     title: 'Lost in the Meadow', tag: 'Find your way back to books, games & adventures.', accent: '#6BCB77', emoji: '🌿', eyebrow: 'Page Not Found' },
  { page: 'offline.html', slug: 'sys-offline', title: "You're Offline",     tag: 'Reconnect to reach games, books & tools.',        accent: '#636e72', emoji: '📡', eyebrow: 'Offline' },
];

// Pages wired to existing real artwork instead of a generated card.
const ART = [
  { page: 'pages/learn-hub.html',         url: OG + 'learn.png' },
  { page: 'pages/my-progress.html',       url: OG + 'my-progress.png' },
  { page: 'pages/discovery_session.html', url: BASE + 'Discovery%20Sessions.png' },
];

function darken(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.round(((n >> 16) & 255) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)})`;
}
function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function html(g) {
  const F = "'Segoe UI Semibold','Trebuchet MS',sans-serif";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1200px;height:630px}
  .card{width:1200px;height:630px;position:relative;overflow:hidden;
    background:radial-gradient(1100px 700px at 82% 18%, ${g.accent}44 0%, transparent 55%),
      linear-gradient(135deg, ${darken(g.accent,0.32)} 0%, #14100f 62%, #0c0a0a 100%);
    font-family:'Segoe UI','Trebuchet MS',sans-serif;color:#fff}
  .grain{position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.05) 1px,transparent 1px);background-size:26px 26px;opacity:.5}
  .wrap{position:absolute;inset:0;display:flex;align-items:center;padding:0 72px;gap:40px}
  .left{flex:1}
  .eyebrow{display:inline-flex;align-items:center;gap:10px;font-family:${F};font-weight:600;letter-spacing:.14em;text-transform:uppercase;font-size:22px;color:${g.accent};filter:brightness(1.55);margin-bottom:22px}
  .eyebrow .dot{width:10px;height:10px;border-radius:50%;background:${g.accent};box-shadow:0 0 16px ${g.accent}}
  h1{font-family:${F};font-weight:700;font-size:${g.title.length>22?68:88}px;line-height:1.0;margin-bottom:24px;letter-spacing:-0.01em;text-shadow:0 4px 30px rgba(0,0,0,.4)}
  .tag{font-size:33px;font-weight:500;color:#e9e2dc;max-width:640px;line-height:1.28}
  .art{width:300px;height:300px;flex:none;border-radius:44px;display:flex;align-items:center;justify-content:center;font-size:176px;
    background:linear-gradient(145deg,rgba(255,255,255,.16),rgba(255,255,255,.03));border:1px solid rgba(255,255,255,.14);
    box-shadow:0 30px 80px rgba(0,0,0,.45),inset 0 2px 0 rgba(255,255,255,.15)}
  .brand{position:absolute;bottom:44px;left:72px;display:flex;align-items:center;gap:16px}
  .brand img{width:52px;height:52px;border-radius:12px}
  .brand span{font-family:${F};font-weight:600;font-size:26px;color:#f2ece6}
  </style></head><body><div class="card"><div class="grain"></div>
  <div class="wrap"><div class="left">
    <div class="eyebrow"><span class="dot"></span>${esc(g.eyebrow)}</div>
    <h1>${esc(g.title)}</h1><div class="tag">${esc(g.tag)}</div>
  </div><div class="art">${g.emoji}</div></div>
  <div class="brand"><img src="data:image/png;base64,${logoB64}"><span>jvdesignstudio.co.uk</span></div>
  </div></body></html>`;
}

// Rewrite og:image + twitter:image on a page; add twitter:image if missing.
function wire(pageRel, url) {
  const p = path.join(ROOT, pageRel);
  let src = fs.readFileSync(p, 'utf8');
  const before = src;
  src = src.replace(/(property="og:image"\s+content=")[^"]*(")/, `$1${url}$2`);
  if (/name="twitter:image"/.test(src)) {
    src = src.replace(/(name="twitter:image"\s+content=")[^"]*(")/, `$1${url}$2`);
  } else {
    const re = /^([ \t]*)(<meta\s+property="og:image"\s+content="[^"]*"\s*>)/m;
    if (re.test(src)) src = src.replace(re, `$1$2\n$1<meta name="twitter:image" content="${url}">`);
  }
  if (src !== before) { fs.writeFileSync(p, src, 'utf8'); return true; }
  return false;
}

(async () => {
  if (!fs.existsSync(OGDIR)) fs.mkdirSync(OGDIR);
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  for (const g of CARDS) {
    await page.setContent(html(g), { waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: path.join(OGDIR, `${g.slug}.png`), type: 'png', clip: { x: 0, y: 0, width: 1200, height: 630 } });
  }
  await browser.close();
  console.log(`Generated ${CARDS.length} cards → og/`);

  let wired = 0;
  for (const g of CARDS) if (wire(g.page, OG + g.slug + '.png')) wired++;
  for (const a of ART)   if (wire(a.page, a.url)) wired++;
  console.log(`Wired ${wired}/${CARDS.length + ART.length} pages.`);
})();
