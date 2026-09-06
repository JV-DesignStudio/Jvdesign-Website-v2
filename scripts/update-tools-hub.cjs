const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const hubPath = path.join(root, 'pages', 'dev-tools.html');
let html = fs.readFileSync(hubPath, 'utf8');

html = html
  .replace(/content="60 tools for game devs\.[^"]+"/g, 'content="40+ browser tools and guides for game devs. Draw sprites, make music, design levels, write dialogue, plan your game and find quick engine references."')
  .replace(/content="60 tools for game developers\.[^"]+"/g, 'content="40+ tools and guides for game developers. Pixel art, music, 3D models, level design, SFX, character design and more."')
  .replace(/content="60 free browser-based tools for game developers\.[^"]+"/g, 'content="40+ free browser-based tools and guides for game developers. Pixel art, music, 3D models, level design, SFX, character design and more."')
  .replace('<div class="hero-stat-num">30</div>', '<div class="hero-stat-num">40+</div>')
  .replace('<div class="stat-number">30+</div>', '<div class="stat-number">40+</div>');

const tools = [
  ['Make Art', '🎨', [
    ['Pixel Studio', 'Draw and animate pixel art with layers, frames, onion skinning, mirror mode, autosave and GIF / spritesheet export.', '../tools/pixel-studio.html', '../PixelStudioCover.webp', ['Pixel Art', 'Animation', 'Export']],
    ['Character Designer', 'Build characters from templates, customise parts, pose them, save presets and export spritesheets, GIFs, PNGs or JSON.', '../tools/character-designer.html', '../CharacterCreatorCover.webp', ['Characters', 'Sprites', 'Batch']],
    ['Sprite Animator', 'Upload a spritesheet, choose frames, preview animation timing live and export frame data for your engine.', '../tools/sprite-animator.html', null, ['Spritesheet', 'Preview', 'JSON']],
    ['Bitmap Font Maker', 'Draw pixel fonts character by character, preview text and export spritesheets, atlases or BMFont XML.', '../tools/bitmap-font-maker.html', null, ['Fonts', 'Atlas', 'BMFont']],
    ['Trading Card Designer', 'Create character cards with templates, rarities, stats, uploaded art and PNG export.', '../tools/trading-card-designer.html', '../CardMakerCoverImage.webp', ['Cards', 'Stats', 'PNG']],
    ['Game Logo Maker', 'Design a title logo with presets, fonts, outlines, glow, gradients and export sizes for stores and splash screens.', '../tools/game-logo-maker.html', null, ['Logo', 'Branding', 'PNG']]
  ]],
  ['Make Audio', '🎵', [
    ['Music Maker', 'Compose full tracks with a beat sequencer, piano roll, synth presets, save/load and WAV export.', '../tools/music-maker.html', null, ['Sequencer', 'Piano Roll', 'WAV']],
    ['Sound Studio', 'Create 16-bit chiptune melodies and retro effects with waveforms, envelopes, bit crush and reverb.', '../tools/sound-studio.html', '../SoundStudioCover.webp', ['Chiptune', 'SFX', 'WAV']],
    ['SFX Studio', 'Generate arcade, puzzle, platformer and RPG sound effects, tune the sound, then download game-ready WAV files.', '../tools/sfx-generator.html', '../SFXStudioCover.webp', ['Sound FX', 'Packs', 'Export']],
    ['Drum Pad', 'Tap beats, switch kits, use keyboard shortcuts and record loops for quick rhythm ideas.', '../tools/drum-pad.html', '../DrumPadDevToolCoverImage.webp', ['Beats', 'Kits', 'Loops']]
  ]],
  ['Build Worlds', '🧱', [
    ['BuildLab', 'Make Roblox-style 3D block models with shapes, paint, transforms, touch support and OBJ / GLTF / RBXM export.', '../tools/buildlab.html', '../BlockBuilderCover.webp', ['3D Models', 'Roblox', 'Export']],
    ['Level Designer', 'Draw 2D platformer levels on a tile grid with layers, fill tools, hazards, pickups and PNG / JSON export.', '../tools/level-designer.html', '../LevelDesignCover.webp', ['Levels', 'Tile Grid', 'JSON']],
    ['Map Generator', 'Generate dungeons, worlds and islands from a seed, edit by hand and export PNG or JSON tilemaps.', '../tools/map-generator.html', '../MapStudioImage.webp', ['Procedural', 'Worlds', 'Tilemaps']],
    ['Tileset Builder', 'Plan reusable tiles and export a compact tileset for your level workflow.', '../tools/tileset-builder.html', null, ['Tiles', 'Canvas', 'Export']],
    ['Particle Designer', 'Design fire, smoke, sparks, magic and other VFX with curves, gradients and engine-friendly exports.', '../tools/particle-designer.html', '../ParticleDesignCoverImage.webp', ['VFX', 'Godot', 'Unity']]
  ]],
  ['Plan & Write', '📋', [
    ['GDD Builder', 'Fill out a structured game design document with progress tracking, browser saves and PDF export.', '../tools/gdd-builder.html', '../GDDCover.webp', ['Game Design', 'PDF', 'Save']],
    ['Game Idea Generator', 'Spin up game-jam prompts with genre, theme, mechanic and twist when you need a fast creative spark.', '../tools/game-idea-generator.html', '../GameIdeaCoverImage.webp', ['Ideas', 'Game Jam', 'Random']],
    ['Story Editor', 'Create branching dialogue, character nodes, choices, endings, visual story links and JSON exports.', '../tools/story-editor.html', '../StodyEditorCover.webp', ['Dialogue', 'Story', 'JSON']],
    ['Dialogue Tree Builder', 'Sketch a playable conversation tree with canvas-based links and exportable story structure.', '../tools/dialogue-tree-builder.html', null, ['Dialogue', 'Nodes', 'Export']],
    ['Design Worksheets', 'Plan core ideas, audience, mechanics and scope before building.', '../tools/design-worksheet.html', null, ['Planning', 'Worksheet', 'Export']],
    ['Store Page Builder', 'Draft store page copy, feature lists and release messaging for a game project.', '../tools/store-page-builder.html', null, ['Launch', 'Copy', 'Planning']]
  ]],
  ['Build & Ship', '🚀', [
    ['Arcade Game Maker', 'Build and play a browser game from templates, tune physics, paste level maps and share a playable link.', '../tools/arcade-game-maker-landing.html', '../ArcadeMakerCoverImage.webp', ['Game Maker', 'Phaser', 'Share']],
    ['Screenshot Generator', 'Create polished screenshots and promo images for game pages or posts.', '../tools/screenshot-generator.html', null, ['Screenshots', 'Promo', 'Canvas']],
    ['Code Snippet Generator', 'Create starter snippets for common game-dev patterns and copy them into your project.', '../tools/code-snippet-generator.html', null, ['Code', 'Starter', 'Helper']],
    ['Error Guide', 'Look up common beginner bugs and get plain-language fixes.', '../tools/error-guide.html', null, ['Debugging', 'Guide', 'Beginner']],
    ['QuestLog', 'Turn projects, habits and daily work into quests with XP, boss tasks and local browser saves.', '../tools/quest-board-page.html', null, ['Productivity', 'RPG', 'PWA']],
    ['Icon Generator', 'Generate Quest Board-style pixel icons and download ready-sized PNGs.', '../tools/icon-generator.html', null, ['Icons', 'Pixel', 'PNG']]
  ]]
];

