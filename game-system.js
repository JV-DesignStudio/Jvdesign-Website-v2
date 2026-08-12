/* ═══════════════════════════════════════════════════════════
   JVDS Game System, Progression, Achievements, Leaderboard
   ═══════════════════════════════════════════════════════════ */

class GameSystem {
  constructor(gameId, gameName, gameCharacter = 'squirt') {
    this.gameId = gameId;
    this.gameName = gameName;
    this.gameCharacter = gameCharacter;
    this.storageKey = `jvds_game_${gameId}`;
    this.leaderboardKey = `jvds_lb_${gameId}`;

    // Fallback run timer: most games pass Date.now() (a timestamp, not a
    // duration) to recordGamePlay, so the engine times runs itself.
    this._runStart = Date.now();

    // Lets AudioEffects (audio-effects.js) find the active game's sound
    // settings without every game having to pass its instance around.
    GameSystem.lastInstance = this;

    this.state = this.loadState() || {
      score: 0,
      highScore: 0,
      gamesPlayed: 0,
      totalTime: 0,
      level: 1,
      xp: 0,
      coins: 0,
      achievements: [],
      lastPlayed: null,
      dailyPlayStreak: 0,
      settings: {
        soundEnabled: true,
        musicEnabled: true,
        sfxVolume: 0.8,
        musicVolume: 0.5,
      }
    };

    // Persisted so cross-game achievements (collector) can count distinct
    // characters by scanning jvds_game_* keys.
    this.state.gameCharacter = gameCharacter;

    this.achievements = this.defineAchievements();
  }

