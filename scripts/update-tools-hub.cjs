const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const hubPath = path.join(root, 'pages', 'dev-tools.html');
let html = fs.readFileSync(hubPath, 'utf8');

html = html
  .replace(/content="60 tools for game devs\.[^"]+"/g, 'content="Workshop companion tools and developer utilities for game devs. Follow tutorials, draw sprites, make audio, design levels, build prototypes and export assets in your browser."')
  .replace(/content="60 tools for game developers\.[^"]+"/g, 'content="Workshop companion tools and developer utilities for game developers. Follow tutorials, draw sprites, make audio, design levels, build prototypes and export assets."')
  .replace(/content="40\+ tools and guides for game developers\.[^"]+"/g, 'content="Workshop companion tools and developer utilities for game developers. Follow tutorials, draw sprites, make audio, design levels, build prototypes and export assets."')
  .replace(/content="60 free browser-based tools for game developers\.[^"]+"/g, 'content="Free workshop companion tools and developer utilities for game developers. Follow tutorials, draw sprites, make audio, design levels, build prototypes and export assets."')
  .replace('<div class="hero-stat-num">30</div>', '<div class="hero-stat-num">40+</div>')
  .replace('<div class="stat-number">30+</div>', '<div class="stat-number">40+</div>');

const tools = [
  ['Asset Pipeline', '🎨', [
    ['Pixel Studio', 'Unified pixel art studio — Simple 8×8-32×32 for kids, plus character templates (humanoid/creature/chibi/top-down), layers, frames, onion skin, spritesheet & GIF export. One studio, no installs.', '../tools/pixel-studio.html', '../PixelStudioCover.webp', ['Pixel Art','Characters','Animation','Easy'], ['PNG','GIF','Spritesheet','JSON']],
    ['Easy Pixel Art', 'Quick 8×8-32×32 starter with 16 colours and big pixels — now also Simple mode inside Pixel Studio. No account.', '../tools/easy-pixel-art.html', '../PixelStudioCover.webp', ['Beginner', 'Pixel Art', 'Easy'], ['PNG','Share','8×8','16×16']],
    ['Sprite Animator', 'Upload a spritesheet, choose frames, preview timing and export packs — also available as Animate + sheet import in Pixel Studio.', '../tools/sprite-animator.html', null, ['Spritesheet', 'Preview', 'JSON'], ['GIF','PNG','JSON','ZIP']],
    ['Bitmap Font Maker', 'Draw pixel fonts character by character, preview text and export spritesheets, atlases or BMFont XML.', '../tools/bitmap-font-maker.html', null, ['Fonts', 'Atlas', 'BMFont'], ['PNG','JSON','BMFont','ZIP']],
    ['Trading Card Designer', 'Create character cards with templates, rarities, stats, uploaded art and PNG export.', '../tools/trading-card-designer.html', '../CardMakerCoverImage.webp', ['Cards', 'Stats', 'PNG'], ['PNG','Print','JSON']],
  ]],
  ['Audio Pipeline', '🎵', [
    ['Audio Studio', 'Compose music, create chiptune sounds and generate game-ready sound effects in one friendly studio.', '../tools/sound-studio.html', '../SoundStudioCover.webp', ['Music', 'Sound FX', 'WAV'], ['WAV','MP3','Loop']],
    ['Drum Pad', 'Tap beats, switch kits, use keyboard shortcuts and record loops for quick rhythm ideas.', '../tools/drum-pad.html', '../DrumPadDevToolCoverImage.webp', ['Beats', 'Kits', 'Loops'], ['WAV','Loop','MIDI']]
  ]],
  ['Level & World Data', '🧱', [
    ['BuildLab', 'Make Roblox-style 3D block models with shapes, paint, transforms, touch support and OBJ / GLTF / RBXM export.', '../tools/buildlab.html', '../BlockBuilderCover.webp', ['3D Models', 'Roblox', 'Export'], ['OBJ','GLTF','RBXM']],
    ['World Builder', 'Build levels, generate maps, import tilesets, test play spaces and export game-ready world data.', '../tools/level-designer.html', '../LevelDesignCover.webp', ['Worlds', 'Levels', 'Tilesets'], ['JSON','Tilemap','PNG']],
    ['Particle Designer', 'Design fire, smoke, sparks, magic and other VFX with curves, gradients and engine-friendly exports.', '../tools/particle-designer.html', '../ParticleDesignCoverImage.webp', ['VFX', 'Godot', 'Unity'], ['JSON','Godot','Unity','PNG']]
  ]],
  ['Design Docs & Narrative', '📋', [
    ['Game Design Studio', 'Brainstorm ideas, plan core mechanics, write a full GDD and export your game plan from one studio.', '../tools/gdd-builder.html', '../GDDCover.webp', ['Ideas', 'Game Design', 'Worksheets'], ['PDF','JSON','GDD']],
    ['Story Editor', 'Create branching dialogue, character nodes, choices, endings, visual story links and JSON exports.', '../tools/story-editor.html', '../StodyEditorCover.webp', ['Dialogue', 'Story', 'JSON'], ['JSON','Dialog','Export']],
    ['Launch Studio', 'Create game logos, promo screenshots, store copy and release messaging from one launch workspace.', '../tools/store-page-builder.html', null, ['Logo', 'Screenshots', 'Store Copy'], ['PNG','Copy','Brand']]
  ]],
  ['Prototype, Debug & Ship', '🚀', [
    ['Arcade Game Maker', 'Prototype browser games from templates, tune physics, import art/audio/levels and share a playable build.', '../tools/arcade-game-maker.html', '../ArcadeMakerCoverImage.webp', ['Game Maker', 'Phaser', 'Share'], ['Share','HTML','Phaser']],
    ['Code Snippet Generator', 'Create starter snippets for common game-dev patterns and copy them into your project.', '../tools/code-snippet-generator.html', null, ['Code', 'Starter', 'Helper'], ['Snippet','JS','Copy']],
    ['Error Guide', 'Look up common beginner bugs and get plain-language fixes.', '../tools/error-guide.html', null, ['Debugging', 'Guide', 'Beginner'], ['Guide','Fix']],
    ['Game Planner', 'Turn game tasks, projects, bugs and polish passes into quests with progression, planning views and local saves.', '../tools/quest-board.html', null, ['Quests', 'Projects', 'Planning'], ['Quests','JSON','Plan']],
    ['Icon Generator', 'Generate Quest Board-style pixel icons and download ready-sized PNGs.', '../tools/icon-generator.html', null, ['Icons', 'Pixel', 'PNG'], ['PNG','Icon','32×32']]
  ]]
];