const references = [
  ['Scratch Starter Guide', '../tools/scratch-starter-guide.html'], ['Scratch Blocks', '../tools/scratch-cheatsheet.html'], ['Python Pygame', '../tools/python-cheatsheet.html'],
  ['JavaScript Canvas', '../tools/javascript-cheatsheet.html'], ['Java 2D', '../tools/java-cheatsheet.html'], ['C++ SFML', '../tools/cpp-cheatsheet.html'],
  ['Godot 4', '../tools/godot-cheatsheet.html'], ['Unity C#', '../tools/unity-cheatsheet.html'], ['Unity Setup', '../tools/unity-starter-setup.html'],
  ['Unreal Engine 5', '../tools/unreal-cheatsheet.html'], ['GDevelop', '../tools/gdevelop-cheatsheet.html'], ['GameMaker', '../tools/gamemaker-cheatsheet.html'],
  ['Defold', '../tools/defold-cheatsheet.html'], ['PICO-8', '../tools/pico8-cheatsheet.html'], ['Minecraft Mods', '../tools/minecraft-cheatsheet.html'],
  ['Roblox Lua', '../tools/roblox-cheatsheet.html'], ['Keyboard Shortcuts', '../tools/keyboard-shortcuts.html'], ['Glossary', '../tools/glossary.html'],
  ['Asset Packs', '../tools/asset-packs.html'], ['Certificate Generator', '../tools/certificate.html'], ['Parent & Teacher Guide', '../tools/parent-guide.html'],
  ['Colour Palette Library', '../tools/colour-palettes.html'], ['Story Player', '../tools/story-player.html'], ['Roblox Builder Move Note', '../tools/roblox-builder.html']
];

