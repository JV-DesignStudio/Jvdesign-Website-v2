# Map Generator — Launch Package

Everything needed to ship the JVDS Map Generator as a product: positioning, wiring, QA matrix and release steps. Follows the same playbook as `pixel-studio-launch.md`.

**Product URL:** https://jvdesignstudio.co.uk/tools/map-generator.html
**Landing page:** https://jvdesignstudio.co.uk/tools/map-generator-landing.html
**Offline:** tool + landing precached in `sw.js` (v10) — maps generate and edit fully client-side.

---

## 1. Positioning

> **JVDS Map Generator** — a free, seeded procedural map generator that runs in the browser. Dungeons, world maps and islands from any seed, hand-editable tile by tile, exportable as PNG or engine-ready JSON.

Target audiences:
1. **Indie/hobbyist game devs** building levels for Godot, Unity, Phaser or RPG Maker who want a first-pass layout in seconds.
2. **Game jammers** needing a believable dungeon or island before the jam clock runs out.
3. **Teachers/clubs and TTRPG hosts** wanting printable maps from a seed they can re-roll and share.

Differentiators: deterministic seeds (share a link, get the identical map) · three generator modes in one tool · manual editing on top of generation (rare in free tools) · JSON export with named tiles and room data · no install, no account, no watermark.

## 2. What shipped in v1.0 ("product" pass)

Tool (`map-generator.html`):
- Fixed canvas-edit coordinate math — editing now works correctly at any zoom level and CSS scaling (previously misaligned once zoomed)
- Unified pointer-event input: drag-painting works with mouse, pen and touch; `touch-action:none` stops scroll hijack
- Undo/redo: 50-step stack, Ctrl+Z / Ctrl+Y, buttons in Edit Mode
- Autosave: debounced localStorage snapshot of mode + seed + settings + tiles, with a restore bar on return
- Share links: `?mode=dungeon&seed=42` URL params are read on load and copyable via 🔗 Share
- Clear Map is now undoable

Landing page (`map-generator-landing.html`):
- Live hero demo: real dungeon generation running on the page itself, "New Map" button
- Features grid, three-mode explainer, export formats, 3-step how-it-works, FAQ
- JSON-LD: `SoftwareApplication` + `FAQPage`
- OG/Twitter cards reuse `MapStudioImage.png`

## 3. QA matrix (run before each release)

| Check | Desktop Chrome | Desktop Firefox | Android Chrome | iOS Safari |
|---|---|---|---|---|
| Dungeon/world/island generate | ☐ | ☐ | ☐ | ☐ |
| Same seed → identical map (twice) | ☐ | ☐ | ☐ | ☐ |
| Place/erase/pick at zoom ≠ 1 (alignment!) | ☐ | ☐ | ☐ | ☐ |
| Drag-paint stroke = single undo step | ☐ | ☐ | ☐ | ☐ |
| Undo/redo Ctrl+Z / Ctrl+Y + buttons | ☐ | ☐ | ☐ (buttons) | ☐ (buttons) |
| Touch paint doesn't scroll page | n/a | n/a | ☐ | ☐ |
| Autosave restore bar appears after refresh | ☐ | ☐ | ☐ | ☐ |
| Restore reproduces mode+seed+edits | ☐ | ☐ | ☐ | ☐ |
| Share link (?mode=&seed=) opens correct map | ☐ | ☐ | ☐ | ☐ |
| PNG export opens / is pixel-perfect | ☐ | ☐ | ☐ | ☐ |
| JSON export → import into Godot TileMap | ☐ | ☐ | ☐ | ☐ |
| Clear Map → confirm → undo restores | ☐ | ☐ | ☐ | ☐ |
| Landing demo canvas generates on load + button | ☐ | ☐ | ☐ | ☐ |

## 4. Release steps

```
npm.cmd run build            # re-inject nav/footer partials into new/changed pages
npm.cmd run build:sitemap    # picks up tools/map-generator-landing.html ✓ (474 URLs)
npm.cmd run validate         # links + css gates
npm.cmd run test:smoke       # puppeteer smoke test
git commit + push            # deploy (site auto-deploys from repo)
```

Post-deploy:
- Visit `/tools/map-generator.html`, edit at zoom ×1.5, refresh, confirm restore bar.
- Confirm `sw.js` v10 activated and precache includes both map-generator entries.
- Search Console: submit updated sitemap; request indexing for the landing page.

## 5. SEO / distribution checklist

- ☑ Landing page + tool page in `sitemap.xml` (regenerated via build:sitemap)
- ☑ Search-index entry for the landing page (regenerated)
- ☑ JSON-LD: `SoftwareApplication` on landing; `FAQPage` on landing
- ☑ Cross-links: dev-tools card, search index, gallery chip, content hub already point at the tool
- ☑ Social: OG image `MapStudioImage.png` set on both pages
- ☐ Announcement posts: add to `/social-posts` (hook: "Type a seed, get a dungeon — free map generator that exports straight to Godot/Unity")
- ☐ Devlog entry documenting v1 (undo/redo, autosave, share links, zoom fix)

## 6. Analytics / KPIs

Track via existing GA4 loader:
- `map_generator_open` (tool load), `map_generator_export` (type: png/json), `map_generator_share` (link copied), `map_generator_restore`.
KPIs for "product working": exports per session, share-link click-through, D7 return rate.

## 7. Roadmap (post-v1 candidates)

- Multi-floor dungeons (stairs connect floors into one project file)
- Custom tileset image mapping onto exported PNG
- Native Godot `.tscn` / Unity package export
- Minimap overview while zoomed in
- Room-type labels (treasure room, guard post) in generator + JSON
