# 🔧 Restore GitHub validation - social queue draft

> **Status: DRAFT - must pass same board review before posting**
> Pipeline: `tasks.json` backlog → `--claim` → `in_progress` → `--request-review` (bot-verify) → `human_review` → `done` → post manually.
> Live board edits remain possible while this is in_progress: `--update Axx --evidence "..." && --sync` does not require release.

---
id: 94
date: 9 September 2026 (2026-09-09)
tag: site
emoji: 🔧
title: Restore GitHub validation
source: devlog-data.js id=94
url: https://jvdesignstudio.co.uk/devlog#post-94
queue_file: social-posts/queue/2026-09-09-94-restore-github-validation.md
board_task: Create or link to tasks.json entry with title containing "Social: Restore GitHub validation" - must go through same review gate
---

## Source
- devlog-data.js id=94 tag=site date="9 September 2026"
- excerpt: Local Node 26.2 npm 11.13: npm ci 47 pkgs 0 vuln, build PASS (content 182 workshops, 18 tools, sitemap 14971 0 broken),
- homepage: https://jvdesignstudio.co.uk/devlog | newsletter preview: newsletter.html auto-shows latest 3 via devlog-data.js
- image suggestion: use existing social-posts/*.svg or og/hub-devlog.png + screenshot of devlog modal at 390px/1440px

## X / Threads (280ch) - copy-paste, keep URL
```
🔧 Restore GitHub validation - Local Node 26.2 npm 11.13: npm ci 47 pkgs 0 vuln, build PASS (content 182 workshops, 18 tools, sitemap 14971 0 broken), https://jvdesignstudio.co.uk/devlog#post-94 #JVDesignStudio #gamedev
```

## Instagram / Facebook (long)
```
🔧 Restore GitHub validation

Local Node 26.2 npm 11.13: npm ci 47 pkgs 0 vuln, build PASS (content 182 workshops, 18 tools, sitemap 14971 0 broken),

Node 24 clean npm ci and website build passed in the separate verification copy, and the synchronized patched dependency set reported zero advisories. Do not mark the full task done until required GitHub checks pass on t…

Read the full note → https://jvdesignstudio.co.uk/devlog#post-94

#JVDesignStudio #gamedev #IndieGameDev #BrowserGames
```

## Newsletter blurb (paste into broadcast)
```
**🔧 Restore GitHub validation** - 9 September 2026 - Local Node 26.2 npm 11.13: npm ci 47 pkgs 0 vuln, build PASS (content 182 workshops, 18 tools, sitemap 14971 0 broken), [Read note](https://jvdesignstudio.co.uk/devlog#post-94)
```

## Board review checklist (bot-verify will check)
- [ ] tasks.json has entry for this social draft (e.g. A83 sub-task or dedicated Axx) in backlog/in_progress/human_review/done
- [ ] evidence names this queue file + devlog-data.js id=94 + 390/1440 no-overflow check
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
Generated: 2026-09-10T11:49:35.090Z by scripts/generate-social-draft.js from devlog-data.js id=94
