# Tools Audit — Full Standard (Standalone Value, Arcade/Pixel bar)

**Standard =** header (`jvdsSiteNav`) + welcome modal before `div#toast` with `localStorage` seen-key + `?` help + autosave + save/load (slots/library) + share link + real export + toast + mobile responsive.

> Generated 2026-08-31. Y = present, · = missing. Pilot 3 marked ★.

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
| **sfx-generator.html** | Y | Y | Y | Y | · | Y | Y | Y | Y | No manual save/load (autosave + history only) |
| **drum-pad.html** | Y | Y | Y | Y | Y | Y | Y | Y | Y | ✅ Full standard |
| **gdd-builder.html** | Y | Y | Y | Y | Y | Y | Y | Y | Y | ✅ Full standard |
| **icon-generator.html** | Y | Y | Y | Y | Y | Y | Y | Y | Y | ✅ Full standard |
| **bitmap-font-maker.html** | Y | Y | Y | Y | Y | Y | Y | Y | Y | ✅ Full standard |
| **colour-palette.html** ★ | Y | Y | Y | Y | Y | Y | Y | Y | Y | ✅ Pilot patched 2026-09-01 |
| **game-idea-generator.html** ★ | Y | Y | Y | Y | Y | Y | Y | Y | Y | ✅ Pilot patched 2026-09-01 |
| **roblox-builder.html** ★ | Y | Y | Y | · | · | Y | · | Y | Y | ✅ Redirect to BuildLab, patched 2026-09-01 |
| **dev-board.html** | · | · | · | · | · | · | · | · | Y | No shared nav, minimal |
| **quest-board.html** | · | · | · | · | · | · | Y | Y | Y | Separate RPG system, out of scope for dev-tools standard |
| **quest-board-page.html** | · | · | · | · | · | · | · | · | Y | Landing wrapper |
| **project-tracker.html** | · | · | · | · | · | · | · | Y | Y | Separate system |
| **story-player.html** | · | · | · | · | · | · | · | Y | Y | Read-only player |
| **arcade-game-maker-landing.html** | Y | · | · | · | · | Y | · | · | Y | Landing |
| **pixel-studio-landing.html** | Y | · | · | · | Y | · | · | · | Y | Landing |
| **level-designer-landing.html** | Y | · | · | Y | · | · | · | · | Y | Landing |
| **map-generator-landing.html** | Y | · | · | Y | · | · | · | · | Y | Landing |

## Tiering (standalone value)

- **Overshadowing (benchmark)**: arcade-game-maker, pixel-studio, buildlab, level-designer — export actually builds a playable game / asset.
- **Complete**: story-editor, trading-card-designer, colour-palette, game-idea-generator, roblox-builder (redirect), character-designer, particle-designer, music-maker, sprite-animator, sound-studio, game-logo-maker, gdd-builder, icon-generator, bitmap-font-maker, drum-pad — full standard met.
- **Near complete**: map-generator (no save/load library), sfx-generator (no manual save/load).

## Next — Landing page patches

1. **arcade-game-maker-landing.html** — add welcome modal + seen-key
2. **pixel-studio-landing.html** — add welcome modal + seen-key
3. **level-designer-landing.html** — add welcome modal + seen-key
4. **map-generator-landing.html** — add welcome modal + seen-key

After landings, review remaining pages (dev-board, quest-board, project-tracker, story-player) for standard compliance.