const developerWorkflow = [
  ['Asset exports', 'PNG, GIF, spritesheet, atlas and BMFont outputs for art and UI pipelines.'],
  ['Game data', 'JSON level, map, dialogue and character data that can move into real projects.'],
  ['Audio outputs', 'WAV loops, SFX and rhythm sketches for fast prototype feedback.'],
  ['Build support', 'Prototype templates, snippets, error help, store copy and task tracking.']
];

const references = [
  ['Scratch Starter Guide', '../tools/scratch-starter-guide.html'], ['Scratch Blocks', '../tools/scratch-cheatsheet.html'], ['Python Pygame', '../tools/python-cheatsheet.html'],
  ['JavaScript Canvas', '../tools/javascript-cheatsheet.html'], ['Java 2D', '../tools/java-cheatsheet.html'], ['C++ SFML', '../tools/cpp-cheatsheet.html'],
  ['Godot 4', '../tools/godot-cheatsheet.html'], ['Unity C#', '../tools/unity-cheatsheet.html'], ['Unity Setup', '../tools/unity-starter-setup.html'],
  ['Unreal Engine 5', '../tools/unreal-cheatsheet.html'], ['GDevelop', '../tools/gdevelop-cheatsheet.html'], ['GameMaker', '../tools/gamemaker-cheatsheet.html'],
  ['Defold', '../tools/defold-cheatsheet.html'], ['PICO-8', '../tools/pico8-cheatsheet.html'], ['Minecraft Mods', '../tools/minecraft-cheatsheet.html'],
  ['Roblox Lua', '../tools/roblox-cheatsheet.html'], ['Keyboard Shortcuts', '../tools/keyboard-shortcuts.html'], ['Glossary', '../tools/glossary.html'],
  ['Asset Packs', '../tools/asset-packs.html'], ['Certificate Generator', '../tools/certificate.html'], ['Parent & Teacher Guide', '../tools/parent-guide.html'],
  ['Palette Studio', '../tools/colour-palette.html'], ['Story Player', '../tools/story-player.html'], ['Roblox Builder Move Note', '../tools/roblox-builder.html']
];

