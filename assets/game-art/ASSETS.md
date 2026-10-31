# Arcade art assets

Placeholder art lives here so every arcade page has something real to point at.
Redraw over these files, then tick them off. Keep the **same filename and pixel
size** so no code has to change.

- Sprites: `assets/game-art/highway-dodge/`
- Covers: `assets/game-art/covers/`
- Regenerate placeholders: `node scripts/generate-game-art.cjs`
- `--force` overwrites existing files, so do not use it once you start redrawing.

The game still draws its cars on canvas today. It does not load these PNGs yet.
The covers also need wiring into `og:image` and the arcade cards once they exist.

---

## Character cars (64 x 104)

One car per JVDS character, using the site mascot colours. All are top-down,
transparent, pointed up.

- [ ] `ember-car.png` 64x104, Ember red/orange (`#dc2626` to `#f97316`), gold stripe
- [ ] `stardust-car.png` 64x104, Stardust gold (`#e0b52e` to `#ffd23c`)
- [ ] `lumo-car.png` 64x104, Lumo purple (`#6d5ce0` to `#9a8cf7`)
- [ ] `pip-car.png` 64x104, Pip green (`#68b53f` to `#96e06a`)
- [ ] `echo-car.png` 64x104, Echo teal (`#249c8e` to `#5fd6c7`)

Accent colours come from `style-mascots.css`:
`--mascot-stardust:#FFD23C`, `--mascot-lumo:#7C6CF0`, `--mascot-ember:#F2637A`,
`--mascot-pip:#7AC74F`, `--mascot-echo:#2EB5A5`.

---

## Highway Dodge sprites

### Traffic
- [ ] `traffic-sedan-red.png` 56x96, oncoming car type 1
- [ ] `traffic-sedan-blue.png` 56x96, oncoming car type 2
- [ ] `traffic-van-white.png` 60x112, larger slow vehicle
- [ ] `traffic-truck.png` 64x128, wide truck, slow, takes 2 lanes
- [ ] `traffic-wrongway.png` 56x96, same shape as a sedan but angry red, drives at you

### Pickups
- [ ] `pickup-nitro.png` 32x32, lightning bolt in a glowing yellow capsule
- [ ] `pickup-shield.png` 32x32, blue shield
- [ ] `pickup-fuel.png` 32x32, green fuel canister
- [ ] `coin.png` 20x20, gold coin, simple

### Hazards and road
- [ ] `hazard-cone.png` 24x36, orange traffic cone, top-down
- [ ] `hazard-barrel.png` 28x28, red/orange drum, top-down
- [ ] `road-tile.png` 120x64, 3-lane road, seamless vertical tile

Road tile tip: the dashes run from y=16 to y=48, leaving a 16px gap at the top
and bottom, so copies stack without a seam.

---

## Covers (480 x 270)

- [ ] `highway-dodge-cover.png` (highest traffic, do first)
- [ ] `lumo-hive-cover.png`
- [ ] `tower-defence-cover.png`
- [ ] `crossy-crew-cover.png`
- [ ] `nova-siege-cover.png`
- [ ] `voidrush-cover.png`
- [ ] `arcade-card-fallback.png` (generic card when a game has no cover)

---

## Done means

- Every box above ticked, PNG at the exact size in the name.
- `node scripts/generate-game-art.cjs` run without `--force` leaves your files
  untouched.
- Covers added to the matching `og:image` tags and arcade cards.
- `node validate-links.js` passes.
