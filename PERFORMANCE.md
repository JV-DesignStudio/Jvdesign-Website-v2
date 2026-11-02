# Performance baseline

The studio has to work on a locked-down school laptop, not a developer machine.
This baseline and budget are the guard rails for that.

Measured by `scripts/check-performance.js`, which serves the site locally and
loads each template in Chromium with:

- CPU slowed 4x
- 1.5 Mbps down, 750 kbps up, 150 ms latency
- viewports 390x844 (phone) and 1440x900 (desktop)
- a fresh browser context and an empty cache for every run, so it is a real
  first visit
- gzip on text responses, because GitHub Pages and Netlify compress HTML, CSS
  and JS in transit

## What is measured

| Metric | What it means | Good threshold |
|---|---|---|
| LCP | When the largest thing on screen appears | 2500 ms or less |
| INP | Delay from a tap or click to the next paint | 200 ms or less |
| CLS | How much the layout jumps | 0.1 or less |
| TBT | Total blocking time from long tasks | Guard rail only |
| Transfer | Bytes actually sent | Guard rail only |

The first three are the Core Web Vitals. The targets above are the standard
"good" thresholds, which Google defines for real users at the 75th percentile.
This harness is a lab run on a deliberately harsh school-device profile, so a
lab number below the target is a strong signal that real users are fine, not a
field guarantee.

INP used to be represented by TBT because it needs a real input. The harness now
clicks the first visible button on each page after it settles and reads the
Event Timing entries for that interaction. Load metrics (LCP, CLS, TBT,
transfer) are read before the click so the input does not inflate them.

## Representative set, 2 November 2026 (A1821)

The set grew from five templates to twelve: home, arcade, a heavy game, the
Arcade Game Maker, Pixel Studio, the 3D Builder, a workshop, the workshop
catalogue, books, the dev log, parents and the dev-tools hub. For each row,
"before" is the quiet run taken before the A1821 fixes and "after" is the
final quiet run after them. Full runs are in `performance-baseline.json`.

| Page | Viewport | LCP before → after | INP after | CLS before → after |
|---|---|---|---|---|
| Homepage `/` | 390 | 2932 → 2196 ms | 40 ms | 0.000 → 0.000 |
| Homepage `/` | 1440 | 2256 → 2208 ms | 32 ms | 0.013 → 0.011 |
| Arcade `/arcade.html` | 390 | 1408 → 1280 ms | 32 ms | 0.000 → 0.000 |
| Arcade `/arcade.html` | 1440 | 1260 → 1336 ms | 32 ms | 0.061 → 0.061 |
| Heavy game `/games/echos-flight.html` | 390 | 1968 → 1004 ms | 16 ms | 0.000 → 0.000 |
| Heavy game `/games/echos-flight.html` | 1440 | 1052 → 976 ms | 32 ms | 0.013 → 0.013 |
| Arcade Game Maker `/tools/arcade-game-maker.html` | 390 | 4920 → 5216 ms | 72 ms | 0.000 → 0.000 |
| Arcade Game Maker `/tools/arcade-game-maker.html` | 1440 | 4808 → 5504 ms | 96 ms | 0.202 → 0.189 |
| Pixel Studio `/tools/pixel-studio.html` | 390 | 1836 → 1704 ms | 0 ms | 0.020 → 0.020 |
| Pixel Studio `/tools/pixel-studio.html` | 1440 | 2032 → 2160 ms | 80 ms | 0.036 → 0.036 |
| 3D Builder `/workshops/3d-builder.html` | 390 | 4600 → 4556 ms | 48 ms | 0.014 → 0.014 |
| 3D Builder `/workshops/3d-builder.html` | 1440 | 4780 → 4600 ms | 200 ms | 0.021 → 0.020 |
| Workshop `/workshops/my-first-browser-game.html` | 390 | 2052 → 2320 ms | 48 ms | 0.068 → 0.068 |
| Workshop `/workshops/my-first-browser-game.html` | 1440 | 2228 → 2032 ms | 40 ms | 0.063 → 0.063 |
| Workshop catalogue `/pages/workshop.html` | 390 | 1948 → 1864 ms | 56 ms | 0.000 → 0.000 |
| Workshop catalogue `/pages/workshop.html` | 1440 | 1948 → 1764 ms | 48 ms | 0.049 → 0.049 |
| Books `/pages/books.html` | 390 | 1600 → 1672 ms | 32 ms | 0.002 → 0.004 |
| Books `/pages/books.html` | 1440 | 1800 → 1740 ms | 40 ms | 0.013 → 0.013 |
| Dev Log `/pages/devlog.html` | 390 | 2836 → 2420 ms | 16 ms | 0.181 → 0.000 |
| Dev Log `/pages/devlog.html` | 1440 | 3636 → 3412 ms | 24 ms | 0.222 → 0.001 |
| Parents `/pages/parents.html` | 390 | 2048 → 2016 ms | 40 ms | 0.000 → 0.000 |
| Parents `/pages/parents.html` | 1440 | 2112 → 2168 ms | 40 ms | 0.010 → 0.010 |
| Dev Tools `/pages/dev-tools.html` | 390 | 1244 → 1256 ms | 48 ms | 0.000 → 0.005 |
| Dev Tools `/pages/dev-tools.html` | 1440 | 3368 → 3544 ms | 40 ms | 0.282 → 0.201 |

