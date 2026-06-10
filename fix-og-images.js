#!/usr/bin/env node
// fix-og-images.js — sets unique og:image and twitter:image per page
// where a matching cover image exists. Falls back to logo.png.
// Run: node fix-og-images.js

const fs   = require('fs');
const path = require('path');
const ROOT = __dirname;
const BASE = 'https://jvdesignstudio.co.uk/';

// Map page filename → image filename (images must exist in root)
const OG_MAP = {
    // Games
    'arcane_citadel.html':           'Arcane Promo.png',
    'arcane_citadel_page.html':      'Arcane Promo.png',
    'cozy-biscuit-clicker.html':     'Biscuit Tin Clicker.png',
    'cozy-cafe-match-game.html':     'CozyCafeCover.png',
    'cozy_creatures.html':           'Cozy Creatures.jpg',
    'crypt-crawlers.html':           'Crypt crawlers.png',
    'echo_fruit_catch.html':         'Axo Fruit Catch.png',
    'gem_match.html':                'GemMatchCover.png',
    'gml_shooter_trainer_project.html': 'GmlCover.png',
    'pip_star_connect.html':         'Pips_Star_Connect.png',
    'sky_high_squirt.html':          'SkyHighCover.png',
    'tiger_smash.html':              'TigerSmashCover.png',
    'voidrush.html':                 'VoidrushCoverimage.png',
    'stardust_collection.html':      'Stardust_Collection_prototype image.png',
    'call_of_the_cards.html':        'Call of the cards.png',
    'candy_kingdom.html':            'CandyKingdomP.jpg',
    'space_invaders_tutorial.html':  'Space Invaders.png',
    'dungeon-delve.html':            'Dungeondelve.png',
    // Books
    'Elara.html':                    'Elara.jpg',
    'Stardust.html':                 'Stardust_Page_1.png',
    'Pip_and_the_night_sky.html':    'PIP Cover.png',
    'lumo_firefly_night.html':       'Lumo Front Cover Concept V001.png',
    'lumo_and_the_grumble_grit.html':'Lumo Concept V002.png',
    // Tools
    'pixel-studio.html':             'PixelStudioCover.png',
    'level-designer.html':           'LevelDesignCover.png',
    'sfx-generator.html':            'SFXStudioCover.png',
    'sound-studio.html':             'SoundStudioCover.png',
    'character-designer.html':       'CharacterCreatorCover.png',
    'colour-palette.html':           'ColourPalletecOVER.png',
    'gdd-builder.html':              'GDDCover.png',
    'map-generator.html':            'MapStudioImage.png',
    'story-editor.html':             'StodyEditorCover.png',
    'drum-pad.html':                 'DrumPadDevToolCoverImage.png',
    'particle-designer.html':        'ParticleDesignCoverImage.png',
    'game-idea-generator.html':      'GameIdeaCoverImage.png',
    'arcade-game-maker.html':        'ArcadeMakerCoverImage.png',
    'arcade-game-maker-landing.html':'ArcadeMakerCoverImage.png',
    'nuclear-blueprint.html':        'NuclearBlueprintCover.png',
    'pirate-cannon-builder.html':    'Cannon.png',
    'pirate-ship-builder.html':      'Ship.png',
    'trading-card-designer.html':    'CardMakerCoverImage.png',
    'roblox-builder.html':           'Roblox Cover.png',
    'castle-siege-blueprint.html':   'BlockBuilderCover.png',
    // Workshop
    'godot-racing-workshop.html':    'Godot Teaser.png',
    'godot-racing-workshop-2.html':  'Godot Teaser.png',
    'godot_templates.html':          'Godot Templates.png',
    'godot_tutorial.html':           'How to GODOT.png',
    'js-platformer-builder.html':    'JSPlatformerCover.png',
    'python-game-builder.html':      'PythonCover.png',
    'mugen-workshop.html':           'MuguenCover.png',
    'mugen-ai-workshop.html':        'MuguenAiCover.png',
    'roblox-creator-journey.html':   'Roblox Cover.png',
    'sci-fi-runner-builder.html':    'Scifirunner.png',
    'unity-2d-platformer.html':      'UnityPlatformerImage.png',
    'unity-3d-platformer.html':      'Unity 3D Platformer.png',
    'unity-top-down-shooter.html':   'UnityTopDownCoverImage.png',
    'unreal-clicker-builder.html':   'UnrealClicker.png',
    'unreal-fighter-workshop.html':  'UnrealFighter.png',
    'unreal-zombie-survivor.html':   'UnrealZombieCover.png',
    'openrct2-swim-rescue.html':     'Saving guests.png',
    'openrct2-modding-builder.html': 'ModdingRCT.png',
    'rocket-builder.html':           'RocketBuilder.png',
    'race-builder.html':             'RacingBluePrint.png',
    'racing-blueprint.html':         'RacingBluePrint.png',
    'cpp-tower-defence-builder.html':'TowerDefenceCover.png',
    'steampunk-airship-builder.html':'steampunkship.png',
    'workshop.html':                 'The Workshop.png',
    'diablo-blueprint.html':         'Dungeondelve.png',
    'night-watch-workshop.html':     'Crypt crawlers.png',
};

let changed = 0;
let skipped = 0;

fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).forEach(file => {
    const img = OG_MAP[file];
    if (!img) { skipped++; return; }

    // Verify image exists
    if (!fs.existsSync(path.join(ROOT, img))) {
        console.log(`  MISSING image for ${file}: ${img}`);
        skipped++;
        return;
    }

    let src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const url = BASE + encodeURIComponent(img).replace(/%20/g, '%20');

    // Replace og:image
    const updated = src
        .replace(/(<meta\s+property="og:image"\s+content=")[^"]*(")/g, `$1${url}$2`)
        .replace(/(<meta\s+name="twitter:image"\s+content=")[^"]*(")/g, `$1${url}$2`);

    if (updated !== src) {
        fs.writeFileSync(path.join(ROOT, file), updated, 'utf8');
        console.log(`  updated ${file} → ${img}`);
        changed++;
    } else {
        skipped++;
    }
});

console.log(`\nDone. ${changed} updated, ${skipped} skipped/unchanged.`);
