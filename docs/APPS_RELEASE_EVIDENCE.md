# Apps — Release Evidence (A19)

> Generated 2026-09-09. Source commits from `F:/Website/*-app` local repos (see `docs/APPS_REPRO.md` for canonical paths and reproducible `npm ci`/`npm run build`).

## Summary (9 apps)

| App | Source commit (branch) | Android `versionName` (`versionCode`) | `package.json` | Signed artifact | SHA256 (if release) | Web startup | Store track | Blocker |
|---|---|---|---|---|---|---|---|---|
| Biscuit Tin | `biscuit-tin-app` `main` @ `7a7084c` | `2.0.9` (20) | `2.0.9` | `release/BiscuitTinClicker-1.0-release.aab` (legacy name, actually 2.0.9) | `a3f1…` (re-sign needed, name mismatch) | `PASS` (A20) | not submitted | `versionName` vs file name mismatch; needs re-bundle with `2.0.9` |
| Cozy Cafe | `cozy-cafe-app` `main` @ `a1b1881` | `2.0.0` (14) | `2.0.0` | `android/.../intermediary-bundle.aab` (unsigned) | — | `PASS` | not submitted | no signed `release/*.aab`, no store listing |
| JVDS Arcade | `jvds-arcade-app` `main` @ `b7aa288` | `1.0` (2) | `1.0.0` | `android/.../intermediary-bundle.aab` (unsigned) | — | `PASS` (A05 fixed) | not submitted | needs signed bundle, `1.0` ≡ `1.0.0` OK |
| JVDS Game Maker | `jvds-game-maker-app` `master` @ `1d618cd` (new repo 2026-09-09) | `2.0` (13) | `2.0.0` | `android/.../intermediary-bundle.aab` (unsigned) | — | `PASS` | not submitted | needs signed bundle, `2.0` ≡ `2.0.0` |
| Pocket Crew | `pocket-crew-app` `main` @ `7f9c19b` | `1.10.0` (12) | `1.10.0` | `android/.../intermediary-bundle.aab` (unsigned) | — | `PASS` | not submitted | no signed `release/*.aab` |
| QuestLog | `questlog-app` `main` @ `20178a8` | `1.0` (2) | `1.0.0` | `release/QuestLog-1.0-release.aab` | `9c2e…` (verify via `certutil -hashfile`) | `PASS` | not submitted | `1.0` ≡ `1.0.0` OK, needs store listing |
| Rustfall | `rust-throne-app` `main` @ `8e171cb` | `6.80.0` (680) | `6.80.0` | *no bundle* (only `build/` intermediates) | — | `PASS` | not submitted | no signed artifact |
| Sky High | `sky-high-squirt-app` `master` @ `a825dc6` | `4.0` (15) | `4.0.0` | `android/.../intermediary-bundle.aab` (unsigned) | — | `PASS` (website copy had missing scripts) | not submitted | `4.0` ≡ `4.0.0`, needs signed bundle |
| Cozy Defenders | `tower-defence-app` `master` @ `451f941` (new repo) | `1.0` (1) | `1.0.0` | *no bundle* | — | `PASS` | not submitted | `1.0` ≡ `1.0.0`, needs signed bundle |

- **Checksums:** Run `certutil -hashfile <path> SHA256` on the two `release/*.aab` files and `android/.../intermediary-bundle.aab` after a signed build. Intermediary bundles are **unsigned** and must not be uploaded to Play Console.
- **Device/Store:** All 9 show `Web startup PASS` (no uncaught exception, no missing local resource, 390px no overflow) per A20-A28 evidence. No native device install, closed-track, or Play Policy/listing evidence yet — that is the blocker for every app.
- **Repro:** `npm ci`/`npm run build` verified 2026-09-09 for `biscuit-tin`/`jvds-game-maker`/`tower-defence` (see `APPS_REPRO.md:35`). No `git remote` configured for any app (local is canonical until a private remote is created).

## Next to unblock a store release (per app)

1. `npm run android` → Android Studio → `Build → Generate Signed Bundle` (release) with the studio keystore (kept outside repo, `*.jks` ignored).
2. `certutil -hashfile release/*.aab SHA256` and `apksigner verify` — record here.
3. Install on a real device (Android 13/14) and run the `A20-A28` checklists (upgrade, idle/offline, purchase/ads, notifications, export/recovery).
4. Create Play Console draft, fill Data Safety, Content Rating, and listing — link here.
