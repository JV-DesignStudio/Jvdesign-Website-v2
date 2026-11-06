# Step Authoring Standard

How to write a single workshop step. The Workshop Page Standard
(`WORKSHOP_PAGE_STANDARD.md`) defines the four page-level blocks; this document
defines what goes inside each step.

- Owner card: A2340.
- Reference pages: `workshops/jump-jump-mario-workshop.html` (checkbox steps),
  `workshops/js-flappy-workshop.html` (canvas build-along steps).
- Companions: `WORKSHOP_PAGE_STANDARD.md` (page blocks), `QUALITY_STANDARD.md`
  (page quality), `DESIGN_SYSTEM.md` (voice and characters).

## Step types

Every step belongs to one of three runtime patterns. The standard below applies
to all three; runtime-specific rules are marked.

| Pattern | Runtime | How it looks |
|---|---|---|
| **Checkbox** | `workshop-engine.js` | `.step-card` with `.step-header` / `.step-body`, unlocked one at a time |
| **Canvas build-along** | `workshop-canvas-engine.js` | Code editor + live preview iframe, steps defined in `CW_CONFIG` |
| **Builder / blueprint** | `workshop-restore-steps.js` | Continuous designer with `go(i)` / `renderStep()` navigation |

## Anatomy of a step

Every step, regardless of runtime, contains these parts in order:

### 1. Step header

- A short imperative title (5 words or fewer): `Build the Player`,
  `Add Gravity`, `Wire the Score`.
- A one-line subtitle that says what changes: `Make the little character who
  does all the jumping!`
- The step number, visible and matching `data-step` or the config index.

### 2. Goal box

The first thing inside the step body. One sentence, starting with a verb, that
names the observable result: `Create a Player scene with a CharacterBody2D for
your hero.`

Do not restate the title. The goal is the test: if the learner can show the
result, the step is done.

### 3. Explanation (teach before asking)

- **For external-engine workshops** (Godot, Unity, Roblox, Minecraft): use the
  two-column pattern. The child column uses plain words and excitement. The
  grown-up column names the real node types, parameters and file paths.
- **For browser-code workshops** (JS, Python, C++): the explanation is the
  prose between the code blocks. Name the concept, say what it does, then show
  the code.
- One concept per step. If the explanation needs a second heading, the step is
  too big. Split it.

### 4. Action (what to do)

The numbered instructions the learner follows. Rules:

- Imperative voice: `Click`, `Type`, `Open`, `Save`.
- Bold the exact UI label or code token the learner must find:
  `Click **Scene > New Scene**`.
- One action per numbered item. `Open the file and paste the code` is two
  items.
- Maximum 7 action items per step. If more are needed, split the step.
- Every code block must be copy-safe: the learner can paste it and it runs with
  no hidden context. If the block depends on earlier code, include enough
  context (an ellipsis comment and the surrounding lines) that the learner
  knows where to paste.

### 5. Try-it prompt (optional but encouraged)

A `callout tryit` box that asks the learner to observe or experiment before
moving on: `Can you find the FileSystem dock?` or `Change the gravity number
and watch the jump change.`

Not a quiz. No right answer. The point is noticing.

### 6. Interactive checkpoint

Every step ends with at least one checkpoint. Accepted checkpoint types, in
order of preference:

| Type | Class | When to use |
|---|---|---|
| Quiz gate | `.quiz-gate` | The step teaches a concept worth testing |
| Fill in the blanks | `.concept-fill` | The step introduces vocabulary or values |
| Order challenge | `.order-challenge` | The step is a procedure worth rehearsing |
| Code challenge | `CW_CONFIG` check | Canvas build-along: the engine checks the learner's code |
| Predict before run | `.predict-gate` | The learner guesses the output before running |
| Manual confirm | `.step-confirm` | External-engine steps where only the learner can see the result |

Rules for checkpoints:

- A quiz gate has three or four options (three preferred). The correct
  answer is `data-k` (base64-encoded index). Distractors must be plausible,
  not jokes.
