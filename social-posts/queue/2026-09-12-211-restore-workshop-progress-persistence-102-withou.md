# 🔧 Restore workshop progress persistence (102 without STORAGE_KEY + 14 stale v1 keys) - social queue draft

> **Status: DRAFT - must pass same board review before posting**
> Pipeline: `tasks.json` backlog → `--claim` → `in_progress` → `--request-review` (bot-verify) → `human_review` → `done` → post manually.
> Live board edits remain possible while this is in_progress: `--update Axx --evidence "..." && --sync` does not require release.

---
id: 211
date: 12 September 2026 (2026-09-12)
tag: update
emoji: 🔧
title: Restore workshop progress persistence (102 without STORAGE_KEY + 14 stale v1 keys)
source: devlog-data.js id=211
url: https://jvdesignstudio.co.uk/devlog#post-211
queue_file: social-posts/queue/2026-09-12-211-restore-workshop-progress-persistence-102-withou.md
board_task: Create or link to tasks.json entry with title containing "Social: Restore workshop progress persistence (1" - must go through same review gate
---

## Source
- devlog-data.js id=211 tag=update date="12 September 2026"
- excerpt: File: workshops/blender-cube-workshop.html STORAGE_KEY jvds-blender-cube-workshop-v2 added (49 injected), File: workshop
- homepage: https://jvdesignstudio.co.uk/devlog | newsletter preview: newsletter.html auto-shows latest 3 via devlog-data.js
- image suggestion: use existing social-posts/*.svg or og/hub-devlog.png + screenshot of devlog modal at 390px/1440px

## X / Threads (280ch) - copy-paste, keep URL
```
🔧 Restore workshop progress persistence (102 without STORAGE_KEY + 14 stale v1 keys) - File: workshops/blender-cube-workshop.html STORAGE_KEY jvds-blender-cube-workshop-v2 added (49 injecte https://jvdesignstudio.co.uk/devlog#post-211 #JVDesignStudio #gamedev
```

## Instagram / Facebook (long)
```
🔧 Restore workshop progress persistence (102 without STORAGE_KEY + 14 stale v1 keys)

File: workshops/blender-cube-workshop.html STORAGE_KEY jvds-blender-cube-workshop-v2 added (49 injected), File: workshop

Grep STORAGE_KEY in workshops/*.html: v2=67, v1=14, noKey=102 (55%). NoKey includes all cheatsheets, series hubs (my-first-*.html 12 files), and real workshops: blender-cube/character/rigging/lighting/materials/scene, cp…

Read the full note → https://jvdesignstudio.co.uk/devlog#post-211

#JVDesignStudio #gamedev #IndieGameDev #BrowserGames
```

## Newsletter blurb (paste into broadcast)
```
**🔧 Restore workshop progress persistence (102 without STORAGE_KEY + 14 stale v1 keys)** - 12 September 2026 - File: workshops/blender-cube-workshop.html STORAGE_KEY jvds-blender-cube-workshop-v2 added (49 injected), File: workshop [Read note](https://jvdesignstudio.co.uk/devlog#post-211)
```

## Board review checklist (bot-verify will check)
- [ ] tasks.json has entry for this social draft (e.g. A83 sub-task or dedicated Axx) in backlog/in_progress/human_review/done
- [ ] evidence names this queue file + devlog-data.js id=211 + 390/1440 no-overflow check
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
Generated: 2026-09-12T08:24:54.561Z by scripts/generate-social-draft.js from devlog-data.js id=211
