# JVDesignStudio Game Curation

The public Games page and JVDS Arcade are storefronts, not a dump of every experiment. `docs/GAME_CURATION.json` is the single source of truth for the tiers below; `scripts/validate-game-quality.js` reads its `flagship` list, and the hub and arcade lead with the same games.

## Tiers

- **Flagship**: the one game that leads every browse surface and must clear the full Studio Pick quality gate (`GAME_QUALITY_STANDARD.md`). Leads the games hub default view and the arcade Start Here.
- **Play Lab**: playable and discoverable, but not currently a headline title. Play Labs are reached through the labelled Play Labs filter and never fill the default view.
- **Retired**: broken, redundant, or no longer representative. Source stays available, but the game is removed from public browse surfaces.
- **Standalone app**: has its own app identity and must not be bundled into JVDS Arcade.
- **Web-only**: ships on the website but not in the Arcade bundle.
- **Non-arcade**: a tool, classroom activity, printable project, or other web content.

## Current set

**Flagship:** Arcane Citadel.

**Play Labs:** everything in `labs` (run `node -e "console.log(require('./docs/GAME_CURATION.json').labs.join(', '))"` for the live list).

**Retired:** VoidRush, Stardust Collector, Tiger Smash, Little Steps, Call of the Cards, Candy Kingdom.

**Standalone apps:** Biscuit Tin Clicker, Cozy Cafe Match.

**Web-only:** Sky High With Friends.

**Non-arcade:** Quiz Quest (Millionaire), Cozy Creatures.

## Quality review

Score each game from 1 to 5 for fun in the first 30 seconds, mobile controls, visual finish, reliability, replay value, originality, and brand fit. A game needs no individual score below 3 and an average of at least 3.5 to leave the retired list. A Flagship should average at least 4 and include evidence from a desktop and mobile smoke test.

Promoting a new game to Flagship means: it passes `npm run validate:game-quality` and `npm run audit:games`, then the human updates `flagship` in `docs/GAME_CURATION.json`. Do not hard-code a flagship list anywhere else.

## Current Arcade Improvement Board

A pick-up-ready task board for the next Arcade cleanup pass is available at `docs/arcade-improvement-board.questlog.json`. Import it into Quest Board to assign work across the team. The decision notes behind those cards are in `docs/ARCADE_IMPROVEMENT_TRIAGE_2026-09-10.md`.
