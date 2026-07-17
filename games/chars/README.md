# Character sprite art

Drop the crew's real art here and the game (website AND app) uses it
automatically instead of the built-in vector versions. No art here =
vector fallback, nothing breaks.

Required filenames (lowercase):

- `lumo.png`  — the purple fox
- `ember.png` — the pink tiger
- `pip.png`   — the turtle
- `echo.png`  — the axolotl

Requirements:
- Front pose, standing, whole body visible
- Transparent background (PNG with alpha)
- At least 512px tall (displayed ~66x92, so anything sharp works)

Got art on a plain light background instead of transparent? Put those
files in `F:\Website\biscuit-tin-app\art-src\` and run:

    cd F:\Website\biscuit-tin-app
    node cut-bg.mjs

It flood-fills the background away from the edges (so white eyes and
muzzles are safe) and writes transparent PNGs straight into this folder.

After adding art: run the app's `npm run build` to sync it into the
Android app, and commit this folder so the website gets it too.
