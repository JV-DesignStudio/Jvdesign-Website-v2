'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WS_DIR = path.join(ROOT, 'workshops');
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

const SERIES = [
  {
    name: 'Stardew Valley World Workshop',
    hub: 'stardew-world-workshop.html',
    hubTitle: 'Stardew Valley World Workshop',
    cheatsheet: 'stardew-modding-cheatsheet.html',
    cheatsheetTitle: 'Stardew modding cheat sheet',
    episodes: [
      { file: 'stardew-world-ep1-setup.html', title: 'Episode 1: Setup' },
      { file: 'stardew-world-ep2-mods-folder.html', title: 'Episode 2: Mods Folder' },
      { file: 'stardew-world-ep3-first-tile.html', title: 'Episode 3: First Tile' },
      { file: 'stardew-world-ep4-layers.html', title: 'Episode 4: Layers' },
      { file: 'stardew-world-ep5-tile-properties.html', title: 'Episode 5: Tile Properties' },
      { file: 'stardew-world-ep6-build-and-decorate.html', title: 'Episode 6: Build and Decorate' },
      { file: 'stardew-world-ep7-warps.html', title: 'Episode 7: Warps' },
      { file: 'stardew-world-ep8-new-area.html', title: 'Episode 8: New Area' },
      { file: 'stardew-world-ep9-package-mod.html', title: 'Episode 9: Package Your Mod' },
      { file: 'stardew-world-ep10-troubleshoot.html', title: 'Episode 10: Troubleshoot' },
      { file: 'stardew-world-ep11-play-share.html', title: 'Episode 11: Play and Share' },
      { file: 'stardew-world-ep12-design.html', title: 'Episode 12: Design Your Own' },
    ],
    stuckItems: [
      { symptom: 'My mod does not show up in SMAPI', fix: 'Check that the manifest.json file is inside its own folder in the Mods directory, and that SMAPI is running (not the vanilla launcher).' },
      { symptom: 'Tiles look wrong or invisible', fix: 'Make sure the tileset image is in the right folder and the filename matches exactly (case matters). Re-open the map in Tiled and check the tileset path.' },
      { symptom: 'The game crashes on load', fix: 'Open the SMAPI console and read the red error line. It usually names the file and the line. Fix that file and try again.' },
      { symptom: 'Changes do not appear in the game', fix: 'Save the map in Tiled, then restart the game (SMAPI caches some files). If using Content Patcher, check the content.json path.' },
    ],
  },
  {
    name: 'Terraria World Workshop',
    hub: 'terraria-world-workshop.html',
    hubTitle: 'Terraria World Workshop',
    cheatsheet: 'terraria-modding-cheatsheet.html',
    cheatsheetTitle: 'Terraria modding cheat sheet',
    episodes: [
      { file: 'terraria-world-ep1-setup.html', title: 'Episode 1: Setup' },
      { file: 'terraria-world-ep2-world-file.html', title: 'Episode 2: World File' },
      { file: 'terraria-world-ep3-first-change.html', title: 'Episode 3: First Change' },
      { file: 'terraria-world-ep4-layers.html', title: 'Episode 4: Layers' },
      { file: 'terraria-world-ep5-biomes.html', title: 'Episode 5: Biomes' },
      { file: 'terraria-world-ep6-build-decorate.html', title: 'Episode 6: Build and Decorate' },
      { file: 'terraria-world-ep7-tunnels.html', title: 'Episode 7: Tunnels' },
      { file: 'terraria-world-ep8-new-area.html', title: 'Episode 8: New Area' },
      { file: 'terraria-world-ep9-package-share.html', title: 'Episode 9: Package and Share' },
      { file: 'terraria-world-ep10-fix-it.html', title: 'Episode 10: Fix It' },
      { file: 'terraria-world-ep11-play-share.html', title: 'Episode 11: Play and Share' },
      { file: 'terraria-world-ep12-design.html', title: 'Episode 12: Design Your Own' },
    ],
    stuckItems: [
      { symptom: 'tModLoader will not start', fix: 'Make sure you installed tModLoader through Steam, not manually. Right-click Terraria in Steam, choose Properties, then Betas, and pick the tModLoader branch.' },
      { symptom: 'My mod does not load', fix: 'Check that the build.txt and the .cs files are in the right folder. Run Build in tModLoader and read the error if it fails.' },
      { symptom: 'Sprites are missing or white', fix: 'The image file must be a .png with the exact name the code expects. Check capitalisation and that the file is in the right subfolder.' },
      { symptom: 'The game crashes when I enter a world', fix: 'Open the tModLoader log (client.log) and look for the red line. It usually names the mod and the problem. Disable other mods to isolate the issue.' },
    ],
  },
  {
    name: 'MUGEN World Workshop',
    hub: 'mugen-world-workshop.html',
    hubTitle: 'MUGEN World Workshop',
    cheatsheet: 'mugen-cheatsheet.html',
    cheatsheetTitle: 'MUGEN cheat sheet',
    episodes: [
      { file: 'mugen-world-ep1-setup.html', title: 'Episode 1: Setup' },
      { file: 'mugen-world-ep2-fighter-files.html', title: 'Episode 2: Fighter Files' },
      { file: 'mugen-world-ep3-sprites-palette.html', title: 'Episode 3: Sprites and Palette' },
      { file: 'mugen-world-ep4-animations.html', title: 'Episode 4: Animations' },
      { file: 'mugen-world-ep5-commands.html', title: 'Episode 5: Commands' },
      { file: 'mugen-world-ep6-states.html', title: 'Episode 6: States' },
      { file: 'mugen-world-ep7-hitboxes.html', title: 'Episode 7: Hitboxes' },
      { file: 'mugen-world-ep8-stage.html', title: 'Episode 8: Stage' },
      { file: 'mugen-world-ep9-ai.html', title: 'Episode 9: AI' },
      { file: 'mugen-world-ep10-game.html', title: 'Episode 10: Your Game' },
    ],
    stuckItems: [
      { symptom: 'Fighter does not appear in the roster', fix: 'Check select.def: the character folder name must match exactly (case-sensitive). Make sure the .def file inside the folder has the same name as the folder.' },
      { symptom: 'Sprites are black or invisible', fix: 'Open Fighter Factory and check the palette. The sprite must use the character palette (palette 0), and the .sff file must be saved correctly.' },
      { symptom: 'Animations play wrong or freeze', fix: 'Check the .air file. Each animation group must list frames in order, and the timing numbers must be positive. A missing frame number causes a freeze.' },
      { symptom: 'Attacks do not connect', fix: 'Check the Clsn2 (hurtbox) and Clsn1 (hitbox) in the .air file. Both the attacker and the target need visible collision boxes. Test in debug mode (F1 in MUGEN).' },
    ],
  },
  {
    name: 'OpenRCT2 World Workshop',
    hub: 'openrct2-world-workshop.html',
    hubTitle: 'OpenRCT2 World Workshop',
    cheatsheet: 'openrct2-cheatsheet.html',
    cheatsheetTitle: 'OpenRCT2 cheat sheet',
    episodes: [
      { file: 'openrct2-world-ep1-setup.html', title: 'Episode 1: Setup' },
      { file: 'openrct2-world-ep2-first-plugin.html', title: 'Episode 2: First Plugin' },
      { file: 'openrct2-world-ep3-events.html', title: 'Episode 3: Events' },
      { file: 'openrct2-world-ep4-read-the-park.html', title: 'Episode 4: Read the Park' },
      { file: 'openrct2-world-ep5-guests.html', title: 'Episode 5: Guests' },
      { file: 'openrct2-world-ep6-swim-rescue.html', title: 'Episode 6: Swim Rescue' },
      { file: 'openrct2-world-ep7-test-debug.html', title: 'Episode 7: Test and Debug' },
      { file: 'openrct2-world-ep8-design-share.html', title: 'Episode 8: Design and Share' },
    ],
    stuckItems: [
      { symptom: 'Plugin does not appear in the menu', fix: 'Make sure the .js file is in the OpenRCT2 plugin folder (Documents/OpenRCT2/plugin). Restart the game after adding the file.' },
      { symptom: 'Script error in the console', fix: 'Open the plugin console (View > Plugin Console). Read the error line: it names the file and line number. Fix the typo and reload (Ctrl+Shift+R).' },
      { symptom: 'Nothing happens when I click the button', fix: 'Check that the button callback calls the right function name. A missing return or a wrong variable name is the usual cause.' },
      { symptom: 'The park data looks wrong', fix: 'Use console.log() to print the value you are reading. The API property name may be different from what you expect. Check the OpenRCT2 API docs.' },
    ],
  },
  {
    name: 'Java RPG',
    hub: null,
    hubTitle: null,
    cheatsheet: null,
    cheatsheetTitle: null,
    episodes: [
      { file: 'java-rpg-part1-workshop.html', title: 'Part 1: RPG Foundation' },
      { file: 'java-rpg-part2-workshop.html', title: 'Part 2: Combat and Items' },
      { file: 'java-rpg-part3-workshop.html', title: 'Part 3: Quests and World' },
    ],
    stuckItems: [
      { symptom: 'Code will not compile', fix: 'Read the error message: it names the file and line. Check for missing semicolons, unmatched braces, and wrong capitalisation (Java is case-sensitive).' },
      { symptom: 'The canvas is blank', fix: 'Make sure you called repaint() after changing game state. Check that the paintComponent method draws to the Graphics object, not to null.' },
      { symptom: 'Keyboard input does nothing', fix: 'Check that addKeyListener is called on the right component and that the component has focus. Call requestFocusInWindow() after making the frame visible.' },
    ],
  },
  {
    name: 'Night Watch',
    hub: null,
    hubTitle: null,
    cheatsheet: null,
    cheatsheetTitle: null,
    episodes: [
      { file: 'night-watch-workshop.html', title: 'Part 1: The Tower' },
      { file: 'night-watch-part2-workshop.html', title: 'Part 2: The Forest' },
      { file: 'night-watch-part3-workshop.html', title: 'Part 3: The Final Battle' },
    ],
    stuckItems: [
      { symptom: 'Sprites do not load', fix: 'Check that the image file path matches the code. Try a full reload (Ctrl+Shift+R) to clear the browser cache.' },
      { symptom: 'Character does not move', fix: 'Check the keyboard event listener. Make sure you are listening for the right key codes and updating the position each frame.' },
      { symptom: 'Collisions do not work', fix: 'Check the bounding box logic: the x, y, width and height must match the actual sprite size. Add a debug rectangle around each object to see the hitbox.' },
    ],
  },
  {
    name: 'C++ Platformer',
    hub: null,
    hubTitle: null,
    cheatsheet: null,
    cheatsheetTitle: null,
    episodes: [
      { file: 'cpp-platformer-workshop.html', title: 'Part 1: Platformer Basics' },
      { file: 'cpp-platformer-part2-workshop.html', title: 'Part 2: Advanced Platformer' },
    ],
    stuckItems: [
      { symptom: 'Build fails with errors', fix: 'Read the first error line: it names the file and line. Common causes: missing #include, wrong variable type, missing semicolons.' },
      { symptom: 'Window opens then closes', fix: 'Add a game loop that keeps the window open. Make sure the loop calls sf::RenderWindow::display() and processes events each frame.' },
      { symptom: 'Sprite does not appear', fix: 'Check that the texture file is in the same folder as the executable. Verify the file loaded correctly with if(!texture.loadFromFile(...)).' },
    ],
  },
  {
    name: 'C++ Tower Defence',
    hub: null,
    hubTitle: null,
    cheatsheet: null,
    cheatsheetTitle: null,
    episodes: [
      { file: 'cpp-tower-part1-workshop.html', title: 'Part 1: Tower Defence Setup' },
      { file: 'cpp-tower-part2-workshop.html', title: 'Part 2: Tower Defence Gameplay' },
    ],
    stuckItems: [
      { symptom: 'Build fails with errors', fix: 'Read the first error line: it names the file and line. Common causes: missing #include, wrong variable type, missing semicolons.' },
      { symptom: 'Towers do not fire', fix: 'Check the range calculation and the timer. Make sure the tower checks distance to each enemy and resets its cooldown after firing.' },
      { symptom: 'Enemies walk through walls', fix: 'Check the path waypoints. Enemies follow the waypoint list in order; if a waypoint is missing or in the wrong position, they skip part of the path.' },
    ],
  },
];

