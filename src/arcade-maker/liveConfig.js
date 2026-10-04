// liveConfig.js , canonical source of truth for the game config, state, theme
// data and TD defaults (A760). tools/arcade-game-maker.html imports this module
// and no longer defines any of it inline. Originally extracted by
// scripts/sync-arcade-maker-modules.js; edit this file directly now.
// Import: import { liveConfig, gameState, touchInput, gameTheme, themeInt, themeHex, _themeData, _clearTouchInput } from "./liveConfig.js";

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
    // ── Loot & Drops ──────────────────────────────────────────────
    lootEnabled:    false,
    lootDropRate:   0.40,  // chance per enemy kill
    lootCoinRate:   0.55,  // fraction of drops → coin
    lootGemRate:    0.25,  // fraction → gem
    lootHealRate:   0.12,  // fraction → heal
    lootCustomPuRate:0.08, // fraction → custom PU
    lootCoinValue:  25,
    lootGemValue:   100,
    // ── Custom Power-ups ──────────────────────────────────────────
    customPowerUps: [],
    // ── Game Juice ────────────────────────────────────────────────
    juiceEnabled:   true,
    juiceShake:     true,  juiceShakeIntensity: 3,  juiceShakeDuration: 140,
    juiceHitStop:   true,  juiceHitStopMs: 30,
    juiceBurst:     true,  juiceBurstCount: 8,
    juiceChroma:    true,
    juiceZoom:      false, juiceZoomScale: 1.06,
    juiceComboFlash:true,
    // ── Visual Themes ─────────────────────────────────────────────
    theme: 'space',
    // ── Parallax Backgrounds ──────────────────────────────────────
    parallaxLayers: true,
    // ── Story / Dialogue ──────────────────────────────────────────
    storyIntro: '', storyWin: '', storyLose: '',
    // ── Enemy AI ──────────────────────────────────────────────────
    enemyAI: 'classic',
    // ── Boss Fight ────────────────────────────────────────────────
    bossEnabled: false, bossScore: 500, bossHpNew: 20, bossBehaviour: 'sweep',
    // ── Multi-Level Progression ───────────────────────────────────
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
    // ── Visual Level Editor ───────────────────────────────────────
    tileMapEnabled: false,
    tileMap: [],
    tileSize: 32,
    // ── Collectibles & Shop ───────────────────────────────────────
    coinsEnabled: true,
    coinEmoji: '🪙',
    coinValue: 10,
    // ── Achievements ──────────────────────────────────────────────
    achievements: [],
    // ── Particle System ───────────────────────────────────────────
    particleStyle: 'burst',
    particleColor: 'purple',
    particleCount: 8,
    particleSize: 'medium',
    trailEffect: false,
    // ── Rhythm game ───────────────────────────────────────────────────
    rhythmLanes: 4,      // 1-4 active lanes
    rhythmSpeed: 260,    // note fall speed px/s
    rhythmMisses: 30,    // misses before game over
    rhythmWinScore: 2000, // score needed to trigger victory
    platLevel: 1,         // current platformer level (1-3); persisted by autosave
    // ── Street Fighter ────────────────────────────────────────────
    cpuDifficulty: 'normal', // easy | normal | hard | brutal
    roundCount: 3,            // best-of N rounds
    twoPlayer: false,         // true = P2 uses arrow keys
    // ── New extras features ───────────────────────────────────────
    powerupsEnabled: false,
    powerupTypes: ['speed','shield','magnet','double'],
    weatherEffect: 'none',
    hapticEnabled: true,
    hapticIntensity: 1.0, // 0.0-1.5 multiplier applied to all vibrate patterns
    // ── Patch3 HUD/Combat/Camera extras ──────────────────────────────────
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
    // Power Picks: the in-run perk draft. On by default , it is the thing that
    // makes two runs of the same game play differently.
    perksEnabled: true
};

// Perk-aware accessors: RunMods multipliers fold into speed/fireCooldown at runtime.
/* Player movement speed and weapon cadence are read directly by all 21 scenes,
   so rather than touching ~80 call sites the two values become accessors that
   fold in the current run's perks. The raw author-set numbers live in
   liveConfig._base and are what save/share/export always write, so a run can
   never leak its buffs back into the studio sliders. With no perks taken both
   multipliers are exactly 1 and every genre behaves as it did before. */
liveConfig._base = { speed: liveConfig.speed, fireCooldown: liveConfig.fireCooldown };
Object.defineProperty(liveConfig, "speed", {
    enumerable: true, configurable: true,
    get() { let m = 1; try { m = RunMods.moveSpeedMul; } catch (e) { m = 1; } return this._base.speed * (m || 1); },
    set(v) { this._base.speed = v; },
});
Object.defineProperty(liveConfig, "fireCooldown", {
    enumerable: true, configurable: true,
    get() { let m = 1; try { m = RunMods.fireRateMul; } catch (e) { m = 1; } return Math.max(24, Math.round(this._base.fireCooldown / (m || 1))); },
    set(v) { this._base.fireCooldown = v; },
});

