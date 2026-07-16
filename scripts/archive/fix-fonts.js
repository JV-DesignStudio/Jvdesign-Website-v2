#!/usr/bin/env node
// fix-fonts.js, removes JetBrains Mono from pages that don't need it,
// and removes duplicate @keyframes logo-shift / .reveal blocks from pages
// that load style-shared.css (which already defines them).
// Run: node fix-fonts.js

const fs   = require('fs');
const path = require('path');
const ROOT = __dirname;

// Pages that genuinely use monospace font (code blocks, GML editor, etc.)
const NEEDS_MONO = new Set([
    'dev-tools.html', 'pixel-studio.html', 'level-designer.html',
    'sfx-generator.html', 'sound-studio.html', 'music-maker.html',
    'character-designer.html', 'colour-palette.html', 'story-editor.html',
    'bitmap-font-maker.html', 'drum-pad.html', 'particle-designer.html',
    'game-idea-generator.html', 'arcade-game-maker.html', 'map-generator.html',
    'gdd-builder.html', 'trading-card-designer.html', 'roblox-builder.html',
    'sprite-animator.html', 'game-logo-maker.html', 'dungeon-delve.html',
    'nuclear-blueprint.html', 'gml_shooter_trainer_project.html',
    'darkmode.html',
    // workshop pages with code snippets
    'castle-siege-blueprint.html', 'diablo-blueprint.html', 'fnaf-blueprint.html',
    'js-platformer-builder.html', 'python-game-builder.html',
    'cpp-tower-defence-builder.html', 'openrct2-modding-builder.html',
    'openrct2-swim-rescue.html', 'sci-fi-runner-builder.html',
    'unity-2d-platformer.html', 'unity-3d-platformer.html',
    'unity-top-down-shooter.html', 'unreal-2d-platformer.html',
    'unreal-blueprint-shooter.html', 'unreal-clicker-builder.html',
    'unreal-fighter-workshop.html', 'unreal-top-down-shooter.html',
    'unreal-zombie-survivor.html', 'race-builder.html', 'rocket-builder.html',
    'racing-blueprint.html', 'quest-board.html', 'quest-board-page.html',
    'project-tracker.html',
]);

// Duplicated CSS blocks that live in style-shared.css, safe to remove from pages
const DUPE_BLOCKS = [
    // logo-shift keyframe + class
    /@keyframes logo-shift\s*\{[^}]*\}\s*\.logo-name\s*\{[^}]*\}\s*/g,
    // reveal animation
    /\.reveal\s*\{[^}]*opacity:\s*0[^}]*\}\s*\.reveal\.visible\s*\{[^}]*\}\s*/g,
];

let fontsFixed = 0;
let cssFixed = 0;

fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).forEach(file => {
    let src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    let changed = false;

    // Remove JetBrains Mono from fonts link if page doesn't need it
    if (!NEEDS_MONO.has(file) && src.includes('JetBrains+Mono')) {
        src = src.replace(/&family=JetBrains\+Mono:[^&"']*/g, '');
        changed = true;
        fontsFixed++;
    }

    // Remove duplicate CSS blocks from pages that load style-shared.css
    if (src.includes('style-shared.css')) {
        DUPE_BLOCKS.forEach(re => {
            const updated = src.replace(re, '');
            if (updated !== src) { src = updated; changed = true; }
        });
        if (changed) cssFixed++;
    }

    if (changed) fs.writeFileSync(path.join(ROOT, file), src, 'utf8');
});

console.log(`Fonts fixed: ${fontsFixed} pages`);
console.log(`Duplicate CSS removed: ${cssFixed} pages`);
