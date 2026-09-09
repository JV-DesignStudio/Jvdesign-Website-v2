# A29 — Dependency and Asset Provenance (2026-09-09)

## Dependencies
- `npm audit` → `0 vulnerabilities` (48 packages, 2026-09-09, Node 26.2 / npm 11.13, lockfile includes `vite@6.4.3` as declared in `package.json:48`).
- `devDependencies`: `puppeteer@25.10.0` (Apache-2.0), `sharp@0.35.4` (Apache-2.0), `three@0.128.0` (MIT), `vite@6.4.3` (MIT). All via `npm ci` from `package-lock.json` (reproducible).
- `engines.node >=22.12.0` (`package.json:50`, `.nvmrc: 24`).

## Secrets / History
- Filename scan `**/*.{jks,keystore,pem,p12,env}` → 0 matches in website repo (2026-09-09).
- `git log --all --oneline -- "*jks|*.keystore|*.pem|*.p12|*.env"` → 0 (apps keep `*.jks` ignored via `.gitignore`).
- Full content/history scan (e.g. `gitleaks`) not run — noted as remaining.

## Assets
- **Fonts:** `Fredoka`, `Inter`, `JetBrains Mono` via `fonts.googleapis.com` (`pages/dev-tools.html:28` etc) — SIL Open Font License.
- **Icons/Placeholders:** `https://placehold.co/*` fallback for `logo.png` errors — CC0.
- **Mascots:** `assets/mascots/*` (Ember etc) — studio original, `board-data.json:84` 34 files.
- **Game art/audio:** Per-tool exports (PNG/WAV/JSON) are user-generated; sample assets in `tools/*` are placeholders or CC0. No proprietary font/audio shipped without license — to be fully inventoried per app in `APPS_RELEASE_EVIDENCE.md`.
- **Downloads:** `pages/downloads.html` PDFs — studio original.

## Remaining
- Run `gitleaks`/`trufflehog` history scan and record licenses per `tools/*` sample asset.
