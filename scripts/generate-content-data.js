#!/usr/bin/env node
/**
 * generate-content-data.js
 * Scans all HTML pages and generates structured JSON content files
 * for the central data layer.
 *
 * Output:
 *   content/workshops.json
 *   content/games.json    (from games-registry.js + page scraping)
 *   content/tools.json    (from pages/dev-tools.html)
 *   content/books.json    (from pages/books.html)
 *   content/characters.json
 *   content/paths.json    (learning path definitions)
 *   content/stats.json    (aggregated counts)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'content');

/* ── Helpers ─────────────────────────────────────────────── */

function read(f) {
  try { return fs.readFileSync(f, 'utf8'); }
  catch { return ''; }
}

function walk(dir, ext) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const skip = ['node_modules', '.git', '.claude', 'partials', 'quest-board-deploy',
    '.github', 'og', 'icons', 'downloads', 'pitch-assets', 'social-posts', 'docs',
    'scripts', 'questlog-pwa', 'src', 'tests', 'chars', 'chars-orig', 'models',
    'covers', 'arcade-app'];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || skip.includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(full, ext));
    } else if (entry.name.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

function extract(html, re) {
  const m = html.match(re);
  return m ? m[1].trim() : '';
}

function slugFromFilename(file) {
  return path.basename(file, '.html');
}

/* ── WORKSHOPS ───────────────────────────────────────────── */

function generateWorkshops() {
  const files = walk(path.join(ROOT, 'workshops'), '.html');
  const workshops = [];
  const engines = {};

  for (const file of files) {
    const slug = slugFromFilename(file);
    const html = read(file);
    if (!html) continue;

    // Skip non-workshop pages
    if (slug === 'my-progress') continue;

    const title = extract(html, /<title>([^<|]+)/);
    const desc = extract(html, /<meta\s+name="description"\s+content="([^"]+)"/);
    const themeColor = extract(html, /<meta\s+name="theme-color"\s+content="([^"]+)"/);

    // Determine engine from filename prefix
    let engine = 'General';
    const prefixes = {
      'godot': 'Godot', 'scratch': 'Scratch', 'unity': 'Unity',
      'unreal': 'Unreal', 'roblox': 'Roblox', 'python': 'Python',
      'javascript': 'JavaScript', 'js-': 'JavaScript', 'cpp': 'C++',
      'gdevelop': 'GDevelop', 'defold': 'Defold', 'java-': 'Java',
      'gml': 'GML/GameMaker', 'pico8': 'PICO-8', 'blender': 'Blender',
      'mugen': 'MUGEN', 'tinkercad': 'TinkerCAD', 'minecraft': 'Minecraft',
      'openrct2': 'OpenRCT2'
    };
    for (const [prefix, eng] of Object.entries(prefixes)) {
      if (slug.startsWith(prefix)) { engine = eng; break; }
    }

    // Determine if it's a series landing page
    const isSeries = slug.startsWith('my-first-');

    // Determine difficulty from title/desc
    let difficulty = 'beginner';
    const combined = (title + ' ' + desc).toLowerCase();
    if (combined.includes('advanced') || combined.includes('procedural') || combined.includes('shaders')) difficulty = 'advanced';
    else if (combined.includes('intermediate') || combined.includes('part 2') || combined.includes('level 2')) difficulty = 'intermediate';

    // Determine age range
    let ageRange = '10+';
    if (combined.includes('ages 4') || combined.includes('ages 5') || combined.includes('tiny learners')) ageRange = '4-6';
    else if (combined.includes('ages 6') || combined.includes('ages 7') || combined.includes('ages 8')) ageRange = '7-9';
    else if (combined.includes('ages 10') || combined.includes('ages 12') || combined.includes('teen')) ageRange = '10-14';

    // Extract step count from workshop engine config
    let steps = 0;
    const stepMatch = html.match(/WORKSHOP_TOTAL\s*=\s*(\d+)/);
    if (stepMatch) steps = parseInt(stepMatch[1], 10);

    // Determine tags from title and desc
    const tags = [];
    if (combined.includes('platformer')) tags.push('platformer');
    if (combined.includes('racing')) tags.push('racing');
    if (combined.includes('shooter')) tags.push('shooter');
    if (combined.includes('puzzle')) tags.push('puzzle');
    if (combined.includes('rpg') || combined.includes('role play')) tags.push('rpg');
    if (combined.includes('horror')) tags.push('horror');
    if (combined.includes('tycoon')) tags.push('tycoon');
    if (combined.includes('simulator')) tags.push('simulator');
    if (combined.includes('obby')) tags.push('obby');
    if (combined.includes('story') || combined.includes('narrative')) tags.push('narrative');
    if (combined.includes('animation')) tags.push('animation');
    if (combined.includes('3d') || combined.includes('3D')) tags.push('3d');
    if (combined.includes('2d') || combined.includes('2D')) tags.push('2d');
    if (isSeries) tags.push('series');

    workshops.push({
      id: slug,
      title: title || slug,
      desc: desc || '',
      engine,
      difficulty,
      ageRange,
      type: isSeries ? 'series' : 'workshop',
      tags,
      steps,
      themeColor,
      cover: null,
      url: `/workshops/${slug}.html`
    });

    if (!engines[engine]) engines[engine] = 0;
    engines[engine]++;
  }

  // Sort by engine then title
  workshops.sort((a, b) => a.engine.localeCompare(b.engine) || a.title.localeCompare(b.title));

  console.log(`  workshops.json: ${workshops.length} entries`);
  console.log(`  Engines: ${Object.entries(engines).map(([k,v]) => `${k}(${v})`).join(', ')}`);

  return workshops;
}