  /* ─── STATE MANAGEMENT ─── */
  loadState() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      const state = stored ? JSON.parse(stored) : null;
      // Repair totalTime corrupted by older pages that recorded timestamps
      // as durations (anything over ~1 year of play is not real).
      if (state && !(state.totalTime >= 0 && state.totalTime < 3.15e10)) {
        state.totalTime = 0;
      }
      return state;
    } catch (e) {
      console.error('Failed to load game state:', e);
      return null;
    }
  }

  saveState() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    } catch (e) {
      console.error('Failed to save game state:', e);
    }
  }

  resetState() {
    this.state = {
      score: 0,
      totalScore: this.state.totalScore || 0,
      gameCharacter: this.state.gameCharacter,
      highScore: this.state.highScore,
      gamesPlayed: this.state.gamesPlayed,
      totalTime: this.state.totalTime,
      level: 1,
      xp: 0,
      coins: 0,
      achievements: this.state.achievements,
      lastPlayed: new Date().toISOString(),
      dailyPlayStreak: this.state.dailyPlayStreak,
      settings: this.state.settings
    };
    this.saveState();
  }

  /* ─── SCORE & PROGRESSION ─── */
  addScore(points) {
    this.state.score += points;
    this.state.totalScore = (this.state.totalScore || 0) + points;
    if (this.state.score > this.state.highScore) {
      this.state.highScore = this.state.score;
      this.checkHighScoreAchievement();
    }
    this.saveState();
    return this.state.score;
  }

  // Unlocks a "new personal best" achievement when the game defines one.
  // Safe no-op otherwise. (Previously called but never defined, which threw
  // mid-game-over in every game that uses addScore.)
  checkHighScoreAchievement() {
    const ids = ['highScore', 'newBest', 'personalBest'];
    for (const id of ids) {
      if (this.achievements && this.achievements[id]) { this.unlockAchievement(id); break; }
    }
  }

  addXP(amount) {
    this.state.xp += amount;
    const xpPerLevel = 1000;
    const newLevel = Math.floor(this.state.xp / xpPerLevel) + 1;

    if (newLevel > this.state.level) {
      this.state.level = newLevel;
      this.saveState();
      return { levelUp: true, level: newLevel };
    }

    this.saveState();
    return { levelUp: false, xp: this.state.xp };
  }

  addCoins(amount) {
    this.state.coins += amount;
    this.saveState();
    return this.state.coins;
  }

  /* ─── SCORE TRACKING ───
     Replaces the two setInterval pollers every game used to copy-paste:
     one converting window.__gsScore deltas into XP, one checking
     window.__gsBestRun against score-tier achievements. This watches both
     globals reactively (property setters), so XP and achievements land the
     instant the game writes a score instead of up to 5s later, and no idle
     timers run. Behavior matches the old pollers exactly (same divisor math,
     same "advance to current on any XP gain" remainder handling).

       gameSystem.trackScore({
         xpDivisor: 10,                       // score points per 1 XP
         tiers: [ [1, 'firstJump'], [100, 'score100'], [500, 'score500'] ]
       });
  */
  trackScore(opts) {
    opts = opts || {};
    const divisor = opts.xpDivisor > 0 ? opts.xpDivisor : 1;
    const tiers = opts.tiers || [];
    const self = this;
    let lastScore = 0;
    let scoreVal = (typeof window !== 'undefined' && window.__gsScore) || 0;
    let bestVal = (typeof window !== 'undefined' && window.__gsBestRun) || 0;

    const onScore = v => {
      const cur = Math.floor(v || 0);
      if (cur > lastScore) {
        const xp = Math.floor((cur - lastScore) / divisor);
        if (xp > 0) { self.addXP(xp); lastScore = cur; }
      }
    };
    const onBest = v => {
      const score = Math.floor(v || 0);
      tiers.forEach(t => { if (score >= t[0]) self.unlockAchievement(t[1]); });
      self.checkAchievements();
    };

    if (typeof window === 'undefined') return;
    try {
      Object.defineProperty(window, '__gsScore', {
        configurable: true,
        get() { return scoreVal; },
        set(v) { scoreVal = v; onScore(v); }
      });
      Object.defineProperty(window, '__gsBestRun', {
        configurable: true,
        get() { return bestVal; },
        set(v) { bestVal = v; onBest(v); }
      });
    } catch (e) {
      // Fallback to polling if the globals can't be redefined.
      setInterval(() => { onScore(window.__gsScore); }, 500);
      setInterval(() => { onBest(window.__gsBestRun); }, 5000);
      return;
    }
    // Honor any score already written before tracking started.
    if (scoreVal) onScore(scoreVal);
    if (bestVal) onBest(bestVal);
  }

  getXPProgress() {
    const xpPerLevel = 1000;
    const currentXP = this.state.xp % xpPerLevel;
    return {
      current: currentXP,
      max: xpPerLevel,
      percentage: (currentXP / xpPerLevel) * 100
    };
  }

  recordGamePlay(duration) {
    // Most games call this from their real game-over AND unconditionally
    // again from a beforeunload handler as a mobile-safety-net (beforeunload
    // is unreliable on mobile). Without a guard, a normal finish-then-close
    // session double-counts gamesPlayed/totalTime and fires this method's
    // XP/analytics side effects twice. A call arriving moments after a prior
    // one is that same safety-net firing on the same run, not a new run, so
    // it's ignored rather than recorded again.
    const now = Date.now();
    if (this._lastRecordAt && (now - this._lastRecordAt) < 4000) {
      return false;
    }
    this._lastRecordAt = now;

    // Most games pass Date.now() here (a timestamp, not a duration), so
    // anything implausible falls back to the engine's own run timer.
    const MAX_RUN = 6 * 60 * 60 * 1000;
    let ms = duration;
    if (!(typeof ms === 'number' && ms > 0 && ms < MAX_RUN)) {
      ms = Math.min(Math.max(now - this._runStart, 0), MAX_RUN);
    }
    this._runStart = now;

    this.state.gamesPlayed += 1;
    this.state.totalTime += ms;
    this.updatePlayStreak();
    this.state.lastPlayed = new Date().toISOString();
    this.saveState();
    return true;
  }

  // Must run before lastPlayed is overwritten with "now".
  updatePlayStreak() {
    const prev = this.state.lastPlayed ? new Date(this.state.lastPlayed) : null;
    if (!prev || isNaN(prev.getTime())) {
      this.state.dailyPlayStreak = Math.max(this.state.dailyPlayStreak, 1);
      return;
    }

    // Compare calendar days, not elapsed hours, so a run just after
    // midnight still counts as the next day.
    const dayStart = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const daysDiff = Math.round((dayStart(new Date()) - dayStart(prev)) / 86400000);

    if (daysDiff === 0) {
      this.state.dailyPlayStreak = Math.max(this.state.dailyPlayStreak, 1);
    } else if (daysDiff === 1) {
      this.state.dailyPlayStreak += 1;
    } else {
      this.state.dailyPlayStreak = 1;
    }
  }

  /* ─── ACHIEVEMENTS ─── */
  defineAchievements() {
    return {
      firstPlay: {
        id: 'firstPlay',
        name: '🎮 Getting Started',
        description: 'Play your first game',
        icon: '🎮',
        unlocked: false
      },
      tenGames: {
        id: 'tenGames',
        name: '🌟 Dedicated Player',
        description: 'Play 10 games',
        icon: '🌟',
        unlocked: false
      },
      fiftyGames: {
        id: 'fiftyGames',
        name: '👑 Pro Player',
        description: 'Play 50 games',
        icon: '👑',
        unlocked: false
      },
      streak7: {
        id: 'streak7',
        name: '🔥 On Fire',
        description: 'Maintain a 7-day play streak',
        icon: '🔥',
        unlocked: false
      },
      streak30: {
        id: 'streak30',
        name: '⭐ Legendary',
        description: 'Maintain a 30-day play streak',
        icon: '⭐',
        unlocked: false
      },
      level10: {
        id: 'level10',
        name: '📈 Rising Star',
        description: 'Reach level 10',
        icon: '📈',
        unlocked: false
      },
      // Global cross-game achievements
      collector: {
        id: 'collector',
        name: '🎁 Collector',
        description: 'Unlock 5 different characters',
        icon: '🎁',
        unlocked: false
      },
      masterGamer: {
        id: 'masterGamer',
        name: '🏆 Master Gamer',
        description: 'Reach level 10 in 3 different games',
        icon: '🏆',
        unlocked: false
      },
      speedRunner: {
        id: 'speedRunner',
        name: '⚡ Speed Runner',
        description: 'Play 100 games',
        icon: '⚡',
        unlocked: false
      },
      completionist: {
        id: 'completionist',
        name: '✅ Completionist',
        description: 'Earn all single-game achievements',
        icon: '✅',
        unlocked: false
      },
      billionaire: {
        id: 'billionaire',
        name: '💰 Billionaire',
        description: 'Earn 1 billion total points',
        icon: '💰',
        unlocked: false
      }
    };
  }

  unlockAchievement(achievementId) {
    if (!this.state.achievements.includes(achievementId)) {
      this.state.achievements.push(achievementId);
      this.saveState();
      return true;
    }
    return false;
  }

  checkAchievements() {
    const toUnlock = [];

    if (this.state.gamesPlayed === 1 && !this.state.achievements.includes('firstPlay')) {
      toUnlock.push('firstPlay');
    }

    if (this.state.gamesPlayed >= 10 && !this.state.achievements.includes('tenGames')) {
      toUnlock.push('tenGames');
    }

    if (this.state.gamesPlayed >= 50 && !this.state.achievements.includes('fiftyGames')) {
      toUnlock.push('fiftyGames');
    }

    if (this.state.dailyPlayStreak >= 7 && !this.state.achievements.includes('streak7')) {
      toUnlock.push('streak7');
    }

    if (this.state.dailyPlayStreak >= 30 && !this.state.achievements.includes('streak30')) {
      toUnlock.push('streak30');
    }

    if (this.state.level >= 10 && !this.state.achievements.includes('level10')) {
      toUnlock.push('level10');
    }

    // Global cross-game achievements
    if (this.state.gamesPlayed >= 100 && !this.state.achievements.includes('speedRunner')) {
      toUnlock.push('speedRunner');
    }

    if ((this.state.totalScore || 0) >= 1000000000 && !this.state.achievements.includes('billionaire')) {
      toUnlock.push('billionaire');
    }

    if (!this.state.achievements.includes('collector') || !this.state.achievements.includes('masterGamer')) {
      const allStates = this.getAllGameStates();
      const characters = {};
      let level10Games = 0;
      allStates.forEach(s => {
        if (s.gamesPlayed > 0 && s.gameCharacter) characters[s.gameCharacter] = true;
        if (s.level >= 10) level10Games++;
      });

      if (Object.keys(characters).length >= 5 && !this.state.achievements.includes('collector')) {
        toUnlock.push('collector');
      }
      if (level10Games >= 3 && !this.state.achievements.includes('masterGamer')) {
        toUnlock.push('masterGamer');
      }
    }

    const perGameIds = ['firstPlay', 'tenGames', 'fiftyGames', 'streak7', 'streak30', 'level10'];
    if (!this.state.achievements.includes('completionist') &&
        perGameIds.every(id => this.state.achievements.includes(id) || toUnlock.includes(id))) {
      toUnlock.push('completionist');
    }

    toUnlock.forEach(id => this.unlockAchievement(id));
    return toUnlock;
  }

  // Every game's saved state (this one included), for cross-game achievements.
  getAllGameStates() {
    const states = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.indexOf('jvds_game_') === 0) {
          try {
            const s = JSON.parse(localStorage.getItem(key));
            if (s) states.push(key === this.storageKey ? this.state : s);
          } catch (e) { /* skip unparseable entries */ }
        }
      }
    } catch (e) { /* storage blocked */ }
    return states;
  }

  getAchievements() {
    return Object.values(this.achievements).map(ach => ({
      ...ach,
      unlocked: this.state.achievements.includes(ach.id)
    }));
  }

  /* ─── LEADERBOARD ─── */
  addToLeaderboard(playerName, score) {
    try {
      let leaderboard = this.getLeaderboard();

      leaderboard.push({
        name: playerName || 'Player',
        score: score,
        timestamp: new Date().toISOString(),
        gameCharacter: this.gameCharacter
      });

      leaderboard.sort((a, b) => b.score - a.score);
      leaderboard = leaderboard.slice(0, 50);

      localStorage.setItem(this.leaderboardKey, JSON.stringify(leaderboard));
      return leaderboard;
    } catch (e) {
      console.error('Failed to update leaderboard:', e);
      return [];
    }
  }

  getLeaderboard() {
    try {
      const stored = localStorage.getItem(this.leaderboardKey);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to load leaderboard:', e);
      return [];
    }
  }

  /* ─── SETTINGS ─── */
  updateSetting(key, value) {
    this.state.settings[key] = value;
    this.saveState();
  }

  getSetting(key) {
    return this.state.settings[key];
  }

  /* ─── UTILITY ─── */
  getStats() {
    return {
      score: this.state.score,
      highScore: this.state.highScore,
      level: this.state.level,
      xp: this.state.xp,
      coins: this.state.coins,
      gamesPlayed: this.state.gamesPlayed,
      achievements: this.state.achievements.length,
      dailyPlayStreak: this.state.dailyPlayStreak,
      totalTime: this.formatTime(this.state.totalTime)
    };
  }

  formatTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  clearAllData() {
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.leaderboardKey);
    this.state = this.loadState() || {
      score: 0,
      highScore: 0,
      gamesPlayed: 0,
      totalTime: 0,
      level: 1,
      xp: 0,
      coins: 0,
      achievements: [],
      lastPlayed: null,
      dailyPlayStreak: 0,
      settings: {
        soundEnabled: true,
        musicEnabled: true,
        sfxVolume: 0.8,
        musicVolume: 0.5,
      }
    };
  }

  /* ─── GLOBAL LEADERBOARD ─── */
  syncToGlobalLeaderboard() {
    if (typeof playerProfile === 'undefined') return;

    try {
      let leaderboard = [];
      const stored = localStorage.getItem('jvds_global_leaderboard');
      if (stored) {
        leaderboard = JSON.parse(stored);
      }

      const playerId = playerProfile.state.playerId;
      const stats = playerProfile.getStats();

      const existingIdx = leaderboard.findIndex(e => e.playerId === playerId);
      const entry = {
        playerId: playerId,
        name: 'Player ' + playerId.substring(0, 8),
        totalXP: stats.totalXP,
        level: stats.level,
        achievements: stats.achievementsUnlocked,
        dailyStreak: stats.dailyStreak,
        workshopsCompleted: stats.workshopsCompleted,
        lastUpdated: new Date().toISOString()
      };

      if (existingIdx !== -1) {
        leaderboard[existingIdx] = entry;
      } else {
        leaderboard.push(entry);
      }

      leaderboard.sort((a, b) => b.totalXP - a.totalXP);
      leaderboard = leaderboard.slice(0, 100);

      localStorage.setItem('jvds_global_leaderboard', JSON.stringify(leaderboard));
    } catch (e) {
      console.warn('Failed to sync to global leaderboard:', e);
    }
  }
}

