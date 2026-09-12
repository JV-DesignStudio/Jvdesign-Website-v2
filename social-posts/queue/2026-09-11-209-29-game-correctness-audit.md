# 🔧 29-game correctness audit - social queue draft

> **Status: DRAFT - must pass same board review before posting**
> Pipeline: `tasks.json` backlog → `--claim` → `in_progress` → `--request-review` (bot-verify) → `human_review` → `done` → post manually.
> Live board edits remain possible while this is in_progress: `--update Axx --evidence "..." && --sync` does not require release.

---
id: 209
date: 11 September 2026 (2026-09-11)
tag: games
emoji: 🔧
title: 29-game correctness audit
source: devlog-data.js id=209
url: https://jvdesignstudio.co.uk/devlog#post-209
queue_file: social-posts/queue/2026-09-11-209-29-game-correctness-audit.md
board_task: Create or link to tasks.json entry with title containing "Social: 29-game correctness audit" - must go through same review gate
---

## Source
- devlog-data.js id=209 tag=games date="11 September 2026"
- excerpt: 38 real bugs fixed: crashes, wiped saves, unreachable bosses, dead relics that did nothing when purchased.
- homepage: https://jvdesignstudio.co.uk/devlog | newsletter preview: newsletter.html auto-shows latest 3 via devlog-data.js
- image suggestion: use existing social-posts/*.svg or og/hub-devlog.png + screenshot of devlog modal at 390px/1440px

## X / Threads (280ch) - copy-paste, keep URL
```
🔧 29-game correctness audit - 38 real bugs fixed: crashes, wiped saves, unreachable bosses, dead relics that did nothing when purchased. https://jvdesignstudio.co.uk/devlog#post-209 #JVDesignStudio #gamedev
```

## Instagram / Facebook (long)
```
🔧 29-game correctness audit

38 real bugs fixed: crashes, wiped saves, unreachable bosses, dead relics that did nothing when purchased.

38 real bugs fixed: crashes, wiped saves, unreachable bosses, dead relics that did nothing when purchased. Evidence: 38 real bugs fixed: crashes, wiped saves, unreachable bosses, dead relics that did nothing when purchas…

Read the full note → https://jvdesignstudio.co.uk/devlog#post-209

#JVDesignStudio #gamedev #IndieGameDev #BrowserGames
```

## Newsletter blurb (paste into broadcast)
```
**🔧 29-game correctness audit** - 11 September 2026 - 38 real bugs fixed: crashes, wiped saves, unreachable bosses, dead relics that did nothing when purchased. [Read note](https://jvdesignstudio.co.uk/devlog#post-209)
```

## Board review checklist (bot-verify will check)
- [ ] tasks.json has entry for this social draft (e.g. A83 sub-task or dedicated Axx) in backlog/in_progress/human_review/done
- [ ] evidence names this queue file + devlog-data.js id=209 + 390/1440 no-overflow check
- [ ] queue file exists in social-posts/queue/ and is not leaked to public sitemap (validate:public)
- [ ] human_review -> done via --approve (bot re-verifies) before posting
- [ ] after done, post manually and record postedAt/postedUrl in task evidence

## Live board edit demo (while this draft is in_progress)
```bash
# board stays editable without releasing in_progress:
node F:/Website/studio-workspace/board-keeper.cjs --update A83 --evidence "Edited live while social draft Axx in_progress - 2026-09-11"
node F:/Website/studio-workspace/board-keeper.cjs --sync
node F:/Website/studio-workspace/board-keeper.cjs --check
```

---
Generated: 2026-09-12T07:27:47.133Z by scripts/generate-social-draft.js from devlog-data.js id=209
