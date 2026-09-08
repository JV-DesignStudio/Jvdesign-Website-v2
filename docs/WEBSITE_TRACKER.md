# Website Tracker

Current working tracker for public website changes that need a durable handoff.

## 2026-09-07 Tool-By-Tool QA Pass

Status: in progress. BuildLab, Bitmap Font Maker, Pixel Character Studio, GDD Builder and Icon Generator first passes are complete; continue with the next queued tool.

Approach:
- Work one tool at a time instead of doing a broad toolbox sweep.
- For each tool, check duplicate nav/header chrome, footer placement, broken or corrupted symbols, the main interaction, achievement/learning feedback and mobile layout.
- Avoid global symbol replacement. Some question marks are intentional coding blanks, so encoding cleanup should happen page-by-page.
- Add focused smoke tests where a tool has complex interaction or layout risk.

BuildLab pass:
- Removed the extra local header so BuildLab uses the same shared site nav as the rest of the site.
- Removed the duplicate skip link.
- Stopped the BuildLab stylesheet from hiding `.site-header`, which could hide the real shared nav.
- Removed the old corrupted "header consolidation" hack from the BuildLab stylesheet.
- Added an in-canvas BuildLab status badge so the tool still has a clear identity without a second nav.
- Added graceful 3D engine startup handling. If Three.js, TransformControls or WebGL fail, learners now see a clear restart/help state instead of a dead viewport.
- Added a focused BuildLab smoke test for phone and desktop checks.
- `node scripts/tool-smoke-buildlab.cjs` passed across phone and desktop viewports.
- `node validate-links.js` passed: 7039 internal references checked, 0 broken.

Bitmap Font Maker pass:
- Removed the extra local `.hdr` header so the page uses the same shared site nav as the rest of the site.
- Added a compact "Pixel font workshop" workflow strip: choose glyph, draw pixels, preview/export.
- Added clearer accessible labels to the icon-only toolbar buttons.
- Removed a duplicate `?` keyboard handler that called a missing `showToast()` function.
- Removed the old header-consolidation CSS hack from the tool stylesheet.
- Added a focused Bitmap Font Maker smoke test for phone and desktop checks.
- `node scripts/tool-smoke-bitmap-font-maker.cjs` passed across phone and desktop viewports.
- Corrupted-symbol scan was clean for `tools/bitmap-font-maker.html` and `style-tool-bitmap-font-maker.css`.
- Follow-up `node validate-links.js` passed: 7036 internal references checked, 0 broken.

Pixel Character Studio merge pass:
- Rebranded `tools/character-designer.html` as Pixel Character Studio while keeping the existing URL so old links continue to work.
- Removed the extra local tool header so the merged studio uses the shared site nav only.
- Added a clear mode strip: Design, Pixel edit, Animate and Export.
- Updated the welcome flow to explain the merged journey instead of just character creation.
- Updated `pages/dev-tools.html` so Pixel Character Studio is the main art pipeline card.
- Repositioned Pixel Studio and Sprite Animator as Classic specialist fallbacks on the Dev Tools page.
- Added Classic bridge strips to `tools/pixel-studio.html` and `tools/sprite-animator.html` that point learners into Pixel Character Studio.
- Removed duplicate local headers and stale header-consolidation CSS hacks from the Classic Pixel Studio and Sprite Animator pages.
- Added a focused Pixel Character Studio smoke test for phone and desktop checks.
- `node scripts/tool-smoke-pixel-character-studio.cjs` passed across phone and desktop viewports.
- Follow-up `node validate-links.js` passed: 7048 internal references checked, 0 broken.
- Added `node scripts/art-tools-consolidation-smoke.cjs` for the full art merge flow.
- `node scripts/art-tools-consolidation-smoke.cjs` passed: Dev Tools, Pixel Character Studio, Pixel Studio Classic and Sprite Animator Classic across phone and desktop viewports.
- Corrupted-symbol scan was clean for the merged studio, both Classic pages and `pages/dev-tools.html`.
- Follow-up `node validate-links.js` passed: 7047 internal references checked, 0 broken.

GDD Builder pass:
- Removed the extra skip link and duplicate local `.site-header`.
- Removed the stale header-consolidation CSS hack and the tool-specific `.site-header` override that fought the shared nav.
- Replaced visible corrupted hero/action/section-toggle strings with safe labels/entities.
- Replaced corrupted generated check/delete/toast strings with safer text/entities.
- Added a focused GDD Builder smoke test for phone and desktop checks.
- `node scripts/tool-smoke-gdd-builder.cjs` passed across phone and desktop viewports.
- Follow-up `node validate-links.js` passed: 7043 internal references checked, 0 broken.

Icon Generator pass:
- Removed the extra skip link and duplicate local `.hdr` header.
- Added a compact "App icon workshop" brief with the learner flow: Shape, Palette, Style and Export.
- Removed the stray question-mark symbol from the reset action.
- Removed stale header-consolidation CSS and duplicate skip-link CSS.
- Added local mobile shared-nav sizing so the tool does not overflow on phones.
- Added a focused Icon Generator smoke test for phone and desktop checks.
- `node scripts/tool-smoke-icon-generator.cjs` passed across phone and desktop viewports.
- Corrupted-symbol scan was clean for `tools/icon-generator.html` and `style-tool-icon-generator.css`.
- Follow-up `node validate-links.js` passed: 7040 internal references checked, 0 broken.

