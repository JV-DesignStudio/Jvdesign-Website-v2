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

A workshop is finished when a learner can follow it independently -- no adult
repairing broken steps, no AI filling gaps -- and end with something they made.

#### Structural (machine-checked by `validate-workshops.js`)

- `STORAGE_KEY` is defined and progress saves under it; the progress hub reflects it.
- Checkbox-style workshops have `toggleStep` and `completeStep`.
- Builder-style workshops have `go(i)` or `renderStep()`.
- All public workshops: `<title>`, `<meta name="description">`, `<link rel="canonical">` are present.
- An age label appears in the meta description ("Ages N+") and in the page body (`.pill-age` or equivalent).

#### Educational (verified by a human tester)

**Learning outcome.** The page states, before the first step, what the learner
will be able to make, do or explain when they finish. "You will build a
platformer with three levels" is a learning outcome. A catalogue blurb is not.

**Defined deliverable.** There is one clear finished thing: a running game, a
saved PNG, an exported file. The learner knows when they are done without
being told. A 37-step workshop with no win condition fails this gate.

**Prerequisites listed.** If the workshop assumes prior tools, accounts,
installs or knowledge, these are listed at the top with links where relevant.
"Requires Scratch account" counts. Discovering a required install mid-lesson
does not.

**Age label consistent.** The meta description, the hero/badge, and every
per-episode badge show the same age range. Contradictions (Ages 8+ in catalogue,
Ages 11+ on the page) must be resolved before release.

**Verified end-to-end.** The steps have been run on a clean setup -- no cached
files, no saved progress -- by someone who did not write them. Code examples
compile or execute as shown. Every code blank has a correct answer. Quizzes
run to the final screen and record a result.

**Recovery support.** At least one step that is known to go wrong has a
"Stuck? Try this" note or equivalent. Common mistakes are named, not just
the correct path.

**Challenge extension.** A learner who finishes the main path is offered one
further step: something to customise, break or extend independently. This is
the signal that the workshop builds independence, not copy-paste dependency.

**Lumo present.** Lumo appears in the copy, a callout, or a hint panel at
at least one meaningful point in the learning journey.

**Responsive.** Works at 390px and 1440px without horizontal scroll; interactive
elements are usable by touch and mouse.

#### Release gate

A workshop must pass all structural checks AND a named tester must record:

```
WORKSHOP: <filename>  TESTER: <name>  DATE: <YYYY-MM-DD>
Platform: <browser+OS>  Age proxy: <student/self/N-year-old>
PASS/FAIL  Notes: <any step that needed repair>
```

This record lives in the task evidence before the card reaches Human Review.
Until it exists the workshop must not appear in the public catalogue with a
"Ready" label, regardless of step count, visual quality, or previous audit passes.

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

## Accessibility

Interactive elements must be reachable and labelled for keyboard and screen
reader users. `validate-a11y.js --strict` is the gate: it checks names, labels,
alt text, landmarks and form fields in a real browser at 390px and 1440px, and it
skips redirect stubs so findings point at the real page.

- Menus announce their state. The nav toggle and the More dropdown expose
  `aria-expanded`, and keyboard focus is managed while they are open.
- Outcomes are announced. Quiz responses, scores and status messages go through
  `window.JVDS.announce()` into the `#jvds-announce` polite live region, so a
  screen reader user hears the result instead of only seeing it.

Canvas games: the canvas is the visual surface only. The controls are real
buttons and keys, and a win or a loss is announced through the live region.
Realtime action games (runners, shooters) have no full screen reader play mode;
that is a documented limitation, not a silent gap.

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
