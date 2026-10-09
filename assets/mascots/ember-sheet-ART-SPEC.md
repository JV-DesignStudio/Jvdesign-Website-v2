# Ember sheet + Stardust sprite, Art Spec (A614)

Two character-art gaps found in the 28 Sep site audit:

1. Every crew member has a reference sheet in `assets/mascots`
   (`lumo-sheet.png`, `pip-sheet.jpg`, `echo-sheet.jpg`, `stardust-sheet.png`)
   except **Ember**.
2. `games/chars/` holds in-game sprites for `lumo.png`, `ember.png`, `pip.png`
   and `echo.png`, but **Stardust** has none, so any arcade game starring
   Stardust would be missing its sprite.

The files below currently hold generated placeholders so the slots exist and
validate. Replace each with hand-crafted art of the same name, size and format.
Per the design system, character art is hand-crafted: do not ship AI-generated
character images.

## Required files

| File | Format | Size | Use |
|---|---|---|---|
| `assets/mascots/ember-sheet.png` | PNG | 1536x1024 | Ember reference sheet, matching `lumo-sheet.png` / `stardust-sheet.png` (turnaround, expressions, palette swatches, style rules). |
| `games/chars/stardust.png` | PNG | 205x224 | In-game sprite, matching `games/chars/lumo.png` (205x224) and `ember.png` (190x225). Keep a consistent scale and a transparent background. |

## Ember palette (from `meet-the-crew.html`)

- Main fur `#E8608A`, Light fur `#F8A8BE`, Stripes `#C04070`, Eyes `#3DB850`,
  Cape `#2A2A2A`.
- Ember is the pink tiger: brave, big-hearted, Create. Keep the dark stripes and
  green eyes; do not change the species or palette.

## Stardust palette (from `meet-the-crew.html`)

- Main `#FFC733`, Core glow `#FFE566`, Edge shade `#FF9800`, Sparkle `#FFF4B8`.
- Stardust is the golden dream spirit: glowing, made of warm light and tiny
  stars. The sprite should read clearly at small size on a game canvas.

## Wiring

- Neither file is referenced by a page yet (checked: no `chars/stardust` or
  `ember-sheet` references). They are added now so the slots exist and the
  sprite is ready for any game that casts Stardust.

## Done when

Both files are real hand-crafted art at the sizes above, and
`node validate-links.js`, `node validate-covers.js` and
`node scripts/validate-public-boundary.js` all pass at 390/1440.
