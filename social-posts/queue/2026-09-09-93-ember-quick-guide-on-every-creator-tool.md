# 🔧 Ember quick guide on every creator tool - social queue draft

> **Status: DRAFT - must pass same board review before posting**
> Pipeline: `tasks.json` backlog → `--claim` → `in_progress` → `--request-review` (bot-verify) → `human_review` → `done` → post manually.
> Live board edits remain possible while this is in_progress: `--update Axx --evidence "..." && --sync` does not require release.

---
id: 93
date: 9 September 2026 (2026-09-09)
tag: site
emoji: 🔧
title: Ember quick guide on every creator tool
source: devlog-data.js id=93
url: https://jvdesignstudio.co.uk/devlog#post-93
queue_file: social-posts/queue/2026-09-09-93-ember-quick-guide-on-every-creator-tool.md
board_task: Create or link to tasks.json entry with title containing "Social: Ember quick guide on every creator tool" - must go through same review gate
---

## Source
- devlog-data.js id=93 tag=site date="9 September 2026"
- excerpt: Completed 9 Sep: ember-guide.css/js + bottom-bar Help chip (mobile thumb) + hub hero pills (18) + 24 tool tours. Repatch
- homepage: https://jvdesignstudio.co.uk/devlog | newsletter preview: newsletter.html auto-shows latest 3 via devlog-data.js
- image suggestion: use existing social-posts/*.svg or og/hub-devlog.png + screenshot of devlog modal at 390px/1440px

## X / Threads (280ch) - copy-paste, keep URL
```
🔧 Ember quick guide on every creator tool - Completed 9 Sep: ember-guide.css/js + bottom-bar Help chip (mobile thumb) + hub hero pills (18) + 24 tool tours. Repatch https://jvdesignstudio.co.uk/devlog#post-93 #JVDesignStudio #gamedev
```

## Instagram / Facebook (long)
```
🔧 Ember quick guide on every creator tool

Completed 9 Sep: ember-guide.css/js + bottom-bar Help chip (mobile thumb) + hub hero pills (18) + 24 tool tours. Repatch

Add a fast first-visit Ember pop that points at the real controls plus a Help button that reopens it. Must work on first load, on Help, and not nag on shared school PCs. Evidence: Completed 9 Sep: ember-guide.css/js + bo…

Read the full note → https://jvdesignstudio.co.uk/devlog#post-93

#JVDesignStudio #gamedev #IndieGameDev #BrowserGames
```

## Newsletter blurb (paste into broadcast)
```
**🔧 Ember quick guide on every creator tool** - 9 September 2026 - Completed 9 Sep: ember-guide.css/js + bottom-bar Help chip (mobile thumb) + hub hero pills (18) + 24 tool tours. Repatch [Read note](https://jvdesignstudio.co.uk/devlog#post-93)
```

## Board review checklist (bot-verify will check)
- [ ] tasks.json has entry for this social draft (e.g. A83 sub-task or dedicated Axx) in backlog/in_progress/human_review/done
- [ ] evidence names this queue file + devlog-data.js id=93 + 390/1440 no-overflow check
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
Generated: 2026-09-10T11:49:35.099Z by scripts/generate-social-draft.js from devlog-data.js id=93
