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
| **character-designer.html** | Y | · | Y | Y | · | · | Y | Y | Y | Needs welcome/save/share |
| **particle-designer.html** | Y | · | Y | Y | · | · | Y | Y | Y | Needs welcome/save/share |
| **music-maker.html** | Y | · | Y | Y | · | Y | · | Y | Y | Needs welcome/save |
| **sprite-animator.html** | Y | · | Y | Y | · | · | Y | Y | Y | Needs welcome/save/share |
| **sound-studio.html** | Y | · | Y | Y | · | · | Y | Y | Y | Duplicate of sfx-generator |
| **map-generator.html** | Y | · | · | Y | · | Y | Y | Y | Y | Needs welcome/seen |
| **game-logo-maker.html** | Y | · | · | Y | · | Y | Y | Y | Y | Needs welcome/seen/save |
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
- **Mid (needs gap-fill)**: character-designer, particle-designer, music-maker, sprite-animator, sound-studio, map-generator, game-logo-maker — functional but missing 2-3 standard pieces.
- **Weak (pilot)**: roblox-builder (stub), game-idea-generator (no persist/export/share), colour-palette (no welcome/share), gdd-builder, icon-generator, bitmap-font-maker, drum-pad, sfx-generator — usable solo but not “worth keeping” without save/share.

## Next — Pilot 3 patches (full standard)

1. **roblox-builder.html** — replace redirect with minimal standalone builder (or confirm deprecation → remove from dev-tools grid). If kept: add nav, welcome modal, toast, export.
2. **game-idea-generator.html** — add welcome modal + seen-key `jvds_gameidea_seen_v1`, toast `#toast`, autosave/share (copy + share link), keep history as save slots, add `?` help. Keep chips/filters.
3. **colour-palette.html** — add welcome modal + seen-key `jvds_palette_seen_v1`, share link (hash with cols/mood), `?` help, ensure autosave already via `jvds_palettes`. Normalize export to match CSS/JSON/GDScript pattern.

After pilots pass, sweep mid tier with same template (welcome+seen+share+save gaps) then landings.
