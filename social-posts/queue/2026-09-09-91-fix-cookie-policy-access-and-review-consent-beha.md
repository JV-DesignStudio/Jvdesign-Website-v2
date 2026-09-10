# 🔧 Fix cookie policy access and review consent behavior - social queue draft

> **Status: DRAFT - must pass same board review before posting**
> Pipeline: `tasks.json` backlog → `--claim` → `in_progress` → `--request-review` (bot-verify) → `human_review` → `done` → post manually.
> Live board edits remain possible while this is in_progress: `--update Axx --evidence "..." && --sync` does not require release.

---
id: 91
date: 9 September 2026 (2026-09-09)
tag: site
emoji: 🔧
title: Fix cookie policy access and review consent behavior
source: devlog-data.js id=91
url: https://jvdesignstudio.co.uk/devlog#post-91
queue_file: social-posts/queue/2026-09-09-91-fix-cookie-policy-access-and-review-consent-beha.md
board_task: Create or link to tasks.json entry with title containing "Social: Fix cookie policy access and review cons" - must go through same review gate
---

## Source
- devlog-data.js id=91 tag=site date="9 September 2026"
- excerpt: Completed 9 Sep: cookie-consent.js:40 /privacy-policy -> /pages/privacy-policy.html (404 fix). analytics-loader.js:1 now
- homepage: https://jvdesignstudio.co.uk/devlog | newsletter preview: newsletter.html auto-shows latest 3 via devlog-data.js
- image suggestion: use existing social-posts/*.svg or og/hub-devlog.png + screenshot of devlog modal at 390px/1440px

## X / Threads (280ch) - copy-paste, keep URL
```
🔧 Fix cookie policy access and review consent behavior - Completed 9 Sep: cookie-consent.js:40 /privacy-policy -> /pages/privacy-policy.html (404 fix). analytics-loader.js:1 now https://jvdesignstudio.co.uk/devlog#post-91 #JVDesignStudio #gamedev
```

## Instagram / Facebook (long)
```
🔧 Fix cookie policy access and review consent behavior

Completed 9 Sep: cookie-consent.js:40 /privacy-policy -> /pages/privacy-policy.html (404 fix). analytics-loader.js:1 now

cookie-consent.js links to /privacy-policy, which returns 404; /pages/privacy-policy.html returns 200. Contact lacks the Cookie settings control present in the shared footer. Analytics is loaded before an explicit choice…

Read the full note → https://jvdesignstudio.co.uk/devlog#post-91

#JVDesignStudio #gamedev #IndieGameDev #BrowserGames
```

## Newsletter blurb (paste into broadcast)
```
**🔧 Fix cookie policy access and review consent behavior** - 9 September 2026 - Completed 9 Sep: cookie-consent.js:40 /privacy-policy -> /pages/privacy-policy.html (404 fix). analytics-loader.js:1 now [Read note](https://jvdesignstudio.co.uk/devlog#post-91)
```

## Board review checklist (bot-verify will check)
- [ ] tasks.json has entry for this social draft (e.g. A83 sub-task or dedicated Axx) in backlog/in_progress/human_review/done
- [ ] evidence names this queue file + devlog-data.js id=91 + 390/1440 no-overflow check
- [ ] queue file exists in social-posts/queue/ and is not leaked to public sitemap (validate:public)
- [ ] human_review -> done via --approve (bot re-verifies) before posting
- [ ] after done, post manually and record postedAt/postedUrl in task evidence

## Live board edit demo (while this draft is in_progress)
```bash
# board stays editable without releasing in_progress:
node F:/Website/studio-workspace/board-keeper.cjs --update A83 --evidence "Edited live while social draft Axx in_progress - 2026-09-09"
node F:/Website/studio-workspace/board-keeper.cjs --sync
node F:/Website/studio-workspace/board-keeper.cjs --check
```

---
Generated: 2026-09-10T11:49:35.108Z by scripts/generate-social-draft.js from devlog-data.js id=91