/* ═══════════════════════════════════════════════════════════
   UI COMPONENTS, Modal, Achievement Notifications, etc
   ═══════════════════════════════════════════════════════════ */

class GameUI {
  static showAchievementNotification(achievement) {
    const notification = document.createElement('div');
    notification.className = 'achievement-notification';
    notification.innerHTML = `
      <div class="achievement-notification-content">
        <div class="achievement-notification-icon">${achievement.icon}</div>
        <div class="achievement-notification-text">
          <div class="achievement-notification-title">Achievement Unlocked!</div>
          <div class="achievement-notification-name">${achievement.name}</div>
        </div>
      </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('show');
    }, 10);

    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  static showScorePopup(score, x, y) {
    const popup = document.createElement('div');
    popup.className = 'score-popup';
    popup.textContent = `+${score}`;
    popup.style.left = x + 'px';
    popup.style.top = y + 'px';

    document.body.appendChild(popup);

    setTimeout(() => popup.remove(), 1000);
  }

  static updateHUD(stats) {
    const scoreEl = document.querySelector('[data-stat="score"]');
    if (scoreEl) scoreEl.textContent = stats.score;

    const coinsEl = document.querySelector('[data-stat="coins"]');
    if (coinsEl) coinsEl.textContent = stats.coins;

    const levelEl = document.querySelector('[data-stat="level"]');
    if (levelEl) levelEl.textContent = stats.level;
  }

  static showModal(title, content, buttons = []) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';

    let buttonsHTML = '';
    buttons.forEach(btn => {
      buttonsHTML += `<button class="btn btn-${btn.type || 'primary'}" data-action="${btn.action}">${btn.label}</button>`;
    });

    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <div class="modal-title">${title}</div>
        </div>
        <div class="modal-body">${content}</div>
        <div class="modal-footer">${buttonsHTML}</div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        modal.remove();
        if (window.onModalAction) {
          window.onModalAction(action);
        }
      });
    });

    return modal;
  }
}

/* ═══════════════════════════════════════════════════════════
   SOUND MANAGER, Audio effects and music
   ═══════════════════════════════════════════════════════════ */

class SoundManager {
  constructor(gameSystem) {
    this.gameSystem = gameSystem;
    this.audioContext = null;
  }

  playSound(frequency = 400, duration = 100, type = 'sine') {
    if (!this.gameSystem.getSetting('soundEnabled')) return;

    let sfxVolume = this.gameSystem.getSetting('sfxVolume');
    if (typeof sfxVolume !== 'number') sfxVolume = 0.8;
    if (sfxVolume <= 0) return;

    try {
      const audioContext = this.audioContext || new (window.AudioContext || window.webkitAudioContext)();
      this.audioContext = audioContext;

      // Browsers create contexts suspended until a user gesture; play calls
      // usually come from input handlers, so resuming here unblocks audio.
      if (audioContext.state === 'suspended') audioContext.resume();

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = type;

      gainNode.gain.setValueAtTime(0.3 * sfxVolume, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration / 1000);
    } catch (e) {
      console.warn('Audio playback not available:', e);
    }
  }

  playSuccessSound() {
    this.playSound(800, 100);
    setTimeout(() => this.playSound(1000, 100), 100);
  }

  playErrorSound() {
    this.playSound(300, 100);
    setTimeout(() => this.playSound(200, 100), 100);
  }

  playPointSound() {
    this.playSound(600, 50);
  }
}

/* ═══════════════════════════════════════════════════════════
   CSS STYLES FOR UI COMPONENTS
   ═══════════════════════════════════════════════════════════ */

const GAME_UI_STYLES = `
.achievement-notification {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, rgba(52, 211, 153, 0.2), rgba(129, 140, 248, 0.2));
  border: 1px solid rgba(52, 211, 153, 0.4);
  border-radius: 12px;
  padding: 16px 20px;
  backdrop-filter: blur(8px);
  z-index: 300;
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
  display: flex;
  gap: 12px;
  align-items: center;
}

.achievement-notification.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.achievement-notification-icon {
  font-size: 2rem;
}

.achievement-notification-text {
  color: #fff;
}

.achievement-notification-title {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.7;
}

.achievement-notification-name {
  font-size: 1rem;
  font-weight: 700;
}

.score-popup {
  position: fixed;
  font-size: 1.5rem;
  font-weight: 800;
  color: #34D399;
  text-shadow: 0 0 10px rgba(52, 211, 153, 0.5);
  pointer-events: none;
  z-index: 200;
  animation: scorePopupFloat 1s ease-out forwards;
  font-family: 'Fredoka', cursive;
}

@keyframes scorePopupFloat {
  0% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(-40px);
  }
}
`;

// Inject styles on page load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = GAME_UI_STYLES;
    document.head.appendChild(style);
  });
}

/* ═══════════════════════════════════════════════════════════
   GLOBAL PROFILE BRIDGE, feeds gameplay into the unified
   player profile (player-profile.js) so every game counts
   toward global XP, quests, and the global leaderboard.

   Awards (per game, capped per day so they can't be farmed):
   - session   +10 XP  once/day, spent 30s+ in a game
   - run       +15 XP  5×/day, finished a run (recordGamePlay)
   - milestone +10 XP  5×/day, every 100 in-game XP earned
   - achievement +20 XP each, unlocked a per-game achievement

   player-profile.js is loaded automatically if the page didn't
   include it; awards earned before it loads are queued.
   ═══════════════════════════════════════════════════════════ */
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (typeof GameSystem === 'undefined') return;

  var scriptSrc = document.currentScript && document.currentScript.src;
  var profileSrc = scriptSrc
    ? scriptSrc.replace(/game-system\.js.*$/, 'player-profile.js')
    : '../player-profile.js';

  /* ── Installed-app mode ──
     Marks <html> as soon as this script runs (still mid-<head>, before
     FOUC can happen) so CSS can drop marketing chrome that only makes
     sense when a game is reached by scrolling a search result, not when
     it's opened from inside the installed Arcade app. Same detection
     arcade.html already uses for its own shell. Scoped in game-system.css
     to the iframe-wrapper game pages (.game-frame-wrap); the other games
     never render .site-header/.guide-wrap, so this is a no-op there. */
  var isStandaloneApp = window.matchMedia('(display-mode: standalone)').matches ||
    navigator.standalone === true;
  if (isStandaloneApp) document.documentElement.classList.add('arc-appmode');

  function profile() {
    // player-profile.js declares a top-level `const playerProfile`
    // (a global lexical binding, not a window property).
    try { return typeof playerProfile !== 'undefined' ? playerProfile : (window.playerProfile || null); }
    catch (e) { return window.playerProfile || null; }
  }

  /* ── Daily caps (shared shape with tool-xp.js) ── */
  var CAP_PREFIX = 'jvds_gamexp_';
  function capKey() { return CAP_PREFIX + new Date().toDateString(); }
  function capData() {
    try { return JSON.parse(localStorage.getItem(capKey()) || '{}'); }
    catch (e) { return {}; }
  }
  function capCount(k) { return capData()[k] || 0; }
  function bumpCap(k) {
    var d = capData();
    d[k] = (d[k] || 0) + 1;
    try {
      // Prune cap records from previous days
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var key = localStorage.key(i);
        if (key && key.indexOf(CAP_PREFIX) === 0 && key !== capKey()) localStorage.removeItem(key);
      }
      localStorage.setItem(capKey(), JSON.stringify(d));
    } catch (e) { /* storage full/blocked, XP still awarded */ }
  }

  /* ── GA4 events ──
     Games never loaded ga4-analytics.js, so game_start/game_end/
     game_achievement had never once fired. Emitting from here covers all
     ~34 games with no per-game edits. Consent is handled centrally by
     analytics-loader.js (Consent Mode v2), so these are safe to call
     unconditionally. Param shapes mirror ga4-analytics.js. */
  function track(name, params) {
    if (typeof gtag !== 'function') return;
    try { gtag('event', name, params || {}); } catch (e) { /* never break gameplay */ }
  }

  /* ── XP toast ── */
  function showXPToast(text) {
    if (!document.body) return;
    var t = document.createElement('div');
    t.className = 'jvds-xp-toast';
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');
    t.textContent = text;
    t.style.cssText =
      'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(16px);' +
      'background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;' +
      'padding:10px 22px;border-radius:999px;font:700 .85rem/1.2 Nunito,Inter,sans-serif;' +
      'box-shadow:0 8px 24px rgba(124,58,237,.45);z-index:99999;pointer-events:none;' +
      'opacity:0;transition:opacity .3s,transform .3s;';
    document.body.appendChild(t);
    requestAnimationFrame(function () {
      t.style.opacity = '1';
      t.style.transform = 'translateX(-50%) translateY(0)';
    });
    setTimeout(function () {
      t.style.opacity = '0';
      t.style.transform = 'translateX(-50%) translateY(16px)';
      setTimeout(function () { t.remove(); }, 350);
    }, 2600);
  }

  /* ── Score sharing (viral loop) ──
     When a player sets a new personal best during a session, offer a
     dismissible chip that shares their score. Uses the native share sheet
     on mobile (navigator.share) and falls back to clipboard copy. The
     shared link points at the game's own page, which has a real OG card,
     so every share becomes a preview-rich invitation back to the game.
     One global hook on recordGamePlay; no per-game code needed. */
  var sessionPeak = {}; // gameId -> best score at/of this session (baseline = pre-session high)
  var chipUp = false;

  function gameShareUrl() {
    var c = document.querySelector('link[rel="canonical"]');
    if (c && c.href) return c.href.split('#')[0];
    return location.origin + location.pathname;
  }

  function fmtScore(n) {
    n = Math.floor(n || 0);
    try { return n.toLocaleString(); } catch (e) { return '' + n; }
  }

  function shareScore(gameName, score, url) {
    var text = '🏆 I scored ' + fmtScore(score) + ' in ' + gameName +
               ' on JVDesignStudio! Think you can beat it?';
    if (navigator.share) {
      navigator.share({ title: gameName + ' | JVDesignStudio', text: text, url: url })
        .catch(function () { /* user cancelled or share unavailable */ });
      return;
    }
    var payload = text + ' ' + url;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(payload)
        .then(function () { showXPToast('📋 Score copied, paste it anywhere!'); })
        .catch(function () { showXPToast(payload); });
    } else {
      showXPToast(payload);
    }
  }

  // Public: a game can call window.jvdsShareScore() from its own game-over
  // UI. Optional scoreOverride shares that exact number; otherwise the best
  // known score for the active game is used.
  window.jvdsShareScore = function (scoreOverride) {
    var inst = (typeof GameSystem !== 'undefined') ? GameSystem.lastInstance : null;
    var name = (inst && inst.gameName) || document.title.replace(/\s*[|\-–].*$/, '').trim() || 'this game';
    var best = scoreOverride;
    if (best == null) {
      var s = inst ? inst.state : null;
      best = Math.max((s && s.highScore) || 0, window.__gsBestRun || 0, (s && s.score) || 0);
    }
    shareScore(name, best, gameShareUrl());
  };

  var chipStylesReady = false;
  function ensureChipStyles() {
    if (chipStylesReady || !document.head) return;
    chipStylesReady = true;
    var st = document.createElement('style');
    // Resting state is fully visible with NO entrance animation. CSS
    // animations/transitions freeze at frame 0 in backgrounded tabs, which
    // would hold the chip invisible; a static style is reliable everywhere.
    st.textContent =
      '.jvds-share-chip{position:fixed;bottom:76px;left:50%;transform:translateX(-50%);' +
      'display:flex;align-items:center;gap:12px;z-index:99999;opacity:1;' +
      'background:linear-gradient(135deg,#f5c842,#e6a817);color:#2a1e05;' +
      'padding:12px 14px 12px 18px;border-radius:16px;font:700 .9rem/1.2 Nunito,Inter,sans-serif;' +
      'box-shadow:0 12px 34px rgba(0,0,0,.4);max-width:92vw}' +
      '.jvds-share-chip button{font-family:Nunito,Inter,sans-serif}';
    document.head.appendChild(st);
  }

  function showShareChip(gameName, score, url) {
    if (!document.body || chipUp) return;
    chipUp = true;
    ensureChipStyles();
    // Resting state is visible; entrance is a CSS animation. This avoids any
    // deferred JS style toggle (rAF/setTimeout are throttled in backgrounded
    // tabs), so the chip can never get stuck invisible.
    var chip = document.createElement('div');
    chip.className = 'jvds-share-chip';
    chip.setAttribute('role', 'dialog');
    chip.setAttribute('aria-label', 'Share your score');
    var label = document.createElement('span');
    label.innerHTML = '🏆 New best: ' + fmtScore(score) +
      '<br><span style="font-weight:600;opacity:.75;font-size:.78rem">Share your score</span>';
    var shareBtn = document.createElement('button');
    shareBtn.textContent = navigator.share ? 'Share' : 'Copy';
    shareBtn.style.cssText =
      'background:#2a1e05;color:#f5c842;border:none;padding:9px 16px;border-radius:10px;' +
      'font-weight:700;font-size:.85rem;cursor:pointer;flex:none;';
    var closeBtn = document.createElement('button');
    closeBtn.setAttribute('aria-label', 'Dismiss');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText =
      'background:transparent;border:none;color:#2a1e05;font-size:1rem;cursor:pointer;opacity:.6;flex:none;padding:4px;';
    var hide = function () {
      if (!chipUp) return;
      // Inline style change (not a deferred callback) so hide is reliable too.
      chip.style.transition = 'opacity .28s,transform .28s';
      chip.style.opacity = '0';
      chip.style.transform = 'translateX(-50%) translateY(22px)';
      setTimeout(function () { chip.remove(); chipUp = false; }, 300);
      chipUp = false;
    };
    shareBtn.onclick = function () { shareScore(gameName, score, url); hide(); };
    closeBtn.onclick = hide;
    chip.appendChild(label);
    chip.appendChild(shareBtn);
    chip.appendChild(closeBtn);
    document.body.appendChild(chip);
    setTimeout(hide, 9000);
  }

  // Public: for games with no discrete "run" to hook recordGamePlay into
  // (idle/incremental games, where recordGamePlay only fires on tab-close
  // and would be too late for this chip to ever be seen), the game itself
  // decides when a share-worthy moment happened and calls this directly.
  // No XP/analytics side effects, unlike recordGamePlay, so it's safe to
  // call as often as the game likes; showShareChip's own chipUp guard and
  // maybePromptShare's sessionPeak check keep it from spamming.
  window.jvdsCheckNewBest = function () {
    var inst = (typeof GameSystem !== 'undefined') ? GameSystem.lastInstance : null;
    maybePromptShare(inst);
  };

  // Called on run-finish. Shows the chip only when the finished run beat the
  // best score seen since the page opened (a real new record, not the stored
  // all-time high loaded at startup), so it never nags on ordinary runs.
  function maybePromptShare(inst) {
    try {
      if (!inst || !inst.gameId) return;
      var s = inst.state || {};
      var best = Math.max(s.highScore || 0, window.__gsBestRun || 0, s.score || 0);
      if (best <= 0) return;
      var prev = sessionPeak[inst.gameId];
      if (prev == null) prev = 0;
      if (best > prev) {
        sessionPeak[inst.gameId] = best;
        showShareChip(inst.gameName, best, gameShareUrl());
      }
    } catch (e) { /* sharing must never break game-over */ }
  }

  /* ── Award queue (flushed once the profile is available) ── */
  var pending = [];
  var syncers = {}; // gameId -> GameSystem instance (for leaderboard sync)
  var syncTimer = null;

  function scheduleLeaderboardSync() {
    if (syncTimer) return;
    syncTimer = setTimeout(function () {
      syncTimer = null;
      for (var id in syncers) {
        try { syncers[id].syncToGlobalLeaderboard(); } catch (e) {}
        break; // one sync updates the whole profile entry
      }
    }, 1000);
  }

  function grant(xp, source, label) {
    var p = profile();
    if (!p) return;
    var result = p.addXP(xp, source);
    showXPToast('+' + xp + ' XP, ' + label);
    if (result && result.levelUp) {
      setTimeout(function () { showXPToast('🎉 Level ' + result.newLevel + '!'); }, 1200);
    }
    scheduleLeaderboardSync();
  }

  function award(gameId, action, xp, maxPerDay, label) {
    var k = gameId + ':' + action;
    if (maxPerDay && capCount(k) >= maxPerDay) return;
    var run = function () { grant(xp, 'game:' + gameId + ':' + action, label); };
    if (profile()) {
      bumpCap(k);
      run();
    } else {
      pending.push({ key: k, maxPerDay: maxPerDay, run: run });
    }
  }

  function flushPending() {
    if (!profile()) return;
    var jobs = pending.splice(0);
    jobs.forEach(function (job) {
      if (job.maxPerDay && capCount(job.key) >= job.maxPerDay) return;
      bumpCap(job.key);
      job.run();
    });
  }

  /* ── Load player-profile.js if the page didn't include it ── */
  function ensureProfileLoaded() {
    if (profile()) { flushPending(); return; }
    if (document.querySelector('script[src*="player-profile"]')) {
      // Included but not executed yet, flush when the page finishes loading
      window.addEventListener('load', flushPending);
      return;
    }
    var s = document.createElement('script');
    s.src = profileSrc;
    s.onload = flushPending;
    (document.head || document.documentElement).appendChild(s);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureProfileLoaded);
  } else {
    ensureProfileLoaded();
  }

  /* ── Hook GameSystem ── */

  // Session XP: loadState runs inside the constructor, after gameId is set
  var sessionTimers = {};
  var origLoadState = GameSystem.prototype.loadState;
  GameSystem.prototype.loadState = function () {
    if (this.gameId && !syncers[this.gameId]) {
      syncers[this.gameId] = this;
      var gameId = this.gameId, gameName = this.gameName;
      sessionTimers[gameId] = setTimeout(function () {
        award(gameId, 'session', 10, 1, 'Playing ' + gameName);
      }, 30000);
    }
    var st = origLoadState.apply(this, arguments);
    // Baseline the share prompt at the pre-session high, so only records
    // beaten during this visit trigger the "new best" chip.
    if (this.gameId && sessionPeak[this.gameId] == null) {
      sessionPeak[this.gameId] = (st && st.highScore) || 0;
      track('game_start', {
        game_id: this.gameId,
        game_name: this.gameName,
        returning_player: !!(st && st.gamesPlayed > 0),
        high_score: (st && st.highScore) || 0
      });
    }
    return st;
  };

  // Run finished
  var origRecord = GameSystem.prototype.recordGamePlay;
  GameSystem.prototype.recordGamePlay = function () {
    // Capture before origRecord resets _runStart, so we can report run length.
    var startedAt = this._runStart;
    var r = origRecord.apply(this, arguments);
    if (!r) return r; // debounced duplicate (see recordGamePlay's own guard) — no XP/analytics
    award(this.gameId, 'run', 15, 5, this.gameName + ', run finished');

    var secs = 0;
    if (typeof startedAt === 'number') {
      secs = Math.round((Date.now() - startedAt) / 1000);
      if (!(secs >= 0 && secs < 21600)) secs = 0; // ignore implausible runs
    }
    var best = Math.max((this.state && this.state.highScore) || 0, window.__gsBestRun || 0);
    track('game_end', {
      game_id: this.gameId,
      game_name: this.gameName,
      score: Math.floor((this.state && this.state.score) || 0),
      high_score: Math.floor(best),
      games_played: (this.state && this.state.gamesPlayed) || 0,
      time_spent_seconds: secs
    });
    // Defer briefly so games that write __gsBestRun right after recordGamePlay
    // are reflected before we decide whether it's a new best.
    var self = this;
    setTimeout(function () { maybePromptShare(self); }, 60);
    return r;
  };

  // Per-game achievement ids that were never registered via defineAchievements()
  // (e.g. custom trackScore() tiers like 'score100') still deserve a real toast
  // instead of the generic "Achievement unlocked!" — turn the id itself into
  // a readable label: 'firstQuestion' -> 'First Question', 'score100' -> 'Score 100'.
  function prettifyAchievementId(id) {
    var s = String(id || '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([a-zA-Z])(\d)/g, '$1 $2')
      .replace(/(\d)([a-zA-Z])/g, '$1 $2');
    s = s.charAt(0).toUpperCase() + s.slice(1);
    return s + '!';
  }

  // Per-game achievements mirror to global XP
  var origUnlock = GameSystem.prototype.unlockAchievement;
  GameSystem.prototype.unlockAchievement = function (achievementId) {
    var unlocked = origUnlock.apply(this, arguments);
    if (unlocked) {
      var ach = this.achievements && this.achievements[achievementId];
      var name = (ach && ach.name) || prettifyAchievementId(achievementId);
      award(this.gameId, 'ach:' + achievementId, 20, 1, name);
      track('game_achievement', {
        game_id: this.gameId,
        game_name: this.gameName,
        achievement_id: achievementId,
        achievement_name: name
      });
    }
    return unlocked;
  };

  // In-game XP milestones: every 100 per-game XP → +10 global XP
  var origAddXP = GameSystem.prototype.addXP;
  GameSystem.prototype.addXP = function (amount) {
    var r = origAddXP.apply(this, arguments);
    if (amount > 0) {
      this._bridgeXPAcc = (this._bridgeXPAcc || 0) + amount;
      while (this._bridgeXPAcc >= 100) {
        this._bridgeXPAcc -= 100;
        award(this.gameId, 'milestone', 10, 5, this.gameName + ', score milestone!');
      }
    }
    return r;
  };

  /* ── Reliable persistence ──
     beforeunload (used by ~29 games) is unreliable on mobile: browsers
     discard backgrounded tabs and fire it inconsistently on app-switch.
     Flush every active GameSystem when the page is hidden or unloaded so
     score/high-score/XP/achievements survive. saveState is idempotent, so
     firing on both events (and repeatedly) is harmless. All games benefit
     without any per-game changes. */
  function flushAllState() {
    for (var id in syncers) {
      try { syncers[id].saveState(); } catch (e) {}
    }
    var p = profile();
    if (p) { try { p.saveProfile(); } catch (e) {} }
  }
  // pagehide is the reliable "leaving" signal (incl. bfcache); visibilitychange
  // →hidden is the one mobile actually delivers on app-switch/tab-discard.
  window.addEventListener('pagehide', flushAllState);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flushAllState();
  });

  /* ── Auto fullscreen toggle ──
     Most games never wired the Fullscreen API, so tapping into them from the
     Arcade just opened a normal page instead of filling the screen. Inject a
     floating toggle for every page that loads this engine, unless the page
     already ships its own (dungeon-delve, echo_fruit_catch). */
  function initFullscreenToggle() {
    // dungeon-delve.html and echo_fruit_catch.html ship their own toggle
    // under different ids/fn names — don't double up on those two.
    if (document.getElementById('btn-fullscreen') || document.getElementById('fsToggleBtn') ||
        window.toggleFullscreen || window.toggleFS) return;
    // Iframe-wrapper game pages (e.g. critter-whack-page.html) embed the
    // actual game in a `.game-frame-wrap` box below a marketing header —
    // fullscreening the whole document there would just blow up the hero
    // text and footer around a small iframe, so fullscreen that box instead.
    var target = document.querySelector('.game-frame-wrap') || document.documentElement;
    var request = target.requestFullscreen || target.webkitRequestFullscreen || target.msRequestFullscreen;
    if (!request) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gs-fullscreen-btn';
    btn.setAttribute('aria-label', 'Enter fullscreen');
    btn.textContent = '⛶';
    btn.addEventListener('click', function () {
      var isFs = document.fullscreenElement || document.webkitFullscreenElement;
      if (!isFs) {
        (target.requestFullscreen || target.webkitRequestFullscreen || target.msRequestFullscreen).call(target);
      } else {
        (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen).call(document);
      }
    });
    ['fullscreenchange', 'webkitfullscreenchange', 'msfullscreenchange'].forEach(function (ev) {
      document.addEventListener(ev, function () {
        var isFs = document.fullscreenElement || document.webkitFullscreenElement;
        btn.textContent = isFs ? '✕' : '⛶';
        btn.setAttribute('aria-label', isFs ? 'Exit fullscreen' : 'Enter fullscreen');
      });
    });
    (target === document.documentElement ? document.body : target).appendChild(btn);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFullscreenToggle);
  } else {
    initFullscreenToggle();
  }
})();
