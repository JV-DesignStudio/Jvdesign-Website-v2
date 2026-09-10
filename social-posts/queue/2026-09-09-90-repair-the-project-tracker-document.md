# 🔧 Repair the project tracker document - social queue draft

> **Status: DRAFT - must pass same board review before posting**
> Pipeline: `tasks.json` backlog → `--claim` → `in_progress` → `--request-review` (bot-verify) → `human_review` → `done` → post manually.
> Live board edits remain possible while this is in_progress: `--update Axx --evidence "..." && --sync` does not require release.

---
id: 90
date: 9 September 2026 (2026-09-09)
tag: apps
emoji: 🔧
title: Repair the project tracker document
source: devlog-data.js id=90
url: https://jvdesignstudio.co.uk/devlog#post-90
queue_file: social-posts/queue/2026-09-09-90-repair-the-project-tracker-document.md
board_task: Create or link to tasks.json entry with title containing "Social: Repair the project tracker document" - must go through same review gate
---

## Source
- devlog-data.js id=90 tag=apps date="9 September 2026"
- excerpt: Completed 9 Sep: same redirect fixes overflow/script-exposure - project-tracker no longer renders tracker DOM, so no exp
- homepage: https://jvdesignstudio.co.uk/devlog | newsletter preview: newsletter.html auto-shows latest 3 via devlog-data.js
- image suggestion: use existing social-posts/*.svg or og/hub-devlog.png + screenshot of devlog modal at 390px/1440px

## X / Threads (280ch) - copy-paste, keep URL
```
🔧 Repair the project tracker document - Completed 9 Sep: same redirect fixes overflow/script-exposure - project-tracker no longer renders tracker DOM, so no exp https://jvdesignstudio.co.uk/devlog#post-90 #JVDesignStudio #gamedev
```

## Instagram / Facebook (long)
```
🔧 Repair the project tracker document

Completed 9 Sep: same redirect fixes overflow/script-exposure - project-tracker no longer renders tracker DOM, so no exp

A fresh mobile load of tools/project-tracker.html visibly exposes script text, overflows horizontally and requests a malformed template URL. No uncaught exception is required for this to be broken. Evidence: Completed 9 …

Read the full note → https://jvdesignstudio.co.uk/devlog#post-90

#JVDesignStudio #gamedev #IndieGameDev #BrowserGames
```

## Newsletter blurb (paste into broadcast)
```
**🔧 Repair the project tracker document** - 9 September 2026 - Completed 9 Sep: same redirect fixes overflow/script-exposure - project-tracker no longer renders tracker DOM, so no exp [Read note](https://jvdesignstudio.co.uk/devlog#post-90)
```

## Board review checklist (bot-verify will check)
- [ ] tasks.json has entry for this social draft (e.g. A83 sub-task or dedicated Axx) in backlog/in_progress/human_review/done
- [ ] evidence names this queue file + devlog-data.js id=90 + 390/1440 no-overflow check
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
Generated: 2026-09-10T11:49:35.109Z by scripts/generate-social-draft.js from devlog-data.js id=90
