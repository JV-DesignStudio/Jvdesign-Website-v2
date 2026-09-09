# CLAUDE.md , JVDesignStudio (Read Before Touching Code)

> Claude Code auto-loads this file. This is a mirror of `AGENTS.md` , the canonical instructions. If you edited `AGENTS.md`, this was synced.

## 1) What JVDS Is For

**North Star , `JVDS_PRODUCT_VISION.md:1` + `pages/dev-board.html:112`:**
> JVDesignStudio exists so young people can learn, create and play without barriers. A new learner should arrive and make something they are proud of within 15 minutes on a locked-down school computer. **Creativity shouldn't need permission.**

**Core loop:** `Imagine(Stardust) → Learn(Lumo) → Create(Ember) → Play(Pip) → Improve(Echo) → Imagine again` (`JVDS_PRODUCT_VISION.md:24`).

**School-Computer Rule** (`JVDS_PRODUCT_VISION.md:38`): core experiences require **no install, no admin rights, no paid software, no powerful PC, no account to start**.

**Current mission** (`pages/dev-board.html:167`): make the *first successful creation* obvious/joyful. Chosen first-path: **Pixel Character Studio**.

**Before you build anything ask** (`JVDS_PRODUCT_VISION.md:54`): Does it help a young person make/understand/play/improve something? Does it strengthen the loop and work in a restricted browser? Can an existing tool be improved instead? Does it respect characters as identity? Is it more important than the first successful creation?

## 2) Where Work Is Tracked

| View | Path |
|---|---|
| **Private Studio Board (canonical)** | `F:/Website/studio-workspace/board/index.html` + `F:/Website/studio-workspace/tasks.json` (57 tasks) , **outside public Git** |
| **Public mirror** | `pages/dev-board.html` (`noindex`) |
| **KPIs** | `board-data.json` |

Refs: `JVDS_PRODUCT_VISION.md`, `F:/Website/studio-workspace/CLAIM_GUIDE.md`, `F:/Website/studio-workspace/WORKFLOW.md`.

## 3) How To Work , Claim Before You Code

```bash
node F:/Website/studio-workspace/board-keeper.cjs --check
node F:/Website/studio-workspace/board-keeper.cjs --claim A46 --agent "claude-code"
# ... do work, fill tasks.json evidence (must name file + test output), then BOT gate (required):
node F:/Website/studio-workspace/board-keeper.cjs --request-review A46
# BOT PASS -> human_review | BOT FAIL -> stays in_progress. Approve re-runs bot live. Never hand-edit status.
node F:/Website/studio-workspace/board-keeper.cjs --sync
node F:/Website/studio-workspace/board-keeper.cjs --release A46 --status backlog  # to abandon
```

Rules: one task at a time, update `evidence` before `--sync`, never mark `done` until published/verified, keep `historical-shipped.json` intact.

Snapshot (2026-09-08): **In Progress (3)** A01, A12, A47; **Verified (6)** A02-A04 etc; **Backlog (32)** A05…

## 4) The Watcher AI (Board Keeper)

`F:/Website/studio-workspace/board-keeper.cjs:1` , deterministic Node script, not a chat model. Hooks in `.opencode/opencode.json:3` run `--check` before/after every tool; Scheduled Task runs every 5 min. Guards on `--sync`: em-dash count, `P1 → devlog` promotion, newsletter cross-link.

If `DRIFT` reported, fix `tasks.json` then `--sync`. If `--claim` fails (already `in_progress`), pick another `backlog` ID.

## 5) Repo Conventions

Static site. `build.js` syncs `partials/` via `<!-- BUILD:name -->`. `npm ci` (Node 24), `npm run validate:public`, `npm run build:sitemap`. Never hand-edit `tools/quest-board.html` / `quest-board-deploy/` , edit `tools/project-tracker.html` then `node make-public.js && node make-app-bundle.js`.
