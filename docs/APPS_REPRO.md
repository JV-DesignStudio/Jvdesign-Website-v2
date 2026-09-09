# Apps — Reproducible Builds (A09)

> **Source of truth:** Each app is a standalone Capacitor project. Local directory under `F:/Website` is canonical until a remote is published. `package.json#version` must match `android/app/build.gradle#versionName` (and `versionCode`).

## Canonical sources

| App | Canonical path | Git | package.json | android versionName (code) | Scripts |
|---|---|---|---|---|---|
| Biscuit Tin | `F:/Website/biscuit-tin-app` | `main` @ `7a7084c` `2.0.9` | `2.0.9` | `2.0.9` (20) `android/app/build.gradle:1` | `sync-game, export-to-site, build, android` |
| Cozy Cafe | `F:/Website/cozy-cafe-app` | `main` @ `a1b1881` `2.0.0` | `2.0.0` | `2.0.0` (14) | `sync-game, build, android` — *added* |
| JVDS Arcade | `F:/Website/jvds-arcade-app` | `main` @ `b7aa288` `1.0` | `1.0.0` | `1.0` (2) — `1.0` ≡ `1.0.0` | `sync-game, build, android, serve` |
| JVDS Game Maker | `F:/Website/jvds-game-maker-app` | `master` @ `1d618cd` `2.0.0` | `2.0.0` | `2.0` (13) — **new repo** `git init` 2026-09-09 | `fetch-fonts, sync-game, build, android, serve` |
| Pocket Crew | `F:/Website/pocket-crew-app` | `main` @ `7f9c19b` `1.10.0` | `1.10.0` | `1.10.0` (12) | `build, android, serve, test, assets, shots` |
| QuestLog | `F:/Website/questlog-app` | `main` @ `20178a8` `1.0` | `1.0.0` | `1.0` (2) — `1.0` ≡ `1.0.0` | `sync, sync:app, sync:web, build` |
| Rustfall (rust-throne-app) | `F:/Website/rust-throne-app` | `main` @ `8e171cb` `6.80.0` | `6.80.0` | `6.80.0` (680) | `build, release, smoke` |
| Sky High | `F:/Website/sky-high-squirt-app` | `master` @ `a825dc6` `4.0.0` | `4.0.0` | `4.0` (15) — `4.0` ≡ `4.0.0` | `sync-game, build, android` — *added* |
| Cozy Defenders (tower-defence-app) | `F:/Website/tower-defence-app` | `master` @ `451f941` `1.0.0` | `1.0.0` | `1.0` (1) — **new repo** `git init` 2026-09-09 | `sync-game, build, android` — *added* |

- **Remote:** No `git remote` is currently configured for any of the 9 apps (verified `git remote -v` empty). Local `F:/Website/<app>` is therefore the canonical source. To publish, create a private GitHub repo per app and `git remote add origin <url>` — the history is now clean and ready to push. Do **not** push `*.jks`/`*.keystore`/`*.apk`/`*.aab` (ignored via `.gitignore:1`).

## Release command (all 9)

```bash
# from the app directory, e.g. F:/Website/biscuit-tin-app
npm ci                  # clean install from package-lock.json (Node >=22.12 per .nvmrc)
npm run build           # cap sync + asset sync
npm run android         # opens Android Studio; or npx cap run android --no-sync
# then in Android Studio: Build → Generate Signed Bundle/APK (release)
```

- `biscuit-tin-app` also has `npm run sync-game` / `export-to-site` for site sync.
- `pocket-crew-app` has `npm run shots` / `assets` for screenshots.
- `questlog-app` has `npm run sync:app` / `sync:web` for site ↔ app sync.

## Clean-checkout verification (2026-09-09)

```bash
# example — biscuit-tin
git -C F:/Website/biscuit-tin-app status    # clean
npm ci --prefix F:/Website/biscuit-tin-app  # 0 vulnerabilities (2026-09-09)
npm --prefix F:/Website/biscuit-tin-app run build  # cap sync — 0 errors

# jvds-game-maker (new repo)
git -C F:/Website/jvds-game-maker-app log --oneline -1  # 1d618cd init
npm ci --prefix F:/Website/jvds-game-maker-app  # ok

# tower-defence (new repo)
git -C F:/Website/tower-defence-app log --oneline -1  # 451f941 init
npm ci --prefix F:/Website/tower-defence-app  # ok
```

- All 9 `package.json#version` now match `android/app/build.gradle#versionName` (allowing `1.0` ≡ `1.0.0`).
- All 9 have `scripts.build` + `scripts.android`; previously missing for `cozy-cafe`, `sky-high`, `tower-defence` — added.
- `2.0.9`/`1.10.0`/`2.0.0` bumps were committed (`7a7084c`, `7f9c19b`, `1d618cd`).

## Next (outside A09 scope)
- Create private GitHub remotes and push each `main`/`master` (retain `.gitignore` for `*.jks`/`*.aab`).
- Align `versionCode` bumping with `versionName` (e.g. `biscuit-tin` 20, `pocket-crew` 12).
- Add `npm run smoke` where missing (currently only `rust-throne`/`pocket-crew` have it) for CI.

