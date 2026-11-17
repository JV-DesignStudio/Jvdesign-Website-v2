/**
 * add-learn-hub-ctas.cjs
 * Adds an "engine hub" CTA bar to each /learn/ page, right after the hero section.
 * This creates clear SEO differentiation: learn pages = informational guides,
 * engine hubs = workshop listings.
 * Run: node scripts/add-learn-hub-ctas.cjs
 */
const fs = require('fs');
const path = require('path');

const LEARN_DIR = path.resolve(__dirname, '../learn');

// Map: learn page filename → { hub href, hub label, engine name }
const PAGES = {
  'scratch-for-kids.html':              { href: '/workshops/engine-scratch.html',       label: 'Open all Scratch workshops', engine: 'Scratch' },
  'godot-for-beginners.html':           { href: '/workshops/engine-godot.html',         label: 'Open all Godot workshops',   engine: 'Godot' },
  'unity-for-beginners.html':           { href: '/workshops/engine-unity.html',         label: 'Open all Unity workshops',   engine: 'Unity' },
  'roblox-studio-beginner-tutorials.html': { href: '/workshops/engine-roblox.html',     label: 'Open all Roblox workshops',  engine: 'Roblox Studio' },
  'minecraft-modding-for-beginners.html':  { href: '/workshops/engine-minecraft.html',  label: 'Open all Minecraft workshops', engine: 'Minecraft' },
  'gamemaker-for-beginners.html':       { href: '/workshops/engine-gml-gamemaker.html', label: 'Open all GameMaker workshops', engine: 'GameMaker' },
  'pico8-for-beginners.html':           { href: '/workshops/engine-pico-8.html',        label: 'Open all Pico-8 workshops',  engine: 'Pico-8' },
  'python-games-for-kids.html':         { href: '/workshops/engine-python.html',        label: 'Open all Python workshops',  engine: 'Python' },
  'java-game-tutorial.html':            { href: '/workshops/engine-java.html',          label: 'Open all Java workshops',    engine: 'Java' },
  'cpp-game-tutorial.html':             { href: '/workshops/engine-cpp.html',           label: 'Open all C++ workshops',     engine: 'C++' },
  'how-to-make-a-game-for-kids.html':   { href: '/workshops/start-here.html',           label: 'Find your first workshop',   engine: null },
  'coding-for-kids.html':               { href: '/workshops/start-here.html',           label: 'Find your first workshop',   engine: null },
  'make-a-game-on-a-school-chromebook.html': { href: '/workshops/start-here.html',      label: 'Find a no-install workshop', engine: null },
  'best-free-game-making-tools-for-kids.html': { href: '/create',                       label: 'Open all free tools',        engine: null },
};

const MARKER = 'data-learn-hub-cta="added"';

for (const [file, info] of Object.entries(PAGES)) {
  const filePath = path.join(LEARN_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.warn(`skip (missing): ${file}`);
    continue;
  }
  let html = fs.readFileSync(filePath, 'utf8');
  if (html.includes(MARKER)) {
    console.log(`skip (already done): ${file}`);
    continue;
  }

  const ctaBlock = `
  <!-- SEO: guide → workshop hub link (A2649) -->
  <div class="lh-hub-cta" ${MARKER}>
    <div class="lh-hub-cta-inner">
      <span class="lh-hub-cta-text">${info.engine ? `Ready to build? The step-by-step <strong>${info.engine} workshops</strong> are free and need no account.` : 'Ready to build? The free step-by-step workshops need no account to start.'}</span>
      <a class="lh-hub-cta-btn" href="${info.href}">${info.label} →</a>
    </div>
  </div>
`;

  // Insert after </section> that follows the .lh-hero (the first </section>)
  const heroClose = '</section>\n\n  <div class="lh-callout">';
  const heroCloseAlt = '</section>\n\n  <section';
  const heroCloseAlt2 = '</section>\n\n<section';

  if (html.includes(heroClose)) {
    html = html.replace(heroClose, '</section>\n' + ctaBlock + '\n  <div class="lh-callout">');
  } else if (html.includes(heroCloseAlt)) {
    html = html.replace(heroCloseAlt, '</section>\n' + ctaBlock + '\n  <section');
  } else if (html.includes(heroCloseAlt2)) {
    html = html.replace(heroCloseAlt2, '</section>\n' + ctaBlock + '\n<section');
  } else {
    // Fallback: insert after </header>
    html = html.replace('</header>\n<!-- /BUILD:nav-content -->', '</header>\n<!-- /BUILD:nav-content -->\n' + ctaBlock);
    if (!html.includes(MARKER)) {
      console.warn(`could not find insertion point: ${file}`);
      continue;
    }
  }

  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`✓ ${file}`);
}

console.log('\nDone.');
