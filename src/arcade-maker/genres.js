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
  'PAPERTOSS',
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
};

const GENRE_ICONS = {
  SHOOTER: '🚀', PLATFORMER: '🏃', DODGE: '⬇️', BREAKER: '🧱', RUNNER: '🦕',
  FLAPPY: '🐦', INVADERS: '👾', PONG: '🏓', SNAKE: '🐍', ASTEROIDS: '☄️',
  ROGUELIKE: '⚔️', RACING: '🏎️', HOPPER: '🐸', BEAT: '🥊', PUZZLE: '🧩',
  RHYTHM: '🎵', DEFENSE: '🗼', PINBALL: '🔮', CLICKER: '👆', MEMORY: '🃏',
  WAVESURVIVAL: '🌊', PAPERTOSS: '🏀',
};

const GENRE_LABELS = {
  SHOOTER: 'Space Shooter', PLATFORMER: '2D Platformer', DODGE: 'Dodge & Collect',
  BREAKER: 'Brick Breaker', RUNNER: 'Auto Runner', FLAPPY: 'Flappy Jump',
  INVADERS: 'Space Invaders', PONG: 'Pong', SNAKE: 'Snake', ASTEROIDS: 'Asteroids',
  ROGUELIKE: 'Roguelike Dungeon', RACING: 'Top-Down Racing', HOPPER: 'Endless Hopper',
  BEAT: '1v1 Fighter', PUZZLE: 'Puzzle', RHYTHM: 'Rhythm', DEFENSE: 'Tower Defense',
  PINBALL: 'Pinball', CLICKER: 'Idle Clicker', MEMORY: 'Card Memory',
  WAVESURVIVAL: 'Wave Survival',
};

export { GENRE_LIST, GENRE_DESCS, GENRE_ICONS, GENRE_LABELS };
