# JVDS Quality Standard

One definition of finished for every game, workshop, tool, app and site page.

A page is not finished because it exists. It is finished when its core journey
works on a school computer, at 390px and 1440px, with an owner and evidence a
test can reproduce.

## Finished means owner + checklist + evidence

- **Owner.** The character-agent for the tag (Pip games, Ember tools, Lumo
  workshops, Echo site and brand, App Health apps) or a named human.
- **Checklist.** The per-type list below passes.
- **Evidence.** Names the file and a passing test at 390px and 1440px, recorded
  on the card before it reaches Human Review.

## Per-type checklists

### Game (the keep-rule checklist)

1. Starts with no page errors.
2. Controls are clear in the first few seconds.
3. The main mechanic plays from the start to a win, a loss or a finish.
4. Restart works.
5. Sound and visual feedback respond to what the player does.
6. Saving or high scores work wherever the page promises them.
7. Works at 390px and 1440px on the devices it claims.
8. A passing automated test exists in `tests/`.

These are the same conditions behind the READY label. `GAME_QUALITY.md` defines
how they map to READY / BETA / EXPERIMENT / HIDDEN.

### Workshop

- Lumo is present in the copy or a callout.
- The quiz or lesson runs to the end and gives a result.
- Progress saves under the workshop's STORAGE_KEY and shows on the progress hub.
- A clear next step is offered at the end.
- Works at 390px and 1440px, and a test passes.

### Tool

- Create, edit, save and export all work on this device with no account.
- Export or download produces a real file the learner can keep.
- Touch and mouse both usable, with undo or reset where editing matters.
- Works at 390px and 1440px, and a test passes.

### App

- A fresh install opens with no error banner.
- The catalogue or first screen loads real content.
- It reopens offline.
- `package.json` version matches the Android versionName.
- `validate:public` passes.

### Site page

- Every link resolves (`validate-links` reports 0 broken).
- Every call to action lands on a real, non-duplicated destination.
- No horizontal overflow at 390px or 1440px.
- Any privacy or data claim is accurate.

## The four dispositions

When something is not finished, decide what to do with it. Every audit card
carries exactly one of these words in its title:

| Disposition | Use when | Action |
|---|---|---|
| **Keep-and-polish** | It works and learners want it, and only small gaps remain. | Keep it live and improve it in place. |
| **Fix-before-release** | It blocks the core journey or misleads the learner. | Do not call it shipped. Fix it, then re-verify. |
| **Merge-or-simplify** | It duplicates another page, tool or system. | Combine into one and retire the weaker. |
| **Remove-or-archive** | It is broken, unwanted or superseded. | Hide it from the catalogue until it is repaired. |

The disposition is not the same as the game label. A game can be BETA and still
be Keep-and-polish, or EXPERIMENT and be Remove-or-archive.

## How the board uses this

- Audit cards carry their disposition at the start of the title, for example
  `[Fix-before-release] Arcane Citadel flagship: complete a full verified playthrough`.
- A card is done only when its checklist passes and its evidence names a file and
  a passing test. Only a human approves it out of Human Review.
- The tests are `tests/<page>-*.js` for a single page, plus the tag suite
  (tools, games, workshops, site).

## Where the rules live

- Game labels: `GAME_QUALITY.md`.
- This document is the single standard the audit board points to.
