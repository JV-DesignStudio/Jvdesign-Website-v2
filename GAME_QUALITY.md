# Game quality labels

Every game in the JVDS Arcade carries one honest label so players and families
can tell a finished game from an experiment. The label shows on the cabinet and
the same four words are used in the studio's own workflow.

| Label | Meaning | Shown in the Arcade |
|---|---|---|
| READY | Finished. The core loop works, a run can be completed or lost, and the studio's automated browser tests pass at phone and desktop width. | Yes |
| BETA | Playable and fun, but still being improved. Known limits are visible on the page. | Yes |
| EXPERIMENT | An early prototype, shown on purpose so you can try an idea before it is a full game. Not marketed as a finished release. | Yes |
| HIDDEN | Broken, misleading, unfinishable or unsafe, or simply not worth showing yet. It is left out of the public catalogue until it is fixed. | No |

## What READY means

A game is READY only when all of these are true:

- It starts with no page errors.
- The controls are clear in the first few seconds.
- The main mechanic is playable from start to a win, a loss or a finish.
- Restart works.
- Sound and visual feedback respond to what the player does.
- Saving or high scores work wherever the page promises them.
- It works on the devices it claims to support, tested at 390px and 1440px.
- There is a passing automated test for it in `tests/`.

If a game fails one of these it goes back to BETA. If it fails several, or it is
not worth maintaining yet, it becomes HIDDEN and leaves the catalogue.

## Where the labels live

The public list is the `window.JVDS_GAME_QUALITY` map at the bottom of
`games-registry.js`. The arcade reads it and renders the pill on each card. Change
one line to change a label, and the cabinet updates on the next load.

`tests/game-quality.js` checks that every listed game has a valid label, that the
arcade renders it, and that this document still defines all four words.

The studio keeps an internal curation file (`docs/GAME_CURATION.json`) in the
private workspace. `scripts/validate-game-quality.js` reads it when present for
the flagship polish gate, and falls back to the `tier` flag on the registry when
it is not, so the gate never breaks the public build.
