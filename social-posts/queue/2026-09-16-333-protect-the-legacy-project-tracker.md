# 🔧 Protect the legacy project tracker - social queue draft

> **Status: DRAFT - must pass same board review before posting**
> Pipeline: `tasks.json` backlog → `--claim` → `in_progress` → `--request-review` (bot-verify) → `human_review` → `done` → post manually.
> Live board edits remain possible while this is in_progress: `--update Axx --evidence "..." && --sync` does not require release.

---
id: 333
date: 16 September 2026 (2026-09-16)
tag: site
emoji: 🔧
title: Protect the legacy project tracker
source: devlog-data.js id=333
url: https://jvdesignstudio.co.uk/devlog#post-333
queue_file: social-posts/queue/2026-09-16-333-protect-the-legacy-project-tracker.md
board_task: Create or link to tasks.json entry with title containing "Social: Protect the legacy project tracker" - must go through same review gate
---

## Source
- devlog-data.js id=333 tag=site date="16 September 2026"
- excerpt: The Studio findings board has been moved outside the public repository and its public current-branch copy deleted. This
- homepage: https://jvdesignstudio.co.uk/devlog | newsletter preview: newsletter.html auto-shows latest 3 via devlog-data.js
- image: social-posts/queue/2026-09-16-333-protect-the-legacy-project-tracker.png (1080x1080 auto-generated via generate-social-card.js)

## X / Threads (280ch) - copy-paste, keep URL
```
🔧 Protect the legacy project tracker - The Studio findings board has been moved outside the public repository and its public current-branch copy deleted. This https://jvdesignstudio.co.uk/devlog#post-333 #JVDesignStudio #gamedev
```

## Instagram / Facebook (long)
```
🔧 Protect the legacy project tracker

The Studio findings board has been moved outside the public repository and its public current-branch copy deleted. This

DEV LOG DRAFT - REVIEW/COPY\n\nDraft file: F:/Website/studio-workspace/verification/devlog-draft-A06-85.json\nTarget: devlog-data.js post id 85\nSource task: A06\n\nPROPOSED ENTRY:\nTitle: 🔧 Protect the legacy project t…

Read the full note → https://jvdesignstudio.co.uk/devlog#post-333

#JVDesignStudio #gamedev #IndieGameDev #BrowserGames
```

## Newsletter blurb (paste into broadcast)
```
**🔧 Protect the legacy project tracker** - 16 September 2026 - The Studio findings board has been moved outside the public repository and its public current-branch copy deleted. This [Read note](https://jvdesignstudio.co.uk/devlog#post-333)
```

## Board review checklist (bot-verify will check)
- [ ] tasks.json has entry for this social draft (e.g. A83 sub-task or dedicated Axx) in backlog/in_progress/human_review/done
- [ ] evidence names this queue file + devlog-data.js id=333 + 390/1440 no-overflow check
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
Generated: 2026-09-16T06:40:06.817Z by scripts/generate-social-draft.js from devlog-data.js id=333
