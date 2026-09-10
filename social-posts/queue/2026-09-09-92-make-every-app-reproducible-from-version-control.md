# 🔧 Make every app reproducible from version control - social queue draft

> **Status: DRAFT - must pass same board review before posting**
> Pipeline: `tasks.json` backlog → `--claim` → `in_progress` → `--request-review` (bot-verify) → `human_review` → `done` → post manually.
> Live board edits remain possible while this is in_progress: `--update Axx --evidence "..." && --sync` does not require release.

---
id: 92
date: 9 September 2026 (2026-09-09)
tag: apps
emoji: 🔧
title: Make every app reproducible from version control
source: devlog-data.js id=92
url: https://jvdesignstudio.co.uk/devlog#post-92
queue_file: social-posts/queue/2026-09-09-92-make-every-app-reproducible-from-version-control.md
board_task: Create or link to tasks.json entry with title containing "Social: Make every app reproducible from version" - must go through same review gate
---

## Source
- devlog-data.js id=92 tag=apps date="9 September 2026"
- excerpt: Completed 9 Sep: audited 9 apps (F:/Website/*-app). Created git repos for jvds-game-maker-app (1d618cd) and tower-defenc
- homepage: https://jvdesignstudio.co.uk/devlog | newsletter preview: newsletter.html auto-shows latest 3 via devlog-data.js
- image suggestion: use existing social-posts/*.svg or og/hub-devlog.png + screenshot of devlog modal at 390px/1440px

## X / Threads (280ch) - copy-paste, keep URL
```
🔧 Make every app reproducible from version control - Completed 9 Sep: audited 9 apps (F:/Website/*-app). Created git repos for jvds-game-maker-app (1d618cd) and tower-defenc https://jvdesignstudio.co.uk/devlog#post-92 #JVDesignStudio #gamedev
```

## Instagram / Facebook (long)
```
🔧 Make every app reproducible from version control

Completed 9 Sep: audited 9 apps (F:/Website/*-app). Created git repos for jvds-game-maker-app (1d618cd) and tower-defenc

jvds-game-maker-app and tower-defence-app are not within a local Git repository. Several other apps have package versions that differ from Android versions; Cozy Cafe, Sky High and Tower Defence have no package scripts. …

Read the full note → https://jvdesignstudio.co.uk/devlog#post-92

#JVDesignStudio #gamedev #IndieGameDev #BrowserGames
```

## Newsletter blurb (paste into broadcast)
```
**🔧 Make every app reproducible from version control** - 9 September 2026 - Completed 9 Sep: audited 9 apps (F:/Website/*-app). Created git repos for jvds-game-maker-app (1d618cd) and tower-defenc [Read note](https://jvdesignstudio.co.uk/devlog#post-92)
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
node F:/Website/studio-workspace/board-keeper.cjs --update A83 --evidence "Edited live while social draft Axx in_progress - 2026-09-09"
node F:/Website/studio-workspace/board-keeper.cjs --sync
node F:/Website/studio-workspace/board-keeper.cjs --check
```

---
Generated: 2026-09-10T11:49:35.108Z by scripts/generate-social-draft.js from devlog-data.js id=92
