# Pixel Studio — Launch Package

Everything needed to ship Pixel Studio as a product: positioning, store listings, QA matrix, release steps and post-launch tasks.

**Product URL:** https://jvdesignstudio.co.uk/tools/pixel-studio.html
**Landing page:** https://jvdesignstudio.co.uk/tools/pixel-studio-landing.html
**Installable:** Yes — dedicated manifest at `/tools/pixel-studio.webmanifest`, precached in `sw.js` (v9).

---

## 1. Positioning

> **Pixel Studio** — a free, installable pixel art and animation editor that runs in the browser. Layers, frames, onion skinning and game-ready exports with no install, no account and no watermark.

Target audiences:
1. **Young/aspiring game devs** (JVDS core audience) making sprites for Scratch/Godot/Phaser/GM games.
2. **Indie devs** wanting a zero-friction sprite editor that pairs with the Arcade Game Maker.
3. **Teachers/clubs** needing a free, safe, install-free creative tool for lessons.

Differentiators: free + no account + no watermark · mobile touch-first · one-click "Send to Game Maker" · installable/offline PWA.

---

## 2. Chrome Web Store listing (ready to paste)

- **Name:** Pixel Studio — Pixel Art Editor (31 chars ✓, max 45)
- **Summary** (max 132):
  > Draw and animate pixel art free in your browser. Layers, frames, onion skin, GIF & spritesheet export. No install, no account.
  (129 chars ✓)
- **Category:** Graphics & Photography (alt: Productivity → Drawing & Writing)
- **Language:** English (UK)
- **Long description:**

  Pixel Studio is a free pixel art and animation editor that runs entirely in your browser — and installs as an app so it works offline.

  DRAW
  • Pencil, eraser, fill bucket, eyedropper, line and rectangle tools
  • Brush sizes 1–16px, right-click draws with your background colour
  • Mirror mode for instant symmetry
  • 32-colour starter palette, recent colours, custom colour picker
  • Canvases from 8×8 up to 128×128

  ANIMATE
  • Unlimited animation frames with adjustable FPS playback
  • Onion skinning for smooth walk cycles
  • Duplicate frames and layers in one click

  EXPORT (game-ready, no watermark)
  • Animated GIF
  • PNG spritesheet grids
  • Scaled PNGs up to 512px
  • .json project files you can re-open anytime
  • Import existing PNGs and spritesheets

  MADE FOR GAME DEV
  • Layers with visibility toggles and merge-down
  • Undo/redo, autosave and session restore
  • One click sends your sprite to the JVDS Arcade Game Maker
  • Touch-first mobile layout for drawing on the go

  Free forever. No account. Your art is yours, including commercial use.

- **Screenshots** (1280×800 or 640×400, PNG/JPEG):
  1. Full editor with an in-progress character sprite (desktop)
  2. Onion skin + frames strip mid-animation
  3. GIF export preview modal
  4. Mobile layout with bottom tool bar
  5. Spritesheet export result
- **Marquee promo:** 440×280 — reuse/crop `PixelStudioCover.png`
- **Screenshots tool tip:** run the editor at 1280×800, use browser devtools device toolbar for the mobile shot.

## 3. Microsoft Store / PWABuilder

1. Go to https://www.pwabuilder.com → enter the product URL → **Test Package**.
2. Manifest checks should pass (name, icons 192/512 + maskable, start_url, display standalone ✓).
3. Generate **Windows** package → submit via Partner Center; Android package via Google Play (or skip — site PWA is the primary distribution).
4. Keep `sw.js` cache version bumped (currently `jvds-v9`) so installed clients refresh cleanly.

## 4. QA matrix (run before each release)

| Check | Desktop Chrome | Desktop Firefox | Android Chrome | iOS Safari |
|---|---|---|---|---|
| Draw/erase/fill/line/rect | ☐ | ☐ | ☐ | ☐ |
| Right-click bg colour draw | ☐ | ☐ | n/a | n/a |
| Touch draw + lift outside canvas (no crash) | n/a | n/a | ☐ | ☐ |
| Undo/redo (Ctrl+Z / Ctrl+Y) | ☐ | ☐ | ☐ (buttons) | ☐ (buttons) |
| Mirror mode plots both sides | ☐ | ☐ | ☐ | ☐ |
| Layers add/dup/merge/delete + visibility | ☐ | ☐ | ☐ | ☐ |
| Frames add/dup/delete, FPS change mid-play | ☐ | ☐ | ☐ | ☐ |
| GIF export opens in external viewer | ☐ | ☐ | ☐ | ☐ |
| PNG + spritesheet export | ☐ | ☐ | ☐ | ☐ |
| Import PNG / sheet (existing art preserved) | ☐ | ☐ | ☐ | ☐ |
| Project file export → import roundtrip | ☐ | ☐ | ☐ | ☐ |
| Autosave restore prompt appears | ☐ | ☐ | ☐ | ☐ |
| Install prompt → installed → offline launch | ☐ | ☐ | ☐ | (Add to Home Screen) |
| Mobile bottom-bar tabs all functional | ☐ | ☐ | ☐ | ☐ |
| Hamburger nav opens/closes | ☐ | ☐ | ☐ | ☐ |

**Regression guard:** the mobile hamburger previously broke on this page due to a duplicated nav script — verify it opens on every deploy.

## 5. Release steps

```
npm run build            # re-inject nav/footer partials into new/changed pages
npm run build:sitemap    # picks up tools/pixel-studio-landing.html
npm run validate         # links + css gates
npm run test:smoke       # puppeteer smoke test
git commit + push        # deploy (site auto-deploys from repo)
```

Post-deploy:
- Visit `/tools/pixel-studio.html`, confirm DevTools → Application → Manifest loads with the Pixel Studio icons (not the site-wide manifest).
- Confirm `sw.js` v9 activated and precache includes the Pixel Studio entries.
- Lighthouse → Installable ✓, PWA ✓; note the score in the launch log.

## 6. SEO / distribution checklist

- ☐ Landing page + tool page both in `sitemap.xml` (regenerate via `npm run build:sitemap`)
- ☐ Search Console: submit updated sitemap; request indexing for the landing page
- ☐ JSON-LD: `SoftwareApplication` on tool + landing; `FAQPage` on landing ✓
- ☐ Cross-links: dev-tools card, search index entry, gallery chips, discovery session ✓ (already point at the tool)
- ☐ Social: OG image `PixelStudioCover.png` set on both pages ✓
- ☐ Announcement posts: add to `/social-posts` (suggested hook: "Free pixel art editor you can install like an app — GIF export included")
- ☐ Devlog entry documenting v1 (redo, GIF export, autosave, mirror, installable)

## 7. Analytics / KPIs

Track via existing GA4 loader:
- `pixel_studio_open` (tool load), `pixel_studio_install` (install prompt accepted), `pixel_studio_export` (type: png/gif/sheet/project), `pixel_studio_send_gamemaker`.
KPIs for "product working": D7 return rate of installed users, export-per-session ratio, Game Maker hand-off rate.

## 8. Roadmap (post-v1 candidates)

- Selection + move/stamp tools, text tool
- True GIF palette control (per-frame palettes), APNG export
- Cloud sync of project files (once accounts exist)
- Tile-map mode with auto-tiling helpers
- Palette import from exported PNGs
