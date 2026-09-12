# 🔧 Fix bot-verify FAIL for A143 - social queue draft

> **Status: DRAFT - must pass same board review before posting**
> Pipeline: `tasks.json` backlog → `--claim` → `in_progress` → `--request-review` (bot-verify) → `human_review` → `done` → post manually.
> Live board edits remain possible while this is in_progress: `--update Axx --evidence "..." && --sync` does not require release.

---
id: 212
date: 12 September 2026 (2026-09-12)
tag: update
emoji: 🔧
title: Fix bot-verify FAIL for A143
source: devlog-data.js id=212
url: https://jvdesignstudio.co.uk/devlog#post-212
queue_file: social-posts/queue/2026-09-12-212-fix-bot-verify-fail-for-a143.md
board_task: Create or link to tasks.json entry with title containing "Social: Fix bot-verify FAIL for A143" - must go through same review gate
---

## Source
- devlog-data.js id=212 tag=update date="12 September 2026"
- excerpt: Fixed A143: File: pages/workshop.html and File: workshops/blender-workshop.html validate:public PASS test:workshops 39/3
- homepage: https://jvdesignstudio.co.uk/devlog | newsletter preview: newsletter.html auto-shows latest 3 via devlog-data.js
- image suggestion: use existing social-posts/*.svg or og/hub-devlog.png + screenshot of devlog modal at 390px/1440px

## X / Threads (280ch) - copy-paste, keep URL
```
🔧 Fix bot-verify FAIL for A143 - Fixed A143: File: pages/workshop.html and File: workshops/blender-workshop.html validate:public PASS test:workshops 39/3 https://jvdesignstudio.co.uk/devlog#post-212 #JVDesignStudio #gamedev
```

## Instagram / Facebook (long)
```
🔧 Fix bot-verify FAIL for A143

Fixed A143: File: pages/workshop.html and File: workshops/blender-workshop.html validate:public PASS test:workshops 39/3

bot-verify.cjs for A143 failed: evidence: len 55, files 2, test-mention no  -  must name file + test output (e.g. \'tools/pixel-studio.html test:sprite PASS\') | tag-proof: workshops needs /workshops\/|quiz|lesson|comple…

Read the full note → https://jvdesignstudio.co.uk/devlog#post-212

#JVDesignStudio #gamedev #IndieGameDev #BrowserGames
```

## Newsletter blurb (paste into broadcast)
```
**🔧 Fix bot-verify FAIL for A143** - 12 September 2026 - Fixed A143: File: pages/workshop.html and File: workshops/blender-workshop.html validate:public PASS test:workshops 39/3 [Read note](https://jvdesignstudio.co.uk/devlog#post-212)
```

## Board review checklist (bot-verify will check)
- [ ] tasks.json has entry for this social draft (e.g. A83 sub-task or dedicated Axx) in backlog/in_progress/human_review/done
- [ ] evidence names this queue file + devlog-data.js id=212 + 390/1440 no-overflow check
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
Generated: 2026-09-12T08:26:32.259Z by scripts/generate-social-draft.js from devlog-data.js id=212