const workshopCompanions = [
  { title: 'Scratch starter workshops', href: '../workshops/scratch-platformer-workshop.html', desc: 'Use the Scratch guide first, then make sprites and simple art for platformer, maze, clicker and catch lessons.', tools: ['Scratch Blocks', 'Pixel Studio', 'Game Design Studio'] },
  { title: 'Python game workshops', href: '../workshops/python-game-builder.html', desc: 'Keep the Pygame reference open while building dodgers, mazes, breakout games and platformers.', tools: ['Python Pygame', 'Pixel Studio', 'Audio Studio'] },
  { title: 'Browser game workshops', href: '../workshops/my-first-browser-game.html', desc: 'Move from canvas basics into playable prototypes with art, worlds and arcade-ready audio.', tools: ['JavaScript Canvas', 'Arcade Game Maker', 'World Builder'] },
  { title: 'Roblox creator workshops', href: '../workshops/roblox-creator-journey.html', desc: 'Plan a Roblox idea, build blocky models, and keep Lua help nearby during obby, tycoon and simulator sessions.', tools: ['BuildLab', 'Roblox Lua', 'Game Design Studio'] },
  { title: 'Unity, Unreal and engine lessons', href: '../workshops/unity-cheatsheet.html', desc: 'Use engine references with planning, audio and visual tools while shaping a more production-style project.', tools: ['Unity C#', 'Unreal Engine 5', 'Audio Studio'] },
  { title: '15-minute prototype sessions', href: '../workshops/my-first-video-game.html', desc: 'Start with an idea, assemble art and sound, then turn the workshop outcome into something playable fast.', tools: ['Game Design Studio', 'Arcade Game Maker', 'Audio Studio'] }
];

function workshopCompanionCard(item) {
  return '<a href="' + item.href + '" class="workshop-map-card reveal">' +
    '<span class="workshop-map-label">Workshop path</span>' +
    '<h3>' + item.title + '</h3>' +
    '<p>' + item.desc + '</p>' +
    '<div class="workshop-map-tools">' + item.tools.map(label => '<span class="workshop-chip">' + label + '</span>').join('') + '</div>' +
    '<span class="workshop-map-cta">Open workshop →</span>' +
    '</a>';
}

function card(tool, category) {
  const [title, desc, href, image, tags, outputs] = tool;
  const thumb = image
    ? `<img width="1024" height="572" loading="lazy" src="${image}" alt="${title} preview">`
    : `<span class="tool-emoji">${category[1]}</span>`;
  const searchExtras = outputs ? ' ' + outputs.join(' ').toLowerCase() : '';
  return `<a href="${href}" class="tool-card reveal" data-tool-card data-category="${category[0].toLowerCase()}" data-search="${[title, desc, tags.join(' '), category[0]].join(' ').toLowerCase()}${searchExtras}">
    <div class="tool-thumb">
        <span class="tool-year">2026</span>
        ${thumb}
    </div>
    <div class="tool-body">
        <span class="tool-type">${category[0]}</span>
        <h3 class="tool-title">${title}</h3>
        <p class="tool-desc">${desc}</p>
        <div class="tool-tags">${tags.map(tag => `<span class="tool-tag">${tag}</span>`).join('')}</div>
        ${outputs && outputs.length ? `<div class="tool-outputs">${outputs.map(o => `<span class="tool-output-badge">${o}</span>`).join('')}</div>` : ''}
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
const developerWorkflowMarkup = developerWorkflow.map(([title, desc]) => '<div class="dev-workflow-card reveal"><span>' + title + '</span><p>' + desc + '</p></div>').join('\n        ');
const workshopCompanionMarkup = workshopCompanions.map(workshopCompanionCard).join('\n    ');

const replacement = `<!-- TOOLS GRID -->
<section class="tools-section">
    <div class="section-header reveal">
        <span class="section-eyebrow">🧰 Game Development Toolbox</span>
        <h2 class="section-title">Build assets, data, prototypes and shipping materials</h2>
        <p class="section-sub">A practical shelf of browser-based development tools for making game assets, level data, audio, design docs, prototype builds, debugging help and launch materials.</p>
    </div>

    <div class="dev-workflow-grid" aria-label="Development workflow outputs">
        ${developerWorkflowMarkup}
    </div>

    <div class="tool-search-wrap">
        <input type="text" id="toolSearch" placeholder="Search exports, formats, engines, assets, bugs or tasks..." oninput="filterToolsBySearch(this.value)">
        <div id="searchResults" class="search-results" hidden></div>
    </div>

    <div class="workshop-map reveal" aria-labelledby="workshopCompanionMapTitle">
        <div class="workshop-map-head">
            <span class="section-eyebrow">🧭 Workshop Companion Map</span>
            <h2 id="workshopCompanionMapTitle" class="section-title">Start with the class, then open the matching tools</h2>
            <p class="section-sub">Each path points learners toward the tools that help them follow along, make assets, solve problems and keep building after the workshop ends.</p>
        </div>
        <div class="workshop-map-grid">
    ${workshopCompanionMarkup}
        </div>
    </div>

    <div class="tool-filters" aria-label="Tool categories">
        ${filterButtons}
    </div>

    ${categoryMarkup}

    <div class="reference-library reveal">
        <div>
            <span class="section-eyebrow">🧩 Engine References & Developer Cheatsheets</span>
            <h2 class="section-title">Cheatsheets, starters and quick references</h2>
            <p class="section-sub">Keep engine syntax, starter files, shortcuts and support references close while you build.</p>
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
