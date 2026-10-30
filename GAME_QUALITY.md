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

A game is READY only when the full release checklist passes. Run every item manually
on the day of release or re-test, then record the result in `window.JVDS_GAME_TESTS`
in `games-registry.js` with `testDate` (ISO date) and `version` (short commit hash).

### Release checklist (A1956)

- **Opens without error** - no console errors on load; CSP violations count as failures.
- **Start works** - the player can reach the first playable moment from the title or main screen.
- **Play works** - the core mechanic runs without freezing, NaN scores or broken collision.
- **Lose works** - a losing condition triggers and shows the player their result.
- **Win works** (where applicable) - a win or completion state is reachable and shows correctly.
- **Restart works** - the player can start again from the result screen without reloading the page.
- **Controls match the advertised input** - keyboard, touch or mouse controls work as described on the page.
- **Scores, rewards and achievements behave correctly** - no negative scores, no reward on first frame, unlock logic matches description.
- **Save and offline behaviour match the description** - if the page promises high score persistence, confirm it survives a reload.
- **Mobile layout checked at 390px** - game is playable at phone width if the page does not say desktop-only.
- **Desktop layout checked at 1440px** - no overflow or broken UI at wide viewport.
- **No critical blocker** - the player can always reach a win, loss or end state; the game cannot get permanently stuck.
- **Automated test passes** - there is a passing automated test for it in `tests/`.

If a game fails one or two items it goes back to BETA. If it fails several, or it
is not worth maintaining yet, it becomes HIDDEN and leaves the catalogue.

## Where the labels live

The public list is the `window.JVDS_GAME_QUALITY` map in `games-registry.js`.
The arcade reads it and renders the pill on each card. Change one line to change
a label, and the cabinet updates on the next load.

Test records (date, commit, checklist pass) live in `window.JVDS_GAME_TESTS` in the
same file. Every READY game must have an entry. When a game regresses: update its
label back to BETA, and remove or mark its test record stale.

`tests/game-quality.js` checks that every listed game has a valid label, that the
arcade renders it, and that this document still defines all four words.

The studio keeps an internal curation file (`docs/GAME_CURATION.json`) in the
private workspace. `scripts/validate-game-quality.js` reads it when present for
the flagship polish gate, and falls back to the `tier` flag on the registry when
it is not, so the gate never breaks the public build.
