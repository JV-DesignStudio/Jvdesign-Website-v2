// liveConfig.js — extracted from tools/arcade-game-maker.html for Vite module split.
// This file is the canonical definition of all game config, state, and theme data.
// In the monolith these are inline globals; here they are proper ES exports.
// Import: import { liveConfig, gameState, touchInput, gameTheme } from './liveConfig.js';

const liveConfig = {
    speed:200, rotateSpeed:190, bulletSpeed:540, fireCooldown:180,
    spawnDelay:1100, enemySpeed:150, gravity:600, jumpForce:450,
    pointsPerKill:10, obstacleSpeed:220, fireRate:400,
    lives:3, playerScale:1.0, bgStyle:'dark', screenShake:true,
    bulletSpread:1, doubleJump:false, paddleW:90, enemyZigzag:false,
    pipeGap:120, pong2Player:false,
    difficultyScale:1.0,
    gameSpeed:1.0,
    winCondition:'none', winTarget:500,
    powerUpEnabled:true, powerUpFreq:10000,
    puShieldOn:true, puX2On:true, puSpeedOn:true, puLifeOn:true,
    snakeWallWrap:true, snakeCellSize:20,
    snakeSpeed:160, snakeStartLen:3, snakePoisonFood:true, snakeGoldenFood:true,
    asteroidCount:6, asteroidSpeedMul:1.0, asteroidDrag:50, asteroidSaucer:true,
    dodgeStarRatio:30,
    runnerObstacleMix:'standard', runnerCoinFreq:0.15, runnerParallax:true,
    maxEnemies:12, bossWaves:true,
    wallJump:false, platformerEnemyCount:4,
    brickRows:4,
    invaderCols:8, invaderRows:3, invaderUfo:true,
    rogueRooms:6, rogueDensity:0.3, rogueStartHp:3,
    rogueEnemyHpMul:1.0, rogueBossMul:1.0,
    crtEffect:false, sceneTransition:'none',
    soundPack:'chiptune',
    gameFont:'JetBrains',
    tags:[],
    speedRun:false,
    bossHp:15, bossScale:2.0, bossSpeed:50, bossReward:150, bossPhases:null,
    cutsceneSlides:null, cutsceneWhen:'before',
    events: [],
    lootEnabled:false, lootDropRate:0.40, lootCoinRate:0.55, lootGemRate:0.25,
    lootHealRate:0.12, lootCustomPuRate:0.08, lootCoinValue:25, lootGemValue:100,
    customPowerUps: [],
    juiceEnabled:true,
    juiceShake:true, juiceShakeIntensity:3, juiceShakeDuration:140,
    juiceHitStop:true, juiceHitStopMs:30,
    juiceBurst:true, juiceBurstCount:10,
    juiceChroma:true,
    juiceZoom:false, juiceZoomScale:1.06,
    juiceComboFlash:true,
    theme:'space',
    parallaxLayers:true,
    storyIntro:'', storyWin:'', storyLose:'',
    enemyAI:'classic',
    bossEnabled:false, bossScore:500, bossHpNew:20, bossBehaviour:'sweep',
    levelsEnabled:false, levelCount:3,
    levelConfigs:[
        {speed:180,enemyCount:5,bgHex:'#0a0a12'},
        {speed:240,enemyCount:8,bgHex:'#0d0d1a'},
        {speed:300,enemyCount:12,bgHex:'#0a0d14'},
        {speed:360,enemyCount:16,bgHex:'#14080a'},
        {speed:420,enemyCount:20,bgHex:'#080a14'},
    ],
    _currentLevel:0,
    tileMapEnabled:false, tileMap:[], tileSize:32,
    coinsEnabled:true, coinEmoji:'🪙', coinValue:10,
    shopEnabled:false, shopUpgrades:['speed','health','damage','shield'],
    achievements:[],
    particleStyle:'burst', particleColor:'purple', particleCount:12, particleSize:'medium',
    trailEffect:false,
    rhythmLanes:4, rhythmSpeed:260, rhythmMisses:30, rhythmWinScore:2000, platLevel:1,
    cpuDifficulty:'normal', roundCount:3, twoPlayer:false,
    powerupsEnabled:false, powerupTypes:['speed','shield','magnet','double'],
    weatherEffect:'none', hapticEnabled:true, hapticIntensity:1.0,
    countdownEnabled:false, startLives:3,
    playerColour:null, playerSize:1.0, invincFrames:90,
    screenShakeCombat:true, cameraZoom:1.0, hitFlash:true, slowMoHit:false,
    comboWindow:1500, scoreMultiplier:1, autoFire:false,
    scoreStyle:'default', livesStyle:'hearts', scorePopups:true, showTimer:false,
    perksEnabled:true
};

