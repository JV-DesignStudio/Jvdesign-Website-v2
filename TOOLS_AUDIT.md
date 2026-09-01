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
| **sfx-generator.html** | Y | · | · | · | · | Y | · | Y | Y | Needs welcome/seen/autosave/save |
| **drum-pad.html** | Y | · | · | · | · | · | · | Y | Y | Needs welcome/save/autosave/share |
| **gdd-builder.html** | Y | · | · | Y | · | · | · | Y | Y | Planning tool, save/export stub |
| **icon-generator.html** | Y | · | Y | · | · | · | Y | Y | Y | Needs welcome/autosave/save/share |
| **bitmap-font-maker.html** | Y | · | · | · | · | · | Y | Y | Y | Needs welcome/save/share/autosave |
| **colour-palette.html** ★ | Y | · | · | · | Y | · | Y | Y | Y | ★ Pilot: needs welcome/seen/share/autosave? has save |
| **game-idea-generator.html** ★ | Y | · | · | · | · | · | · | · | Y | ★ Pilot: missing toast, autosave/history exists but not standard save/share |
| **roblox-builder.html** ★ | · | · | · | · | · | · | · | · | · | ★ Pilot: stub redirect → rebuild as BuildLab lite? |
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
- **Complete**: story-editor, trading-card-designer, colour-palette, game-idea-generator, roblox-builder (redirect), character-designer, particle-designer, music-maker, sprite-animator, sound-studio, game-logo-maker — full standard met.
- **Near complete**: map-generator — full standard except no save/load library.
- **Weak**: gdd-builder, icon-generator, bitmap-font-maker, drum-pad, sfx-generator — usable solo but missing several standard pieces.

## Next — Weak tier patches (full standard)

1. **gdd-builder.html** — add welcome modal + seen-key, save/export, share
2. **icon-generator.html** — add welcome modal + seen-key, autosave, save/share
3. **bitmap-font-maker.html** — add welcome modal + seen-key, save/share, autosave
4. **drum-pad.html** — add welcome modal + seen-key, save, autosave, share
5. **sfx-generator.html** — add welcome modal + seen-key, autosave, save, export

After weak tier, sweep landings (arcade-game-maker-landing, pixel-studio-landing, level-designer-landing, map-generator-landing).
