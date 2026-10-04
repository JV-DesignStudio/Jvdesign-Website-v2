# Arcade Maker modules , contract

The Arcade Game Maker is one page, `tools/arcade-game-maker.html`, but its reusable
data and pure logic live here as native ES modules. This file is the contract: read it
before adding a module or editing the maker's script.

## Why modules, and why native ESM

The old maker was a single ~21,000 line file. Splitting it lets the data be unit-tested
and stops the same map being copy-pasted three times. The website must keep working with
**no build step** (School-Computer Rule: no install, no admin, open and create), so the
modules are plain ES modules loaded by the browser, not a Vite/Rollup bundle.

The Vite path (`vite.config.js`) belongs to the sibling `jvds-game-maker-app` repo only.
Never make `jvdesignstudio.co.uk` depend on `npx vite build`.

## The modules

| File | Exports | What it is |
|---|---|---|
| `liveConfig.js` | `liveConfig` (default too), `gameState`, `touchInput`, `gameTheme`, `themeInt`, `themeHex`, `_themeData`, `_lcDefaults`, `_clearTouchInput` | All tunable game config, run state, theme data and Tower Defence defaults |
| `GameAudio.js` | `GameAudio` (default too) | Web Audio SFX synthesis, music, custom buffers |
| `genres.js` | `GENRE_LIST`, `GENRE_DESCS`, `GENRE_ICONS`, `GENRE_LABELS` | The 22-genre roster plus description/icon/label maps |
| `achievements.js` | `ACH_TOAST` | Achievement toast labels |

`GENRE_LIST` is the single roster. The `#genreMode` select, the picker grid and every
`for (const g of …)` loop should agree with it. `tests/arcade-game-maker-all-genres.js`
reads the select at runtime, so adding a genre to the maker automatically gets it tested.

## How the HTML consumes them

A small deferred module near the top of `tools/arcade-game-maker.html` imports everything
and publishes it on `window`:

```html
<script type="module">
import { liveConfig, … } from '../src/arcade-maker/liveConfig.js';
import { GameAudio } from '../src/arcade-maker/GameAudio.js';
import { GENRE_LIST, … } from '../src/arcade-maker/genres.js';
import { ACH_TOAST } from '../src/arcade-maker/achievements.js';
const _GENRE_DESCS = GENRE_DESCS, _GENRE_ICONS = GENRE_ICONS, _ACH_TOAST = ACH_TOAST;
Object.assign(window, { liveConfig, …, _GENRE_DESCS, _GENRE_ICONS, _ACH_TOAST });
</script>
```

Then the big **classic** `<script>` below runs as it always did.

### Why not convert the whole script to a module

A module has its own scope. Converting the classic script to `type="module"` would hide
every top-level function and variable from the page's inline `onclick="pickGenre(…)"`
handlers and from the other classic scripts. Publishing the imported values on `window`
from a small deferred module keeps all of that working while still removing the duplicate
definitions. Modules are deferred, so this runs after HTML parsing but before any user
interaction; nothing in the classic script reads these values at parse time.

### Legacy global names

The classic code reads some globals with a leading underscore (`_GENRE_DESCS`,
`_GENRE_ICONS`, `_ACH_TOAST`) because that is what it always used. The modules export the
clean names and the bootstrap publishes both, so neither naming style breaks.

## Adding a module

1. Create `src/arcade-maker/<name>.js` with `export`s. Keep it DOM-free if you want it
   unit-testable; if it touches the DOM, that is fine but note it.
2. Import it in the bootstrap and add it to the `Object.assign(window, …)` list (plus a
   legacy alias if existing code expects one).
3. Delete the inline definition from `tools/arcade-game-maker.html`.
4. Add a check to `tests/arcade-maker-modules-sync.js` (see below) and run the gate.

## The gate (run before review)

```bash
npm run test:arcade          # core smoke: page loads, 3 genres boot, patches present
npm run test:arcade-all      # every genre in #genreMode boots Phaser with no JS errors
npm run test:arcade-modules  # single source of truth: no inline duplicates; modules load
npm run validate:links
```

`test:arcade-modules` is the boundary guard. It fails if:
- the HTML defines `const liveConfig = {`, `const GameAudio = {`, `_GENRE_DESCS`,
  `_GENRE_ICONS` or `_ACH_TOAST` inline again, OR
- the HTML stops importing a module, OR
- any module fails to parse or load cleanly under native ESM.

Add the same style of check when you extract something new, so it cannot silently creep back.

## Retired: the extractor

`scripts/sync-arcade-maker-modules.js` was the one-time extractor (A759) that pulled the
inline definitions into modules. Since A760 the modules are the source of truth and there
is nothing left to extract, so the script detects the inline block is gone and no-ops. It
is kept for historical reference only and is **not** part of the edit workflow. Do not use
it to regenerate modules; edit the module files directly.

## Guardrails

- The website loads with **no build step**. Native ESM only; Vite is app-repo-only.
- One source of truth per value. Never leave an inline copy alongside a module export.
- Keep the `liveConfig._base` accessor trick (`speed` / `fireCooldown` fold in RunMods
  multipliers) until every call site uses the getters.
- There is no `www/` or `sync-maker.mjs` in this repo; those live in `jvds-game-maker-app`.

## History

- **A758**: all-genre headless boot test (`tests/arcade-game-maker-all-genres.js`), the
  safety net that made this refactor possible.
- **A759**: reconciled the dead `liveConfig.js` / `GameAudio.js` scaffolds against the live
  source; added the drift seal.
- **A760**: wired the modules into the page (the bootstrap above) and deleted the inline
  `liveConfig` / `GameAudio` / state / theme helpers.
- **A763**: extracted `genres.js` and `achievements.js`; deduplicated `ACH_LABELS` and the
  title-screen maps.
- **A761**: this contract document.
