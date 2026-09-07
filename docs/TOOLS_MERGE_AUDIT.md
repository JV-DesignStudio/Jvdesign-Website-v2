# Tools merge audit

Date: 7 Sep
Scope: JVDesignStudio website tools catalogue

The Tools section should move from a large pile of pages to fewer, stronger creator workflows. The safest pattern is to choose one canonical tool for each workflow, keep useful older pages as redirects or supporting references, then update the Tools hub and generated content to point only at canonical destinations.

## Highest-priority duplicate/merge groups

1. Arcade Game Maker
- Canonical tool: `tools/arcade-game-maker.html`
- Current hub page: `tools/arcade-game-maker-landing.html`
- Recommendation: make the hub card point directly to the live app or make the landing page a short pre-launch page with a clear “Open Arcade Game Maker” CTA. Avoid presenting both as separate tools.

2. Pixel Studio
- Canonical tool: `tools/pixel-studio.html`
- Duplicate/support page: `tools/pixel-studio-landing.html`
- Recommendation: keep one public route. If the landing page has SEO value, make it a thin landing page that links to the live tool, but do not list both as tools.

3. Level Designer
- Canonical tool: `tools/level-designer.html`
- Duplicate/support page: `tools/level-designer-landing.html`
- Recommendation: same pattern as Pixel Studio. The creator path should send users to the live editor.

4. SFX Studio
- Canonical tool: `tools/sfx-generator.html`
- Duplicate/support page: `tools/sfx-generator-landing.html`
- Nearby tool: `tools/sound-studio.html`
- Recommendation: keep SFX Studio focused on game sound effects and Sound Studio focused on music/chiptune composition, or merge both under one Audio Studio shell with two modes: SFX and Music.

5. Map / Level / Tileset
- Canonical candidates: `tools/level-designer.html`, `tools/map-generator.html`, `tools/tileset-builder.html`
- Duplicate/support pages: `tools/map-generator-landing.html`, `tools/level-designer-landing.html`
- Recommendation: merge the world-building story around Level Designer. Map Generator can become “Generate a starter map” inside Level Designer later. Tileset Builder can become an import/export companion if it is too thin alone.

6. Sprite animation
- Canonical candidate: `tools/sprite-animator.html`
- Duplicate/support page: `tools/sprite-sheet-animator.html`
- Recommendation: merge into one Sprite Animator page. Keep “spritesheet animator” as a redirect or alternate name only.

7. Colour tools
- Canonical candidate: `tools/colour-palette.html`
- Nearby/reference page: `tools/colour-palettes.html`
- Recommendation: merge into one Colour Palette tool with generator plus presets/library tabs.

8. Quest / Tracker
- Canonical candidate: decide between `tools/quest-board.html`, `tools/quest-board-page.html`, and `tools/project-tracker.html`
- Recommendation: choose one flagship QuestLog tool. Project Tracker can become an advanced mode or be moved out of the public Tools hub if it is more internal/admin-like.

9. Story tools
- Canonical candidate: `tools/story-editor.html`
- Nearby pages: `tools/dialogue-tree-builder.html`, `tools/story-player.html`
- Recommendation: merge Dialogue Tree Builder into Story Editor as a node/dialogue mode. Story Player should be a preview/player route, not a separate creator tool.

10. Guides and cheat sheets
- Pages: engine cheat sheets, glossary, parent guide, keyboard shortcuts, starter guides
- Recommendation: keep them as a “Quick References” library, not full creator tools. This is already mostly reflected in the redesigned hub.

## First merge sequence

1. Make live tools canonical over landing pages for Arcade, Pixel, Level, SFX and Map.
2. Merge Sprite Animator and Sprite Sheet Animator naming/routes.
3. Merge Colour Palette and Colour Palettes into one stronger palette tool.
4. Decide Audio Studio direction: keep SFX and Music separate, or build one shell with modes.
5. Decide QuestLog canonical route and remove the extra public duplicate.

## Rule of thumb

If a page lets the user create or export something, it can stay as a tool. If it only explains, introduces, or lists examples, it should become a landing/support/reference page and should not appear as a separate tool card.
