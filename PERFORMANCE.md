# Performance budget

The studio has to work on a locked-down school laptop, not a developer machine.
This budget is the guard rail for that.

Measured by `scripts/check-performance.js`, which serves the site locally and
loads each template in Chromium with:

- CPU slowed 4x
- 1.5 Mbps down, 750 kbps up, 150 ms latency
- viewports 390x844 and 1440x900

It records four numbers per page and fails when one goes over budget.

## What is measured

| Metric | What it means | Why it matters here |
|---|---|---|
| LCP | When the largest thing on screen appears | A learner should see the page, not a blank screen |
| CLS | How much the layout jumps | Jumping buttons cause mis-taps on a phone |
| TBT | Total blocking time from long tasks | A weak CPU freezes on heavy scripts |
| Transfer | Bytes actually sent | School wifi and filtered networks are slow |

INP needs real interaction, so TBT stands in for it in a lab run.

## Current budgets

See `performance-budget.json`. Each page can override the default.

| Template | LCP | CLS | TBT | Transfer |
|---|---|---|---|---|
| `/` | 6000 ms | 0.15 | 1800 ms | 1300 KB |
| Workshop hub | 3000 ms | 0.15 | 1200 ms | 800 KB |
| Tools hub | 5000 ms | 0.3 | 1200 ms | 500 KB |
| Arcade | 3500 ms | 0.25 | 1400 ms | 400 KB |
| Sample game | 2500 ms | 0.1 | 800 ms | 300 KB |
| Sample tool | 4000 ms | 0.22 | 1200 ms | 600 KB |

These are deliberately loose. The gate is meant to catch a page doubling in
weight, or a layout that starts jumping, not to chase a perfect lab score.

## Running it

```bash
node scripts/check-performance.js            # gate, exits 1 on a breach
node scripts/check-performance.js --report   # print numbers, never fail
node scripts/check-performance.js --json out.json
```

CI runs the gate in `.github/workflows/validate.yml` after the build. A
regression fails the build.

## Raising a budget

A budget is a promise to a learner. If a page needs a higher number, say which
page, which metric, the measured before and after, and why the trade is worth
it. Do not raise the default just to make a red build green.
