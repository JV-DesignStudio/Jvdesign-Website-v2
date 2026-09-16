# 🔧 Restore GitHub validation - social queue draft

> **Status: DRAFT - must pass same board review before posting**
> Pipeline: `tasks.json` backlog → `--claim` → `in_progress` → `--request-review` (bot-verify) → `human_review` → `done` → post manually.
> Live board edits remain possible while this is in_progress: `--update Axx --evidence "..." && --sync` does not require release.

---
id: 89
date: 16 September 2026 (2026-09-16)
tag: site
emoji: 🔧
title: Restore GitHub validation
source: devlog-data.js id=89
url: https://jvdesignstudio.co.uk/devlog#post-89
queue_file: social-posts/queue/2026-09-16-89-restore-github-validation.md
board_task: Create or link to tasks.json entry with title containing "Social: Restore GitHub validation" - must go through same review gate
---

## Source
- devlog-data.js id=89 tag=site date="16 September 2026"
- excerpt: Node 24 clean npm ci and website build passed in the separate verification copy, and the synchronized patched dependency
- homepage: https://jvdesignstudio.co.uk/devlog | newsletter preview: newsletter.html auto-shows latest 3 via devlog-data.js
- image suggestion: use existing social-posts/*.svg or og/hub-devlog.png + screenshot of devlog modal at 390px/1440px

## X / Threads (280ch) - copy-paste, keep URL
```
🔧 Restore GitHub validation - Node 24 clean npm ci and website build passed in the separate verification copy, and the synchronized patched dependency https://jvdesignstudio.co.uk/devlog#post-89 #JVDesignStudio #gamedev
```

## Instagram / Facebook (long)
```
🔧 Restore GitHub validation

Node 24 clean npm ci and website build passed in the separate verification copy, and the synchronized patched dependency

DEV LOG DRAFT - REVIEW/COPY\n\nDraft file: F:/Website/studio-workspace/verification/devlog-draft-A01-93.json\nTarget: devlog-data.js post id 93\nSource task: A01\n\nPROPOSED ENTRY:\nTitle: 🔧 Restore GitHub validation\nD…

Read the full note → https://jvdesignstudio.co.uk/devlog#post-89

#JVDesignStudio #gamedev #IndieGameDev #BrowserGames
```

## Newsletter blurb (paste into broadcast)
```
**🔧 Restore GitHub validation** - 16 September 2026 - Node 24 clean npm ci and website build passed in the separate verification copy, and the synchronized patched dependency [Read note](https://jvdesignstudio.co.uk/devlog#post-89)
```

## Board review checklist (bot-verify will check)
- [ ] tasks.json has entry for this social draft (e.g. A83 sub-task or dedicated Axx) in backlog/in_progress/human_review/done
- [ ] evidence names this queue file + devlog-data.js id=89 + 390/1440 no-overflow check
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
Generated: 2026-09-16T12:16:28.650Z by scripts/generate-social-draft.js from devlog-data.js id=89