/* ── GAMES ───────────────────────────────────────────────── */

function generateGames() {
  // Parse games-registry.js
  const regPath = path.join(ROOT, 'games-registry.js');
  const regSrc = read(regPath);

  // Extract the array via eval (safe for local build script)
  let games = [];
  try {
    const fn = new Function('const window = { JVDS_GAMES: [] };\n' + regSrc + ';\nreturn window.JVDS_GAMES;');
    games = fn();
  } catch (e) {
    console.error('  Failed to parse games-registry.js:', e.message);
    return [];
  }

  // Enrich with character associations and connected books
  const characterMap = {
    'lumo': { character: 'Lumo', emoji: '🦊' },
    'pip': { character: 'Pip', emoji: '🐢' },
    'echo': { character: 'Echo', emoji: '🦎' },
    'stardust': { character: 'Stardust', emoji: '✨' },
    'elara': { character: 'Elara', emoji: '🔮' }
  };

  const enriched = games.map(g => {
    let character = null;
    const lower = (g.title + ' ' + g.id).toLowerCase();
    for (const [key, val] of Object.entries(characterMap)) {
      if (lower.includes(key)) { character = val.character; break; }
    }

    return {
      id: g.id,
      title: g.title,
      tag: g.tag,
      emoji: g.emoji,
      category: g.cat,
      cover: g.cover,
      bg: g.bg,
      desc: g.desc,
      kids: g.kids || false,
      age: g.age || null,
      character,
      url: `/games/${g.file}`
    };
  });

  console.log(`  games.json: ${enriched.length} entries`);
  return enriched;
}

/* ── TOOLS ───────────────────────────────────────────────── */

