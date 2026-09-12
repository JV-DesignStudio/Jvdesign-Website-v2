# Backend - JVDS Build & Board System

> **One command, one board, one goal.** The site is static (no server). "Backend" = the build pipeline + board that lets 4 AI providers and one human ship the North Star `first proud creation in 15 min` without stepping on each other.

---

## 30-Second Onboarding - What Everyone Does

```
Human (you)                          Agents (OpenCode / Claude / Codex / Cursor)          Keeper (bouncer)
─────────────                        ──────────────────────────────────                   ────────────────
Open Trello →                        Before any edit:                                      Watches every tool
 see NEXT pill →                      node board-keeper.cjs --check                        pre_tool/post_tool → --check
 see WIP 1 →                          node board-keeper.cjs --claim A118 --agent "name"    WIP 3 → first wins, second gets "already taken"
 see Review 0                         code → update tasks.json evidence →                  validates schema, drift, socialWarnings
                                      node board-keeper.cjs --request-review A118          runs bot-verify 7 checks → human_review
Approve in Trello →                  (blocked if BOT FAIL)                                re-runs BOT live on approve → done
Ship → board-server --sync → live    → next provider sees NEXT pill update in 15s            auto-sync + ntfy
```

**You always know what to do:** look at `Trello NEXT pill` `board/index.html:158` `NEXT → A118` + `WIP bar` `board/index.html:158`. No scan of 37 backlog.

---

## Before → After (why it was confusing)

| Before (scattered) | After (one) |
|---|---|
| 5 loose files in root `build.js`, `generate-sitemap.js` … | `scripts/build/` orchestrator `scripts/build/index.js:1` |
| 4 copies of `walk()` + `IGNORE_DIRS` with drift | `scripts/lib/paths.js:1` + `scripts/lib/walk.js:1` single source |
| `npm run build` = `A && B && C && D && E` chain | `npm run build` = `node scripts/build/index.js` timed `--only` filters |
| `pages/dev-board.html` public health + `board/index.html` private Trello + `hub.html`/`trello.html` duplicates | One warm Trello `board/index.html:70` `BACKLOG 23 · IN_PROGRESS 1 · HUMAN_REVIEW 0` + `healthStrip` `north-star` `auditSection` `devlogQueue` |
| `Approve` fell back to `Copied!` (CORS `OPTIONS 404`) | `board-server.cjs:95` `OPTIONS 204` → `✓ Shipped!` + `Quick Approve` `8787/approve.html` + `Online Approve` `8787/approve-online.html` PAT |
| White `#fff` hard to read | Warm `var(--beige #F0EAD6)` `var(--charcoal)` `style-tool-dev-board.css:1` |

---

## Layout - Where Everything Lives

```
scripts/
  lib/
    paths.js      ROOT, IGNORE_DIRS, EXCLUDE_FILES, BASE_URL - single truth (was 4 copies)
    walk.js       walk(dir,{ext,ignore}) - one impl (was 6 copies)
  build/
    index.js      Orchestrator STEPS: content → partials → sitemap → latest → board (timed, --only, --skip-validate, post-build link check)
    partials.js   Inject partials/nav-content into every HTML (was root build.js)
    content.js    content/*.json + content-data.js (was generate+build-content-data)
    sitemap.js    sitemap.xml + search-index.json (was 2 roots)
    latest.js     latest-post.json from devlog-data.js
    board.js      board-data.json KPIs (303 URLs, 23 backlog, etc.)
  validate/
    index.js      Runs validate-links /css /js /contrast /workshops sequentially (one `npm run validate`)
  README.md       (this file) - onboarding for humans + agents

F:/Website/studio-workspace/
  board/index.html        Trello - single source, warm, drag, bulk, preview/diff/comment, j/k/a/d, Next pill, healthStrip, burndown
  board/approve.html      Quick Approve - phone on same Wi-Fi `http://192.168.1.77:8787/approve.html` (QR in Trello 📱)
  board/approve-online.html Online Approve - anywhere via GitHub PAT `api.github.com` (no PC)
  board-keeper.cjs        Bouncer - --check --claim --request-review --approve --sync --next (WIP 3, firstCreationRe boost)
  bot-verify.cjs          7 checks: evidence, files-exist, done-criteria, tag-proof, no-private-leak, public-boundary, no-new-dashes (advisory)
  board-server.cjs        8787 - CORS 204, /api/claim|approve|reject|nudge|file|diff|comment|ip, serves tasks.json + board-data.json + devlog-data.js
  tasks.json              150 total · 126 done · 23 backlog · 1 in_progress (A117) - source of truth
  WORKFLOW.md / CLAIM_GUIDE.md / JVDS_PRODUCT_VISION.md - loaded via .opencode/opencode.json:3 instructions for every agent
```

---

## How Everyone Knows What They’re Doing

**Human (you) on Trello:**
- **NEXT pill** `board/index.html:158` `NEXT → A118 · Call of the Cards: smarter AI [P1 games]` - North Star sorted `P1→first|school|pixel` `board-keeper.cjs:191`. No hunt.
- **WIP bar** `1 - A117 by opencode 2d` - who’s holding what, `>7d ⚠️ stale` `board-keeper.cjs:355`.
- **Health strip** `Sitemap 303 · Tasks 23 · Validate 0 broken · Server 8787 live · First creation Pixel Character Studio` - is the system green?
- **Card** `🌐 Page / 💻 Code` `board/index.html:2041` + `👁 Preview` `GET /api/file` `📊 Diff` `GET /api/diff` `💬 Comment` `POST /api/comment` - verify without leaving.
- **Bulk + Keyboard** `Bulk Approve all` `board/index.html:2059` + `j/k` navigate `a` approve `d` decline `o` open `Ctrl+K` palette `board/index.html:2120`.

**Agent (any provider) in terminal:**
```bash
node F:/Website/studio-workspace/board-keeper.cjs --check          # see drift + NEXT
node F:/Website/studio-workspace/board-keeper.cjs --claim A118 --agent "cursor-agent"  # first wins
# ... code ...
# update tasks.json evidence with File: + test: PASS
node F:/Website/studio-workspace/board-keeper.cjs --request-review A118  # BOT 7 checks
# human sees it in Human Review, taps Approve - done → board-keeper --sync auto
```

**If second provider races:** `Cannot claim A118: status=in_progress (already taken)` - picks `A119` via `--next`. No duplicate work.

---

## Usage - One Command

```bash
# Full build - what CI runs
npm run build
# or
node scripts/build/index.js

# Fast single stage
node scripts/build/index.js --only=content --skip-validate
node scripts/build/index.js --only=partials
node scripts/build/index.js --only=sitemap

# All validators
npm run validate
node scripts/validate/index.js --only=links
```

**Add a new build step:** `scripts/build/my-step.js` exporting `runMyStep()` → register in `scripts/build/index.js` `STEPS` (order matters).

---

## When We Move On (Pixel Character Studio, first creation)

Trelo’s `healthStrip` already has `First creation: Pixel Character Studio` `board/index.html:1806`. The `NEXT pill` will keep pointing `P1` `first|school|pixel` tasks - agents won’t drift to `P3` polish while the 15-min funnel is red. Board is the only page you need; `pages/dev-board.html` is deleted `638f9e40`.

**School-Computer Rule:** everything here runs with `node` only. `npm ci` only for `validate:css/js` (puppeteer).

---

*Keeper is not AI - deterministic Node `board-keeper.cjs:1`. The `board-keeper` agent in `.opencode/opencode.json:9` is just `qwen2.5-coder:7b` to *enforce* the protocol, not to watch files.*
