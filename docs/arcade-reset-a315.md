# A315 Arcade Reset Design Standard

Date: 15 September 2026

## Problem

The new Arcade games were upgraded too quickly and still feel like the same game wearing different costumes. They share too much structure: hero, HUD, card panels, generic goals, buttons, score save. This reset replaces the shared-template feel with distinct mechanics.

## New Rule

A game is not ready if its main verb could be swapped with another new game and still make sense. Each game needs a different hand-feel, different decision shape, and different win condition.

## Target Rebuilds

| Game | Real Core | Primary Interaction | What Makes It Different |
|---|---|---|---|
| Backpack Quest | Inventory roguelite | Arrange shaped items in a limited backpack grid before room fights | Item position and adjacency create combat effects |
| Marble Run Lab | Physics builder | Place track pieces on a canvas and launch a moving marble | The marble path is simulated visually, not scored from cards |
| Echo's Casebook | Mystery deduction | Collect evidence, cross-link clues, accuse suspects | Correct deduction depends on clue logic, not points |
| Creature Rescue Clinic | Cozy triage management | Read symptoms, diagnose, queue patients, spend supplies | Time/calm pressure and patient-specific treatments |
| Beat Builder Battle | Rhythm timing | Build a beat, then tap the rhythm against a moving playhead | Timing accuracy matters, not just pattern matching |
| Stardust Ruins | Tile movement puzzle | Move through a room grid, rotate corridors, collect keys | Spatial navigation and locked doors drive progress |
| Pixel Pet Arena | Drawing-to-battle | Draw a pet on a pixel canvas, stats come from its shape/colours | The drawing meaningfully changes battle stats |

## Ship Bar

Each rebuilt game must have:

- A unique control model.
- A unique failure condition.
- A meaningful 5 minute loop.
- Restart and continue.
- Arcade profile score save and new-best hook.
- Mobile and desktop smoke evidence.
- A before/after note explaining how sameness was removed.

## Implementation Order

1. Backpack Quest
2. Marble Run Lab
3. Echo's Casebook
4. Creature Rescue Clinic
5. Beat Builder Battle
6. Stardust Ruins
7. Pixel Pet Arena