function makeStuckBlock(workshopId, stuckItems, cheatsheet, cheatsheetTitle) {
  const items = stuckItems.map(item =>
    `    <details class="ws-stuck-item">
      <summary>${item.symptom}</summary>
      <p><strong>What you'll see:</strong> ${item.symptom}.</p>
      <p><strong>Fix:</strong> ${item.fix}</p>
    </details>`
  ).join('\n');

  const noteLinks = cheatsheet
    ? `Open the <a href="${cheatsheet}">${cheatsheetTitle}</a>, or reread the step and try again.`
    : `Reread the step and try again. If you are still stuck, ask an adult to sit with you.`;

  return `<!-- WS-STUCK:START -->
<section class="ws-stuck" aria-labelledby="ws-stuck-title" data-workshop-stuck="${workshopId}">
  <div class="ws-stuck-inner">
    <p class="ws-stuck-kicker"><img src="/assets/mascots/echo-badge.webp" alt="" width="22" height="22" loading="lazy"> Echo's recovery check</p>
    <h2 class="ws-stuck-title" id="ws-stuck-title">Stuck? Try this</h2>
    <p class="ws-stuck-intro">These are the most common problems. Check the symptom, then try the fix.</p>
${items}
    <p class="ws-stuck-note">Still stuck? ${noteLinks}</p>
  </div>
</section>
<!-- WS-STUCK:END -->`;
}

