# Arcade Maker Modular Split — Plan

## Goal
Reduce 1.37 MB single-file parse cost by splitting `tools/arcade-game-maker.html` into ES modules, keeping `www/` build working via `sync-maker.mjs`.

## Stages (incremental, each ships)
1. **Extract pure data**: `liveConfig.js`, `GameAudio.js`, `RunMods.js` — no DOM deps, easy to unit test.
2. **Extract scenes**: each genre `sceneShooter.js` etc. Import via `getScene(data)` factory.
3. **Extract editors**: tilemap `tilemap.js`, level `level.js`, daily `daily.js`.
4. **Vite build**: `vite build` emits `dist/assets/*.js` chunks; `sync-maker.mjs` copies `dist` to `www/` for Capacitor.
5. **Remove inline**: once all imports verified, delete inline `<script>` from HTML, keep HTML as shell.

## Current scaffold
`vite.config.js` already points at `tools/arcade-game-maker.html`. Running `npx vite build` succeeds even before modules exist (just copies HTML). As modules are extracted, Rollup will code-split automatically.

## Adding a module
Example `src/arcade-maker/liveConfig.js`:
```js
export const liveConfig = { speed:200, ... };
```
Then in HTML: `<script type="module">import { liveConfig } from '/src/arcade-maker/liveConfig.js'</script>`

## Guardrails
- Keep `www` generated — never edit `www/index.html` by hand.
- Keep `liveConfig._base` accessor trick until all `speed/fireCooldown` sites use imported getters.
- Add `npm run test:arcade` after each stage to catch regressions.
