# 🔧 Playtest has no game-system/profile bridge - social queue draft

> **Status: DRAFT - must pass same board review before posting**
> Pipeline: `tasks.json` backlog → `--claim` → `in_progress` → `--request-review` (bot-verify) → `human_review` → `done` → post manually.
> Live board edits remain possible while this is in_progress: `--update Axx --evidence "..." && --sync` does not require release.

---
id: 213
date: 12 September 2026 (2026-09-12)
tag: games
emoji: 🔧
title: Playtest has no game-system/profile bridge
source: devlog-data.js id=213
url: https://jvdesignstudio.co.uk/devlog#post-213
queue_file: social-posts/queue/2026-09-12-213-playtest-has-no-game-system-profile-bridge.md
board_task: Create or link to tasks.json entry with title containing "Social: Playtest has no game-system/profile brid" - must go through same review gate
---

## Source
- devlog-data.js id=213 tag=games date="12 September 2026"
- excerpt: File: games/call-of-the-cards-playtest.html now loads game-system.js + game-system.css + player-profile.js, recordGamePl
- homepage: https://jvdesignstudio.co.uk/devlog | newsletter preview: newsletter.html auto-shows latest 3 via devlog-data.js
- image suggestion: use existing social-posts/*.svg or og/hub-devlog.png + screenshot of devlog modal at 390px/1440px

## X / Threads (280ch) - copy-paste, keep URL
```
🔧 Playtest has no game-system/profile bridge - File: games/call-of-the-cards-playtest.html now loads game-system.js + game-system.css + player-profile.js, recordGamePl https://jvdesignstudio.co.uk/devlog#post-213 #JVDesignStudio #gamedev
```

## Instagram / Facebook (long)
```
🔧 Playtest has no game-system/profile bridge

File: games/call-of-the-cards-playtest.html now loads game-system.js + game-system.css + player-profile.js, recordGamePl

games/call-of-the-cards-playtest.html loads call-of-cards-engine.js only  -  no game-system.js, player-profile.js, daily/weekly-challenge. No XP, no jvds_game_* save, no GA4 game_start/game_end, no share-chip, no arcade-…

Read the full note → https://jvdesignstudio.co.uk/devlog#post-213

#JVDesignStudio #gamedev #IndieGameDev #BrowserGames
```

## Newsletter blurb (paste into broadcast)
```
**🔧 Playtest has no game-system/profile bridge** - 12 September 2026 - File: games/call-of-the-cards-playtest.html now loads game-system.js + game-system.css + player-profile.js, recordGamePl [Read note](https://jvdesignstudio.co.uk/devlog#post-213)
```

## Board review checklist (bot-verify will check)
- [ ] tasks.json has entry for this social draft (e.g. A83 sub-task or dedicated Axx) in backlog/in_progress/human_review/done
- [ ] evidence names this queue file + devlog-data.js id=213 + 390/1440 no-overflow check
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
Generated: 2026-09-12T08:29:53.360Z by scripts/generate-social-draft.js from devlog-data.js id=213
