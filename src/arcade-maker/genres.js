// genres.js , canonical source of truth for the genre display data (A763).
// The picker grid, the title screen and the leaderboard all read these maps.
// tools/arcade-game-maker.html imports this module and publishes it on window;
// it no longer defines the descs/icons/labels inline.
// Import: import { GENRE_LIST, GENRE_DESCS, GENRE_ICONS, GENRE_LABELS } from "./genres.js";

// The 22 genres in picker order. This is the single roster; the HTML #genreMode
// select, the picker grid and every GENRES.forEach site should agree with it.
const GENRE_LIST = [
  'SHOOTER', 'PLATFORMER', 'DODGE', 'BREAKER', 'RUNNER', 'FLAPPY', 'INVADERS',
  'PONG', 'SNAKE', 'ASTEROIDS', 'ROGUELIKE', 'RACING', 'HOPPER', 'BEAT',
  'PUZZLE', 'RHYTHM', 'DEFENSE', 'PINBALL', 'CLICKER', 'MEMORY', 'WAVESURVIVAL',
  'PAPERTOSS', 'CUSTOM',
];

const GENRE_DESCS = {
  SHOOTER:      'Rotate, thrust & blast enemies across space.',
  PLATFORMER:   'Jump across platforms, dodge hazards, reach the end.',
  DODGE:        'Sidestep falling objects survive as long as you can.',
  BREAKER:      'Bounce the ball, smash every block, clear the board.',
  RUNNER:       'Sprint endlessly duck, jump, and dodge obstacles.',
  FLAPPY:       'Tap to flap weave through a gauntlet of narrow gaps.',
  INVADERS:     'Hold the line against endless waves of alien invaders.',
  PONG:         'Out-reflect a relentless CPU paddle to win.',
  SNAKE:        "Grow longer, eat pellets, don't bite yourself.",
  ASTEROIDS:    'Spin, thrust and detonate every rock in the field.',
  ROGUELIKE:    'Explore dungeons, fight monsters, collect loot.',
  RACING:       'Burn rubber, drift, use nitro, and cross the line first.',
  HOPPER:       'Leap between platforms, go as high as you can.',
  BEAT:         '1v1 Street Fighter, face the CPU or challenge a friend on the same keyboard. Best-of-3 rounds wins the match.',
  PUZZLE:       'Slide and match tiles to clear the board.',
  RHYTHM:       'Hit notes on beat, keep the multiplier alive.',
  DEFENSE:      'Place towers, hold the path, stop every wave.',
  PINBALL:      'Keep the ball alive, rack up combos and jackpots.',
  CLICKER:      'Click the target to score, buy upgrades and rack up millions!',
  MEMORY:       'Flip cards and find matching pairs before time runs out.',
  WAVESURVIVAL: 'Survive endless waves of enemies, how long can you last?',
  PAPERTOSS:    'Toss paper balls into the bin, watch the wind, score big!',
  CUSTOM:       'A blank arena. Collect stars, dodge chasers, invent the rest.',
};

const GENRE_ICONS = {
  SHOOTER: '🚀', PLATFORMER: '🏃', DODGE: '⬇️', BREAKER: '🧱', RUNNER: '🦕',
  FLAPPY: '🐦', INVADERS: '👾', PONG: '🏓', SNAKE: '🐍', ASTEROIDS: '☄️',
  ROGUELIKE: '⚔️', RACING: '🏎️', HOPPER: '🐸', BEAT: '🥊', PUZZLE: '🧩',
  RHYTHM: '🎵', DEFENSE: '🗼', PINBALL: '🔮', CLICKER: '👆', MEMORY: '🃏',
  WAVESURVIVAL: '🌊', PAPERTOSS: '🏀', CUSTOM: '🧪',
};

const GENRE_LABELS = {
  SHOOTER: 'Space Shooter', PLATFORMER: '2D Platformer', DODGE: 'Dodge & Collect',
  BREAKER: 'Brick Breaker', RUNNER: 'Auto Runner', FLAPPY: 'Flappy Jump',
  INVADERS: 'Space Invaders', PONG: 'Pong', SNAKE: 'Snake', ASTEROIDS: 'Asteroids',
  ROGUELIKE: 'Roguelike Dungeon', RACING: 'Top-Down Racing', HOPPER: 'Endless Hopper',
  BEAT: '1v1 Fighter', PUZZLE: 'Puzzle', RHYTHM: 'Rhythm', DEFENSE: 'Tower Defense',
  PINBALL: 'Pinball', CLICKER: 'Idle Clicker', MEMORY: 'Card Memory',
  WAVESURVIVAL: 'Wave Survival', PAPERTOSS: 'Paper Toss',
  CUSTOM: 'Custom Sandbox',
};

