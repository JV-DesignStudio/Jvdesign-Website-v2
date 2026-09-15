# A219 Arcade Per-Game QA Table

Date: 15 September 2026
Scope: `games/*.html` excluding `mobile-games.html` and `sky_high_squirt.html`, matching `tests/games-qa.js`.

## Summary

Full Arcade browser QA passed across 46 pages at phone portrait, phone landscape, tablet, and desktop. Static contract also passed: titles, viewport metadata, zoom-safe viewport, no duplicate IDs on GameSystem pages, and valid wrapper handling.

The Arcade is technically healthy, but the next quality gap is depth. The best new quality bar is `games/mini-theme-park-builder.html`: it now has a real multi-day loop, stats, unlocks, score saving, and mobile-safe controls. Several older games still work but are short single-loop experiences or iframe wrappers that need parity with that standard.

## Evidence

| Check | Result |
|---|---|
| `RUN_BROWSER=1 npm run audit:games` | PASS, 46 pages scanned, desktop/mobile browser smoke PASS |
| Static game-page contract | PASS |
| Browser sizes | 390x844, 844x390, 768x1024, 1280x900 |
| Wrapper notes | `arcane_citadel_page.html`, `critter-whack-page.html`, `lumo-dash-page.html`, `nibble-quest-page.html`, `stack-attack-page.html` are iframe wrappers |
| `npm run validate:public` | PASS |

## Per-Game QA Table

| Rank | File | Works? | Main Finding | Next Fix |
|---:|---|---|---|---|
| 1 | `games/mini-theme-park-builder.html` | Yes | Stronger replay loop now in place with budget, guests, queues, days, stars, unlocks, save and best score. | Use as the depth benchmark for creative sims. |
| 2 | `games/garden-defense.html` | Yes | Deeper strategy shape already: waves, placement, resource decisions. | Add campaign map, plant unlock tree, and challenge modifiers. |
| 3 | `games/neon-tiles.html` | Yes | Timing action works, but long-term mastery could be clearer. | Add songs, practice mode, medals, and creator-made beat imports. |
| 4 | `games/bubble-pop-galaxy.html` | Yes | Solid puzzle base with levels and bombs. | Add named constellations, level goals, and unlockable bubble powers. |
| 5 | `games/dough-dash.html` | Yes | Order/match loop has good decisions. | Add shop upgrades, customer streaks, and recipe progression. |
| 6 | `games/echos-flight.html` | Yes | Route choice gives it more shape than basic endless games. | Add expeditions, relics, weather routes, and upgrade cards. |
| 7 | `games/pips-bakery-empire.html` | Yes | Idle progression works. | Add quests, bakery layout choices, and active mini-orders. |
| 8 | `games/paper-toss-deluxe.html` | Yes | Simple and readable skill loop. | Add office tour contracts, trick shots, and daily challenges. |
| 9 | `games/pastry-match.html` | Yes | Works as a memory puzzle. | Add puzzle rooms, helper tools, and star targets. |
| 10 | `games/star-chef.html` | Yes | Playable timing/management idea. | Add recipe queue, station upgrades, and customer patience arcs. |
| 11 | `games/bread-blocks.html` | Yes | Classic block loop. | Add mission targets, power pieces, and themed boards. |
| 12 | `games/lumo_firefly_night.html` | Yes | Shooter loop works. | Add map progression, firefly abilities, and boss boards. |
| 13 | `games/pip_star_connect.html` | Yes | Gentle puzzle works. | Add constellation book, timed/comfy modes, and unlockable skies. |
| 14 | `games/gem_match.html` | Yes | Match loop works. | Add target levels, boosters, and puzzle-of-the-day. |
| 15 | `games/voidrush.html` | Yes | Action loop works and viewport is zoom-safe. | Add missions, ship upgrades, enemy patterns, and run rewards. |
| 16 | `games/lumo-dash.html` | Yes | Runner works and viewport is zoom-safe. | Add route choices, character perks, and checkpoint goals. |
| 17 | `games/stardust_collection.html` | Yes | Score save hook exists. | Add collection sets, combo goals, and unlockable trails. |
| 18 | `games/cozy-biscuit-clicker.html` | Yes | Arcade profile bridge exists. | Add bakery chapters, meaningful choices, and prestige milestones. |
| 19 | `games/backpack-quest.html` | Yes | New prototype is reachable as a page. | Deepen combat choices, loot synergies, and run events. |
| 20 | `games/beat-builder-battle.html` | Yes | New prototype is reachable as a page. | Add beat sharing, enemy patterns, and song progression. |
| 21 | `games/creature-rescue-clinic.html` | Yes | New prototype is reachable as a page. | Add patient traits, diagnosis puzzles, and clinic upgrades. |
| 22 | `games/echo-casebook.html` | Yes | New prototype is reachable as a page. | Add clue board, branching suspect logic, and case chapters. |
| 23 | `games/marble-run-lab.html` | Yes | New prototype is reachable as a page. | Add physics scoring, part unlocks, and challenge blueprints. |
| 24 | `games/pixel-pet-arena.html` | Yes | New prototype is reachable as a page. | Add drawing import, pet abilities, and league progression. |
| 25 | `games/stardust-ruins.html` | Yes | New prototype is reachable as a page. | Add rooms, key puzzles, hazards, and relic collection. |
| 26 | Wrapper pages | Yes | Five games are iframe wrappers, which pass loading but hide some direct QA detail. | Prefer migrating wrappers to direct pages or add wrapper-specific restart/save probes. |
| 27 | Remaining legacy pages | Yes | Browser smoke passes, but depth varies and some games still feel like demos. | Rank by player value and upgrade the best candidates before adding more games. |

## Recommended Next Arcade Tasks

1. Upgrade `games/backpack-quest.html` into the next deep replayable game: map nodes, loot choices, enemy variety, relics, run summary, best score, mobile controls.
2. Upgrade `games/marble-run-lab.html`: real physics challenges, part palette, star goals, saved blueprints, and shareable build code.
3. Upgrade `games/echo-casebook.html`: clue board, suspect reasoning, wrong-answer feedback, case chapters, and completion badges.
4. Add wrapper-specific QA probes for restart/save/player-profile in iframe games.
5. Curate the Arcade hub so strong games are featured and prototype games are labelled as experiments until upgraded.