// Tower Defence liveConfig defaults (used by custom-DEFENSE section + sceneTowerDefense)
if (!liveConfig.tdStartGold)    liveConfig.tdStartGold    = 150;
if (!liveConfig.tdEnemyHpMul)   liveConfig.tdEnemyHpMul   = 1.0;
if (!liveConfig.tdEnemySpdMul)  liveConfig.tdEnemySpdMul  = 1.0;
if (!liveConfig.tdTowerTypes) liveConfig.tdTowerTypes = [
    { id:'arrow',  emoji:'🏹', name:'Arrow',  cost:50,  range:120, rate:900,  dmg:1, aoe:0,  slow:0    },
    { id:'sniper', emoji:'🎯', name:'Sniper', cost:100, range:210, rate:1800, dmg:3, aoe:0,  slow:0    },
    { id:'ice',    emoji:'❄️', name:'Ice',    cost:80,  range:100, rate:1100, dmg:1, aoe:0,  slow:0.45 },
    { id:'bomb',   emoji:'💥', name:'Bomb',   cost:120, range:90,  rate:1600, dmg:2, aoe:45, slow:0    },
];

// ── CLICKER / MEMORY / WAVESURVIVAL liveConfig defaults ─────────────────────
if (liveConfig.clickReward       === undefined) liveConfig.clickReward       = 5;
if (liveConfig.autoClickerCost   === undefined) liveConfig.autoClickerCost   = 10;
if (liveConfig.clickerMilestones === undefined) liveConfig.clickerMilestones = true;
if (liveConfig.clickEmoji        === undefined) liveConfig.clickEmoji        = '👾';
if (liveConfig.memoryGrid        === undefined) liveConfig.memoryGrid        = 'medium';
if (liveConfig.memoryCardSet     === undefined) liveConfig.memoryCardSet     = 'animals';
if (liveConfig.memoryTimerMode   === undefined) liveConfig.memoryTimerMode   = false;
if (liveConfig.memoryFlipDelay   === undefined) liveConfig.memoryFlipDelay   = 900;
if (liveConfig.waveScaling       === undefined) liveConfig.waveScaling       = 2;
if (liveConfig.wavePause         === undefined) liveConfig.wavePause         = 2000;
if (liveConfig.waveClearBonus    === undefined) liveConfig.waveClearBonus    = true;

// ── GAME STATE (persists across scene restarts); guard allows inline fallback ──
if (typeof gameState === "undefined") var gameState = { lives:3 };
if (typeof touchInput === "undefined") var touchInput = { left:false, right:false, up:false, down:false, fire:false, lane0:false, lane1:false, lane2:false, lane3:false };
if (typeof gameTheme === "undefined") var gameTheme = { cols:[], name:"" };
function _clearTouchInput() {
    Object.keys(touchInput).forEach(k => { touchInput[k] = false; });
    document.querySelectorAll('.tc-pressed,.joy-active,.pb-zone-active,.rl-pressed')
        .forEach(el => el.classList.remove('tc-pressed','joy-active','pb-zone-active','rl-pressed'));
    const knob = document.querySelector('#tc-joy-zone .joystick-knob');
    if (knob) knob.style.transform = 'translate(-50%,-50%)';
}

// ── GAME THEME (from Colour Palette tool) ────────────────────────────────────
function themeInt(idx, fallback) {
    const c = gameTheme.cols[idx];
    return c ? parseInt(c.replace('#',''), 16) : fallback;
}
function themeHex(idx, fallback) { return gameTheme.cols[idx] || fallback; }

function _themeData(theme) {
    const themes = {
        space:  { bg:0x0a0a18, bgHex:'#0a0a18', playerEmoji:'🚀', enemyEmoji:'👾', bulletEmoji:'💥', collectEmoji:'⭐', accentColor:0x7c3aed },
        ocean:  { bg:0x042a3d, bgHex:'#042a3d', playerEmoji:'🐠', enemyEmoji:'🦑', bulletEmoji:'💧', collectEmoji:'🐚', accentColor:0x0891b2 },
        forest: { bg:0x0d1a0d, bgHex:'#0d1a0d', playerEmoji:'🦊', enemyEmoji:'🍄', bulletEmoji:'🌿', collectEmoji:'🌰', accentColor:0x16a34a },
        castle: { bg:0x1a1a22, bgHex:'#1a1a22', playerEmoji:'⚔️', enemyEmoji:'🐉', bulletEmoji:'✨', collectEmoji:'💎', accentColor:0xb45309 },
        candy:  { bg:0x2a0a2a, bgHex:'#2a0a2a', playerEmoji:'🧁', enemyEmoji:'🍬', bulletEmoji:'⭐', collectEmoji:'🍭', accentColor:0xec4899 },
        cyber:  { bg:0x000a00, bgHex:'#000a00', playerEmoji:'🤖', enemyEmoji:'💻', bulletEmoji:'⚡', collectEmoji:'🔋', accentColor:0x22c55e }
    };
    return themes[theme] || themes.space;
}

const _lcDefaults = JSON.parse(JSON.stringify(liveConfig));

export { liveConfig, gameState, touchInput, gameTheme, themeInt, themeHex, _themeData, _lcDefaults, _clearTouchInput };
export default liveConfig;