function makeNextBlock(workshopId, nextHref, nextTitle, nextSub, hubHref, hubTitle) {
  let hubLink = '';
  if (hubHref) {
    hubLink = `\n<p class="ws-next-links" style="max-width:960px;margin:10px auto 36px;padding:0 24px;font-size:.85rem;font-weight:700">
  <a href="${hubHref}" style="color:#9CCFD2">${hubTitle}</a>
</p>`;
  }

  return `<!-- WS-NEXT:START -->
<nav class="next-route" aria-label="Next step" data-workshop-next="${workshopId}">
  <a href="${nextHref}" class="next-route-inner">
    <span class="next-route-kicker">Up next in the series</span>
    <div class="next-route-body">
      <span class="next-route-title">${nextTitle}</span>
      <span class="next-route-sub">${nextSub}</span>
    </div>
    <span class="next-route-arrow" aria-hidden="true">&rarr;</span>
  </a>
</nav>${hubLink}
<!-- WS-NEXT:END -->`;
}

let stamped = 0;
let skipped = 0;

SERIES.forEach(series => {
  const eps = series.episodes;

  // Stamp each episode
  eps.forEach((ep, i) => {
    const filePath = path.join(WS_DIR, ep.file);
    if (!fs.existsSync(filePath)) {
      console.log(`  SKIP ${ep.file} (file not found)`);
      skipped++;
      return;
    }

    let html = fs.readFileSync(filePath, 'utf8');
    const workshopId = ep.file.replace('.html', '');
    let changed = false;

    // Add WS-STUCK if missing
    const hasStuck = html.includes('WS-STUCK') || /class=["']ws-stuck/.test(html);
    if (!hasStuck) {
      const stuckHtml = makeStuckBlock(
        workshopId,
        series.stuckItems,
        series.cheatsheet,
        series.cheatsheetTitle
      );
      // Insert before the footer or before </main> or before the last </section>
      const insertPoint = html.lastIndexOf('<!-- BUILD:footer-content -->');
      if (insertPoint > -1) {
        html = html.slice(0, insertPoint) + stuckHtml + '\n\n' + html.slice(insertPoint);
        changed = true;
      }
    }

    // Add WS-NEXT if missing
    const hasNext = html.includes('WS-NEXT') || /class=["']next-route/.test(html);
    if (!hasNext) {
      const isLast = i === eps.length - 1;
      let nextHref, nextTitle, nextSub;

      if (isLast && series.hub) {
        nextHref = series.hub;
        nextTitle = 'Back to ' + series.hubTitle;
        nextSub = 'See the full series and your progress';
      } else if (isLast) {
        // No hub, last episode: skip next block
        nextHref = null;
      } else {
        nextHref = eps[i + 1].file;
        nextTitle = eps[i + 1].title;
        nextSub = 'Continue building in the next episode';
      }

      if (nextHref) {
        const nextHtml = makeNextBlock(
          workshopId,
          nextHref,
          nextTitle,
          nextSub,
          series.hub,
          series.hubTitle ? 'All ' + series.name + ' episodes' : null
        );
        const insertPoint = html.lastIndexOf('<!-- BUILD:footer-content -->');
        if (insertPoint > -1) {
          html = html.slice(0, insertPoint) + nextHtml + '\n\n' + html.slice(insertPoint);
          changed = true;
        }
      }
    }

    // Also stamp the series hub if it exists and is missing blocks
    if (changed) {
      if (DRY_RUN) {
        console.log(`  DRY-RUN ${ep.file}`);
      } else {
        fs.writeFileSync(filePath, html);
        console.log(`  STAMPED ${ep.file}`);
      }
      stamped++;
    } else {
      if (VERBOSE) console.log(`  OK ${ep.file} (already has blocks)`);
    }
  });

  // Stamp the hub page too
  if (series.hub) {
    const hubPath = path.join(WS_DIR, series.hub);
    if (!fs.existsSync(hubPath)) return;

    let html = fs.readFileSync(hubPath, 'utf8');
    const workshopId = series.hub.replace('.html', '');
    let changed = false;

    const hasStuck = html.includes('WS-STUCK') || /class=["']ws-stuck/.test(html);
    if (!hasStuck) {
      const stuckHtml = makeStuckBlock(workshopId, series.stuckItems, series.cheatsheet, series.cheatsheetTitle);
      const insertPoint = html.lastIndexOf('<!-- BUILD:footer-content -->');
      if (insertPoint > -1) {
        html = html.slice(0, insertPoint) + stuckHtml + '\n\n' + html.slice(insertPoint);
        changed = true;
      }
    }

    const hasNext = html.includes('WS-NEXT') || /class=["']next-route/.test(html);
    if (!hasNext) {
      const nextHtml = makeNextBlock(
        workshopId,
        series.episodes[0].file,
        series.episodes[0].title,
        'Start the series from the beginning',
        null, null
      );
      const insertPoint = html.lastIndexOf('<!-- BUILD:footer-content -->');
      if (insertPoint > -1) {
        html = html.slice(0, insertPoint) + nextHtml + '\n\n' + html.slice(insertPoint);
        changed = true;
      }
    }

    if (changed) {
      if (DRY_RUN) {
        console.log(`  DRY-RUN ${series.hub} (hub)`);
      } else {
        fs.writeFileSync(hubPath, html);
        console.log(`  STAMPED ${series.hub} (hub)`);
      }
      stamped++;
    }
  }
});

console.log(`\nCross-series stamp: ${stamped} pages ${DRY_RUN ? 'would be ' : ''}updated, ${skipped} skipped`);
if (DRY_RUN) console.log('(dry run, no files changed)');
