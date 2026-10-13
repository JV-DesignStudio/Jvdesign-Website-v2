# Arcade Game Maker genre audit (A1469)

Most of the maker's 22 genres run on the shared `makeBaseScene` in
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
  DEFENSE, PINBALL.
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
| DODGE | Variation of RUNNER | Weave through falling hazards and collect stars |
| BREAKER | Distinct | Angle a bouncing ball to clear a wall of bricks |
| RUNNER | Distinct | Auto-run and jump a single gap-timed lane |
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
| CLICKER | Distinct | Tap, buy upgrades and snowball your income |
| MEMORY | Distinct | Flip cards and match pairs against a timer |
| WAVESURVIVAL | Variation of SHOOTER | Survive escalating waves and boss rounds |
| PAPERTOSS | Distinct | Flick shots with wind and physics |

## Verdicts

- **Distinct (20):** the mechanic above is the reason to pick this genre and it
  does not overlap another well enough to confuse a learner.
- **Variation (2):** WAVESURVIVAL is the wave-based take on SHOOTER, and DODGE
  is the avoidance loop without the auto-run of RUNNER. Both are labelled in the
  picker so nobody expects a brand-new mechanic.

## What to do next

The variations are labelled, not hidden, which is honest. If either later earns
a mechanic of its own (for example, WAVESURVIVAL gains tower placement), update
`GENRE_VARIANT_OF` and this table together.
