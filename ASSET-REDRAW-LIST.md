# Game Asset Redraw List

Assets that need redrawing, grouped by type. Files are relative to `Jvdesign-Website-v2/`.

---

## 1. Mascot Character Sheets (in-game sprites / reference art)

These are the reference sheets used across games and the arcade. Redraw these first as they cascade across everything.

| Character | Current Files | Notes |
|-----------|--------------|-------|
| Echo | `assets/mascots/echo-sheet.jpg`, `games/chars/echo.png` | Axolotl. Used in Echo's Swim, Critter Whack, site-wide |
| Pip | `assets/mascots/pip-sheet.jpg`, `games/chars/pip.png` | Turtle. Used in Crossy Crew, Nova Siege, site-wide |
| Stardust | `assets/mascots/stardust-sheet.png`, `games/chars/stardust.png` | Star. Used in Stardust Snake, site-wide |
| Ember | `assets/mascots/ember-sheet.png`, `games/chars/ember.png` | Dragon/fire. Used in Arcane Citadel, Ember Smash, Highway Dodge (Garage), site-wide |
| Lumo | `assets/mascots/lumo-sheet.png`, `games/chars/lumo.png` | Used in Lumo Dash, workshop pages |
| Barnaby | `assets/mascots/barnaby-sheet.png`, `games/chars/barnaby.png` | Used in site-wide |

---

## 2. Mascot Hero / Badge Art (site-wide UI)

Each mascot has a hero image and a small badge used in navigation and the arcade.

| File | Used On |
|------|---------|
| `assets/mascots/echo-hero.webp` | Echo page, arcade |
| `assets/mascots/echo-badge.webp` | Arcade nav, arcade routes |
| `assets/mascots/pip-hero.webp` | Pip page, arcade |
| `assets/mascots/pip-badge.webp` | Arcade nav, arcade routes |
| `assets/mascots/stardust-hero.webp` | Stardust page, arcade |
| `assets/mascots/stardust-badge.webp` | Arcade nav |
| `assets/mascots/ember-hero.webp` | Ember page, arcade |
| `assets/mascots/ember-badge.webp` | Arcade nav |
| `assets/mascots/lumo-hero.webp` | Lumo / workshop pages |
| `assets/mascots/barnaby-hero.webp` | Site-wide |
| `assets/mascots/crew-together-hero.webp` | Homepage group shot |

---

## 3. Game Cover / Thumbnail Art (arcade cabinet images)

These appear on the arcade grid cards. 480×270 (16:9).

| Game | Thumbnail File | Status |
|------|---------------|--------|
| Echo's Swim (Echo Flight) | `assets/game-thumbs/echo-flight.webp` | Needs redraw |
| Nova Siege | `assets/game-thumbs/nova-siege.webp` | Needs redraw |
| Arcane Citadel | `assets/game-thumbs/arcane-citadel.webp` | Needs redraw |
| Tower Defence | `assets/game-thumbs/tower-defence.webp` | Needs redraw |
| Ember Smash | `assets/game-thumbs/ember-smash.webp` | Needs redraw |
| Gem Match | `assets/game-thumbs/gem-match.webp` | Needs redraw |
| Highway Dodge | `assets/game-thumbs/highway-dodge.webp` | Needs redraw |
| Critter Whack | `assets/game-thumbs/critter-whack.webp` | Needs redraw |
| Crossy Crew | `assets/game-thumbs/crossy-crew.webp` | Needs redraw |
| Stardust Snake | `assets/game-thumbs/stardust-snake.webp` | Needs redraw |

*Note: Rustfall and Sky High are hidden from the arcade. Their thumbs (`rustfall.webp`, `sky-high-friends.webp`) can be skipped.*

---

## 4. In-Game Sprites (drawn on canvas via JS  -  no external image files)

Most arcade games draw everything via canvas 2D API (no external sprite sheets). The "assets" here are the **code-drawn shapes**  -  to change how they look, edit the draw functions in the game's JS file.

| Game | JS File | What to Restyle |
|------|---------|----------------|
| Highway Dodge | `assets/js/inline/games-highway-dodge-1.js` | Player car, traffic cars, road, powerups (coins, fuel, shields, nitro), crash effect |
| Echo's Swim | `games/echos-flight.html` (inline) | Echo sprite, coral gates, bubbles |
| Stardust Snake | `games/stardust-snake.html` (inline) | Snake trail, stars, background sky |
| Ember Smash | `games/ember-smash.html` (inline) | Ball, paddle, bricks |
| Crossy Crew | `games/crossy-crew.html` (inline) | Pip character, cars, logs, river tiles |
| Critter Whack | `games/critter-whack.html` (inline) | Critter sprites, hab zones |
| Nova Siege | `games/nova-siege.html` (inline) | Ship, enemies, bullets, boss |

---

## 5. Lumo Sprite (only real sprite sheet in games folder)

| File | Used In |
|------|---------|
| `games/lumo-sprite.png` | Lumo Dash game |

---

## 6. OG / Social Images

| File | Used For |
|------|---------|
| `og/hub-games.png` | OpenGraph for game pages |
| `og/arcade.png` | OpenGraph for arcade.html |

---

## Priority Order (suggested)

1. Mascot character sheets  -  everything else depends on these
2. Game cover thumbnails  -  arcade first impression
3. Highway Dodge in-game (car sprites)  -  most-played game
4. Lumo sprite  -  Lumo Dash only external sprite
5. Hero / badge art  -  site-wide polish