Tool queue from first scan:
- `tools/buildlab.html` - first pass complete.
- `tools/bitmap-font-maker.html` - first pass complete.
- `tools/character-designer.html` - first pass complete as Pixel Character Studio.
- `tools/pixel-studio.html` - repositioned as Pixel Studio Classic with bridge to Pixel Character Studio.
- `tools/sprite-animator.html` - repositioned as Sprite Animator Classic with bridge to Pixel Character Studio.
- `tools/gdd-builder.html` - first pass complete.
- `tools/icon-generator.html` - first pass complete.
- `tools/level-designer.html` - likely duplicate local header.
- `tools/drum-pad.html` - corrupted text symbols found in scan.
- `tools/game-idea-generator.html` - corrupted text symbols found in scan.
- `tools/glossary.html` - corrupted text symbols found in scan.
- `tools/game-logo-maker.html` - corrupted text symbols found in scan.

Art tool consolidation direction:
- Merge candidate: `tools/character-designer.html`, `tools/pixel-studio.html`, `tools/sprite-animator.html` and possibly `tools/sprite-sheet-animator.html` should become one guided sprite/character studio with modes for Character, Pixel Edit, Animate and Export.
- Merge candidate: `tools/level-designer.html`, `tools/tileset-builder.html` and parts of `tools/map-generator.html` can become a world/level studio later, but only after the sprite/character merge because it is bigger and has play-mode logic.
- Keep separate: `tools/bitmap-font-maker.html` should remain its own tool because font creation has a different workflow and export target.
- Keep separate: `tools/game-logo-maker.html`, `tools/icon-generator.html`, `tools/trading-card-designer.html` and `tools/particle-designer.html` should stay as focused asset generators unless a later pass creates a shared "Brand/UI assets" hub.
- Dev Tools page should eventually show studios first, then smaller focused generators underneath, so learners choose by outcome instead of seeing too many overlapping art tools.

## 2026-09-06 Workshop UX Pass

Status: in progress, broad shared uplift complete with focused Unreal Blueprint polish added.

Scope covered:
- Workshop overview page now has a clear "choose your path" section before the full library.
- Workshop overview page now has a dedicated finder with search and quick category jumps for Scratch, Roblox, Godot, Unity, Unreal, Minecraft, Builders and Downloads.
- Workshop overview filters now announce what they are showing.
- Workshop overview filters now combine format, learner age and search text, then hide empty sections so the page is easier to scan.
- Workshop overview cards have a more consistent shared treatment across article cards, course cards and download cards.
- Shared workshop pages now get an automatic learning map: Build, Check, Unlock.
- Standard step-card workshops have clearer active, completed and locked visual states.
- Quiz, code challenge and true/false controls have stronger spacing and mobile touch targets.
- Builder-style workshops, including Unreal Blueprint pages, now get safer responsive layout treatment, sticky step tabs, clearer completed tab dots and mobile canvas constraints.
- Unreal Blueprint workshops now get an automatic "Blueprint build loop" coach panel: read pins, type values and test the preview.
- Both Unreal layout families are detected by the shared workshop script, so newer Blueprint pages and older `.steps-col` pages receive the same learning-map support.
- Blueprint task lists, node canvases, tab buttons and value inputs now have clearer focus, touch and mobile behavior.
- Racing Blueprint duplicate fullscreen joystick handler was removed.
- Racing Blueprint duplicate structured-data object was removed so its bottom JSON-LD block is valid again.
- Shared workshop feedback badges now mask broken legacy icon glyphs with clean OK/! states.

Files changed:
- `pages/workshop.html`
- `style-workshop.css`
- `workshop-enhancements.js`
- `workshops/racing-blueprint.html`
- `scripts/workshop-responsive-smoke.cjs`

Validation:
- `node validate-workshops.js` passed: 39/39 standard workshops and 22/22 builder-style workshops valid.
- `node validate-links.js` passed: 5228 internal references checked, 0 broken.
- Puppeteer Chrome was restored to the local cache for browser validation.
- Focused workshop responsive smoke test added for the overview and representative Unreal Blueprint pages.
- Focused smoke test now checks the Workshop finder/search behavior as well as layout overflow.
- `node scripts/workshop-responsive-smoke.cjs` passed: 7 pages across 3 viewports.
- `node validate-css.js` and `node validate-contrast.js` were able to launch but the broad sweeps hung without useful output; use the focused smoke test for this pass.

Remaining follow-up:
- Run browser-based CSS and JS validation after installing or restoring Puppeteer Chrome.
- Do a manual browser visual pass on the Unreal Blueprint pages after local preview tooling is available.
- Review individual workshop copy for any step that is technically passable but not clear enough for a beginner.
- Consider moving the overview inline styles into a dedicated stylesheet when there is room for a cleanup pass.
- Continue replacing legacy encoding artifacts in page-specific prose. Many `??` strings are intentional coding blanks, so this should be handled page-by-page rather than with a global replace.
