# JVDesignStudio Website v2

The source for [jvdesignstudio.co.uk](https://jvdesignstudio.co.uk/) , children's picture books, browser games, tabletop games and free creative downloads, plus a handful of dev tools and workshop pages.

Static HTML/CSS/JS, no framework, no build step required to view pages directly in a browser.

## Structure

```
index.html, pages/, games/, ...           Site pages
partials/                                  Shared nav/footer fragments
scripts/
  lib/        paths.js + walk.js (single source of truth)
  build/      Unified pipeline (content → partials → sitemap → latest → board)
  validate/   All validators orchestrated
  archive/    Retired one-shot migration scripts
content/      Generated content/*.json (from HTML scan)
sitemap.xml + search-index.json            Generated from pages on disk
board-data.json                            Generated KPIs for dev-board.html
```

Image assets live at the project root alongside the pages that use them.

## Build

Use Node 24 (see `.nvmrc`) and run `npm ci` before the checks. `npm run validate:public` prevents internal Studio planning artifacts from entering the public website. The working board and audit evidence are maintained separately from this repository; only completed public-facing changes belong in the Dev Log.

The nav and footer are defined once in `partials/` and synced into every page via marker comments (`<!-- BUILD:name --> ... <!-- /BUILD:name -->`):

```bash
npm run build                  # full pipeline (content → partials → sitemap → latest → board)
node scripts/build/index.js --only=partials --skip-validate   # just partials, fast
```

Legacy entrypoints (`build.js`, `generate-sitemap.js`) still work via `npm run build:legacy` but new code should use `scripts/build/`.

## Board - How Everyone Knows What To Do (Backend → Trello)

> One Trello `F:/Website/studio-workspace/board/index.html` - warm `var(--beige)` `BACKLOG 23 · IN_PROGRESS 1 · HUMAN_REVIEW 0` + `NEXT →` pill `board-keeper.cjs --next` `P1 → first|school|pixel` + `WIP` `👤` + `healthStrip` `Sitemap 303` `Validate 0` `First creation` - so 4 providers + you see the same single goal without asking.

**For humans:** open Trello → `NEXT pill` tells you what to claim, `WIP bar` tells you who holds what, `🌐 Page / 💻 Code` `board/index.html:2041` lets you verify without leaving, `👁 Preview / 📊 Diff / 💬 Comment` `board-server.cjs:115` + `Bulk` + `j/k/a/d/o/?` `Ctrl+K` palette.

**For agents:** `node F:/Website/studio-workspace/board-keeper.cjs --check` → `--claim A118 --agent "name"` (first wins, `WIP 3` `board-keeper.cjs:68`) → code → update `tasks.json` `evidence` `File: … validate:public PASS test:…` → `--request-review` `bot-verify.cjs:1` 7 checks → human `Approve` `board-server.cjs:95` `OPTIONS 204` re-runs BOT live → `done` → `--sync` → `healthStrip` toast `Board updated - refreshing…` in 15s.

Full backend docs: [`scripts/README.md`](scripts/README.md) - pipeline `content→partials→sitemap→latest→board` `scripts/build/index.js:1` `lib/paths.js` single `walk()`.

**Mobile approve:** `📱 Mobile` QR `http://192.168.1.77:8787/approve.html` same Wi-Fi (PC on) or `board/approve-online.html` PAT anywhere `api.github.com`.

## Adding a new page

When adding a new page, remember to:
1. Add the nav/footer build markers (copy from an existing page), then run `node build.js`.
2. Run `npm run build:sitemap` to refresh `sitemap.xml` (pages with a `noindex` robots meta are excluded automatically).
3. Link it from the relevant hub page (`pages/games.html`, `pages/freebies.html`, `workshops/learn.html`, etc).

---

## Sub-project: QuestLog , RPG Task Tracker

This repo also bundles the source for **QuestLog**, a separate free RPG-style task tracker app, deployed independently to Netlify.

> Turn your projects, tasks, and daily habits into quests. Earn XP, level up, defeat boss quests.

**[▶ Open QuestLog](https://yourquestlog.netlify.app/)** &nbsp;·&nbsp; **[Landing Page](https://yourquestlog.netlify.app/quest-board-page.html)** &nbsp;·&nbsp; **[Privacy Policy](https://yourquestlog.netlify.app/privacy-policy.html)** &nbsp;·&nbsp; **[GitHub](https://github.com/JV-DesignStudio/yourquestlog)**

### Key Files

```
tools/project-tracker.html  Private source (your own board + data)
make-public.js              Generates public app → tools/quest-board.html
tools/quest-board.html      Public app (setup wizard, clean cards)
tools/quest-board-page.html QuestLog landing page (lives on the main site)
questlog-pwa/               Canonical PWA sources (manifest, sw.js, privacy policy)
icons/                      App icons (192px + 512px PNG)
make-app-bundle.js          Builds deploy bundle for Netlify / Play Store
quest-board-deploy/         Ready-to-deploy bundle (fully generated, safe to delete)
```

### Development

Edit `tools/project-tracker.html` (the single source of truth), then rebuild both steps:

```bash
node make-public.js       # tracker → public app (tools/quest-board.html)
node make-app-bundle.js   # public app + PWA assets → quest-board-deploy/
```

Both scripts resolve paths via `__dirname`, so they run from any working directory.
Never hand-edit `quest-board.html` or anything in `quest-board-deploy/` , changes get
overwritten on the next build; edit the tracker or `questlog-pwa/` sources instead.

Deploy: drag `quest-board-deploy/` into Netlify (or push and let auto-deploy pick it up).

### Privacy

No personal data collected. All data in browser `localStorage`. See [Privacy Policy](https://yourquestlog.netlify.app/privacy-policy.html).
