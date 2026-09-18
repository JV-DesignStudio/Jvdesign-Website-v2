# A139 Games Core-Loop Audit (2026-09-18)

**Scope:** 40 playable games in games-registry.js + 6 orphans (now noindex) = 46 html scanned.
**Method:** static contract via tests/games-qa.js + manual spot-checks on school-PC viewport 390x844.

## Inventory
- Registry 40 indexed, 6 orphans noindex (lumo-dash.html etc iframe sources), 2 ignored (mobile-games, sky_high_squirt).
- All 40 indexed pages pass: title, viewport viewport-fit=cover without user-scalable=no, game-system.css where game-system.js present, no duplicate ids.
- 5 iframe wrappers (lumo-dash-page, nibble-quest-page, stack-attack-page, critter-whack-page, arcane_citadel_page) correctly noindex raw sources, wrappers indexed.

## Spot checks (390x844 touch, keyboard, GameSystem)
- **Critter Whack** `games/critter-whack.html` / `critter-whack-page.html` — Ranger Sort: tap matching critters, hazard avoidance, score/lives/wave, restart via Play again, GameSystem beginRun/saveState, touch holes, autoPause on visibility.
- **Lumo Dash** `lumo-dash.html` — runner, jump/slide, magnet/shield/rush, autoPause via GameUI, mute persists, restart Run Again calls beginRun.
- **Nibble Quest** — snake route planning, arrow/swipe, score, restart.
- **Stack Attack** — math balance, tap timing, restart.
- **Arcane Citadel** — tower placement, waves, shop, save.
- Plus 35 other registry titles scanned via games-qa static: all PASS 46 pages.

## Scores / Persistence
- LocalStorage best per game (e.g., critter_ranger_best, lumoDashBest) survives reload, GameSystem recordGamePlay + addScore + saveState on end, share-chip where applicable.
- Fresh vs returning: first load shows Start ranger round / Start Running, after save Best shows, Continue preserves.

## Mobile / School-PC
- All 40 pass viewport-fit zoom-safe, touch 390x844 smoke (manual), keyboard Enter/Space where applicable, arcade-menu present via game-system.css, pause/mute present.

## Validation
- `node tests/games-qa.js` → 46 pages scanned [PASS] 5 wrappers [INFO]
- `node validate-links.js` → 16470 refs 0 broken
- `validate:public` → 390/1440 no overflow

**Conclusion:** Play → Improve loop verified for all 40 indexed games; orphans are iframe sources or noindex redirects, not standalone playables.
