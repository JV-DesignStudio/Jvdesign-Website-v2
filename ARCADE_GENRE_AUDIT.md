# Arcade Game Maker genre audit (A1469)

Most of the maker's 23 genres run on the shared `makeBaseScene` in
`tools/arcade-game-maker.html`. Sharing the base is fine, but a learner should
know which genres genuinely play differently and which are a deliberate
variation of another. This audit records, per genre, the mechanic that makes it
distinct, and marks the overlapping ones as variations in the picker.

The data lives in one place: `GENRE_HOOKS` and `GENRE_VARIANT_OF` in
`src/arcade-maker/genres.js`. The picker shows the hook in the card tooltip and
a "variant of X" tag for the genres marked here. `tests/arcade-game-maker-distinctness.js`
guards it.

## Shared base or its own scene

- **Own scene** (fully separate gameplay): RACING, HOPPER, BEAT, PUZZLE, RHYTHM,
  DEFENSE, PINBALL, CUSTOM.
- **Shared base** (same top-down infrastructure, distinct rules on top):
  SHOOTER, PLATFORMER, DODGE, BREAKER, RUNNER, FLAPPY, INVADERS, PONG, SNAKE,
  ASTEROIDS, ROGUELIKE, CLICKER, MEMORY, WAVESURVIVAL, PAPERTOSS.

Sharing the base does not make a genre the same to play. What matters is the
rule that defines the loop, listed below.

## Per-genre distinct mechanic

| Genre | Verdict | Distinct mechanic |
|---|---|---|
| SHOOTER | Distinct | Free rotation and thrust with momentum and bullets |
| PLATFORMER | Distinct | Gravity, jumping and a scrolling platform world |
| DODGE | Variation of RUNNER | Dodge hazards, chain star combos and grab shield, slow-mo and x2 drops |
| BREAKER | Distinct | Angle a bouncing ball to clear a wall of bricks |
| RUNNER | Distinct | Three-lane auto-run: jump low barriers, slide under high ones, switch lanes for walls |
| FLAPPY | Distinct | One-tap flapping through narrowing gaps |
| INVADERS | Distinct | Hold the line as a descending formation advances |
| PONG | Distinct | Rally a ball with a paddle against the CPU |
| SNAKE | Distinct | Grow a grid snake without biting yourself |
| ASTEROIDS | Distinct | Thrust in open space, large rocks split when hit |
| ROGUELIKE | Distinct | Twin-stick rooms, clear a room to open the next |
| RACING | Distinct | Lap a track, hit boost pads, beat the CPU |
| HOPPER | Distinct | Bounce ever upward between platforms |
| BEAT | Distinct | 1v1 fighter with light, heavy, special and block |
| PUZZLE | Distinct | Push every crate onto a target |
| RHYTHM | Distinct | Hit lanes on the beat to build combos |
| DEFENSE | Distinct | Place towers to stop ten waves |
| PINBALL | Distinct | Flippers, bumpers and jackpot targets |
| CLICKER | Distinct | Tap for income, buy auto-clickers and hit milestone bonuses |
| MEMORY | Distinct | Flip cards against a timer with grid-size and card-set modes |
| WAVESURVIVAL | Variation of SHOOTER | Survive escalating waves, a boss every 5th wave and wave-clear bonuses |
| PAPERTOSS | Distinct | Flick shots through wind with a miss limit and bin-width difficulty |
| CUSTOM | Distinct | Blank arena with top-down, autorun or platformer loops and custom rules |

## Modes and twists (phase 2)

Each BETA or EXPERIMENT genre now has at least one mode or twist that changes
how it plays, not just its numbers.

| Genre | Signature mechanic | Mode or twist |
|---|---|---|
| DODGE | Combo scoring and temporary power drops | Shield, slow-mo and x2 score drops; wave patterns every 8 spawns |
| MEMORY | Match streaks and a live timer | 3x2 / 4x3 / 6x4 grids and animals, food, space or sports card sets |
| CLICKER | Auto-clicker economy | Milestone bonuses and configurable auto-clicker cost |
| WAVESURVIVAL | Boss cadence | Boss every 5th wave, scaling per wave, wave-clear bonus and survive-to-win waves |
| PAPERTOSS | Wind physics under pressure | Miss limit and bin width set the difficulty; wind changes each shot |
| CUSTOM | Sandbox loops | Top-down, autorun or platformer core loop, chasers, stars, variables and rules |

## Verdicts

- **Distinct (21):** the mechanic above is the reason to pick this genre and it
  does not overlap another well enough to confuse a learner.
- **Variation (2):** WAVESURVIVAL is the wave-based take on SHOOTER, and DODGE
  is the avoidance loop without the auto-run of RUNNER. Both are labelled in the
  picker, and both now carry their own signature twist (boss cadence and power
  drops) so the variation label is about the shared base, not a missing idea.

## What to do next

The variations are labelled, not hidden, which is honest. If either later earns
a mechanic of its own (for example, WAVESURVIVAL gains tower placement), update
`GENRE_VARIANT_OF` and this table together.