- Fill-in-the-blank answers are base64-encoded in `data-a`. Accept common
  misspellings (the engine normalises case and whitespace).
- The checkpoint awards XP: `+15 XP` for a quiz or fill, `+10 XP` for an
  order challenge.
- After the checkpoint, a `completeStep` button advances to the next step.
  This is the only way forward.

### 7. Step completion

Checkbox and builder steps use `data-on="completeStep"` with the step number.
Canvas steps are completed by the engine when the code check passes. Both
patterns persist progress in localStorage via the page's `data-steps-key` or
`data-workshop-key`.

## Content rules

### Reading level

- Target age: 10 years old, reading alone. A grown-up column can use technical
  terms; the child column and the action list cannot.
- Sentence length: 20 words maximum in the child column and action list.
  Longer sentences split at the comma.
- Jargon: define a term the first time it appears. After that, use it
  freely. Never define it again.
- Reading-level lint: the linter checks Flesch-Kincaid grade level on the
  child-facing text. Target: grade 5 or below.

### Voice

- Second person: `you`, not `we` or `the user`.
- Present tense: `Click Save` not `You will click Save`.
- Active voice: `The sprite appears` not `The sprite will be shown`.
- Excitement is fine; hype is not. `That's your character!` is fine.
  `AMAZING EPIC WIN!!!` is not.
- Use the JVDS characters by name when they belong:
  - **Lumo** introduces concepts (outcome, explanation).
  - **Echo** handles recovery and debugging (stuck, fix-it).
  - **Ember** encourages creation (build, extend).
  - **Pip** handles play and testing (try-it, see-it).
  - **Stardust** guides the path (next step, release stages).

### Code blocks

- Indent with 2 spaces, never tabs.
- No trailing whitespace.
- Maximum 30 lines per code block. If longer, split across steps.
- Highlight the new lines with a comment: `// NEW: add gravity`.
- Every code block names the file it belongs to in a preceding line:
  `In **player.gd**, add:` or `In your **index.html**:`.

### Images and media

- Decorative images: `alt=""`.
- Instructional screenshots: `alt` describes what the learner should see,
  not the file name.
- Maximum one image per step. A second image means the step is doing too
  much.
- Prefer text instructions over screenshots. A screenshot of a menu is
  less durable than `Click **Scene > New Scene**`.

## Machine checks

The linter (`scripts/validate-step-authoring.js`) checks every step in every
public workshop page:

| Check | Rule | Severity |
|---|---|---|
| `has-goal` | Step body starts with `.goal-box` or a goal sentence | error |
| `action-count` | Action list has 1 to 7 items | warning |
| `checkpoint` | Step has at least one interactive checkpoint | error |
| `quiz-options` | Quiz gates have 3 or 4 options | error |
| `code-length` | No code block exceeds 30 lines | warning |
| `title-length` | Step title is 7 words or fewer | warning |
| `step-numbering` | Step numbers are sequential with no gaps | error |
| `complete-button` | Step ends with a completion mechanism | warning |
| `alt-text` | Images have non-empty `alt` or `alt=""` for decorative | warning |
| `no-inline-style-step` | Step body has no inline `style=` attributes | info |

Run before committing:

```bash
node scripts/validate-step-authoring.js
```

The linter reads the same `CONVERTED` and `BUILDER_STYLE` lists from
`validate-workshops.js` and also parses `CW_CONFIG` steps from the canvas
engine inline scripts.

## Definition of done

A step meets this standard when:

1. It has a title, goal box, explanation, action list and checkpoint.
2. It teaches one concept.
3. The linter passes with no errors.
4. A 10-year-old can read the child-facing text without help.
5. The code blocks run when pasted in order.

## Anti-patterns

- A step that says `Do steps 1 through 5` as a single instruction.
- A quiz with a joke distractor (`A banana`, `42`).
- A code block with no file name.
- An explanation that defines the same term twice.
- A step with no checkpoint (the learner clicks Next with no proof of understanding).
- Inline styles on step elements. Use the shared CSS classes.
