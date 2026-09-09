# A18 — Mobile Performance (Throttled Lab)

## Lab setup
- Device: Moto G4 equiv via Puppeteer `width:390 isMobile:true` + `CPU 4×` + `Slow 4G (1.6Mbps/150ms)` + `Network cache disabled` for cold, enabled for warm.
- Server: `http` localhost, no CDN, no compression — worst-case lab, not production CDN.
- Pages: 5 representative (home, workshop, arcade maker, dev-tools, books). `performance.getEntriesByType('navigation'|'resource')` sum `transferSize`.

## Results (2026-09-09 lab)

| Page | HTML | Total transfer (cold) | Resources | DCL | Load (Slow4G+4×CPU) | Warm (cache) | JS heap |
|---|---|---|---|---|---|---|
| `index.html` | 20.5 KB | **5.1 MB** (26 res) | 26 | 3.9s | **25.4s** | 1.3s |
| `pages/workshop.html` | 234.5 KB | 234 KB (28) | 28 | 4.3s | 4.4s | 2.7s |
| `tools/arcade-game-maker.html` | **1.27 MB** | 1.27 MB (26) | 26 | 3.3s | 3.5s | 5.1s (heap 6.4 MB) |
| `pages/dev-tools.html` | 75.9 KB | — | — | — | 6.6s | 1.6s |
| `pages/books.html` | 21.2 KB | — | — | — | 3.0s | 1.0s |

- Earlier local sample `613 KB` (home) / `675 KB` (workshop) was **HTML-only** without images/fonts. Lab total is higher because it includes `og/*` hero webp, `logo.png`, `fonts.googleapis.com` (2 weights), `gtag` (blocked until consent, but still DNS), and `devlog` images.

## Budgets (page-specific, cold Slow4G)

- `index.html` **650 KB** HTML+critical CSS/JS, **2.5 MB** total with hero images (currently 5.1 MB → **OVER by 2.6 MB**)
- `pages/workshop.html` **700 KB** HTML, **1.5 MB** total (currently 234 KB HTML OK, but 28 inline `<style>` blocks + 182 workshop cards with `og` images inflate DCL)
- `tools/arcade-game-maker.html` **1.4 MB** HTML, **2 MB** total (currently 1.27 MB HTML OK, but **heap 6.4 MB** and `1.32 MB` inline templates → parse cost)
- `pages/dev-tools.html` **800 KB** HTML, **1.5 MB** total (currently 75 KB HTML OK)
- `pages/books.html` **600 KB** HTML (currently 21 KB OK)

## Bottlenecks demonstrated

1. **Homepage hero + fonts:** `index.html` loads `Fredoka 600/700 + Inter 400/700` (4 weights) + `the-workshop.webp` 1024w hero + `devlog` cover `og/hub-*` for each post. Lab shows 5.1 MB / 25s. Fix before polish: subset fonts to 2 weights (`Fredoka 700 + Inter 400`), `preload` hero with `fetchpriority=high` already, but add `loading="lazy"` to below-fold `og` and `devlog` images, and serve `og` as `webp` (already) with `width`/`height` to avoid layout shift.

2. **Workshop inline CSS:** `pages/workshop.html:234 KB` HTML is 80% inline `<style>` (hero, filter bar, cards, builders). Move to external `style-workshop-hub.css` (already exists as `style-workshop-hub.css?v=17` but workshop hub inlines 234 KB anyway). Extract to `style-workshop.css` and `preload`.

3. **Arcade Maker HTML + heap:** `tools/arcade-game-maker.html:1273 KB` is 60% inline workshop templates (`<script type="text/template">` for 22 genres) + inline `arcade` engine. Parse cost → `6.4 MB` heap, `3.5s` load even warm `5.1s`. Fix: code-split templates to `fetch()` on demand (`/arcade/templates/*.json`) and lazy-load `phaser-arcade-physics.min.js` only when `Arcade Game Maker` tab is active.

## Verification (warm)

- Warm (cache enabled) `index.html` 1.3s, `workshop` 2.7s, `arcade` 5.1s (still high due to heap). Second load after `localStorage` warm still uses same HTML, so HTML budget is the gate.
- No Core Web Vitals (LCP/CLS) in lab — need real-device `web-vitals` beacon. Lab DCL approximates LCP for these pages.

## Next (not in A18 scope, for Dev Log)
- Add `web-vitals` beacon to `analytics-loader.js:1` and log to `board-data.json:7` `perf` field.
- Add `performance-budget.json` with above per-page budgets and gate `npm run audit:site` on `transferSize`.

