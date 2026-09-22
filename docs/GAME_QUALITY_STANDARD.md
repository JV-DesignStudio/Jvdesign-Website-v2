# JVDS Game Quality Standard v2

A website game earns Studio Pick treatment only when it satisfies this checklist.

## Player Standard

- First 10 seconds: the goal, controls and next action are visible before play starts.
- Readable loop: the player can understand play, fail or win, improve, and restart.
- Feedback: important actions visibly respond through motion, scoring, logs, state changes, or sound-ready hooks.
- Progress: the game saves score, best run, completion, unlocks, goals, or meaningful state.
- Browser-first: works without account, install, admin rights or powerful hardware; usable on mobile and desktop.
- Learning value: the game names the skill it demonstrates, such as systems, timing, route planning, deduction, sequencing or iteration.
- Build next: the game links to a JVDS tool or workshop that helps the learner make something related.
- Honest curation: if a game does not meet this standard, it stays in Play Labs or is hidden until improved.

## Studio Pick Minimum

A Studio Pick must show a quality panel near the top of the page with:

- Play goal
- Skill learned
- Build-next link
- Session expectation

It must also include at least one visible polish layer: coaching, mission/challenge goals, route diagnostics, evidence strength, wave intel, presets, medals, or comparable replay guidance. It must pass `npm run audit:games` and `npm run validate:links` before review.

## Current Benchmark Set

- Pixel Pet Arena: character design, stats, iteration, Pixel Studio bridge.
- Creature Rescue Clinic: triage, empathy, resource planning.
- Backpack Quest: route choice, inventory, risk and reward.
- Marble Run Lab: cause and effect, route testing, debugging.
- Echo's Casebook: evidence, dialogue, deduction.\r\n- Beat Builder Battle: sequencing, rhythm timing, pattern iteration.\r\n- Stardust Ruins: route planning, resource pressure, readable level design.\r\n- Garden Defense: lane strategy, economy, wave scouting and upgrades.

## Acceptance Gate

Run `npm run validate:game-quality` before promoting any game to Studio Pick. New games launch as Play Labs until they pass the gate and a human curation review.

The gate checks that every Studio Pick has the visible quality panel, learning labels, build-next link, save/progress hook, and a named polish signal such as a coach, mission, challenge, diagnostic or replay system.

## Browser Play Audit

Run `npm run audit:studio-picks` after meaningful game UI changes. The audit opens every Studio Pick on mobile and desktop, checks for runtime page errors, horizontal overflow, visible first-screen actions, quality panels and build-next links.

