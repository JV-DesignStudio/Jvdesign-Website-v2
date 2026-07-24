# Build the JVDS Game Maker — our 5th studio app

You're working in F:\Website\Jvdesign-Website-v2 (Windows, PowerShell + Bash
available; git repo; static site deployed to jvdesignstudio.co.uk via GitHub
Pages). This is a live production site.

## Goal
Turn our existing browser-based game-building tool,
tools/arcade-game-maker.html, into a single installable "JVDS Game Maker"
app: a pocket game studio where a kid picks a genre, tunes it, plays it
instantly, and exports or shares what they made. This is the studio's 5th
app, and it is DIFFERENT from the JVDS Arcade (our 4th app), which bundles
our ~29 finished games. This one wraps the *maker tool*, not the games.

## Read these FIRST before proposing anything
- Memory index at C:\Users\Josh-\.claude\projects\F--Website-Jvdesign-Website-v2\memory\MEMORY.md,
  especially: jvds-arcade-app (the app we JUST shipped, mirror its Capacitor
  setup and sync approach), biscuit-tin-mobile-app, cozy-cafe-app,
  nav-consistency-system, site-test-script.
- The tool itself: tools/arcade-game-maker.html. It is ONE self-contained
  file, ~19,800 lines / 1.2 MB, built on Phaser (../phaser-arcade-physics.min.js,
  already local). 21 genres (Pong, Snake, Shooter, Platformer, Invaders,
  Dodge, Roguelike, Racing, Tower Defence, Breaker, Flappy, Asteroids,
  Pinball, Memory, Puzzle, Clicker, Rhythm, Beat, Hopper, Runner, Wave
  Survival). It saves to its own jv_* localStorage keys and loads
  player-profile.js + tool-xp.js for XP. Live-preview split pane, Tune tabs,
  blueprints, custom achievements, boss designer, cutscenes, and an
  HTML-export feature that inlines Phaser into a standalone file.
- The proven Capacitor toolchain (F:\Dev\jdk-21, Android SDK at
  F:\Dev\Android\Sdk, JDK-21 gotcha) and, crucially, the sibling app we just
  built: F:\Website\jvds-arcade-app (sync-arcade.mjs, render-assets.mjs,
  serve.mjs, release signing, store-assets). Mirror it.

## Recommended plan (confirm with me before building)
Phase 1, the app:
- Make the tool installable as a PWA first, then wrap it with Capacitor into
  a new sibling repo F:\Website\jvds-game-maker-app. App id
  uk.co.jvdesignstudio.gamemaker, name "JVDS Game Maker".
- The sync is SIMPLE compared to the Arcade: this is basically one HTML file
  plus Phaser, player-profile.js, tool-xp.js and style-shared.css. Copy
  tools/arcade-game-maker.html -> www/index.html, strip site chrome (nav,
  analytics, cookie-consent, site sw, manifest), rewrite ../ paths.
- Landscape-friendly: a maker tool wants width. Default orientation likely
  landscape or unrestricted, not portrait.
- Reuse the cozy-crew art spec for icon/splash, same cabinet-style mark
  direction as the Arcade if you like, or a "build your own" twist.

## Hard constraints / gotchas (mostly NEW vs the Arcade build)
- TRUE OFFLINE needs the web fonts bundled. The tool pulls Google Fonts
  (Fredoka, Inter, JetBrains Mono, Orbitron, Bangers, Press Start 2P, Nunito)
  and has jsdelivr/gstatic preconnects. In an app with no network these must
  be inlined or shipped as local font files, or the UI falls back to system
  fonts. Decide and handle it in the sync, do not leave dangling CDN links.
- SHARE/FORK calls external services: is.gd (link shortener, ~line 14920) and
  api.qrserver.com (QR codes, ~line 16497). Offline these will fail. Either
  gate them behind an online check with a graceful message, or swap for the
  app's native share sheet. Do not ship a share button that silently errors.
- The "describe-your-game AI builder" is LOCAL keyword matching, not a real
  AI/API call (verified). Same misnomer we just fixed on the Pong "AI".
  Consider renaming it to something honest (e.g. "Quick Start" or "Describe
  your game") so it doesn't read as generative AI. Confirm with me first.
- The HTML-export feature fetches ../phaser-arcade-physics.min.js to inline
  it. That path must resolve inside the bundle (it will if Phaser is copied
  to the www root). Verify export still produces a working standalone file
  in the app.
- Do NOT alter the shipped cozy apps' code, and do NOT fold this into the
  JVDS Arcade app. They are separate products.
- Hosting is case-sensitive (Linux). Match on-disk filename casing exactly.
- An external auto-rebase/build process rewrites main mid-session and touches
  many files. Stage ONLY files you intentionally changed (explicit paths,
  never git add -A) and verify they survive at HEAD with git show HEAD:<file>.
- Verify before committing: npm run validate (links + CSS) and node
  test-site.js (puppeteer sweep) must pass; drive the app in a real browser
  and show proof. The tool's Phaser preview hangs in-app-browser screenshots,
  so verify with puppeteer against the app's serve.mjs, same as we did for
  the Arcade.
- Commit only when I ask; end commit messages with:
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
- In chat, write plain sentences with no em dashes.

## First step
Read the files above, load into a real browser to see what the tool actually
does, then come back with a concrete Phase-1 plan and the handful of files
you'd create/change, before writing any code. Call out how you'll handle the
three network dependencies (fonts, is.gd, qrserver) for offline, since that
is the main thing that makes this different from the Arcade build.
