/* liveConfig.js — extracted from arcade-game-maker.html for Vite module split. */
/* In the monolith this is inline; here it is a proper ES module for tree-shaking. */
/* Import: import { liveConfig, gameState, touchInput } from './liveConfig.js'; */

const liveConfig = {
    speed:200, rotateSpeed:190, bulletSpeed:540, fireCooldown:180,
    spawnDelay:1100, enemySpeed:150, gravity:600, jumpForce:450,
    pointsPerKill:10, obstacleSpeed:220, fireRate:400,
    // Note: scoreMultiplier applied at runtime via liveConfig.scoreMultiplier
    // Custom tab options
    lives:3, playerScale:1.0, bgStyle:'dark', screenShake:true,
    bulletSpread:1, doubleJump:false, paddleW:90, enemyZigzag:false,
    pipeGap:120, pong2Player:false,
    // Difficulty ramp
    difficultyScale:1.0,
    // Game speed (physics + timer multiplier)
    gameSpeed:1.0,
    // Win condition: 'none' | 'score' | 'time'
    winCondition:'none', winTarget:500,
    // Power-ups
    powerUpEnabled:true, powerUpFreq:10000,
    puShieldOn:true, puX2On:true, puSpeedOn:true, puLifeOn:true,
    // Snake options
    snakeWallWrap:true, snakeCellSize:20,
    snakeSpeed:160, snakeStartLen:3, snakePoisonFood:true, snakeGoldenFood:true,
    // Asteroids options
    asteroidCount:6, asteroidSpeedMul:1.0, asteroidDrag:50, asteroidSaucer:true,
    // Dodge options
    dodgeStarRatio:30,
    // Paper Toss options
    paperTossWindMax:140, paperTossBinWidth:70, paperTossMissLimit:3,
    // Runner options
    runnerObstacleMix:'standard', runnerCoinFreq:0.15, runnerParallax:true,
    // Shooter options
    maxEnemies:12, bossWaves:true,
    // Platformer options
    wallJump:false, platformerEnemyCount:4,
    // Breaker options
    brickRows:4,
    // Invaders options
    invaderCols:8, invaderRows:3, invaderUfo:true,
    // Roguelike options
    rogueRooms:6, rogueDensity:0.3, rogueStartHp:3,
    rogueEnemyHpMul:1.0,   // multiplier applied to every enemy's base HP
    rogueBossMul:1.0,       // multiplier applied to boss HP
    // Visual FX
    crtEffect:false, sceneTransition:'none',
    // Sound pack
    soundPack:'chiptune',
    gameFont:'JetBrains',
    tags:[],
    // Speed run
    speedRun:false,
    // Boss Designer
    bossHp:15, bossScale:2.0, bossSpeed:50, bossReward:150, bossPhases:null,
    // Cutscene
    cutsceneSlides:null, cutsceneWhen:'before',
    // User-defined event rules (Events tab)
    events: [],
    // â”€â”€ Loot & Drops â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    lootEnabled:    false,
    lootDropRate:   0.40,  // chance per enemy kill
    lootCoinRate:   0.55,  // fraction of drops â†’ coin
    lootGemRate:    0.25,  // fraction â†’ gem
    lootHealRate:   0.12,  // fraction â†’ heal
    lootCustomPuRate:0.08, // fraction â†’ custom PU
    lootCoinValue:  25,
    lootGemValue:   100,
    // â”€â”€ Custom Power-ups â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    customPowerUps: [],
    // â”€â”€ Game Juice â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    juiceEnabled:   true,
    juiceShake:     true,  juiceShakeIntensity: 3,  juiceShakeDuration: 140,
    juiceHitStop:   true,  juiceHitStopMs: 30,
    juiceBurst:     true,  juiceBurstCount: 10,
    juiceChroma:    true,
    juiceZoom:      false, juiceZoomScale: 1.06,
    juiceComboFlash:true,
    // â”€â”€ Visual Themes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    theme: 'space',
    // â”€â”€ Parallax Backgrounds â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    parallaxLayers: true,
    // â”€â”€ Story / Dialogue â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    storyIntro: '', storyWin: '', storyLose: '',
    // â”€â”€ Enemy AI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    enemyAI: 'classic',
    // â”€â”€ Boss Fight â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    bossEnabled: false, bossScore: 500, bossHpNew: 20, bossBehaviour: 'sweep',
    // â”€â”€ Multi-Level Progression â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    levelsEnabled: false,
    levelCount: 3,
    levelConfigs: [
        { speed: 180, enemyCount: 5,  bgHex: '#0a0a12' },
        { speed: 240, enemyCount: 8,  bgHex: '#0d0d1a' },
        { speed: 300, enemyCount: 12, bgHex: '#0a0d14' },
        { speed: 360, enemyCount: 16, bgHex: '#14080a' },
        { speed: 420, enemyCount: 20, bgHex: '#080a14' },
    ],
    _currentLevel: 0,
    // â”€â”€ Visual Level Editor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    tileMapEnabled: false,
    tileMap: [],
    tileSize: 32,
    // â”€â”€ Collectibles & Shop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    coinsEnabled: true,
    coinEmoji: 'ðŸª™',
    coinValue: 10,
    // â”€â”€ Achievements â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    achievements: [],
    // â”€â”€ Particle System â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    particleStyle: 'burst',
    particleColor: 'purple',
    particleCount: 12,
    particleSize: 'medium',
    trailEffect: false,
    // â”€â”€ Rhythm game â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    rhythmLanes: 4,      // 1-4 active lanes
    rhythmSpeed: 260,    // note fall speed px/s
    rhythmMisses: 30,    // misses before game over
    rhythmWinScore: 2000, // score needed to trigger victory
    platLevel: 1,         // current platformer level (1-3); persisted by autosave
    // â”€â”€ Street Fighter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    cpuDifficulty: 'normal', // easy | normal | hard | brutal
    roundCount: 3,            // best-of N rounds
    twoPlayer: false,         // true = P2 uses arrow keys
    // â”€â”€ New extras features â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    powerupsEnabled: false,
    powerupTypes: ['speed','shield','magnet','double'],
    weatherEffect: 'none',
    hapticEnabled: true,
    hapticIntensity: 1.0, // 0.0â€“1.5 multiplier applied to all vibrate patterns
    // â”€â”€ Patch3 HUD/Combat/Camera extras â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    countdownEnabled: false,
    startLives: 3,
    playerColour: null,
    playerSize: 1.0,
    invincFrames: 90,
    screenShakeCombat: true,
    cameraZoom: 1.0,
    hitFlash: true,
    slowMoHit: false,
    comboWindow: 1500,
    scoreMultiplier: 1,
    autoFire: false,
    scoreStyle: 'default',
    livesStyle: 'hearts',
    scorePopups: true,
    showTimer: false,
    // Power Picks: the in-run perk draft. On by default â€” it is the thing that
    // makes two runs of the same game play differently.
    perksEnabled: true
};

