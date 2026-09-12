# 🔧 Repair 3 JavaScript SyntaxErrors blocking games - social queue draft

> **Status: DRAFT - must pass same board review before posting**
> Pipeline: `tasks.json` backlog → `--claim` → `in_progress` → `--request-review` (bot-verify) → `human_review` → `done` → post manually.
> Live board edits remain possible while this is in_progress: `--update Axx --evidence "..." && --sync` does not require release.

---
id: 214
date: 12 September 2026 (2026-09-12)
tag: games
emoji: 🔧
title: Repair 3 JavaScript SyntaxErrors blocking games
source: devlog-data.js id=214
url: https://jvdesignstudio.co.uk/devlog#post-214
queue_file: social-posts/queue/2026-09-12-214-repair-3-javascript-syntaxerrors-blocking-games.md
board_task: Create or link to tasks.json entry with title containing "Social: Repair 3 JavaScript SyntaxErrors blockin" - must go through same review gate
---

## Source
- devlog-data.js id=214 tag=games date="12 September 2026"
- excerpt: Fixed 3 SyntaxErrors: File: games/lumo-dash.html reset duplicate removed (1e26a17f restore), File: games/lumo-dash-page.
- homepage: https://jvdesignstudio.co.uk/devlog | newsletter preview: newsletter.html auto-shows latest 3 via devlog-data.js
- image suggestion: use existing social-posts/*.svg or og/hub-devlog.png + screenshot of devlog modal at 390px/1440px

## X / Threads (280ch) - copy-paste, keep URL
```
🔧 Repair 3 JavaScript SyntaxErrors blocking games - Fixed 3 SyntaxErrors: File: games/lumo-dash.html reset duplicate removed (1e26a17f restore), File: games/lumo-dash-page. https://jvdesignstudio.co.uk/devlog#post-214 #JVDesignStudio #gamedev
```

## Instagram / Facebook (long)
```
🔧 Repair 3 JavaScript SyntaxErrors blocking games

Fixed 3 SyntaxErrors: File: games/lumo-dash.html reset duplicate removed (1e26a17f restore), File: games/lumo-dash-page.

validate-js reports 3 pages with SyntaxError that kills entire script blocks: games/lumo-dash-page.html Unexpected token \')\', games/lumo-dash.html same, games/voidrush.html Unexpected token \'}\'. Buttons do nothing wh…

Read the full note → https://jvdesignstudio.co.uk/devlog#post-214

#JVDesignStudio #gamedev #IndieGameDev #BrowserGames
```

## Newsletter blurb (paste into broadcast)
```
**🔧 Repair 3 JavaScript SyntaxErrors blocking games** - 12 September 2026 - Fixed 3 SyntaxErrors: File: games/lumo-dash.html reset duplicate removed (1e26a17f restore), File: games/lumo-dash-page. [Read note](https://jvdesignstudio.co.uk/devlog#post-214)
```

## Board review checklist (bot-verify will check)
- [ ] tasks.json has entry for this social draft (e.g. A83 sub-task or dedicated Axx) in backlog/in_progress/human_review/done
- [ ] evidence names this queue file + devlog-data.js id=214 + 390/1440 no-overflow check
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
Generated: 2026-09-12T08:40:59.226Z by scripts/generate-social-draft.js from devlog-data.js id=214
