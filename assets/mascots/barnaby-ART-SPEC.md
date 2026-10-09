# Barnaby the Arctic Fox, Art Spec (A806)

Barnaby is a JVDS crew member who currently exists only as a design doc
(`assets/mascots/barnaby-sheet.html`). This spec defines exactly what art to
produce so he matches the rest of the crew. The files listed below currently
hold generated placeholders (arctic-gradient rectangles) so the pages render
and validate. Replace each placeholder with hand-crafted art of the same name,
size and format. Per the design system, character art is hand-crafted: do not
ship AI-generated character images.

## Who Barnaby is

- Name: Barnaby Balthazar Blip, "The Arctic Fox".
- Story: the fox who forgot how to play; busy sorting socks until he
  remembers. Story world: Valley of Vroom, River of Zip.
- Role: a guest crew member (outside the five-character Imagine, Learn, Create, Play, Improve loop).
- Must never be confused with Lumo (purple fox, hooded cloak). Barnaby is
  arctic: snow and cream, no cloak, a long winter nose and a snow-tipped tail.

## Required files (exact paths)

| File | Format | Size | Use |
|---|---|---|---|
| `assets/mascots/barnaby-badge.avif` + `barnaby-badge.webp` | AVIF + WebP | 96x96 | Nav / dropdown badge (shown at 18-22px). Centre the head; keep it readable as a circle. |
| `assets/mascots/barnaby-hero.avif` + `barnaby-hero.webp` | AVIF + WebP | 640x380 | Crew card art on `meet-the-crew.html` (object-fit: contain, so keep the fox centred with margin). |
| `assets/mascots/barnaby.png` | PNG | 480x480 | Portrait / fallback raster. |
| `assets/mascots/barnaby-sheet.png` | PNG | 1200x900 | Printable reference sheet (turnaround + expressions). |
| `games/chars/barnaby.png` | PNG | 96x96 | In-game sprite, matching `games/chars/lumo.png` etc. |

Keep the AVIF/WebP pairs pixel-identical in composition (the page picks AVIF when
supported, WebP otherwise).

## Palette (from `barnaby-sheet.html`)

- Snow `#FFFFFF`, Cream `#F8F0E6`, Light fur `#E6D5C3`, Shadow `#C9A68A`
- Nose `#2B1D12`, Eyes `#3B5B7A`, Socks `#FF6B6B` (prop), Blue mud `#6B8DB5`

## Style rules

**DO**
- Big winter nose, 22 whiskers, rounded soft shapes, about 30cm scale.
- Snow-tipped tail, larger than the body.
- Arctic palette only (no purple anywhere).

**DON'T**
- Purple fur or a hooded cloak (that is Lumo).
- Human proportions or sharp/pointy shapes.
- Any art promising content Barnaby's story does not contain.

## Placeholder wiring (already done, so the slot is live)

- `meet-the-crew.html`: Barnaby crew card added with `id="barnaby"`.
- `partials/nav-content.html`: "Barnaby the Arctic Fox" link in the More menu,
  pointing at `/meet-the-crew.html#barnaby`.

## Done when

Each placeholder above is replaced by real art of the same name/size/format, and
`node validate-links.js`, `node validate-covers.js` and
`node scripts/validate-public-boundary.js` all pass at 390/1440.