// Perk-aware accessors — RunMods multipliers fold into speed/fireCooldown at runtime
liveConfig._base = { speed: liveConfig.speed, fireCooldown: liveConfig.fireCooldown };
Object.defineProperty(liveConfig, 'speed', {
    enumerable: true, configurable: true,
    get() { let m=1; try{m=RunMods.moveSpeedMul;}catch(e){} return this._base.speed*(m||1); },
    set(v) { this._base.speed = v; },
});
Object.defineProperty(liveConfig, 'fireCooldown', {
    enumerable: true, configurable: true,
    get() { let m=1; try{m=RunMods.fireRateMul;}catch(e){} return Math.max(24,Math.round(this._base.fireCooldown/(m||1))); },
    set(v) { this._base.fireCooldown = v; },
});

// Tower Defence defaults
if (!liveConfig.tdStartGold)    liveConfig.tdStartGold    = 150;
if (!liveConfig.tdEnemyHpMul)   liveConfig.tdEnemyHpMul   = 1.0;
if (!liveConfig.tdEnemySpdMul)  liveConfig.tdEnemySpdMul  = 1.0;
if (!liveConfig.tdTowerTypes) liveConfig.tdTowerTypes = [
    {id:'arrow',emoji:'🏹',name:'Arrow',cost:50,range:120,rate:900,dmg:1,aoe:0,slow:0},
    {id:'sniper',emoji:'🎯',name:'Sniper',cost:100,range:210,rate:1800,dmg:3,aoe:0,slow:0},
    {id:'ice',emoji:'❄️',name:'Ice',cost:80,range:100,rate:1100,dmg:1,aoe:0,slow:0.45},
    {id:'bomb',emoji:'💥',name:'Bomb',cost:120,range:90,rate:1600,dmg:2,aoe:45,slow:0},
];
if (liveConfig.clickReward===undefined)       liveConfig.clickReward       = 5;
if (liveConfig.autoClickerCost===undefined)   liveConfig.autoClickerCost   = 10;
if (liveConfig.clickerMilestones===undefined) liveConfig.clickerMilestones = true;
if (liveConfig.clickEmoji===undefined)        liveConfig.clickEmoji        = '👆';
if (liveConfig.memoryGrid===undefined)        liveConfig.memoryGrid        = 'medium';
if (liveConfig.memoryCardSet===undefined)     liveConfig.memoryCardSet     = 'animals';
if (liveConfig.memoryTimerMode===undefined)   liveConfig.memoryTimerMode   = false;
if (liveConfig.memoryFlipDelay===undefined)   liveConfig.memoryFlipDelay   = 900;
if (liveConfig.waveScaling===undefined)       liveConfig.waveScaling       = 2;
if (liveConfig.wavePause===undefined)         liveConfig.wavePause         = 2000;
if (liveConfig.waveClearBonus===undefined)    liveConfig.waveClearBonus    = true;

const gameState = { lives:3 };
const touchInput = { left:false, right:false, up:false, down:false, fire:false, lane0:false, lane1:false, lane2:false, lane3:false };
const gameTheme = { cols:[], name:'' };
function themeInt(idx, fallback) {
    const c = gameTheme.cols[idx];
    return c ? parseInt(c.replace('#',''), 16) : fallback;
}
function themeHex(idx, fallback) { return gameTheme.cols[idx] || fallback; }

function _themeData(theme) {
    const themes = {
        space:  {bg:0x0a0a18,bgHex:'#0a0a18',playerEmoji:'🚀',enemyEmoji:'👾',bulletEmoji:'🔸',collectEmoji:'⭐',accentColor:0x7c3aed},
        ocean:  {bg:0x042a3d,bgHex:'#042a3d',playerEmoji:'🏊',enemyEmoji:'🦑',bulletEmoji:'💧',collectEmoji:'🐚',accentColor:0x0891b2},
        forest: {bg:0x0d1a0d,bgHex:'#0d1a0d',playerEmoji:'🧙',enemyEmoji:'🦇',bulletEmoji:'🔮',collectEmoji:'🍄',accentColor:0x16a34a},
        castle: {bg:0x1a1a22,bgHex:'#1a1a22',playerEmoji:'⚔️',enemyEmoji:'🧟',bulletEmoji:'🪄',collectEmoji:'🗝️',accentColor:0xb45309},
        candy:  {bg:0x2a0a2a,bgHex:'#2a0a2a',playerEmoji:'🍭',enemyEmoji:'🧁',bulletEmoji:'🍩',collectEmoji:'🍬',accentColor:0xec4899},
        cyber:  {bg:0x000a00,bgHex:'#000a00',playerEmoji:'🤖',enemyEmoji:'🦾',bulletEmoji:'⚡',collectEmoji:'💾',accentColor:0x22c55e}
    };
    return themes[theme] || themes.space;
}

const _lcDefaults = JSON.parse(JSON.stringify(liveConfig));

export { liveConfig, gameState, touchInput, gameTheme, themeInt, themeHex, _themeData, _lcDefaults };
export default liveConfig;
