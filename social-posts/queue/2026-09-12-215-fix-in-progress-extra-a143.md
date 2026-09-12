# 🔧 Fix IN_PROGRESS extra A143 - social queue draft

> **Status: DRAFT - must pass same board review before posting**
> Pipeline: `tasks.json` backlog → `--claim` → `in_progress` → `--request-review` (bot-verify) → `human_review` → `done` → post manually.
> Live board edits remain possible while this is in_progress: `--update Axx --evidence "..." && --sync` does not require release.

---
id: 215
date: 12 September 2026 (2026-09-12)
tag: site
emoji: 🔧
title: Fix IN_PROGRESS extra A143
source: devlog-data.js id=215
url: https://jvdesignstudio.co.uk/devlog#post-215
queue_file: social-posts/queue/2026-09-12-215-fix-in-progress-extra-a143.md
board_task: Create or link to tasks.json entry with title containing "Social: Fix IN_PROGRESS extra A143" - must go through same review gate
---

## Source
- devlog-data.js id=215 tag=site date="12 September 2026"
- excerpt: File: board/index.html and File: pages/devlog.html validate:public PASS test:board-sync PASS at 390/1440px no overflow,
- homepage: https://jvdesignstudio.co.uk/devlog | newsletter preview: newsletter.html auto-shows latest 3 via devlog-data.js
- image suggestion: use existing social-posts/*.svg or og/hub-devlog.png + screenshot of devlog modal at 390px/1440px

## X / Threads (280ch) - copy-paste, keep URL
```
🔧 Fix IN_PROGRESS extra A143 - File: board/index.html and File: pages/devlog.html validate:public PASS test:board-sync PASS at 390/1440px no overflow, https://jvdesignstudio.co.uk/devlog#post-215 #JVDesignStudio #gamedev
```

## Instagram / Facebook (long)
```
🔧 Fix IN_PROGRESS extra A143

File: board/index.html and File: pages/devlog.html validate:public PASS test:board-sync PASS at 390/1440px no overflow,

Auto-detected from --check: IN_PROGRESS extra A143. See board-keeper --check output and tasks.json drift. File: validate:public/boundary. Evidence: File: board/index.html and File: pages/devlog.html validate:public PASS …

Read the full note → https://jvdesignstudio.co.uk/devlog#post-215

#JVDesignStudio #gamedev #IndieGameDev #BrowserGames
```

## Newsletter blurb (paste into broadcast)
```
**🔧 Fix IN_PROGRESS extra A143** - 12 September 2026 - File: board/index.html and File: pages/devlog.html validate:public PASS test:board-sync PASS at 390/1440px no overflow, [Read note](https://jvdesignstudio.co.uk/devlog#post-215)
```

## Board review checklist (bot-verify will check)
- [ ] tasks.json has entry for this social draft (e.g. A83 sub-task or dedicated Axx) in backlog/in_progress/human_review/done
- [ ] evidence names this queue file + devlog-data.js id=215 + 390/1440 no-overflow check
- [ ] queue file exists in social-posts/queue/ and is not leaked to public sitemap (validate:public)
- [ ] human_review -> done via --approve (bot re-verifies) before posting
- [ ] after done, post manually and record postedAt/postedUrl in task evidence

## Live board edit demo (while this draft is in_progress)
```bash
# board stays editable without releasing in_progress:
node F:/Website/studio-workspace/board-keeper.cjs --update A83 --evidence "Edited live while social draft Axx in_progress - 2026-09-12"
node F:/Website/studio-workspace/board-keeper.cjs --sync
node F:/Website/studio-workspace/board-keeper.cjs --check
```

---
Generated: 2026-09-12T08:51:56.513Z by scripts/generate-social-draft.js from devlog-data.js id=215