function card(tool, category) {
  const [title, desc, href, image, tags] = tool;
  const thumb = image
    ? `<img width="1024" height="572" loading="lazy" src="${image}" alt="${title} preview">`
    : `<span class="tool-emoji">${category[1]}</span>`;
  return `<a href="${href}" class="tool-card reveal" data-tool-card data-category="${category[0].toLowerCase()}" data-search="${[title, desc, tags.join(' '), category[0]].join(' ').toLowerCase()}">
    <div class="tool-thumb">
        <span class="tool-year">2026</span>
        ${thumb}
    </div>
    <div class="tool-body">
        <span class="tool-type">${category[0]}</span>
        <h3 class="tool-title">${title}</h3>
        <p class="tool-desc">${desc}</p>
        <div class="tool-tags">${tags.map(tag => `<span class="tool-tag">${tag}</span>`).join('')}</div>
        <span class="tool-cta">Open Tool →</span>
    </div>
</a>`;
}

const filterButtons = ['all', ...tools.map(([name]) => name.toLowerCase())]
  .map((name, index) => `<button class="filter-btn${index === 0 ? ' active' : ''}" data-filter="${name}">${index === 0 ? 'All Tools' : tools[index - 1][1] + ' ' + tools[index - 1][0]}</button>`)
  .join('\n        ');

const categoryMarkup = tools.map(category => {
  const [name, emoji, items] = category;
  return `<div class="tool-category" data-category="${name.toLowerCase()}">
        <div class="category-header">
            <span class="category-emoji">${emoji}</span>
            <span class="category-label">Category</span>
            <span class="category-title">${name}</span>
            <span class="category-count">${items.length} tools</span>
        </div>
        <div class="tools-grid">
${items.map(item => card(item, category)).join('\n')}
        </div>
    </div>`;
}).join('\n\n    ');

const referenceMarkup = references.map(([label, href]) => `<a href="${href}" class="reference-pill">${label}</a>`).join('\n            ');

