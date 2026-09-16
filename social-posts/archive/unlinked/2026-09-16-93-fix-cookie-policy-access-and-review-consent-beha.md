# 🔧 Fix cookie policy access and review consent behavior - social queue draft

> **Status: DRAFT - must pass same board review before posting**
> Pipeline: `tasks.json` backlog → `--claim` → `in_progress` → `--request-review` (bot-verify) → `human_review` → `done` → post manually.
> Live board edits remain possible while this is in_progress: `--update Axx --evidence "..." && --sync` does not require release.

---
id: 93
date: 16 September 2026 (2026-09-16)
tag: site
emoji: 🔧
title: Fix cookie policy access and review consent behavior
source: devlog-data.js id=93
url: https://jvdesignstudio.co.uk/devlog#post-93
queue_file: social-posts/queue/2026-09-16-93-fix-cookie-policy-access-and-review-consent-beha.md
board_task: Create or link to tasks.json entry with title containing "Social: Fix cookie policy access and review cons" - must go through same review gate
---

## Source
- devlog-data.js id=93 tag=site date="16 September 2026"
- excerpt: cookie-consent.js links to /privacy-policy, which returns 404; /pages/privacy-policy.html returns 200. Contact lacks the
- homepage: https://jvdesignstudio.co.uk/devlog | newsletter preview: newsletter.html auto-shows latest 3 via devlog-data.js
- image suggestion: use existing social-posts/*.svg or og/hub-devlog.png + screenshot of devlog modal at 390px/1440px

## X / Threads (280ch) - copy-paste, keep URL
```
🔧 Fix cookie policy access and review consent behavior - cookie-consent.js links to /privacy-policy, which returns 404; /pages/privacy-policy.html returns 200. Contact lacks the https://jvdesignstudio.co.uk/devlog#post-93 #JVDesignStudio #gamedev
```

## Instagram / Facebook (long)
```
🔧 Fix cookie policy access and review consent behavior

cookie-consent.js links to /privacy-policy, which returns 404; /pages/privacy-policy.html returns 200. Contact lacks the

DEV LOG DRAFT - REVIEW/COPY\n\nDraft file: F:/Website/studio-workspace/verification/devlog-draft-A08-85.json\nTarget: devlog-data.js post id 85\nSource task: A08\n\nPROPOSED ENTRY:\nTitle: 🔧 Fix cookie policy access and…

Read the full note → https://jvdesignstudio.co.uk/devlog#post-93

#JVDesignStudio #gamedev #IndieGameDev #BrowserGames
```

## Newsletter blurb (paste into broadcast)
```
**🔧 Fix cookie policy access and review consent behavior** - 16 September 2026 - cookie-consent.js links to /privacy-policy, which returns 404; /pages/privacy-policy.html returns 200. Contact lacks the [Read note](https://jvdesignstudio.co.uk/devlog#post-93)
```

## Board review checklist (bot-verify will check)
- [ ] tasks.json has entry for this social draft (e.g. A83 sub-task or dedicated Axx) in backlog/in_progress/human_review/done
- [ ] evidence names this queue file + devlog-data.js id=93 + 390/1440 no-overflow check
- [ ] queue file exists in social-posts/queue/ and is not leaked to public sitemap (validate:public)
- [ ] human_review -> done via --approve (bot re-verifies) before posting
- [ ] after done, post manually and record postedAt/postedUrl in task evidence

## Live board edit demo (while this draft is in_progress)
```bash
# board stays editable without releasing in_progress:
node F:/Website/studio-workspace/board-keeper.cjs --update A83 --evidence "Edited live while social draft Axx in_progress - 2026-09-16"
node F:/Website/studio-workspace/board-keeper.cjs --sync
node F:/Website/studio-workspace/board-keeper.cjs --check
```

---
Generated: 2026-09-16T13:21:48.441Z by scripts/generate-social-draft.js from devlog-data.js id=93