function generateTools() {
  const html = read(path.join(ROOT, 'pages', 'dev-tools.html'));
  const tools = [];

  // Match tool cards: <a href="../tools/XXX.html" class="tool-card">
  const cardRe = /<a\s+href="[^"]*\/tools\/([^"]+\.html)"[^>]*class="tool-card[^"]*"[\s\S]*?<h3[^>]*>([^<]+)<\/h3>[\s\S]*?<p[^>]*class="tool-desc"[^>]*>([^<]+)<\/p>[\s\S]*?<\/a>/g;

  let match;
  while ((match = cardRe.exec(html)) !== null) {
    const [, file, rawTitle, desc] = match;
    const slug = file.replace('.html', '');

    // Determine category from surrounding context
    const before = html.substring(0, match.index);
    let category = 'General';
    const categoryMatches = [...before.matchAll(/<div class="tool-category" data-category="([^"]+)"/g)];
    const categoryKey = categoryMatches.length ? categoryMatches[categoryMatches.length - 1][1] : '';
    const categoryLabels = {
      'make art': 'Make Art',
      'make audio': 'Make Audio',
      'build worlds': 'Build Worlds',
      'plan & write': 'Plan & Write',
      'build & ship': 'Build & Ship',
      art: 'Art & Design',
      audio: 'Audio',
      '3d': '3D & Models',
      game: 'Game Dev',
      planning: 'Planning'
    };
    if (categoryLabels[categoryKey]) category = categoryLabels[categoryKey];

    // Check if coming soon
    const isComingSoon = html.substring(match.index, match.index + match[0].length + 200).includes('Coming Soon');

    // Extract tags
    const tagSection = html.substring(match.index, match.index + match[0].length);
    const tags = [];
    const tagRe = /<span class="tool-tag">([^<]+)<\/span>/g;
    let tagMatch;
    while ((tagMatch = tagRe.exec(tagSection)) !== null) {
      tags.push(tagMatch[1]);
    }

    tools.push({
      id: slug,
      title: rawTitle.replace(/\.\s*/g, '. ').trim(),
      desc: desc.trim(),
      category,
      tags,
      comingSoon: isComingSoon,
      url: `/tools/${file}`
    });
  }

  console.log(`  tools.json: ${tools.length} entries`);
  return tools;
}

/* ── BOOKS ───────────────────────────────────────────────── */

function generateBooks() {
  const books = [
    {
      id: 'lumo-and-the-grumble-grit',
      title: 'Lumo and the Grumble-Grit',
      theme: 'Anxiety · Resilience',
      ageRange: '4-8',
      character: 'Lumo',
      emoji: '🦊',
      cover: 'lumo-front-cover-concept-v001.webp',
      desc: 'A purple fox learns that carrying something heavy doesn\'t mean stopping — it means finding a quieter kind of strong.',
      status: 'published',
      url: '/books/lumo_and_the_grumble_grit.html'
    },
    {
      id: 'pip-and-the-night-sky',
      title: 'Pip & The Great Dark',
      theme: 'Fear of the Dark',
      ageRange: '3-7',
      character: 'Pip',
      emoji: '🐢',
      cover: 'pip-cover.webp',
      desc: 'A small tortoise afraid of the night sky discovers that the dark holds wonder, not just danger.',
      status: 'published',
      url: '/books/Pip_and_the_night_sky.html'
    },
    {
      id: 'echo-and-the-mountain-of-choices',
      title: 'Echo & the Mountain of Choices',
      theme: 'Courage · Choices',
      ageRange: '5-8',
      character: 'Echo',
      emoji: '🦎',
      cover: 'axo-adventure.webp',
      desc: 'An axolotl climbs a mountain one small try at a time — a story about resilience and thinking differently.',
      status: 'coming-soon',
      url: '/books/Echo_and_the_mountain_of_choice.html'
    },
    {
      id: 'elara-and-the-wire-web-key',
      title: 'Elara & the Wire-Web Key',
      theme: 'Online Safety',
      ageRange: '4-8',
      character: 'Elara',
      emoji: '🔮',
      cover: 'Elara.webp',
      desc: 'A heartwarming story about safe online exploration, clever thinking, and trusting the right people.',
      status: 'published',
      url: '/books/Elara.html'
    },
    {
      id: 'stardusts-cosmic-adventure',
      title: "Stardust's Cosmic Adventure",
      theme: 'Belonging · Space',
      ageRange: '2-6',
      character: 'Stardust',
      emoji: '✨',
      cover: 'front-cover-concept.webp',
      desc: 'A magical journey through the cosmos sparking wonder, curiosity, and a sense of belonging in the universe.',
      status: 'published',
      url: '/books/Stardust.html'
    }
  ];

  console.log(`  books.json: ${books.length} entries`);
  return books;
}

/* ── CHARACTERS ──────────────────────────────────────────── */

