# Game System Integration Guide

This guide shows how to integrate any existing game with the new JVDesignStudio Game System for progression, achievements, and leaderboards.

## Quick Integration (5 minutes)

### Step 1: Load the Game System
Add this before your closing `</head>` tag:

```html
<script src="../game-system.js"></script>
<link rel="stylesheet" href="../game-system.css">
```

### Step 2: Initialize the Game System
Add this JavaScript to initialize the system when your game loads:

```javascript
// Initialize the game system (customize game ID and name)
const gameSystem = new GameSystem('my-game-id', 'My Game Name', 'squirt');
const soundManager = new SoundManager(gameSystem);

// When the game starts
function onGameStart() {
  gameSystem.state.score = 0;
  gameSystem.resetState();
}

// When the game ends
function onGameEnd(finalScore) {
  gameSystem.addScore(finalScore);
  
  // Calculate XP (100 points = 1 XP)
  const xpGained = Math.floor(finalScore / 100);
  const result = gameSystem.addXP(xpGained);
  
  // Check for achievements
  const unlockedAchievements = gameSystem.checkAchievements();
  
  // Show level up or achievements
  if (result.levelUp) {
    GameUI.showModal(
      '🎉 Level Up!',
      `You reached <strong>Level ${result.level}</strong>!<br>Great work!`,
      [{ label: 'Continue', action: 'continue', type: 'primary' }]
    );
  }
  
  unlockedAchievements.forEach(achId => {
    const ach = gameSystem.achievements[achId];
    GameUI.showAchievementNotification(ach);
  });
  
  // Record gameplay
  gameSystem.recordGamePlay(gameDurationMs);
  gameSystem.saveState();
}

// Update HUD during gameplay (call this each frame or when score changes)
function updateHUD() {
  GameUI.updateHUD(gameSystem.getStats());
}
```

### Step 3: Add HUD to Your Game
Add this HTML to your game layout:

```html
<div class="game-hud">
  <div class="hud-group">
    <div class="hud-pill">
      <span class="hud-label">Score</span>
      <span class="hud-value" data-stat="score">0</span>
    </div>
    <div class="hud-pill">
      <span class="hud-label">Level</span>
      <span class="hud-value" data-stat="level">1</span>
    </div>
  </div>
</div>
```

## Full Integration with Achievements

### Create Custom Achievements
Override the `defineAchievements()` method:

```javascript
class MyGameSystem extends GameSystem {
  defineAchievements() {
    return {
      ...super.defineAchievements(),
      firstScore100: {
        id: 'firstScore100',
        name: '⭐ Century',
        description: 'Score 100 points',
        icon: '⭐',
        unlocked: false
      },
      perfectRound: {
        id: 'perfectRound',
        name: '💎 Perfect',
        description: 'Complete a perfect round',
        icon: '💎',
        unlocked: false
      }
    };
  }
}

// Use it
const gameSystem = new MyGameSystem('my-game-id', 'My Game', 'character');
```

### Check for Achievements Mid-Game

```javascript
function onScore(points) {
  gameSystem.state.score += points;
  
  // Check custom conditions
  if (gameSystem.state.score === 100) {
    gameSystem.unlockAchievement('firstScore100');
    const ach = gameSystem.achievements.firstScore100;
    GameUI.showAchievementNotification(ach);
  }
  
  if (isPerfectRound) {
    gameSystem.unlockAchievement('perfectRound');
    const ach = gameSystem.achievements.perfectRound;
    GameUI.showAchievementNotification(ach);
  }
}
```

## Audio Integration

### Play Sound Effects
```javascript
// Success sound (two notes)
soundManager.playSuccessSound();

// Error sound
soundManager.playErrorSound();

// Custom frequency sound
// playSound(frequency Hz, duration ms, waveform)
soundManager.playSound(600, 100, 'sine');
soundManager.playSound(800, 100, 'square');
```

## Leaderboard Integration

