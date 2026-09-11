# Scripts - JVDS Backend

> The site is static (no server). "Backend" here = build pipeline + validators + generators that produce the static assets Cloudflare/GitHub Pages serves.

## Before vs After

| Before | After |
|---|---|
| 5 loose files in root (`build.js`, `generate-sitemap.js`, etc) | All pipeline in `scripts/build/` |
| 4 copies of `walk()` + `IGNORE_DIRS` with drift | One `lib/paths.js` + `lib/walk.js` |
| `npm run build` = `A && B && C && D && E` chain | `npm run build` = `node scripts/build/index.js` (timed, `--only` filters) |
| No single place to see pipeline order | `scripts/build/index.js` is the manifest |

## Layout

```
scripts/
  lib/
    paths.js      ROOT, IGNORE_DIRS, EXCLUDE_FILES, BASE_URL - single source of truth
    walk.js       walk(dir, {ext, ignore}) - one implementation
  build/
    index.js      Orchestrator (timed, --only, --skip-validate, post-build link check)
    partials.js   Inject partials/nav-content into every HTML (was root build.js)
    content.js    content/*.json + content-data.js (was generate+build-content-data)
    sitemap.js    sitemap.xml + search-index.json
    latest.js     latest-post.json from devlog-data.js
    board.js      board-data.json KPIs for dev-board.html
  validate/
    index.js      Runs validate-links/css/js/contrast/workshops sequentially
  README.md       (this file)
```

## Usage

```bash
# Full build (what CI runs)
npm run build
# or
node scripts/build/index.js

# Single stage (fast iteration)
node scripts/build/index.js --only=partials
node scripts/build/index.js --only=content
node scripts/build/index.js --only=sitemap --skip-validate

# Validators
npm run validate
node scripts/validate/index.js --only=links
```

## Adding a new build step

1. Create `scripts/build/my-step.js` exporting `runMyStep()`.
2. Register it in `scripts/build/index.js` `STEPS` array (order matters).
3. Update this README.

## Legacy shims

Root files `build.js`, `generate-sitemap.js`, `validate-links.js`, etc still exist as
thin wrappers for backwards compat (`npm run build:legacy` also preserved). New code should
import from `scripts/lib/*` and `scripts/build/*` directly. Eventually the root shims will be
removed once CI and docs are migrated.

## School-Computer Rule

Everything here runs with `node` only, no install/admin rights needed for content authors.
`npm ci` is required only for `validate:css` / `validate:js` (puppeteer).
