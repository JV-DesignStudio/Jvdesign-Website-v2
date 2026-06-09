#!/usr/bin/env node
// migrate.js — adds BUILD markers to pages missing them, removes inline nav CSS,
// and adds style-shared.css link where missing.
// Run once: node migrate.js
// Then run: node build.js

const fs   = require('fs');
const path = require('path');
const ROOT = __dirname;

// Pages that use the dark jvds-site-nav and should get nav-tools + footer-tools
const TOOL_PAGES = new Set([
    'dev-tools.html',
    'pixel-studio.html', 'sound-studio.html', 'music-maker.html',
    'level-designer.html', 'sfx-generator.html', 'character-designer.html',
    'story-editor.html', 'colour-palette.html', 'arcade-game-maker.html',
    'arcade-game-maker-landing.html', 'icon-generator.html',
    'game-idea-generator.html', 'drum-pad.html',
    'bitmap-font-maker.html', 'dungeon-delve.html', 'game-logo-maker.html',
    'gdd-builder.html', 'map-generator.html', 'nuclear-blueprint.html',
    'particle-designer.html', 'pirate-cannon-builder.html',
    'pirate-ship-builder.html', 'roblox-builder.html', 'sprite-animator.html',
    'steampunk-airship-builder.html', 'trading-card-designer.html',
    'unity-2d-platformer.html', 'unity-top-down-shooter.html',
    'unreal-blueprint-shooter.html', 'unreal-top-down-shooter.html',
]);

// Regex that matches the full inline jvds nav CSS block
// Starts at .jvds-site-nav{position:sticky and ends at the final @media line
const NAV_CSS_RE = /\.jvds-site-nav\{position:sticky[\s\S]*?@media\(min-width:861px\)\{\.jvds-mobile-nav\{display:none!important;\}\}\n?/g;

function ensureStyleLink(src) {
    if (src.includes('style-shared.css')) return src;
    // Insert before </head>
    return src.replace('</head>', '<link rel="stylesheet" href="/style-shared.css">\n</head>');
}

function removeInlineNavCss(src) {
    return src.replace(NAV_CSS_RE, '');
}

function wrapNav(src, marker) {
    const HEADER_CLASS = '<header class="jvds-site-nav"';
    const start = src.indexOf(HEADER_CLASS);
    if (start === -1) return src; // no nav to wrap

    // Find </header>
    const headerEnd = src.indexOf('</header>', start);
    if (headerEnd === -1) return src;
    const afterHeader = headerEnd + '</header>'.length;

    // Look for the inline nav toggle <script> immediately after (within ~10 chars of whitespace)
    const snippet = src.slice(afterHeader, afterHeader + 20);
    let blockEnd = afterHeader;
    if (snippet.trim().startsWith('<script>')) {
        const scriptTagStart = afterHeader + src.slice(afterHeader).indexOf('<script>');
        const scriptTagEnd   = src.indexOf('</script>', scriptTagStart) + '</script>'.length;
        blockEnd = scriptTagEnd;
    }

    const navBlock = src.slice(start, blockEnd);
    return (
        src.slice(0, start) +
        `<!-- BUILD:${marker} -->\n${navBlock}\n<!-- /BUILD:${marker} -->` +
        src.slice(blockEnd)
    );
}

function wrapFooter(src, marker) {
    const start = src.lastIndexOf('<footer');
    if (start === -1) return src;
    const end = src.indexOf('</footer>', start);
    if (end === -1) return src;
    const blockEnd = end + '</footer>'.length;

    const footerBlock = src.slice(start, blockEnd);
    return (
        src.slice(0, start) +
        `<!-- BUILD:${marker} -->\n${footerBlock}\n<!-- /BUILD:${marker} -->` +
        src.slice(blockEnd)
    );
}

let changed = 0;
let skipped = 0;

const htmlFiles = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

htmlFiles.forEach(file => {
    const filePath = path.join(ROOT, file);
    let src = fs.readFileSync(filePath, 'utf8');

    // Skip if already has nav BUILD markers
    if (src.includes('<!-- BUILD:nav')) {
        skipped++;
        return;
    }

    // Skip if no jvds-site-nav header at all
    if (!src.includes('<header class="jvds-site-nav"')) {
        skipped++;
        return;
    }

    const isTool     = TOOL_PAGES.has(file);
    const navMarker  = isTool ? 'nav-tools'    : 'nav-content';
    const footMarker = isTool ? 'footer-tools' : 'footer-content';

    src = ensureStyleLink(src);
    src = removeInlineNavCss(src);
    src = wrapNav(src, navMarker);
    src = wrapFooter(src, footMarker);

    fs.writeFileSync(filePath, src, 'utf8');
    console.log(`  migrated [${isTool ? 'tools' : 'content'}]: ${file}`);
    changed++;
});

console.log(`\nDone. ${changed} migrated, ${skipped} skipped.`);
