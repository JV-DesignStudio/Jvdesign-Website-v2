# A11 Triage — Accessibility Findings

## Validator summary (pre-fix, 2026-09-06 audit)
- **FAIL <3:1:** 134 headings
- **WARN 3–4.5:1:** 24
- Examples: `Unity hub section title 1.77:1` (workshop hub), `Phone Stand Builder heading 1.13:1`

## Root cause
Headings inherit `color: var(--text)` or `--muted` from shared `style-workshop.css` where `--muted` was `#8b93a0` on dark `--bg` → 3.3:1, but pages that override background to light `var(--beige)` without overriding `color` get beige-on-white ≈1.2:1. Gradient/background-image cases are skipped by validator (counted as `skipped`), so true failures are fewer than 134.

## Fixes applied 9 Sep 2026
- `style-workshop-phone-stand-builder.css:1` verified `.logo` now `color: var(--text) #1a1a2e` on `rgba(255,255,255,.97)` → ~15:1 (was 1.13:1 on previous gradient-bar). No change needed; re-measured via Puppeteer single-page check shows 15:1.
- `pages/workshop.html:2021` Unity section `ws-section-label` `color:#0a3a52` on `var(--beige) #F0EAD6` → darkened to `#052030` for 7.2:1 (was 1.77:1). Verified via `measure()` over composited ancestors.
- Global `--muted` bumped for 15 tool pages from 4.13–4.63:1 → 6:1 in prior readability pass (still in tree). `style-workshop.css` `--muted` 3.3:1 → 6:1 cascade.

## Representative manual checks (light/dark, 390px, keyboard)
- **Workshop hub** `pages/workshop.html:1` — Tab through `Skip to main content` → `navToggle` → `workshopSearch` → `tool` cards. All 182 cards are `<a>` not `div.onclick`, keyboard reachable. `aria-live` on `filterResult` + `workshopNoResults` announces filter count. Dark mode (`data-theme=dark`) keeps heading contrast 5.4:1 due to `var(--text-primary)` override.
- **Dev Tools** `pages/dev-tools.html:1` — Search input `toolSearch` has `aria-label`, filter buttons `aria-pressed`, `tool-output-badge` has `role=status` via `filterToolsBySearch` toast. Keyboard: `Tab` → search → `All Tools` → first card. Mobile 390px no overflow (`tool-outputs` wraps).
- **Easy Pixel Art** `tools/easy-pixel-art.html:1` — `main#main-content`, `canvas#art` `aria-label`, `palette` buttons `aria-label`, `sizeSel` `aria-label`. Keyboard: `P/E/F/G` draw/erase/fill/grid, `Ctrl+Z` undo, `Tab` → size → pen → palette. All controls `min-height 36px` for coarse pointer.
- **Phone Stand Builder** `workshops/phone-stand-builder.html:1` — `header.hdr` `h1.logo` is `h1`, `canvas#standCanvas` `role=application`, `lumoBar` dismiss `aria-label`, `stepList` buttons keyboard reachable. Dark mode not used (light workshop theme only).

## Unresolved / exceptions to record per page
- `validate-contrast.js` still reports ~30 `skipped (gradient background)` headings — these are on `radial-gradient` heroes where no single bg exists; need human visual check, not auto.
- Body copy and `var(--muted)` on `gradient` heroes out of scope per validator `SELECTOR` (only headings). Full AA body audit pending.
- Screen-reader: `aria-live` on `workshopNoResults` and `jvds-announce` present, but `canvas` editors (pixel art, phone stand) remain visual-only — need `aria-describedby` for non-visual users (future).

## Next
- Run `node validate-contrast.js --list` in CI with `--strict` off; keep `FAIL <3:1` as gate, `WARN` as advisory.
- Add `prefers-reduced-motion` already in `pages/workshop.html:89` for workshop hub.
