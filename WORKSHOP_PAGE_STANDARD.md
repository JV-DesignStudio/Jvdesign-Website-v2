# Workshop Page Standard

One definition of a good workshop page. The audit board had about twenty separate
cards asking for the same four things on every workshop page. Run one at a time
they were twenty passes over the same pages, and each pass could undo the last.
This document defines the four things once. A series slice then rolls the same
pattern out to a group of workshops.

- Owner card: A2191.
- Reference page: `workshops/my-first-browser-game.html`.
- Companions: `QUALITY_STANDARD.md` (a page is finished when owner, checklist and
  evidence agree), `WORKSHOP_QA.md` (the release checklist), `DESIGN_SYSTEM.md`
  (voice, characters and colour).

Keep this file next to the other workshop docs. It is the single source the
rollout slices point at.

## The four blocks

Every published workshop page carries these four things, in this order, after the
hero.

| Order | Block | Marker | Class | Purpose |
|---|---|---|---|---|
| 1 | Outcome panel | `WS-OUTCOME` | `.ws-outcome` | What the learner makes, learns and finishes |
| 2 | Stuck? Try this | `WS-STUCK` | `.ws-stuck` | Recovery for the mistakes this workshop actually causes |
| 3 | Creative extension | part of the outcome panel | `.ws-outcome` | One open-ended task so the work becomes the learner's own |
| 4 | Next step | `WS-NEXT` | `.next-route` | One clear next workshop in the same pathway |

The markers are HTML comments:

```html
<!-- WS-OUTCOME:START --> ... <!-- WS-OUTCOME:END -->
<!-- WS-STUCK:START --> ... <!-- WS-STUCK:END -->
<!-- WS-NEXT:START --> ... <!-- WS-NEXT:END -->
```

Each block also carries a data attribute with the workshop id, so a page can be
checked on its own:

```html
<section class="ws-stuck" data-workshop-stuck="my-first-browser-game">
<nav class="next-route" data-workshop-next="my-first-browser-game">
```

### 1. Outcome panel

The learner sees, before the first step, what they will be able to make, do or
explain. A catalogue blurb is not an outcome.

Required labels, in this order:

- `Your project` - the thing being built, named the way a learner would name it.
- `You'll learn` - the concept and why it works, in plain language.
- `Finish with` - the deliverable a learner can keep or show.
- `Then extend it` - the creative extension (block 3).

Implementation:

- Data lives in `content/workshop-outcomes.json`.
- `scripts/apply-workshop-outcomes.js` stamps the `WS-OUTCOME` block.
- `scripts/validate-workshop-outcomes.js` checks every published workshop.
- `tests/workshop-outcomes.js` renders sample pages at 390px and 1440px.

### 2. Stuck? Try this

Recovery is part of teaching, not a fallback. Name the mistakes this workshop
actually causes, then give the learner a way back without asking an adult or
opening a developer console.

Required content:

- The heading `Stuck? Try this`.
- At least three real mistakes, phrased as the symptom the learner sees.
- Each mistake is a `details.ws-stuck-item` with a `summary`, a
  `What you'll see:` line and a `Fix:` line.
- A note pointing at a cheat sheet, the step again, or an adult.
- Plain English. Do not assume installs, file paths or a developer console.

Implementation:

- The shared pattern is the `.ws-stuck` CSS in `style-shared.css`.
- Reference markup is the `WS-STUCK` block in `workshops/my-first-browser-game.html`.
- `content/workshop-debugging.json` and `scripts/apply-workshop-debugging.js`
  stamp the deeper `WS-DEBUG` challenge on engine hub pages. That is the
  hint-first debugging task, and it can sit alongside `WS-STUCK`.
- `tests/workshop-debugging.js` guards the debugging task where it is used.

### 3. Creative extension

A learner who finishes the guided path is offered one further task: something to
customise, break or extend independently. This is the difference between a
copy-paste exercise and a creative one.

Required content:

- The `Then extend it` field in the outcome panel.
- One concrete extension, tied to this workshop, not a generic "add a feature".

Implementation:

- The extension is part of `content/workshop-outcomes.json` (`extend`) and the
  outcome panel. Do not add a second extension list.

### 4. Next step

Every workshop ends with one relevant next step, not a wall of unrelated links.
It should be the next workshop in the same pathway.

Required content:

