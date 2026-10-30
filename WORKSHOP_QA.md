# Workshop QA Checklist

Every workshop must pass this checklist before it is marked published/released.
Run it in a private/incognito window with no previous browser data for a fresh-start test.

## Before publishing

- [ ] Every lesson step can be opened and read without console errors
- [ ] Code examples in every lesson run and produce the stated result
- [ ] Every quiz accepts the correct answer and rejects all stated incorrect answers
- [ ] Answer feedback shows correct message on pass and on fail
- [ ] All buttons work: next step, previous step, restart, reset, export (where present)
- [ ] All internal links and "continue" links resolve to a real page
- [ ] Progress indicator updates correctly as steps are completed
- [ ] Completion state triggers correctly on the final step and awards XP (where applicable)
- [ ] Mobile layout checked at 390px - no overflow, no clipped buttons
- [ ] Keyboard navigation: Tab reaches all interactive elements in logical order
- [ ] A fresh learner can start the workshop without relying on data from a previous session

## Tagging rules

| Status | Meaning |
|---|---|
| `in_progress` | Being written or currently failing the checklist |
| `published` | Passed the full checklist above |

If a critical learning path is broken (step cannot be completed, quiz impossible, code example produces wrong output), move the workshop back to `in_progress` until fixed.

## Recording the sign-off

After the checklist passes, record it in `tasks.json` evidence and in the workshop's front-matter or header comment:

```
<!-- QA: PASS 2026-10-30 · checklist: WORKSHOP_QA.md -->
```

This file is the canonical checklist definition referenced by board task A2035.