Fourteen of the twenty-four rows meet all three good thresholds on the school
profile. The 3D Builder and Arcade Game Maker are the exceptions: the builder
or editor is itself the largest paint, so it cannot appear before its engine
and shell have parsed on a 4x slowed CPU. They keep explicit lab budgets above
the good threshold so a real regression still fails. The remaining CLS on the
dev-tools desktop row is a parse-time reorder, not a late stylesheet:

- **Dev Log** was the biggest layout problem. The post grid is built from
  `devlog-data.js` after the document parses, so the empty grid and the footer
  painted first and then jumped when the cards filled in (CLS 0.181 and 0.222).
  The posts section and footer now stay hidden until the first render, and the
  post data is preloaded. CLS is 0.000 and 0.001, and LCP also improved.
- **Dev Tools** carried its section-reorder CSS at the end of `<body>`, so the
  tools grid and news blocks swapped places at about 2.5 s (CLS 0.282). The
  rule now lives in `<head>` and applies before first paint. CLS is 0.201; the
  rest is the next-step handoff moving as the long grid is parsed, tracked as
  follow-up work rather than hidden.
- **3D Builder** loads a 700 KB engine. Deferring it until after first paint
  was measured and rejected: LCP got worse (5208 and 5372 ms) because the
  builder is the largest paint and still waits for the engine. The eager engine
  was kept and the page has a measured 5500 ms LCP budget instead.
- **Arcade Game Maker** already loads Phaser only on the first Play press
  (A2175). Its LCP is still about 5.2 to 5.5 s because the maker shell is
  heavy; the 5700 ms budget catches further regressions.
- **Pixel Studio**, the workshop, books, parents and the arcade stay within
  their measured ranges.

## Current budgets

See `performance-budget.json`. Each page can override the default. Budgets are
regression guards set above the measured quiet baseline, and they are looser
than the good thresholds on heavy tool pages where the editor cannot paint
that early on a 4x slowed CPU. INP is given extra headroom because a synthetic
click is noisier than a load metric, and a busy shared machine or CI runner
should not produce a false failure.

| Template | LCP | INP | CLS | TBT | Transfer |
|---|---|---|---|---|---|
| `/` | 3000 ms | 350 ms | 0.1 | 400 ms | 800 KB |
| `/arcade.html` | 2500 ms | 400 ms | 0.15 | 700 ms | 800 KB |
| `/games/echos-flight.html` | 2500 ms | 250 ms | 0.1 | 400 ms | 400 KB |
| `/tools/arcade-game-maker.html` | 5700 ms | 350 ms | 0.35 | 4000 ms | 1400 KB |
| `/tools/pixel-studio.html` | 2600 ms | 250 ms | 0.1 | 600 ms | 600 KB |
| `/workshops/3d-builder.html` | 5500 ms | 300 ms | 0.1 | 1600 ms | 700 KB |
| `/workshops/my-first-browser-game.html` | 2800 ms | 300 ms | 0.15 | 600 ms | 500 KB |
| `/pages/workshop.html` | 2800 ms | 400 ms | 0.2 | 600 ms | 900 KB |
| `/pages/books.html` | 3000 ms | 300 ms | 0.1 | 400 ms | 1000 KB |
| `/pages/devlog.html` | 4500 ms | 300 ms | 0.1 | 600 ms | 800 KB |
| `/pages/parents.html` | 3000 ms | 300 ms | 0.1 | 400 ms | 500 KB |
| `/pages/dev-tools.html` | 5000 ms | 350 ms | 0.3 | 500 ms | 1000 KB |

The homepage LCP budget moved from 2800 to 3000 ms because three quiet
baseline runs measured 2428, 2464 and 2544 ms, and a busy run measured 2804 ms.
The new number keeps a margin above the quiet range and still fails a return to
the old 4500 ms first paint.

## Running it

```bash
npm run check:performance                              # gate, exits 1 on a breach
node scripts/check-performance.js --report             # print numbers, never fail
node scripts/check-performance.js --report --baseline  # append a dated run to performance-baseline.json
```

CI runs the gate in `.github/workflows/validate.yml` after the build. A
regression fails the build. If a row breaches a budget, the harness measures
that row up to two more times and keeps the best run, so a transient load spike
on a shared machine does not look like a regression. Pass `--retries 0` to
disable the retries.

## Repeating after a release

Run `node scripts/check-performance.js --report --baseline` after each
significant release and commit the new entry in `performance-baseline.json`
with the release changes. The entry
records the date, commit and every measurement. Update the baseline table above
if a number moves enough to change the story, and add a follow-up card for any
page that falls outside a good threshold.

Only use quiet runs for a budget change. Repeat runs on a shared machine drift
well above normal numbers while an install or another Puppeteer suite is
running, and the committed page drifts with them.

## Real-user data

Field data is the real check, but it needs a CrUX or PageSpeed Insights API key.
The offline studio does not have one, and the free PageSpeed endpoint rate
limits anonymous requests. When a key is available, record the 75th percentile
LCP, INP and CLS for the same pages beside this lab baseline, rather than
treating the lab run as field truth.

## Raising a budget

A budget is a promise to a learner. If a page needs a higher number, say which
page, which metric, the measured before and after, and why the trade is worth
it. Do not raise the default just to make a red build green.