/* Player movement speed and weapon cadence are read directly by all 21 scenes,
   so rather than touching ~80 call sites the two values become accessors that
   fold in the current run's perks. The raw author-set numbers live in
   liveConfig._base and are what save/share/export always write, so a run can
   never leak its buffs back into the studio sliders. With no perks taken both
   multipliers are exactly 1 and every genre behaves as it did before. */
liveConfig._base = { speed: liveConfig.speed, fireCooldown: liveConfig.fireCooldown };
Object.defineProperty(liveConfig, 'speed', {
    enumerable: true, configurable: true,
    get() {
        let m = 1;
        try { m = RunMods.moveSpeedMul; } catch (e) { m = 1; }   // RunMods may still be in its TDZ
        return this._base.speed * (m || 1);
    },
    set(v) { this._base.speed = v; },
});
Object.defineProperty(liveConfig, 'fireCooldown', {
    enumerable: true, configurable: true,
    get() {
        let m = 1;
        try { m = RunMods.fireRateMul; } catch (e) { m = 1; }     // RunMods may still be in its TDZ
        return Math.max(24, Math.round(this._base.fireCooldown / (m || 1)));
    },
    set(v) { this._base.fireCooldown = v; },
});

// Tower Defence liveConfig defaults (used by custom-DEFENSE section + sceneTowerDefense)
if (!liveConfig.tdStartGold)    liveConfig.tdStartGold    = 150;
if (!liveConfig.tdEnemyHpMul)   liveConfig.tdEnemyHpMul   = 1.0;
if (!liveConfig.tdEnemySpdMul)  liveConfig.tdEnemySpdMul  = 1.0;
if (!liveConfig.tdTowerTypes) liveConfig.tdTowerTypes = [
    { id:'arrow',  emoji:'ðŸ¹', name:'Arrow',  cost:50,  range:120, rate:900,  dmg:1, aoe:0,  slow:0    },
    { id:'sniper', emoji:'ðŸŽ¯', name:'Sniper', cost:100, range:210, rate:1800, dmg:3, aoe:0,  slow:0    },
    { id:'ice',    emoji:'â„ï¸', name:'Ice',    cost:80,  range:100, rate:1100, dmg:1, aoe:0,  slow:0.45 },
    { id:'bomb',   emoji:'ðŸ’¥', name:'Bomb',   cost:120, range:90,  rate:1600, dmg:2, aoe:45, slow:0    },
];

// â”€â”€ CLICKER / MEMORY / WAVESURVIVAL liveConfig defaults â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
if (liveConfig.clickReward       === undefined) liveConfig.clickReward       = 5;
if (liveConfig.autoClickerCost   === undefined) liveConfig.autoClickerCost   = 10;
if (liveConfig.clickerMilestones === undefined) liveConfig.clickerMilestones = true;
if (liveConfig.clickEmoji        === undefined) liveConfig.clickEmoji        = 'ðŸ‘¾';
if (liveConfig.memoryGrid        === undefined) liveConfig.memoryGrid        = 'medium';
if (liveConfig.memoryCardSet     === undefined) liveConfig.memoryCardSet     = 'animals';
if (liveConfig.memoryTimerMode   === undefined) liveConfig.memoryTimerMode   = false;
if (liveConfig.memoryFlipDelay   === undefined) liveConfig.memoryFlipDelay   = 900;
if (liveConfig.waveScaling       === undefined) liveConfig.waveScaling       = 2;
if (liveConfig.wavePause         === undefined) liveConfig.wavePause         = 2000;
if (liveConfig.waveClearBonus    === undefined) liveConfig.waveClearBonus    = true;


// ── Exports for Vite consumption ──────────────────────────────────────────
export { liveConfig, gameState, touchInput, gameTheme, themeInt, themeHex, _themeData };
