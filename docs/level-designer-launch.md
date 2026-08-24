# Level Designer — Launch Package

Everything needed to ship the Level Designer as a product: positioning, store listings, QA matrix, release steps and post-launch tasks.

**Product URL:** https://jvdesignstudio.co.uk/tools/level-designer.html
**Landing page:** https://jvdesignstudio.co.uk/tools/level-designer-landing.html
**Installable:** Yes — dedicated manifest at `/tools/level-designer.webmanifest`, precached in `sw.js` (v11).
**Test command:** `npm run test:level` (16 functional checks + packaging checks over HTTP).

---

## 1. Positioning

> **Level Designer** — a free, installable 2D platformer level editor that runs in the browser. Paint tiles, route enemy patrols, play-test instantly and hand off to the Arcade Game Maker — no install, no account.

Target audiences:
1. **Young/aspiring game devs** (JVDS core audience) building levels for their first platformers.
2. **Teachers/clubs** needing a free, safe, install-free game-design tool for lessons.
3. **Indie devs** wanting a zero-friction level sketch tool that pairs with the Arcade Game Maker.

Differentiators: free + no account · instant play mode (design → play in one click) · enemy path tool · one-click "Send to Game Maker" · Level Doctor design feedback (offline) · installable/offline PWA.

---

## 2. Chrome Web Store listing (ready to paste)

- **Name:** Level Designer — 2D Game Levels (32 chars ✓, max 45)
- **Summary** (max 132):
  > Design 2D platformer levels free in your browser. Tile painting, layers, enemy paths, play-testing. No install, no account.
  (127 chars ✓)
- **Category:** Games (alt: Productivity)
- **Language:** English (UK)
- **Long description:**

  Level Designer is a free 2D platformer level editor that runs entirely in your browser — and installs as an app so it works offline.

  DESIGN
  • 10 tools: draw, erase, flood fill, eyedropper, rectangle, line, pan, select, stamp and enemy path
  • Up to 8 named layers with visibility toggles, locking and duplication
  • Grids from 16×8 up to 128×64, with six background themes
  • Reusable stamps — save any region and place it again anywhere

  BRING LEVELS TO LIFE
  • 30+ tiles: terrain, hazards, pickups, enemies, goals and decor
  • Enemy path tool — click waypoints and enemies patrol the route
  • Tile properties: values, tags and notes on any cell

  PLAY-TEST INSTANTLY
  • Built-in play mode with real physics, coins, hazards and lives
  • Checkpoints, stompable enemies and a win flag
  • Level Doctor checks spawn safety, goal placement, hazards and floor coverage

  SHIP IT
  • One click sends your level into the JVDS Arcade Game Maker
  • PNG mock-ups and engine-friendly JSON with full tile definitions
  • Share URLs that encode the whole level
  • 5 save slots plus autosave

  Free forever. No account. Your levels are yours, including commercial use.

- **Screenshots** (1280×800 or 640×400, PNG/JPEG):
  1. Full editor with an in-progress level (desktop)
  2. Enemy path tool with waypoints visible
  3. Play mode mid-jump with coins/HUD
  4. Level Doctor feedback panel
  5. Mobile layout with bottom tool bar
- **Marquee promo:** 440×280 — reuse/crop `LevelDesignCover.png`
- **Screenshots tool tip:** run the editor at 1280×800, use browser devtools device toolbar for the mobile shot.

## 3. Microsoft Store / PWABuilder

1. Go to https://www.pwabuilder.com → enter the product URL → **Test Package**.
2. Manifest checks should pass (name, icons 192/512 + maskable, start_url, display standalone ✓).
3. Generate **Windows** package → submit via Partner Center.
4. Keep `sw.js` cache version bumped (currently `jvds-v11`) so installed clients refresh cleanly.

## 4. QA matrix (run before each release)