// Six finished genres that span different play styles. The maker shows these
// first so a newcomer meets a small, confident choice instead of all 22 at once.
const GENRE_RECOMMENDED = ['SHOOTER', 'PLATFORMER', 'RUNNER', 'BREAKER', 'SNAKE', 'RACING'];

// Quality guidance for the maker picker (A1473). READY = finished and a good
// first pick, BETA = playable but still being improved, EXPERIMENT = an early
// idea. Kept in this one module so the picker, the starter grid and the tests
// all read the same source. This is maker guidance, separate from the public
// arcade GAME_QUALITY map in games-registry.js.
const GENRE_QUALITY = {
  SHOOTER:'READY', PLATFORMER:'READY', RUNNER:'READY', FLAPPY:'READY',
  INVADERS:'READY', PONG:'READY', SNAKE:'READY', ASTEROIDS:'READY',
  ROGUELIKE:'READY', BREAKER:'READY', RACING:'READY', HOPPER:'READY',
  BEAT:'READY', PUZZLE:'READY', RHYTHM:'READY', DEFENSE:'READY',
  PINBALL:'READY', WAVESURVIVAL:'BETA', DODGE:'BETA', MEMORY:'BETA',
  CLICKER:'BETA', PAPERTOSS:'EXPERIMENT', CUSTOM:'BETA',
};
const GENRE_QUALITY_LABELS = {
  READY:      'Finished, a good first pick',
  BETA:       'Playable, still being improved',
  EXPERIMENT: 'Early idea, try it out',
};

// Distinct core mechanic per genre (A1469). Most genres run on the shared
// makeBaseScene, so this records what actually makes each one different, and
// GENRE_VARIANT_OF marks the few that are a deliberate variation of another.
// See ARCADE_GENRE_AUDIT.md for the full written audit.
const GENRE_HOOKS = {
  SHOOTER:      'Free rotation and thrust with momentum and bullets',
  PLATFORMER:   'Gravity, jumping and a scrolling platform world',
  DODGE:        'Weave through falling hazards and collect stars',
  BREAKER:      'Angle a bouncing ball to clear a wall of bricks',
  RUNNER:       'Auto-run and jump a single gap-timed lane',
  FLAPPY:       'One-tap flapping through narrowing gaps',
  INVADERS:     'Hold the line as a descending formation advances',
  PONG:         'Rally a ball with a paddle against the CPU',
  SNAKE:        'Grow a grid snake without biting yourself',
  ASTEROIDS:    'Thrust in open space, large rocks split when hit',
  ROGUELIKE:    'Twin-stick rooms, clear a room to open the next',
  RACING:       'Lap a track, hit boost pads, beat the CPU',
  HOPPER:       'Bounce ever upward between platforms',
  BEAT:         '1v1 fighter with light, heavy, special and block',
  PUZZLE:       'Push every crate onto a target',
  RHYTHM:       'Hit lanes on the beat to build combos',
  DEFENSE:      'Place towers to stop ten waves',
  PINBALL:      'Flippers, bumpers and jackpot targets',
  CLICKER:      'Tap, buy upgrades and snowball your income',
  MEMORY:       'Flip cards and match pairs against a timer',
  WAVESURVIVAL: 'Survive escalating waves and boss rounds',
  PAPERTOSS:    'Flick shots with wind and physics',
  CUSTOM:       'Blank arena with your own star target and chasing enemies',
};
const GENRE_VARIANT_OF = {
  WAVESURVIVAL: 'SHOOTER',  // wave-based take on the top-down shooter
  DODGE:        'RUNNER',   // avoidance loop without the auto-run
};

export { GENRE_LIST, GENRE_DESCS, GENRE_ICONS, GENRE_LABELS, GENRE_QUALITY, GENRE_QUALITY_LABELS, GENRE_HOOKS, GENRE_VARIANT_OF, GENRE_RECOMMENDED };