### Submit to Leaderboard
```javascript
function onGameEnd(finalScore) {
  const playerName = prompt('Enter your name for the leaderboard:') || 'Player';
  gameSystem.addToLeaderboard(playerName, finalScore);
  
  // Show top 10
  const leaderboard = gameSystem.getLeaderboard().slice(0, 10);
  console.log('Top Scores:', leaderboard);
}
```

### Display Leaderboard
```javascript
function showLeaderboard() {
  const lb = gameSystem.getLeaderboard();
  let html = '<div class="leaderboard">';
  
  lb.slice(0, 10).forEach((entry, i) => {
    html += `
      <div class="leaderboard-row">
        <div class="leaderboard-rank">#${i + 1}</div>
        <div class="leaderboard-name">${entry.name}</div>
        <div class="leaderboard-score">${entry.score}</div>
      </div>
    `;
  });
  
  html += '</div>';
  return html;
}
```

## CSS Classes Available

### HUD
- `.game-hud` — Top HUD bar
- `.hud-pill` — Individual stat pill
- `.hud-label` — Label text
- `.hud-value` — Value text

### Buttons
- `.btn` — Base button
- `.btn-primary` — Teal gradient button
- `.btn-secondary` — Transparent button
- `.btn-success` — Green button
- `.btn-danger` — Red button
- `.btn-icon` — Icon button (48px)

### Cards
- `.card` — Card container
- `.card-title` — Card title
- `.card-body` — Card content

### Modals
- `.modal-overlay` — Full screen overlay
- `.modal-overlay.open` — Show modal
- `.modal-content` — Modal box
- `.modal-title` — Modal title
- `.modal-body` — Modal content
- `.modal-footer` — Buttons row

### Badges
- `.badge` — Base badge
- `.badge-primary` — Teal badge
- `.badge-success` — Green badge
- `.badge-error` — Red badge
- `.badge-warning` — Yellow badge

### Achievements
- `.achievement` — Achievement item
- `.achievement.unlocked` — Unlocked state
- `.achievement-icon` — Achievement emoji/icon
- `.achievement-name` — Achievement name

### Progress
- `.progress-bar` — Progress bar container
- `.progress-fill` — Progress fill

## Game ID Reference

Use these IDs when creating GameSystem instances:

| Game | ID | Character |
|------|-----|-----------|
| Cozy Cafe Match | `cozy-cafe` | pip |
| Sky High Squirt | `sky-high-squirt` | squirt |
| Lumo Dash | `lumo-dash` | lumo |
| PiP Star Connect | `pip-star-connect` | pip |
| Echo Fruit Catch | `echo-fruit-catch` | echo |
| Biscuit Clicker | `biscuit-clicker` | pip |
| Tiger Smash | `tiger-smash` | tiger |
| Gem Match | `gem-match` | lumo |
| VoidRush | `voidrush` | squirt |
| Lumo Firefly | `lumo-firefly` | lumo |
| Stardust Collector | `stardust` | stardust |

## Tips & Best Practices

1. **Call `gameSystem.saveState()` frequently** — After score changes, achievements, etc.
2. **Use `checkAchievements()` at game end** — Let it auto-detect most achievements
3. **Test on mobile** — Use Chrome DevTools device emulation
4. **Handle offline** — All persistence uses localStorage, works completely offline
5. **Sound safety** — Always check `getSetting('soundEnabled')` before playing audio
6. **XP scaling** — 100 points = 1 XP works for most games; adjust ratio per game
7. **Character themes** — Pass the character name to GameSystem for themed UI colors

## Example: Complete Integration

See `/games/game-template.html` for a complete working example with:
- Full HUD setup
- Pause/Resume functionality
- Settings menu
- Game initialization
- Score tracking
- Achievement notifications

## Support

For help integrating, check:
- `game-system.js` — Full class documentation with comments
- `/games/game-template.html` — Working HTML template
- `/games/mobile-games.html` — Hub implementation with stats