| Check | Desktop Chrome | Desktop Firefox | Android Chrome | iOS Safari |
|---|---|---|---|---|
| Draw/erase/fill/pick/rect/line | ☐ | ☐ | ☐ | ☐ |
| Right-click erase + right-drag pan | ☐ | ☐ | n/a | n/a |
| Touch draw + long-press erase | n/a | n/a | ☐ | ☐ |
| Two-finger pan (no accidental paint) | n/a | n/a | ☐ | ☐ |
| Undo/redo (Ctrl+Z / Ctrl+Y + buttons) | ☐ | ☐ | ☐ | ☐ |
| Layers add/dupe/lock/hide/rename | ☐ | ☐ | ☐ | ☐ |
| Grid resize preserves art | ☐ | ☐ | ☐ | ☐ |
| Enemy path: start → waypoints → close | ☐ | ☐ | ☐ | ☐ |
| Stamps: save → place → persists reload | ☐ | ☐ | ☐ | ☐ |
| Save slots: save → load → delete | ☐ | ☐ | ☐ | ☐ |
| PNG export opens in viewer | ☐ | ☐ | ☐ | ☐ |
| JSON export → import roundtrip | ☐ | ☐ | ☐ | ☐ |
| Share URL encode → open in new tab | ☐ | ☐ | ☐ | ☐ |
| Send to Game Maker → Import Last works | ☐ | ☐ | ☐ | ☐ |
| Play mode: run, jump, coin, die, win | ☐ | ☐ | ☐ | ☐ |
| Level Doctor flags empty level + no flag | ☐ | ☐ | ☐ | ☐ |
| Install prompt → installed → offline launch | ☐ | ☐ | ☐ | (Add to Home Screen) |
| Mobile bottom-bar tabs all functional | ☐ | ☐ | ☐ | ☐ |
| Hamburger nav opens/closes | ☐ | ☐ | ☐ | ☐ |

**Regression guard:** `npm run test:level` must pass — it covers the level-name field (a past bug silently broke every save/export path), all 10 tools, undo/redo, save slots, Game Maker export, Level Doctor and play-mode physics.

## 5. Release steps

```
npm run build            # re-inject nav/footer partials into new/changed pages
npm run build:sitemap    # picks up tools/level-designer-landing.html
npm run validate         # links + css gates
npm run test:level       # designer functional + packaging checks
git commit + push        # deploy (site auto-deploys from repo)
```

Post-deploy:
- Visit `/tools/level-designer.html`, confirm DevTools → Application → Manifest loads with the Level Designer icons (not the site-wide manifest).
- Confirm `sw.js` v11 activated and precache includes the Level Designer entries.
- Lighthouse → Installable ✓, PWA ✓; note the score in the launch log.

## 6. SEO / distribution checklist

- ☑ Landing page + tool page in `sitemap.xml` (regenerated via `npm run build:sitemap`; arcade-app bundle no longer pollutes it)
- ☐ Search Console: submit updated sitemap; request indexing for the landing page
- ☑ JSON-LD: `SoftwareApplication` on tool + landing; `FAQPage` on landing
- ☑ Search index entry (auto-crawled) + dev-tools card cross-link
- ☑ Social: OG image `LevelDesignCover.png` set on both pages
- ☑ Announcement posts: `/social-posts/13-level-designer-launch.md`
- ☐ Devlog entry documenting v1 (level name field fix, Level Doctor, installable PWA)

## 7. Analytics / KPIs

Track via existing GA4 loader (add events when wiring analytics):
- `level_designer_open` (tool load), `level_designer_install` (install accepted), `level_designer_export` (type: png/json/share), `level_designer_play`, `level_designer_send_gamemaker`.
KPIs for "product working": D7 return rate of installed users, play-mode-per-session ratio, Game Maker hand-off rate.

## 8. Roadmap (post-v1 candidates)

- Copy/paste between levels via clipboard export
- Warp/door tiles with paired teleport links in play mode
- Moving platforms with defined routes (reuse enemy path data)
- Level collection: multi-level JSON packs with progression
- Tileset image import → play mode uses real sprites instead of colours
