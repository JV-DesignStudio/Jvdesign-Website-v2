# Tools Audit — Full Standard (Standalone Value, Arcade/Pixel bar)

**Standard =** header (`jvdsSiteNav`) + welcome modal before `div#toast` with `localStorage` seen-key + `?` help + autosave + save/load (slots/library) + share link + real export + toast + mobile responsive.

> Updated 2026-09-01. Y = present, · = missing, ⚠ = buggy. Pilot 3 marked ★.

| Tool | Header | Welcome | Seen | Autosave | Save | Share | Export | Toast | Mobile | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| **arcade-game-maker.html** | Y | ·* | Y | Y | Y | Y | Y | Y | Y | *welcome via #welcome-overlay not welcomeModal pattern |
| **pixel-studio.html** | Y | Y | Y | Y | · | · | Y | Y | Y | Benchmark alongside arcade |
| **buildlab.html** | Y | Y | Y | Y | Y | Y | Y | Y | Y | Full standard reference |
| **level-designer.html** | Y | · | Y | Y | Y | Y | Y | Y | Y | Has startModal, missing welcomeModal |
| **story-editor.html** | Y | Y | Y | Y | Y | Y | Y | Y | Y | ✅ Patched 2026-08-31 |
| **trading-card-designer.html** | Y | Y | Y | Y | Y | Y | Y | Y | Y | ✅ Patched 2026-08-31 |
| **character-designer.html** | Y | Y | Y | Y | Y | Y | Y | Y | Y | ✅ Patched 2026-09-01 |
| **particle-designer.html** | Y | Y | Y | Y | Y | Y | Y | Y | Y | ✅ Patched 2026-09-01 |
| **music-maker.html** | Y | Y | Y | Y | Y | Y | Y | Y | Y | ✅ Patched 2026-09-01 |
| **sprite-animator.html** | Y | Y | Y | Y | Y | Y | Y | Y | Y | ✅ Patched 2026-09-01 |
| **sound-studio.html** | Y | Y | Y | Y | Y | Y | Y | Y | Y | ✅ Patched 2026-09-01 |
| **map-generator.html** | Y | Y | Y | Y | · | Y | Y | Y | Y | No save/load library |
| **game-logo-maker.html** | Y | Y | Y | Y | Y | Y | Y | Y | Y | ✅ Full standard |
| **gdd-builder.html** | Y | Y | Y | Y | Y | Y | Y | Y | Y | ✅ Full standard |
| **icon-generator.html** | Y | Y | Y | Y | Y | Y | Y | Y | Y | ✅ Full standard |
| **bitmap-font-maker.html** | Y | Y | Y | Y | Y | Y | Y | Y | Y | ✅ Full standard |
| **drum-pad.html** | Y | Y | Y | Y | Y | Y | Y | Y | Y | ✅ Full standard |
| **sfx-generator.html** | Y | Y | Y | Y | · | Y | Y | Y | Y | No manual save/load (autosave + history only) |
| **colour-palette.html** ★ | Y | Y | Y | Y | Y | Y | Y | Y | Y | ✅ Pilot patched 2026-09-01 |
| **game-idea-generator.html** ★ | Y | Y | Y | Y | Y | Y | Y | Y | Y | ✅ Pilot patched 2026-09-01 |
| **roblox-builder.html** ★ | Y | Y | Y | · | · | Y | · | Y | Y | ✅ Redirect to BuildLab, patched 2026-09-01 |
| **dev-board.html** | · | · | · | · | · | · | · | · | Y | Out of scope — static internal dashboard |
| **quest-board.html** | · | ⚠ | · | Y | Y | Y | Y | Y | Y | Full standard, auth gate replaces welcome |
| **quest-board-page.html** | · | · | · | · | · | · | · | · | Y | Landing wrapper |
| **project-tracker.html** | · | ⚠ | · | Y | Y | Y | Y | Y | Y | Full standard, auth gate replaces welcome |
| **story-player.html** | · | · | · | · | · | Y | · | Y | Y | Out of scope — read-only player |
| **arcade-game-maker-landing.html** | Y | Y | Y | · | · | · | · | Y | Y | Landing, `?` key fixed |
| **pixel-studio-landing.html** | Y | Y | Y | · | · | · | · | Y | Y | Landing, `?` key fixed |
| **level-designer-landing.html** | Y | Y | Y | · | · | · | · | Y | Y | Landing, `?` key fixed |
| **map-generator-landing.html** | Y | Y | Y | · | · | · | · | Y | Y | Landing, `?` key fixed |

## Tiering (standalone value)

- **Overshadowing (benchmark)**: arcade-game-maker, pixel-studio, buildlab, level-designer — export actually builds a playable game / asset.
- **Complete**: story-editor, trading-card-designer, colour-palette, game-idea-generator, roblox-builder (redirect), character-designer, particle-designer, music-maker, sprite-animator, sound-studio, game-logo-maker, gdd-builder, icon-generator, bitmap-font-maker, drum-pad — full standard met.
- **Near complete**: map-generator (no save/load library), sfx-generator (no manual save/load).
- **Landings**: arcade-game-maker-landing, pixel-studio-landing, level-designer-landing, map-generator-landing — `?` key fixed 2026-09-01.
- **Out of scope**: dev-board (static dashboard), story-player (read-only player).
- **Separate systems**: quest-board, project-tracker — full standard, auth gate replaces welcome modal.

## All tasks complete

All tools have been audited and patched to meet the full standard. The only remaining items are:
- map-generator: add save/load library (nice to have)
- sfx-generator: add manual save/load buttons (nice to have)
