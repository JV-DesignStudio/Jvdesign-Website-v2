# 🔧 Repair the project tracker document - social queue draft

> **Status: DRAFT - must pass same board review before posting**
> Pipeline: `tasks.json` backlog → `--claim` → `in_progress` → `--request-review` (bot-verify) → `human_review` → `done` → post manually.
> Live board edits remain possible while this is in_progress: `--update Axx --evidence "..." && --sync` does not require release.

---
id: 92
date: 16 September 2026 (2026-09-16)
tag: apps
emoji: 🔧
title: Repair the project tracker document
source: devlog-data.js id=92
url: https://jvdesignstudio.co.uk/devlog#post-92
queue_file: social-posts/queue/2026-09-16-92-repair-the-project-tracker-document.md
board_task: Create or link to tasks.json entry with title containing "Social: Repair the project tracker document" - must go through same review gate
---

## Source
- devlog-data.js id=92 tag=apps date="16 September 2026"
- excerpt: A fresh mobile load of tools/project-tracker.html visibly exposes script text, overflows horizontally and requests a mal
- homepage: https://jvdesignstudio.co.uk/devlog | newsletter preview: newsletter.html auto-shows latest 3 via devlog-data.js
- image suggestion: use existing social-posts/*.svg or og/hub-devlog.png + screenshot of devlog modal at 390px/1440px

## X / Threads (280ch) - copy-paste, keep URL
```
🔧 Repair the project tracker document - A fresh mobile load of tools/project-tracker.html visibly exposes script text, overflows horizontally and requests a mal https://jvdesignstudio.co.uk/devlog#post-92 #JVDesignStudio #gamedev
```

## Instagram / Facebook (long)
```
🔧 Repair the project tracker document

A fresh mobile load of tools/project-tracker.html visibly exposes script text, overflows horizontally and requests a mal

DEV LOG DRAFT - REVIEW/COPY\n\nDraft file: F:/Website/studio-workspace/verification/devlog-draft-A07-85.json\nTarget: devlog-data.js post id 85\nSource task: A07\n\nPROPOSED ENTRY:\nTitle: 🔧 Repair the project tracker d…

Read the full note → https://jvdesignstudio.co.uk/devlog#post-92

#JVDesignStudio #gamedev #IndieGameDev #BrowserGames
```

## Newsletter blurb (paste into broadcast)
```
**🔧 Repair the project tracker document** - 16 September 2026 - A fresh mobile load of tools/project-tracker.html visibly exposes script text, overflows horizontally and requests a mal [Read note](https://jvdesignstudio.co.uk/devlog#post-92)
```

## Board review checklist (bot-verify will check)
- [ ] tasks.json has entry for this social draft (e.g. A83 sub-task or dedicated Axx) in backlog/in_progress/human_review/done
- [ ] evidence names this queue file + devlog-data.js id=92 + 390/1440 no-overflow check
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
Generated: 2026-09-16T13:21:34.558Z by scripts/generate-social-draft.js from devlog-data.js id=92
