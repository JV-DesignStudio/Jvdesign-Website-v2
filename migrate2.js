#!/usr/bin/env node
// migrate2.js — handles the 27 pages skipped by migrate.js:
// - adds BUILD:nav-strip markers to jvds-strip game pages
// - adds BUILD:nav-content to no-nav pages that need it
// - adds BUILD:footer-content markers where footers exist
// - adds style-shared.css link if missing
// Run: node migrate2.js  then  node build.js

const fs   = require('fs');
const path = require('path');
const ROOT = __dirname;

// Game pages that use the floating strip nav
const STRIP_PAGES = new Set([
    'arcane_citadel.html', 'cozy-biscuit-clicker.html', 'cozy-cafe-match-game.html',
    'sky_high_squirt.html', 'tiger_smash.html',
]);

// Tool/blueprint pages that need nav-content injected (currently have no nav)
const TOOL_NAV_PAGES = new Set([
    'castle-siege-blueprint.html', 'diablo-blueprint.html', 'fnaf-blueprint.html',
    'icon-generator.html', 'mugen-ai-workshop.html', 'project-tracker-v3.html',
    'project-tracker.html', 'quest-board.html', 'race-builder.html',
    'racing-blueprint.html', 'rocket-builder.html', 'unreal-2d-platformer.html',
    'unreal-fighter-workshop.html', 'unreal-zombie-survivor.html',
    'crypt-crawlers.html', 'pips_night_sky.html', 'little_steps.html',
    'discovery_session.html', 'links.html', 'darkmode.html',
    'privacy-policy.html', 'offline.html',
]);

function ensureStyleLink(src) {
    if (src.includes('style-shared.css')) return src;
    return src.replace('</head>', '<link rel="stylesheet" href="/style-shared.css">\n</head>');
}

// Remove inline jvds-strip CSS block
const STRIP_CSS_RE = /\/\*[^*]*SITE BACK STRIP[^*]*\*\/[\s\S]*?\/\* Tab that peeks out[\s\S]*?\/\*[^*]*\*\/\s*\n?/g;
const STRIP_CSS_RE2 = /\.jvds-strip\{[\s\S]*?\.jvds-tab\.hidden\{display:none;\}\n?/g;

function wrapStripNav(src) {
    const start = src.indexOf('<div class="jvds-strip"');
    if (start === -1) return src;
    // Find the tab button that follows
    const tabBtn = src.indexOf('<button class="jvds-tab"', start);
    if (tabBtn === -1) return src;
    const blockEnd = src.indexOf('>', tabBtn) + 1;
    // Also grab any inline script for open/close functions right after
    const afterTab = src.slice(blockEnd, blockEnd + 200).trimStart();
    let end = blockEnd;
    if (afterTab.startsWith('<script>')) {
        const scriptStart = blockEnd + src.slice(blockEnd).indexOf('<script>');
        end = src.indexOf('</script>', scriptStart) + '</script>'.length;
    }
    const block = src.slice(start, end);
    return (
        src.slice(0, start) +
        `<!-- BUILD:nav-strip -->\n${block}\n<!-- /BUILD:nav-strip -->` +
        src.slice(end)
    );
}

function insertNavContent(src) {
    // Insert BUILD:nav-content placeholder right after <body> (and optional skip link)
    const bodyIdx = src.indexOf('<body>');
    if (bodyIdx === -1) return src;
    const insertAt = bodyIdx + '<body>'.length;
    return (
        src.slice(0, insertAt) +
        '\n<!-- BUILD:nav-content -->\n<!-- /BUILD:nav-content -->' +
        src.slice(insertAt)
    );
}

function wrapFooter(src, marker) {
    const start = src.lastIndexOf('<footer');
    if (start === -1) return src;
    const end = src.indexOf('</footer>', start);
    if (end === -1) return src;
    const blockEnd = end + '</footer>'.length;
    const block = src.slice(start, blockEnd);
    return (
        src.slice(0, start) +
        `<!-- BUILD:${marker} -->\n${block}\n<!-- /BUILD:${marker} -->` +
        src.slice(blockEnd)
    );
}

let changed = 0;

fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).forEach(file => {
    if (!STRIP_PAGES.has(file) && !TOOL_NAV_PAGES.has(file)) return;

    let src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    if (src.includes('<!-- BUILD:nav')) return; // already done

    src = ensureStyleLink(src);

    if (STRIP_PAGES.has(file)) {
        src = src.replace(STRIP_CSS_RE, '').replace(STRIP_CSS_RE2, '');
        src = wrapStripNav(src);
        if (src.includes('<footer')) src = wrapFooter(src, 'footer-content');
    } else {
        // No existing nav — insert empty BUILD:nav-content block
        src = insertNavContent(src);
        if (src.includes('<footer')) src = wrapFooter(src, 'footer-content');
    }

    fs.writeFileSync(path.join(ROOT, file), src, 'utf8');
    console.log(`  migrated: ${file}`);
    changed++;
});

console.log(`\nDone. ${changed} file(s) updated.`);