- The kicker `Up next in the series`.
- One real local link to the next workshop in the same series.
- The pathway hub as a secondary link.
- Links must resolve (`validate-links.js` reports zero broken).

Implementation:

- The shared pattern is `.next-route` in `style-shared.css`.
- Reference markup is the `WS-NEXT` block in `workshops/my-first-browser-game.html`.
- `tracks.js` and the finish-banner code can also surface the next track item.
  When they do, the `WS-NEXT` block is still the visible, static fallback.

## Layout and accessibility

- Blocks are max 960px wide, centred, with 20px side padding, and collapse under
  640px.
- Blocks render at 390px and 1440px with no horizontal overflow.
- Use a real `<section>` or `<nav>` with `aria-labelledby` or `aria-label` and a
  real `<h2>`.
- Disclosure summaries must be keyboard reachable and announce their state.
- Decorative mascot images use `alt=""`. The character name is in the copy.
- No duplicate element ids. Keep one id per page.

## Machine checks

Run these before a slice reaches review:

```bash
node validate-workshops.js
node scripts/validate-workshop-outcomes.js
node tests/workshop-page-standard.js
node validate-a11y.js --area=workshops --strict
node validate-links.js
```

`validate-workshops.js` checks the reference page for the `WS-STUCK` and
`WS-NEXT` markers, at least three recovery items, and a real local next-step
link. `tests/workshop-page-standard.js` renders the reference page at 390px and
1440px and checks the outcome labels, the recovery items, the next href, no
duplicate ids, no unnamed images and no page errors.

When a slice finishes a page, add it to `tests/workshop-page-standard.js` so the
guarantee grows with the rollout.

## Rollout in eight series slices

The audit children are grouped into eight slices. Each slice owns a disjoint set
of files, so two open cards never edit the same workshop. Every slice depends on
A2191, the standard, and reuses the shared CSS and markers above. Do not redefine
the blocks per page.

| Slice | Card | Series | File family |
|---|---|---|---|
| 1 | A1851 | Scratch | `workshops/scratch-*.html`, `workshops/my-first-scratch-game*.html` |
| 2 | A1859 | Python and JavaScript browser games | `workshops/python-*.html`, `workshops/js-*.html`, `workshops/my-first-browser-game.html`, `workshops/build-a-game-15-min.html` |
| 3 | A1867 | Roblox and Minecraft | `workshops/roblox-*.html`, `workshops/minecraft-*.html` |
| 4 | A1888 | Godot, Unity and Unreal | `workshops/godot-*.html`, `workshops/unity-*.html`, `workshops/unreal-*.html` |
| 5 | A1903 | GameMaker, GDevelop, Defold and PICO-8 | `workshops/gml-*.html`, `workshops/gdevelop-*.html`, `workshops/defold-*.html`, `workshops/pico8-*.html` |
| 6 | A1917 | 3D Builders and 3D Design and Print | `workshops/3d-*.html`, `workshops/blender-*.html`, `workshops/tinkercad-*.html`, `workshops/castle-*.html`, `workshops/phone-stand-builder.html` |
| 7 | A1951 | Learning Lab and Learning Tools | the Learning Lab and Learning Tools resource pages and their worksheets |
| 8 | A2033 | Cross-series support and the written standard | this document and the shared `.ws-stuck` / `.next-route` pattern |

The reference page `my-first-browser-game.html` belongs to slice 2 (A1859). Slice
8 keeps the written standard and the shared pattern in sync and reviews the
slices, but it does not edit a page owned by a series slice.

If a slice needs a new file family, add it to the table and name it on the card
before starting. A card must never edit a file owned by another open card.

## Definition of done for a slice

A slice is done when:

1. Every public workshop page in its family renders all four blocks.
2. Each block uses the shared marker, class and required labels.
3. A page sample from the slice passes at 390px and 1440px with no overflow.
4. `validate-workshops.js` and `scripts/validate-workshop-outcomes.js` pass.
5. `tests/workshop-page-standard.js` passes on the pages changed.
6. `validate-a11y.js --area=workshops --strict` passes on the pages changed.
7. The card evidence names the files and the test results.

## Anti-patterns

- A new one-off panel per page. Use the shared classes.
- Recovery text that says "read the error" without saying where to look.
- An extension that is just "add a feature". Name the feature and the test.
- A next step that is a list of ten unrelated links.
- Editing a page owned by another open card.
- Redefining the standard in a second document. Change this file instead.