function generateCharacters() {
  const characters = [
    {
      id: 'lumo',
      name: 'Lumo',
      species: 'Fox',
      emoji: '🦊',
      color: '#6b4fa0',
      colorName: 'Purple',
      desc: 'A quiet fox who carries the Grumble-Grit — a heavy stone representing invisible struggles. Lumo teaches that strength isn\'t about never struggling, but about finding quieter ways to keep going.',
      books: ['lumo-and-the-grumble-grit'],
      games: ['garden-defense', 'lumo-firefly', 'lumo-dash'],
      tools: []
    },
    {
      id: 'pip',
      name: 'Pip',
      species: 'Tortoise',
      emoji: '🐢',
      color: '#f5a623',
      colorName: 'Amber',
      desc: 'A small tortoise who fears the night sky but discovers it holds wonder, not just danger. Pip represents curiosity overcoming fear.',
      books: ['pip-and-the-night-sky'],
      games: ['star-connect', 'bakery-empire'],
      tools: []
    },
    {
      id: 'echo',
      name: 'Echo',
      species: 'Axolotl',
      emoji: '🦎',
      color: '#3EC9A7',
      colorName: 'Teal',
      desc: 'An adventurous axolotl who faces choices one small try at a time. Echo represents courage, thinking differently, and the power of small steps.',
      books: ['echo-and-the-mountain-of-choices'],
      games: ['echo-flight', 'echo-fruit'],
      tools: []
    },
    {
      id: 'stardust',
      name: 'Stardust',
      species: 'Stardust particle',
      emoji: '✨',
      color: '#A78BFA',
      colorName: 'Violet',
      desc: 'A tiny speck of stardust drifting through the cosmos, searching for where they belong. Stardust represents wonder, curiosity, and the joy of exploration.',
      books: ['stardusts-cosmic-adventure'],
      games: ['stardust'],
      tools: []
    },
    {
      id: 'elara',
      name: 'Elara',
      species: 'Human',
      emoji: '🔮',
      color: '#c8b0e8',
      colorName: 'Lavender',
      desc: 'A clever explorer who navigates the Wire-Web with a magical key, learning about online safety and trusting the right people.',
      books: ['elara-and-the-wire-web-key'],
      games: [],
      tools: []
    }
  ];

  console.log(`  characters.json: ${characters.length} entries`);
  return characters;
}

/* ── LEARNING PATHS ──────────────────────────────────────── */