const replacement = `<!-- TOOLS GRID -->
<section class="tools-section">
    <div class="section-header reveal">
        <span class="section-eyebrow">🔧 Creator Toolbox</span>
        <h2 class="section-title">Pick What You Need Right Now</h2>
        <p class="section-sub">Start with a flagship creator tool, then jump into quick guides and cheat sheets when you need help with a specific engine.</p>
    </div>

    <div class="tool-search-wrap">
        <input type="text" id="toolSearch" placeholder="Search by tool, export, engine, or task..." oninput="filterToolsBySearch(this.value)">
        <div id="searchResults" class="search-results" hidden></div>
    </div>

    <div class="tool-filters" aria-label="Tool categories">
        ${filterButtons}
    </div>

    ${categoryMarkup}

    <div class="reference-library reveal">
        <div>
            <span class="section-eyebrow">📚 Quick References</span>
            <h2 class="section-title">Cheat Sheets, Guides & Extras</h2>
            <p class="section-sub">These are lighter resources rather than full editors, so they now live together where they are easier to scan.</p>
        </div>
        <div class="reference-grid">
            ${referenceMarkup}
        </div>
    </div>
</section>

<!-- TRY THIS FIRST SECTION -->`;

html = html.replace(/<!-- TOOLS GRID -->[\s\S]*?<!-- TRY THIS FIRST SECTION -->/, replacement);

html = html.replace(/<section class="testimonials-section">[\s\S]*?<!-- TOOL STATS SECTION -->/, '<!-- TOOL STATS SECTION -->');
html = html.replace('<span style="font-size:0.7rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--purple-lt);">📊 Tool Analytics</span>', '<span style="font-size:0.7rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--purple-lt);">📊 Tool Highlights</span>');
html = html.replace('Most Used Tools', 'Flagship Tools');
html = html.replace('Based on community usage and feature completeness', 'A practical starting shelf for the tools that carry the most creator workflows');

const script = `<script>
(function(){
    var categories = [].slice.call(document.querySelectorAll('.tool-category'));
    var cards = [].slice.call(document.querySelectorAll('[data-tool-card]'));
    var filterBtns = [].slice.call(document.querySelectorAll('.filter-btn'));
    var searchInput = document.getElementById('toolSearch');
    var searchResults = document.getElementById('searchResults');
    var activeFilter = 'all';

    function setSearchMessage(text, hidden) {
        if (!searchResults) return;
        searchResults.textContent = text;
        searchResults.hidden = hidden;
    }

    function applyFilter(filter){
        activeFilter = filter || 'all';
        filterBtns.forEach(function(btn){
            btn.classList.toggle('active', btn.getAttribute('data-filter') === activeFilter);
        });
        categories.forEach(function(cat){
            var catName = cat.getAttribute('data-category');
            cat.style.display = activeFilter === 'all' || catName === activeFilter ? '' : 'none';
        });
        cards.forEach(function(card){ card.style.display = ''; });
        setSearchMessage('', true);
    }

    filterBtns.forEach(function(btn){
        btn.addEventListener('click', function(){
            if(searchInput) searchInput.value = '';
            applyFilter(btn.getAttribute('data-filter'));
        });
    });

    function filterToolsBySearch(query){
        var q = (query || '').toLowerCase().trim();
        if(!q){
            applyFilter(activeFilter);
            return;
        }
        var shown = 0;
        categories.forEach(function(cat){ cat.style.display = ''; });
        cards.forEach(function(card){
            var match = (card.getAttribute('data-search') || '').indexOf(q) !== -1;
            card.style.display = match ? '' : 'none';
            if(match) shown++;
        });
        categories.forEach(function(cat){
            var visible = [].slice.call(cat.querySelectorAll('[data-tool-card]')).some(function(card){
                return card.style.display !== 'none';
            });
            cat.style.display = visible ? '' : 'none';
        });
        filterBtns.forEach(function(btn){ btn.classList.remove('active'); });
        setSearchMessage(shown + ' tool' + (shown !== 1 ? 's' : '') + ' found for "' + query + '"', false);
    }

    window.filterToolsBySearch = filterToolsBySearch;
})();
</script>`;

html = html.replace(/<script>\s*\(function\(\)\{\s*var cards = \[\][\s\S]*?<\/script>/, script);

fs.writeFileSync(hubPath, html, 'utf8');