function generatePaths() {
  const paths = [
    {
      id: 'godot-beginner',
      title: 'Godot Beginner Path',
      emoji: '🎮',
      desc: 'From zero to your first Godot 4 game',
      color: '#478cbf',
      engine: 'Godot',
      ageRange: '10+',
      levels: [
        { title: 'Level 1: GDScript Basics', workshops: ['godot-gdscript-essentials'] },
        { title: 'Level 2: Your First Scene', workshops: ['godot-first-scene'] },
        { title: 'Level 3: 2D Platformer', workshops: ['godot-2d-platformer'] },
        { title: 'Level 4: Build a Complete Game', workshops: ['my-first-video-game'] }
      ],
      certificate: 'Junior Godot Developer'
    },
    {
      id: 'scratch-beginner',
      title: 'Scratch Beginner Path',
      emoji: '🐱',
      desc: 'Learn to code by making games in Scratch',
      color: '#FF7700',
      engine: 'Scratch',
      ageRange: '7-12',
      levels: [
        { title: 'Level 1: Scratch Basics', workshops: ['scratch-getting-started'] },
        { title: 'Level 2: Your First Game', workshops: ['my-first-scratch-game'] },
        { title: 'Level 3: Build a Platformer', workshops: ['scratch-platformer'] },
        { title: 'Level 4: Interactive Stories', workshops: ['scratch-story'] }
      ],
      certificate: 'Scratch Creator'
    },
    {
      id: 'roblox-beginner',
      title: 'Roblox Studio Path',
      emoji: '🟦',
      desc: 'Build and publish Roblox games',
      color: '#00b4ff',
      engine: 'Roblox',
      ageRange: '10+',
      levels: [
        { title: 'Level 1: Roblox Studio Basics', workshops: ['roblox-studio-basics'] },
        { title: 'Level 2: Build an Obby', workshops: ['roblox-obby-workshop'] },
        { title: 'Level 3: Tycoon', workshops: ['roblox-tycoon-workshop'] },
        { title: 'Level 4: Your First Game', workshops: ['my-first-roblox-studio-game'] }
      ],
      certificate: 'Roblox Developer'
    },
    {
      id: 'python-beginner',
      title: 'Python Game Dev Path',
      emoji: '🐍',
      desc: 'Learn Python by building games with Pygame',
      color: '#ff7700',
      engine: 'Python',
      ageRange: '10+',
      levels: [
        { title: 'Level 1: Python Basics', workshops: ['python-getting-started'] },
        { title: 'Level 2: Pygame Intro', workshops: ['python-pygame-intro'] },
        { title: 'Level 3: Build Breakout', workshops: ['python-breakout-workshop'] },
        { title: 'Level 4: Platformer', workshops: ['python-platformer-workshop'] }
      ],
      certificate: 'Python Game Developer'
    },
    {
      id: 'unity-beginner',
      title: 'Unity Beginner Path',
      emoji: '🟢',
      desc: 'Start building 2D games in Unity',
      color: '#5bc0f8',
      engine: 'Unity',
      ageRange: '12+',
      levels: [
        { title: 'Level 1: Unity Interface', workshops: ['unity-getting-started'] },
        { title: 'Level 2: 2D Basics', workshops: ['unity-2d-basics'] },
        { title: 'Level 3: 2D Platformer', workshops: ['unity-2d-platformer'] }
      ],
      certificate: 'Unity Beginner'
    },
    {
      id: 'tiny-learners-path',
      title: 'Tiny Learners Path',
      emoji: '🌱',
      desc: 'Creative play for ages 4-6',
      color: '#FF6B6B',
      engine: 'General',
      ageRange: '4-6',
      levels: [
        { title: 'Explore Activities', workshops: ['tiny-learners'] },
        { title: 'Draw & Create', workshops: ['tiny-learners'] }
      ],
      certificate: 'Tiny Creator'
    }
  ];

  console.log(`  paths.json: ${paths.length} entries`);
  return paths;
}

/* ── STATS ───────────────────────────────────────────────── */

function generateStats(workshops, games, tools, books) {
  const stats = {
    generated: new Date().toISOString(),
    workshops: workshops.length,
    games: games.length,
    tools: tools.filter(t => !t.comingSoon).length,
    books: books.length,
    engines: {},
    toolCategories: {}
  };

  workshops.forEach(w => {
    stats.engines[w.engine] = (stats.engines[w.engine] || 0) + 1;
  });

  tools.forEach(t => {
    stats.toolCategories[t.category] = (stats.toolCategories[t.category] || 0) + 1;
  });

  console.log(`  stats.json: ${stats.workshops} workshops, ${stats.games} games, ${stats.tools} tools, ${stats.books} books`);
  return stats;
}

/* ── MAIN ────────────────────────────────────────────────── */

function main() {
  console.log('Generating content data...');

  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  const workshops = generateWorkshops();
  const games = generateGames();
  const tools = generateTools();
  const books = generateBooks();
  const characters = generateCharacters();
  const paths = generatePaths();
  const stats = generateStats(workshops, games, tools, books);

  fs.writeFileSync(path.join(OUT, 'workshops.json'), JSON.stringify(workshops, null, 2));
  fs.writeFileSync(path.join(OUT, 'games.json'), JSON.stringify(games, null, 2));
  fs.writeFileSync(path.join(OUT, 'tools.json'), JSON.stringify(tools, null, 2));
  fs.writeFileSync(path.join(OUT, 'books.json'), JSON.stringify(books, null, 2));
  fs.writeFileSync(path.join(OUT, 'characters.json'), JSON.stringify(characters, null, 2));
  fs.writeFileSync(path.join(OUT, 'paths.json'), JSON.stringify(paths, null, 2));
  fs.writeFileSync(path.join(OUT, 'stats.json'), JSON.stringify(stats, null, 2));

  console.log('\nDone. Files written to content/');
}

main();
