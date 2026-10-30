(function(){
const C = document.getElementById('game'), ctx = C.getContext('2d');
const $ = id => document.getElementById(id);
const audio = window.AudioEffects ? new AudioEffects(.5) : null;
const sys = window.GameSystem ? new GameSystem('highway-dodge','Highway Dodge','ember') : null;

const BEATS = [
  { at:0, text:'The first wave of traffic appears.' },
  { at:.4, text:'Speed picks up and the lanes get busy.' },
  { at:.8, text:'Rush hour. Every gap counts.' }
];
// Respect reduce-motion: no screen shake, fewer particles, no vertical flourish.
const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

const storyRun = window.__storyRun = window.StoryRun ? new StoryRun({
  id:'highway-dodge', gameSystem:sys, title:'Highway Dodge', character:'Ember',
  open:'Ember is racing down the highway and the traffic is getting heavier.',
  objective:'Dodge as many cars as you can and keep driving.',
  beats:BEATS,
  cap:300,
  result:{
    success:'Ember clears the rush and the highway opens up ahead.',
    partial:'A few bumps, but Ember keeps the engine running.',
    fail:'The traffic wins this time, but Ember knows the lanes now.'
  },
  // The StoryRun bar is hidden in this game, so its beats surface as toasts.
  onBeat:function (b) { toast(b.text); },
  onFinish:function (outcome, score) { addKeepsakeButton(outcome, score); },
  onRestart:function(){ startGame(); }
}) : null;

let W, H, dpr;
const LANE_COUNT = 3;
let laneW, roadL, roadR;
// 1 unit = the lane width of the original phone design (78 device px at dpr 1).
let U = 1;
// Difficulty is expressed against this reference canvas height so a car takes
// the same time to cross the screen on any device (see update()).
const REF_H = 650;
let vscale = 1;

const FUEL_MAX = 100;
const FUEL_PER_PICKUP = 42;
const COMBO_WINDOW = 3.2;   // seconds a near-miss chain stays alive
// Oncoming traffic drives a little faster than the road scrolls so it reads as
// moving cars, not markings on a belt. Every lane uses the same factor, so a
// spawn row never shears apart (that shear is what used to close the gap).
const CAR_MUL = 1.18;
const MAX_DIST = 12000;     // "top speed" milestone distance
// Speed ramps with distance, but slowly and with a hard ceiling. The old
// `280 + dist * .04` compounded (dist grows with speed) and nearly tripled the
// pace inside 25 seconds, which made the run unreadable on a phone.
const SPEED_BASE = 280;
const SPEED_RAMP = .012;
const SPEED_MAX = 400;

function baseSpeed() {
  return Math.min(SPEED_MAX, SPEED_BASE + dist * SPEED_RAMP);
}

/* ── TrafficDash parity (Core06 Game Art project) ──────────────────────────
   A 120-second timed run with a finish bonus, drift-for-cash, nitro boost,
   cone/barrel hazards, wrong-way traffic and a W/S throttle. Kept additive so
   the existing endless/fuel/garage systems keep working. */
const TIME_LIMIT = (function () {
  try {
    const t = parseFloat(new URLSearchParams(location.search).get('time'));
    return t > 0 ? t : 120;
  } catch (e) { return 120; }
})();
const FINISH_BONUS = 75;         // coins for surviving the full run
const BOOST_TIME = 4.5;          // seconds of nitro per pickup
const STUMBLE_TIME = 1.3;        // seconds of wobble after a cone
const BOOST_MULT = 1.34;
const STUMBLE_MULT = 0.55;
const DRIFT_CASH_RATE = 0.45;
const DRIFT_MIN_SPEED = 380;     // reference speed before a slide counts

let running = false, dead = false, paused = false;
let player, cars, pickups, slicks, particles, roadLines, hazards, skids, floats;
let score, speed, dist, nearMiss, combo, comboTimer, fuel, bestCombo, carsPassed;
let timeLeft, throttle, boostTimer, stumbleTimer, invuln, starTimer;
let driftPoints, driftWindow, drifting, driftSkidTimer;
let runCash, distanceCash, nearCash, pickupCash;
let hazardTimer, wrongWaySpawns;
let scoreCarry = 0;
let best = (sys ? GameSystem.getBestScore('highway-dodge') : 0) || 0;
let last = 0, spawnTimer = 0, slickTimer = 0, skyTime = 0, dustTimer = 0, slipTimer = 0;
let swipeStartX = 0, swipeStartY = 0, swiping = false;
let tiltActive = false, tiltGamma = 0, tiltBaseline = 0, tiltSetupDone = false;
let playerPrevX = 0, playerVX = 0;
let slipstreamTimer = 0, slipstreamActive = false;
let rushHourActive = false, rushHourTimer = 0;
const RUSH_HOUR_DURATION = 15;   // seconds of Rush Hour
const RUSH_HOUR_AT = 60;         // seconds remaining when it triggers
let endReason = 'crash';
// Fairness accounting: `wallFrames` counts frames where all three lanes were
// blocked at the same height. The spawner makes that impossible; the counter
// exists so a test can prove it.
let wallFrames = 0, spawnRows = 0;
// Collectable depth counters (for tests and balance).
let coinPickups = 0, coinSpawns = 0, slickSpawns = 0;
// Onboarding guide state.
let guideOn = false, guideStep = 0, guideTimer = 0;
// Engine hum.
let engine = null;
// Visual feedback timers
let flashTimer = 0;          // near-miss screen-edge flash
let driftFloatTimer = 0;     // periodic drift score float
let driftWindowEarned = 0;   // coins earned in current drift window
let crashCamTimer = 0;       // crash slow-mo duration
let crashCamEarned = 0;      // earned coins deferred until crash cam ends
let boostSmokeTimer = 0;     // nitro exhaust particle timer
let driftSmokeTimer = 0;     // drift tire-smoke particle timer
let lightningTimer = 0;      // seconds until next lightning strike
let lightningFlash = 0;      // current flash brightness 0-1

/* ── Garage: coins, cars, upgrades and missions, saved on this device ── */
const GARAGE_KEY = 'jvds-highway-garage';
const SKINS = [
  { id:'classic', name:'Classic Racer',  price:0,    style:'car',   body:'#f59e0b', accent:'#fbbf24', glass:'rgba(18,26,44,.85)', lights:'#fde68a' },
  { id:'racer',   name:'Mint Racer',     price:120,  style:'sport', body:'#22c55e', accent:'#bbf7d0', glass:'rgba(8,28,22,.85)',  lights:'#eafff2' },
  { id:'bubble',  name:'Bubblegum',      price:220,  style:'car',   body:'#ec4899', accent:'#fbcfe8', glass:'rgba(38,10,28,.85)', lights:'#fff0f7' },
  { id:'phantom', name:'Phantom',        price:400,  style:'sport', body:'#4f46e5', accent:'#a5b4fc', glass:'rgba(6,8,30,.9)',    lights:'#c7d2fe' },
  { id:'taxi',    name:'Sunset Taxi',    price:550,  style:'van',   body:'#facc15', accent:'#1f2937', glass:'rgba(28,24,6,.85)',  lights:'#fff8d6' },
  { id:'rig',     name:'Night Rig',      price:750,  style:'truck', body:'#475569', accent:'#94a3b8', glass:'rgba(10,14,24,.9)',  lights:'#e2e8f0' },
  { id:'gold',    name:'Gold Rush',      price:1200, style:'sport', body:'#f59e0b', accent:'#fffbeb', glass:'rgba(42,30,2,.8)',   lights:'#fffbe6' },
  { id:'rainbow', name:'Rainbow Rocket', price:2000, style:'sport', body:'#ef4444', accent:'#22d3ee', glass:'rgba(20,10,40,.8)',  lights:'#ffffff', rainbow:true }
];
// Upgrades change the run itself, not just looks.
const UPGRADES = [
  { id:'tank',   name:'Fuel Tank',    icon:'⛽', max:3, base:80,  step:60,  desc:'+20% fuel capacity each level' },
  { id:'shield', name:'Shield Plate', icon:'🛡', max:3, base:120, step:90,  desc:'Begin each run with a shield' },
  { id:'magnet', name:'Coin Magnet',  icon:'🧲', max:3, base:100, step:80,  desc:'Grab pickups from further away' },
  { id:'combo',  name:'Combo Bonus',  icon:'✨', max:3, base:140, step:110, desc:'+15% near-miss points each level' },
  { id:'grip',   name:'Good Grip',    icon:'🛞', max:3, base:90,  step:70,  desc:'Snappier lane changes' }
];
const DAILY_MISSIONS = [
  { id:'d-pass',  icon:'🚗', text:'Pass 25 cars',             metric:'passed',   goal:25,   coins:80 },
  { id:'d-near',  icon:'💨', text:'Land 10 near misses',      metric:'nearMiss', goal:10,   coins:90 },
  { id:'d-coin',  icon:'🪙', text:'Collect 15 coins',         metric:'coins',    goal:15,   coins:70 },
  { id:'d-score', icon:'🚀', text:'Earn 1,500 points',        metric:'score',    goal:1500, coins:100 },
  { id:'d-fuel',  icon:'⛽', text:'Grab 3 fuel cans',         metric:'fuel',     goal:3,    coins:75 }
];
const WEEKLY_MISSIONS = [
  { id:'w-score', icon:'🏆', text:'Earn 12,000 points this week',    metric:'score',    goal:12000, coins:250 },
  { id:'w-pass',  icon:'🛣', text:'Pass 200 cars this week',         metric:'passed',   goal:200,   coins:220 },
  { id:'w-near',  icon:'💨', text:'Land 80 near misses this week',   metric:'nearMiss', goal:80,    coins:240 }
];

function loadGarage(){
  let g = null;
  try { g = JSON.parse(localStorage.getItem(GARAGE_KEY)); } catch (e) {}
  if (!g || typeof g !== 'object') g = {};
  g.coins = Math.max(0, Math.floor(g.coins || 0));
  g.owned = Array.isArray(g.owned) ? g.owned.filter(id => SKINS.some(s => s.id === id)) : [];
  if (g.owned.indexOf('classic') === -1) g.owned.push('classic');
  if (!SKINS.some(s => s.id === g.equipped)) g.equipped = 'classic';
  g.upgrades = (g.upgrades && typeof g.upgrades === 'object') ? g.upgrades : {};
  UPGRADES.forEach(u => { g.upgrades[u.id] = Math.max(0, Math.min(u.max, Math.floor(g.upgrades[u.id] || 0))); });
  g.missions = (g.missions && typeof g.missions === 'object') ? g.missions : {};
  return g;
}
function saveGarage(){
  try {
    localStorage.setItem(GARAGE_KEY, JSON.stringify({
      coins: garage.coins, owned: garage.owned, equipped: garage.equipped,
      upgrades: garage.upgrades, missions: garage.missions
    }));
  } catch (e) {}
}
let garage = loadGarage();
function currentSkin(){ return SKINS.find(s => s.id === garage.equipped) || SKINS[0]; }
function lvl(id){ return (garage.upgrades && garage.upgrades[id]) || 0; }
function fuelMax(){ return FUEL_MAX * (1 + 0.2 * lvl('tank')); }
function upgradeCost(u){ return u.base + u.step * lvl(u.id); }

/* ── Achievements (game-specific, persisted by GameSystem) ── */
const HD_ACHIEVEMENTS = {
  'hd-first-1000': { id:'hd-first-1000', name:'🥇 First Thousand', description:'Score 1,000 in a run', icon:'🥇', unlocked:false },
  'hd-near-50':    { id:'hd-near-50',    name:'💨 Slipstream',     description:'Land 50 near misses in a run', icon:'💨', unlocked:false },
  'hd-combo-10':   { id:'hd-combo-10',   name:'🔥 Untouchable',    description:'Reach a x10 near-miss combo', icon:'🔥', unlocked:false },
  'hd-maxspeed':   { id:'hd-maxspeed',   name:'🚀 Full Throttle',  description:'Reach top speed in a run', icon:'🚀', unlocked:false },
  'hd-buy-car':    { id:'hd-buy-car',    name:'🚗 New Wheels',     description:'Buy a car in the shop', icon:'🚗', unlocked:false }
};
if (sys && sys.achievements) Object.assign(sys.achievements, HD_ACHIEVEMENTS);
function unlock(id){
  if (!sys) return false;
  const a = HD_ACHIEVEMENTS[id];
  const had = (sys.state.achievements || []).indexOf(id) !== -1;
  sys.unlockAchievement(id);
  if (!had) {
    toast(a ? a.icon + ' ' + a.name : 'Achievement!');
    try { if (window.GameUI && GameUI.showAchievementNotification && a) GameUI.showAchievementNotification(a); } catch (e) {}
    try { audio?.playLevelUp?.(); } catch (e) {}
    haptic(35);
  }
  return !had;
}

/* ── Haptics ── */
function haptic(ms){
  if (reduceMotion) return;
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
}

// Held-key state for the W/S throttle.
const keys = {};

/* ── Missions: one rotating goal per day, one per week, scoped to this game ── */
function dayNum(){ return Math.floor(Date.now() / 86400000); }
function weekNum(){ const n = new Date(); return Math.floor(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / 86400000 / 7); }
function pick(list, n){ return list[((n % list.length) + list.length) % list.length]; }
function makeMission(def){ return { id:def.id, icon:def.icon, text:def.text, metric:def.metric, goal:def.goal, coins:def.coins, p:0, claimed:false }; }
function rotateMissions(){
  if (!garage.missions) garage.missions = {};
  const m = garage.missions;
  const day = dayNum(), week = weekNum();
  if (m.day !== day || !m.daily || m.daily.metric == null) { m.day = day; m.daily = makeMission(pick(DAILY_MISSIONS, day)); }
  if (m.week !== week || !m.weekly || m.weekly.metric == null) { m.week = week; m.weekly = makeMission(pick(WEEKLY_MISSIONS, week)); }
  saveGarage();
}
function addMission(metric, amount){
  if (!amount) return;
  const m = garage.missions;
  if (!m) return;
  ['daily','weekly'].forEach(scope => {
    const ms = m[scope];
    if (ms && !ms.claimed && ms.metric === metric) {
      ms.p += amount;
      if (ms.p >= ms.goal) { ms.p = ms.goal; ms.claimed = true; grantMission(ms, scope); }
    }
  });
}
function grantMission(ms, scope){
  garage.coins += ms.coins;
  saveGarage();
  toast((scope === 'weekly' ? '🗓 Weekly' : '⭐ Daily') + ' mission done +' + ms.coins + ' coins');
  try { audio?.playSuccess?.(); } catch (e) {}
  haptic(30);
  if (!( $('shopScreen') && !$('shopScreen').classList.contains('hidden') )) refreshCoins();
  renderMissions();
}

// Read-only debug handle so tests can verify death state, fairness and the shop.
window.__highway = {
  get running() { return running; },
  get dead() { return dead; },
  get paused() { return paused; },
  get score() { return score; },
  get playerLane() { return player ? player.lane : -1; },
  cars() { return cars.map(c => ({ lane: c.lane, y: c.y, h: c.h })); },
  get overlaps() {
    let n = 0;
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i], b = cars[j];
        // Wrong-way cars are deliberately oncoming, so they may pass a
        // same-lane car head-on; the fairness guarantee is about spawn rows.
        if (a.wrongWay || b.wrongWay) continue;
        if (a.lane === b.lane && Math.abs(a.y - b.y) < (a.h + b.h) / 2 - 1) n++;
      }
    }
    return n;
  },
  get milestone() { return milestones ? milestones.next() : null; },
  get shake() { return shake ? shake.amount : 0; },
  get shakeHits() { return shake ? shake.hits : 0; },
  get playerX() { return player ? player.x : -1; },
  get laneW() { return laneW; },
  get roadL() { return roadL; },
  get roadR() { return roadR; },
  get fuel() { return fuel; },
  get fuelMax() { return fuelMax(); },
  get combo() { return combo; },
  get comboTimer() { return comboTimer; },
  get vscale() { return vscale; },
  get endReason() { return endReason; },
  // TrafficDash parity surface (A1719b).
  get timeLeft() { return timeLeft; },
  get timeLimit() { return TIME_LIMIT; },
  get throttle() { return throttle; },
  get boost() { return boostTimer; },
  get stumble() { return stumbleTimer; },
  get drift() { return driftPoints; },
  get drifting() { return drifting; },
  get runCash() { return Math.floor(runCash); },
  get wrongWaySpawns() { return wrongWaySpawns; },
  hazards() { return hazards.map(h => ({ lane: h.lane, y: h.y, type: h.type })); },
  setTimeLeft(t) { timeLeft = Math.max(0, +t || 0); return timeLeft; },
  setThrottle(v) { throttle = Math.max(-1, Math.min(1, +v || 0)); return throttle; },
  // Deterministic spawn seams so a test can exercise one system at a time.
  debugPickup(type, lane) {
    const laneN = typeof lane === 'number' ? lane : (player ? player.lane : 1);
    const p = makePickup(laneN);
    p.type = type; p.x = laneX(laneN); p.y = H - player.h * 2.0;
    pickups.push(p); return { type: p.type, lane: laneN };
  },
  debugHazard(type, lane) {
    const laneN = typeof lane === 'number' ? lane : (player ? player.lane : 1);
    const hz = { x: laneX(laneN), y: H - player.h * 2.0, lane: laneN, type, r: laneW * (type === 'barrel' ? .3 : .24) };
    hazards.push(hz); return { type, lane: laneN };
  },
  debugWrongWay(lane) {
    const laneN = typeof lane === 'number' ? lane : (player ? player.lane : 1);
    const spec = VEHICLES.car;
    const w = laneW * spec.w, h = laneW * spec.h;
    cars.push({ x: laneX(laneN), y: H + h * 1.5, w, h, lane: laneN, type: 'car', wrongWay: true, dir: -1, color: '#ef4444', nearCounted: false, passed: true });
    wrongWaySpawns++;
    return laneN;
  },
  // A1648 fairness + shop surface for the test suite.
  get walls() { return wallFrames; },
  get rows() { return spawnRows; },
  get equipped() { return garage.equipped; },
  get coins() { return garage.coins; },
  get garage() { return { coins: garage.coins, owned: garage.owned.slice(), equipped: garage.equipped }; },
  get upgrades() { return Object.assign({}, garage.upgrades); },
  get missions() { return JSON.parse(JSON.stringify(garage.missions || {})); },
  get carsPassed() { return carsPassed; },
  get slip() { return slipTimer; },
  get star() { return starTimer; },
  get shield() { return player ? player.shield : 0; },
  get coinSpawns() { return coinSpawns; },
  get coinPickups() { return coinPickups; },
  get slickSpawns() { return slickSpawns; },
  get H() { return H; },
  pickups() { return pickups.map(p => ({ lane: p.lane, y: p.y, type: p.type })); },
  achievements() { return Object.keys(HD_ACHIEVEMENTS); },
  unlocked() { return (sys && sys.state.achievements || []).filter(id => HD_ACHIEVEMENTS[id]); },
  carList() { return SKINS.map(s => ({ id:s.id, name:s.name, price:s.price })); },
  upgradeList() { return UPGRADES.map(u => ({ id:u.id, name:u.name, max:u.max, level:lvl(u.id), cost:upgradeCost(u) })); },
  grantCoins(n) { garage.coins += Math.max(0, Math.floor(n || 0)); saveGarage(); renderGarage(); refreshCoins(); return garage.coins; },
  buyUpgrade(id) { return buyUpgrade(id); },
  openShop() { return openShop(); }
};

const MISSION = [500, 1500, 3000, 6000];
const milestones = window.JVDSShowcase ? new JVDSShowcase.Milestones(MISSION, function (m) {
  toast('Goal reached: ' + m + '!');
  try { audio?.playSuccess?.(); } catch(e) {}
  const n = reduceMotion ? 6 : 16;
  for (let i = 0; i < n; i++) {
    particles.push({ x: player.x + (Math.random() - .5) * 60, y: H - player.h, vx: (Math.random() - .5) * 260, vy: -Math.random() * 260, life: 1, color: '#fbbf24', size: 3 });
  }
}) : null;
const shake = window.JVDSShowcase ? new JVDSShowcase.Shake(14) : null;
let fitW = -1, fitH = -1;

// Lane x positions move whenever the canvas is resized, so re-anchor the player,
// cars and pickups onto their lanes.
function remapLanes() {
  if (!player) return;
  player.x = player.targetX = Math.max(roadL + player.w * 0.55, Math.min(roadR - player.w * 0.55, player.x));
  cars.forEach(c => { c.x = laneX(c.lane) + (c.xOff || 0); });
  pickups.forEach(p => { p.x = laneX(p.lane); });
  slicks.forEach(s => { s.x = laneX(s.lane); });
}

function fit() {
  const r = C.getBoundingClientRect();
  dpr = Math.min(devicePixelRatio || 1, 2);
  const nW = Math.round(r.width * dpr), nH = Math.round(r.height * dpr);
  if (nW === fitW && nH === fitH) return;
  const resized = fitW !== 0;
  fitW = nW; fitH = nH;
  W = nW; H = nH;
  C.width = W; C.height = H;
  laneW = Math.min(W / (LANE_COUNT + 2), H / 7.5);
  U = laneW / 78;
  roadL = (W - laneW * LANE_COUNT) / 2;
  roadR = roadL + laneW * LANE_COUNT;
  vscale = H / REF_H;
  if (resized) remapLanes();
}

function laneX(lane) { return roadL + laneW / 2 + lane * laneW; }

// Effective road speed in reference units: base speed shaped by the throttle,
// nitro boost and cone-stumble, exactly like the Godot build.
function effectiveSpeed(ref) {
  const base = (ref == null) ? baseSpeed() : ref;
  const th = Math.max(.45, Math.min(1.6, 1 + throttle * .5));
  const boost = boostTimer > 0 ? BOOST_MULT : 1;
  const stumble = stumbleTimer > 0 ? STUMBLE_MULT : 1;
  const slip = slipstreamActive ? 1.18 : 1;
  return base * th * boost * stumble * slip;
}

const VEHICLES = {
  car:   { w:.54, h:1.00, colors:['#ef4444','#3b82f6','#22c55e','#a855f7','#f97316','#ec4899','#06b6d4'] },
  sport: { w:.50, h:.92,  colors:['#facc15','#fb7185','#38bdf8','#4ade80','#f472b6'] },
  van:   { w:.62, h:1.26, colors:['#e2e8f0','#cbd5e1','#fde68a','#bfdbfe'] },
  truck: { w:.74, h:1.70, colors:['#64748b','#475569','#78716c','#92400e'] },
  bus:   { w:.74, h:1.92, colors:['#f59e0b','#0ea5e9','#dc2626','#16a34a'] },
  bike:  { w:.26, h:.82,  colors:['#f43f5e','#a78bfa','#f59e0b'] }
};
const TRUCKISH = ['truck','bus'];

let gapLane = 1;

function nextGapLane() {
  const r = Math.random();
  let g = gapLane;
  if (r < .34) g = gapLane - 1;
  else if (r < .68) g = gapLane + 1;
  return Math.max(0, Math.min(LANE_COUNT - 1, g));
}

function spawnCar(lane, yOff) {
  const trucky = Math.random() < Math.min(.4, .16 + dist * .00001);
  const types = trucky ? TRUCKISH : ['car','car','sport','van','bike'];
  const type = types[Math.floor(Math.random() * types.length)];
  const spec = VEHICLES[type];
  const w = laneW * spec.w, h = laneW * spec.h;
  const xOff = (Math.random() - 0.5) * laneW * 0.22;
  // 14% of cars slowly drift into an adjacent lane once on screen
  let driftTargetX = null, driftRate = 0, driftTilt = 0;
  if (!trucky && Math.random() < 0.14 && dist > 600) {
    const dDir = Math.random() < 0.5 ? -1 : 1;
    const dLane = Math.max(0, Math.min(LANE_COUNT - 1, lane + dDir));
    if (dLane !== lane) {
      driftTargetX = laneX(dLane) + (Math.random() - 0.5) * laneW * 0.18;
      driftRate = laneW * (0.55 + Math.random() * 0.4);
    }
  }
  cars.push({
    x: laneX(lane) + xOff, xOff, y: -h / 2 + (yOff || 0), w, h, lane, type, isTruck: trucky,
    color: spec.colors[Math.floor(Math.random() * spec.colors.length)],
    nearCounted: false, passed: false,
    driftTargetX, driftRate, driftTilt
  });
}

function spawnRow() {
  const g = nextGapLane();
  const twoCars = Math.random() < Math.min(.6, .18 + dist * .00004);
  let open;
  if (twoCars) {
    open = [g];
  } else {
    const n = g === 0 ? 1 : g === 2 ? 1 : (Math.random() < .5 ? 0 : 2);
    open = [g, n];
  }
  for (let lane = 0; lane < LANE_COUNT; lane++) {
    if (open.indexOf(lane) !== -1) continue;
    spawnCar(lane, (Math.random() - 0.5) * laneW * 0.38);
  }
  gapLane = g;
  spawnRows++;
}

function topEdgeClear(minGap) {
  for (let i = 0; i < cars.length; i++) {
    if (cars[i].y - cars[i].h / 2 < minGap) return false;
  }
  return true;
}

function makePickup(lane) {
  if (typeof lane !== 'number') lane = gapLane;
  const r = Math.random();
  let type;
  if (dist > 1500 && r < .10) type = 'star';
  else if (r < .15) type = 'shield';
  else if (r < .34) type = 'fuel';
  else if (r < .54) type = 'boost';
  else type = 'coin';
  if (type === 'coin') coinSpawns++;
  return { x: laneX(lane), y: -40 * U, lane, type, r: laneW * .26, bob: 0, value: type === 'coin' ? 5 : 0 };
}

function spawnSlick() {
  const lane = Math.floor(Math.random() * LANE_COUNT);
  slickSpawns++;
  slicks.push({ x: laneX(lane), y: -30 * U, lane, r: laneW * .62 });
}

// Cones make the car wobble (stumble); a barrel is a hard crash. Both mirror
// the TrafficDash hazards and are drawn as road-side objects.
function spawnHazard() {
  const lane = Math.floor(Math.random() * LANE_COUNT);
  if (Math.random() < .22) {
    hazards.push({ x: laneX(lane), y: -30 * U, lane, type: 'barrel', r: laneW * .3 });
  } else {
    const count = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      hazards.push({ x: laneX(lane), y: -30 * U - i * 72 * U, lane, type: 'cone', r: laneW * .24 });
    }
  }
}

// Oncoming traffic: spawns below the player and drives up the road, like the
// Godot build's wrong-way cars. Excluded from the wall check (see laneBlocked)
// so it can never fake an impossible row.
function spawnWrongWay() {
  // Never oncoming straight into the player's current lane: pick a different one.
  let lane = Math.floor(Math.random() * (LANE_COUNT - 1));
  if (player && lane >= player.lane) lane++;
  const spec = VEHICLES.car;
  const w = laneW * spec.w, h = laneW * spec.h;
  cars.push({
    x: laneX(lane), y: H + h, w, h, lane, type: 'car', wrongWay: true, dir: -1,
    color: '#ef4444', nearCounted: false, passed: true
  });
  wrongWaySpawns++;
  try { audio?.playError?.(); } catch (e) {}
}

function reset() {
  player = { lane: 1, x: 0, targetX: 0, w: laneW * .48, h: laneW * 1.05, shield: lvl('shield'), tilt: 0 };
  player.x = laneX(1);
  player.targetX = player.x;
  cars = []; pickups = []; slicks = []; particles = []; roadLines = []; hazards = []; skids = []; floats = [];
  score = 0; speed = 280 * vscale; dist = 0; nearMiss = 0; combo = 0; comboTimer = 0; bestCombo = 0; carsPassed = 0;
  fuel = fuelMax();
  timeLeft = TIME_LIMIT;
  throttle = 0; boostTimer = 0; stumbleTimer = 0; invuln = 0;
  driftPoints = 0; driftWindow = 0; drifting = false; driftSkidTimer = 0;
  playerPrevX = 0; playerVX = 0;
  slipstreamTimer = 0; slipstreamActive = false;
  rushHourActive = false; rushHourTimer = 0;
  runCash = 0; distanceCash = 0; nearCash = 0; pickupCash = 0;
  hazardTimer = 4 + Math.random() * 3;
  wrongWaySpawns = 0;
  starTimer = 0;
  scoreCarry = 0;
  spawnTimer = 0;
  slickTimer = 3.5 + Math.random() * 3;
  dustTimer = 0;
  slipTimer = 0;
  gapLane = 1;
  wallFrames = 0;
  spawnRows = 0;
  coinPickups = 0; coinSpawns = 0; slickSpawns = 0;
  endReason = 'crash';
  if (milestones) milestones.reset();
  if (shake) shake.reset();
  flashTimer = 0; driftFloatTimer = 0; driftWindowEarned = 0;
  crashCamTimer = 0; crashCamEarned = 0;
  boostSmokeTimer = 0; driftSmokeTimer = 0;
  lightningTimer = 4 + Math.random() * 8; lightningFlash = 0;
  for (let i = 0; i < 20; i++) {
    roadLines.push({ y: i * (H / 8), x: 0 });
  }
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 900);
}

/* ── Onboarding: a short guided first run, shown once per device ── */
const GUIDE = [
  'Steer by <b>tilting your phone</b>, swiping, the ◀ ▶ buttons, or the arrow keys / A and D.',
  '<b>Ember:</b> there is always a gap. Thread close to traffic for danger-zone bonus points.',
  '<b>Tilt hard or swipe fast</b> to drift for extra cash. Grab ⚡ nitro, 🛡 shields, ⛽ fuel and 🪙 coins.',
  'Dodge 🚧 cones and barrels, then reach the finish before the clock runs out.'
];
function startGuide(){
  let seen = false;
  try { seen = localStorage.getItem('highway-tip-seen') === '1'; } catch (e) {}
  if (seen) return;
  guideOn = true; guideStep = 0;
  showGuideStep();
}
function showGuideStep(){
  const tip = $('tip');
  if (!tip) return;
  tip.innerHTML = GUIDE[guideStep];
  tip.classList.add('show');
  guideTimer = 3.6;
}
function updateGuide(dt){
  if (!guideOn) return;
  guideTimer -= dt;
  if (guideTimer > 0) return;
  guideStep++;
  if (guideStep >= GUIDE.length) {
    guideOn = false;
    $('tip').classList.remove('show');
    try { localStorage.setItem('highway-tip-seen', '1'); } catch (e) {}
  } else {
    showGuideStep();
  }
}

function burst(x, y, color, n) {
  if (reduceMotion) n = Math.ceil(n / 3);
  for (let i = 0; i < n; i++) {
    particles.push({
      x, y, vx: (Math.random() - .5) * 300, vy: (Math.random() - .5) * 300,
      life: 1, color, size: 2 + Math.random() * 4
    });
  }
}

function spawnFloat(x, y, text, color) {
  if (reduceMotion) return;
  floats.push({ x, y, text, color: color || '#fbbf24', life: 1, vy: -78 * U });
}

function moveLane(dir) {
  if (!running || dead || paused) return;
  player.targetX = Math.max(roadL + player.w * 0.55, Math.min(roadR - player.w * 0.55, player.targetX + dir * laneW * 0.9));
  player.lane = Math.max(0, Math.min(LANE_COUNT - 1, Math.round((player.targetX - roadL - laneW / 2) / laneW)));
  player.tilt = dir * .28;
  if (effectiveSpeed() > DRIFT_MIN_SPEED * 0.6) driftWindow = Math.max(driftWindow, 0.45);
  try { audio?.playTap?.(); } catch(e) {}
}

/* ── Engine hum ── */
function engineStart(){
  if (!audio || !audio.getContext) return;
  try {
    const c = audio.getContext();
    if (!c) return;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    g.gain.value = 0;
    osc.connect(g); g.connect(c.destination);
    osc.start();
    engine = { osc, g, c };
  } catch (e) { engine = null; }
}
function engineUpdate(){
  if (!engine) return;
  try {
    const v = audio.getVolume ? audio.getVolume() : 0;
    const speedFrac = Math.min(1, dist / MAX_DIST);
    const th = Math.max(0, throttle);
    const boostPitch = boostTimer > 0 ? 20 : 0;
    engine.osc.frequency.value = 55 + speedFrac * 95 + th * 28 + boostPitch;
    engine.g.gain.value = (0.036 + th * 0.022 + (boostTimer > 0 ? 0.015 : 0)) * v;
  } catch (e) {}
}
function engineStop(){
  if (!engine) return;
  try { engine.osc.stop(); } catch (e) {}
  try { engine.g.disconnect(); } catch (e) {}
  engine = null;
}

function startGame() {
  reset();
  running = true;
  dead = false;
  paused = false;
  $('startScreen').classList.add('hidden');
  $('endScreen').classList.add('hidden');
  $('shopScreen').classList.add('hidden');
  if (!tiltSetupDone && typeof DeviceOrientationEvent !== 'undefined') { tiltSetupDone = true; initTilt(); }
  sys?.beginRun?.();
  rotateMissions();
  if (storyRun && !storyRun.running) storyRun.begin();
  toast(BEATS[0].text);
  startGuide();
  engineStart();
  last = performance.now();
}

function endGame(reason) {
  if (dead) return;
  dead = true;
  running = false;
  paused = false;
  endReason = reason || 'crash';
  engineStop();
  if (shake && !reduceMotion) shake.hit(16);
  haptic(60);
  if (score > best) {
    best = score;
    if (sys) GameSystem.saveScore('highway-dodge', best);
  }
  // Achievements that are judged at run end.
  if (score >= 1000) unlock('hd-first-1000');
  if (dist >= MAX_DIST) unlock('hd-maxspeed');
  // Coins are the shop's currency: distance + near-misses + pickups + drift,
  // the TrafficDash run-earnings model, plus the base score/combo bonus. A
  // completed timed run adds the finish bonus.
  const driftCash = Math.floor(driftPoints * DRIFT_CASH_RATE);
  const finishBonus = endReason === 'win' ? FINISH_BONUS : 0;
  runCash = distanceCash + nearCash + pickupCash + driftCash + finishBonus;
  const earned = Math.max(1, Math.floor(runCash) + Math.floor(score / 20) + nearMiss * 2 + bestCombo * 3);
  garage.coins += earned;
  addMission('score', score);
  saveGarage();
  if (sys) { try { sys.addToLeaderboard('You', score); } catch (e) {} }
  refreshLeaderboard();
  refreshCoins();
  sys?.saveState?.();
  if (!reduceMotion) burst(player.x, H - player.h * 1.5, endReason === 'stall' ? '#22c55e' : endReason === 'win' ? '#fbbf24' : '#ef4444', 30);
  if (endReason === 'win') { try { audio?.playSuccess?.(); } catch (e) {} }
  else { try { audio?.playError?.(); } catch(e) {} }
  toast('Run banked +' + earned + ' coins');
  // Crash cam: slow-mo pause before end screen (deferred in loop)
  if (endReason === 'crash' && !reduceMotion) {
    crashCamEarned = earned;
    crashCamTimer = 0.4;
    return;
  }
  if (storyRun) {
    storyRun.finish((endReason === 'win' || score > 2000) ? 'success' : 'fail', score);
  } else {
    showEnd(earned);
  }
}

function showEnd(earned) {
  if (earned == null) earned = 0;
  $('endTitle').textContent = endReason === 'win' ? 'You Made It!'
    : endReason === 'stall' ? 'Out of Fuel!'
    : score > 5000 ? 'Epic Run!' : score > 2000 ? 'Nice Drive!' : 'Crashed!';
  $('endStats').innerHTML = [
    ['Score', score], ['Near Misses', nearMiss], ['Drift', Math.floor(driftPoints)],
    ['Top Speed', Math.round(60 + dist * .008)], ['Coins', '+' + earned], ['Best', best]
  ].map(s => '<div><b>' + s[1] + '</b><small>' + s[0] + '</small></div>').join('');
  $('endScreen').classList.remove('hidden');
}

function refreshLeaderboard() {
  const el = $('lbLine');
  if (!el || !sys) return;
  let board = [];
  try { board = sys.getLeaderboard() || []; } catch (e) { board = []; }
  if (!board.length) {
    el.innerHTML = '🏁 No runs yet. Hit <b>Start Driving</b> to set your first score.';
    return;
  }
  const pb = Math.floor(board[0].score || 0);
  const runs = board.length;
  const prev = board.slice(1, 3).map(r => Math.floor(r.score || 0).toLocaleString());
  el.innerHTML =
    '<span style="font-size:24px;font-weight:900;color:#fbbf24;letter-spacing:-.5px">🏆 ' + pb.toLocaleString() + '</span>' +
    '<span style="font-size:11px;color:#64748b;display:block;margin-top:1px">Personal best · ' + runs + ' run' + (runs !== 1 ? 's' : '') + (prev.length ? '  ·  Previous: ' + prev.join('  ·  ') : '') + '</span>';
}

function refreshCoins() {
  const c = $('coinHud'); if (c) c.textContent = garage.coins;
  const sc = $('startCoins'); if (sc) sc.textContent = garage.coins;
  const sh = $('shopCoins'); if (sh) sh.textContent = garage.coins;
}

// A shareable/saveable keepsake card so a run can leave the browser (school-PC
// friendly: a plain PNG download, no account and no upload).
function addKeepsakeButton(outcome, runScore) {
  const card = document.querySelector('.sr-modal.show .sr-modal-card');
  if (!card || card.querySelector('.sr-keepsake')) return;
  const btn = document.createElement('button');
  btn.className = 'sr-keepsake';
  btn.type = 'button';
  btn.textContent = '⬇ Save your run';
  btn.addEventListener('click', () => saveKeepsake(outcome, runScore));
  const firstBtn = card.querySelector('.sr-again');
  if (firstBtn) card.insertBefore(btn, firstBtn); else card.appendChild(btn);
}

function saveKeepsake(outcome, runScore) {
  const c = document.createElement('canvas');
  c.width = 900; c.height = 600;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 600);
  grad.addColorStop(0, '#0e1a2e'); grad.addColorStop(1, '#05070d');
  g.fillStyle = grad; g.fillRect(0, 0, 900, 600);

  const roadGrad = g.createLinearGradient(360, 0, 540, 0);
  roadGrad.addColorStop(0, '#1e293b'); roadGrad.addColorStop(.5, '#334155'); roadGrad.addColorStop(1, '#1e293b');
  g.fillStyle = roadGrad; g.fillRect(360, 0, 180, 600);
  g.fillStyle = '#f59e0b'; g.fillRect(356, 0, 4, 600); g.fillRect(540, 0, 4, 600);
  g.fillStyle = 'rgba(255,255,255,.35)';
  for (let y = 10; y < 600; y += 54) { g.fillRect(448, y, 4, 24); }

  g.textAlign = 'center';
  g.fillStyle = '#fbbf24'; g.font = '700 42px system-ui, sans-serif';
  g.fillText('Highway Dodge', 450, 92);
  g.fillStyle = '#94a3b8'; g.font = '700 20px system-ui, sans-serif';
  g.fillText("Ember's run", 450, 126);

  g.fillStyle = '#ffffff'; g.font = '800 108px system-ui, sans-serif';
  g.fillText(String(runScore), 450, 300);
  g.fillStyle = '#94a3b8'; g.font = '700 22px system-ui, sans-serif';
  g.fillText('SCORE', 450, 338);

  g.fillStyle = '#cbd5e1'; g.font = '600 22px system-ui, sans-serif';
  const stats = 'Best ' + best + '     Near misses ' + nearMiss + '     Top speed ' + Math.round(60 + dist * .008);
  g.fillText(stats, 450, 408);

  const line = outcome === 'success' ? 'Cleared the rush.'
    : outcome === 'stall' ? 'The tank ran dry.'
    : 'Crashed out on the highway.';
  g.fillStyle = '#fbbf24'; g.font = '700 26px system-ui, sans-serif';
  g.fillText(line, 450, 466);

  g.fillStyle = '#64748b'; g.font = '600 18px system-ui, sans-serif';
  g.fillText('jvdesignstudio.co.uk', 450, 552);

  c.toBlob(function (blob) {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'highway-dodge-run.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, 'image/png');
}

/* ── Garage UI: cars, upgrades and missions ── */
let activeTab = 'cars';
function setTab(tab){
  activeTab = tab;
  document.querySelectorAll('.shop-tab').forEach(b => b.classList.toggle('on', b.getAttribute('data-tab') === tab));
  ['cars','upgrades','missions'].forEach(t => {
    const el = $('shop' + t.charAt(0).toUpperCase() + t.slice(1));
    if (el) el.classList.toggle('hidden', t !== tab);
  });
}

function buySkin(id) {
  const skin = SKINS.find(s => s.id === id);
  if (!skin || garage.owned.indexOf(id) !== -1 || garage.coins < skin.price) return false;
  garage.coins -= skin.price;
  garage.owned.push(id);
  garage.equipped = id;
  saveGarage();
  renderGarage();
  refreshCoins();
  unlock('hd-buy-car');
  toast('Bought ' + skin.name + '!');
  try { audio?.playSuccess?.(); } catch(e) {}
  haptic(20);
  return true;
}
function equipSkin(id) {
  if (garage.owned.indexOf(id) === -1) return false;
  garage.equipped = id;
  saveGarage();
  renderGarage();
  toast('Driving ' + (SKINS.find(s => s.id === id) || {}).name);
  try { audio?.playTap?.(); } catch(e) {}
  return true;
}
function buyUpgrade(id) {
  const u = UPGRADES.find(x => x.id === id);
  if (!u) return false;
  const level = lvl(id);
  if (level >= u.max) return false;
  const cost = upgradeCost(u);
  if (garage.coins < cost) return false;
  garage.coins -= cost;
  garage.upgrades[id] = level + 1;
  saveGarage();
  renderGarage();
  refreshCoins();
  toast(u.icon + ' ' + u.name + ' Lv' + (level + 1));
  try { audio?.playPowerup?.(); } catch(e) {}
  haptic(20);
  return true;
}

function drawPreview(canvas, skin) {
  const g = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  g.clearRect(0, 0, w, h);
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#111c33'); bg.addColorStop(1, '#0a1120');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.save();
  g.translate(w / 2, h / 2);
  paintCar(g, w * .5, h * .72, { body: skin.body, accent: skin.accent, glass: skin.glass, lights: skin.lights, style: skin.style, rainbow: skin.rainbow });
  g.restore();
}

function renderCars() {
  const grid = $('shopCars');
  if (!grid) return;
  grid.innerHTML = '';
  const equipped = garage.equipped;
  SKINS.forEach(skin => {
    const owned = garage.owned.indexOf(skin.id) !== -1;
    const isEquipped = equipped === skin.id;
    const card = document.createElement('div');
    card.className = 'shop-card' + (isEquipped ? ' equipped' : '');
    card.setAttribute('data-skin', skin.id);
    const cv = document.createElement('canvas');
    cv.className = 'shop-car';
    cv.width = 132; cv.height = 132;
    drawPreview(cv, skin);
    card.appendChild(cv);
    const name = document.createElement('b');
    name.className = 'shop-name';
    name.textContent = skin.name;
    card.appendChild(name);
    const btn = document.createElement('button');
    btn.className = 'shop-buy';
    btn.type = 'button';
    if (isEquipped) { btn.textContent = 'Equipped'; btn.disabled = true; }
    else if (owned) { btn.textContent = 'Equip'; btn.addEventListener('click', () => equipSkin(skin.id)); }
    else {
      btn.textContent = skin.price + ' ⛃';
      if (garage.coins < skin.price) { btn.disabled = true; btn.classList.add('locked'); }
      btn.addEventListener('click', () => buySkin(skin.id));
    }
    card.appendChild(btn);
    grid.appendChild(card);
  });
}

function renderUpgrades() {
  const wrap = $('shopUpgrades');
  if (!wrap) return;
  wrap.innerHTML = '';
  UPGRADES.forEach(u => {
    const level = lvl(u.id);
    const maxed = level >= u.max;
    const cost = upgradeCost(u);
    const row = document.createElement('div');
    row.className = 'up-row';
    row.setAttribute('data-upgrade', u.id);

    const icon = document.createElement('div');
    icon.className = 'up-icon';
    icon.textContent = u.icon;
    row.appendChild(icon);

    const main = document.createElement('div');
    main.className = 'up-main';
    const name = document.createElement('b');
    name.textContent = u.name;
    const desc = document.createElement('span');
    desc.className = 'up-desc';
    desc.textContent = u.desc;
    const pips = document.createElement('span');
    pips.className = 'up-pips';
    for (let i = 0; i < u.max; i++) {
      const pip = document.createElement('i');
      if (i < level) pip.className = 'on';
      pips.appendChild(pip);
    }
    main.appendChild(name);
    main.appendChild(desc);
    main.appendChild(pips);
    row.appendChild(main);

    const btn = document.createElement('button');
    btn.className = 'shop-buy up-buy';
    btn.type = 'button';
    if (maxed) { btn.textContent = 'Max'; btn.disabled = true; }
    else {
      btn.textContent = cost + ' ⛃';
      if (garage.coins < cost) { btn.disabled = true; btn.classList.add('locked'); }
      btn.addEventListener('click', () => buyUpgrade(u.id));
    }
    row.appendChild(btn);
    wrap.appendChild(row);
  });
}

function missionCard(ms, scope) {
  const card = document.createElement('div');
  card.className = 'mission-card' + (ms.claimed ? ' done' : '');
  card.setAttribute('data-mission', scope);
  const pct = Math.max(0, Math.min(100, Math.round((ms.p / ms.goal) * 100)));
  card.innerHTML =
    '<div class="mission-top"><span class="mission-eyebrow">' + (scope === 'weekly' ? '🗓 Weekly' : '⭐ Daily') + '</span>' +
    '<span class="mission-reward">' + (ms.claimed ? '✓ +' + ms.coins + ' coins' : '+' + ms.coins + ' coins') + '</span></div>' +
    '<div class="mission-body"><span class="mission-icon">' + ms.icon + '</span>' +
    '<span class="mission-text">' + ms.text + '</span></div>' +
    '<div class="mission-bar"><i style="width:' + pct + '%"></i></div>' +
    '<div class="mission-meta">' + Math.min(ms.p, ms.goal) + ' / ' + ms.goal + '</div>';
  return card;
}

function renderMissions() {
  const wrap = $('shopMissions');
  if (!wrap) return;
  const m = garage.missions || {};
  wrap.innerHTML = '';
  if (m.daily) wrap.appendChild(missionCard(m.daily, 'daily'));
  if (m.weekly) wrap.appendChild(missionCard(m.weekly, 'weekly'));
}

function renderGarage() {
  renderCars();
  renderUpgrades();
  renderMissions();
  refreshCoins();
  setTab(activeTab);
}

function openShop() {
  paused = true;
  $('shopScreen').classList.remove('hidden');
  rotateMissions();
  renderGarage();
  return true;
}
function closeShop() {
  $('shopScreen').classList.add('hidden');
  if (running && !dead) paused = false;
}

/* ── Drawing helpers ── */
function rr(g, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// One painter for the player and every car in the shop, so a bought car really
// is the car on the road.
function paintCar(g, w, h, o) {
  const hw = w / 2, hh = h / 2;
  const r = Math.min(w * .22, h * .16);
  let body = o.body;
  if (o.rainbow) { const hue = (skyTime * 40) % 360; body = 'hsl(' + hue + ',80%,58%)'; }
  g.fillStyle = 'rgba(0,0,0,.28)';
  rr(g, -hw * 1.06, hh * .72, w * 1.06, h * .3, r * .8); g.fill();

  g.fillStyle = body;
  rr(g, -hw, -hh, w, h, r); g.fill();
  // high-contrast outline so every car reads clearly on the dark road
  g.lineWidth = Math.max(1, w * .05);
  g.strokeStyle = 'rgba(2,6,16,.55)';
  rr(g, -hw, -hh, w, h, r); g.stroke();

  g.fillStyle = 'rgba(255,255,255,.14)';
  rr(g, -hw + w * .07, -hh + h * .05, w * .86, h * .42, r * .7); g.fill();

  g.fillStyle = o.glass || 'rgba(15,23,42,.85)';
  rr(g, -hw + w * .13, -hh + h * .12, w * .74, h * .24, r * .5); g.fill();
  g.fillStyle = o.accent || body;
  rr(g, -hw + w * .15, -hh + h * .4, w * .70, h * .16, r * .4); g.fill();
  g.fillStyle = o.glass || 'rgba(15,23,42,.7)';
  rr(g, -hw + w * .16, -hh + h * .62, w * .68, h * .2, r * .4); g.fill();

  g.fillStyle = '#0b1220';
  rr(g, -hw - w * .03, -hh + h * .18, w * .16, h * .2, 2); g.fill();
  rr(g, hw - w * .13, -hh + h * .18, w * .16, h * .2, 2); g.fill();
  rr(g, -hw - w * .03, hh - h * .4, w * .16, h * .2, 2); g.fill();
  rr(g, hw - w * .13, hh - h * .4, w * .16, h * .2, 2); g.fill();

  g.fillStyle = '#ef4444';
  rr(g, -hw + w * .08, -hh + h * .03, w * .2, h * .06, 2); g.fill();
  rr(g, hw - w * .28, -hh + h * .03, w * .2, h * .06, 2); g.fill();
  const lc = o.lights || '#fde68a';
  g.save();
  g.fillStyle = lc; g.shadowColor = lc; g.shadowBlur = Math.max(4, w * .18);
  rr(g, -hw + w * .08, hh - h * .11, w * .22, h * .08, 2); g.fill();
  rr(g, hw - w * .30, hh - h * .11, w * .22, h * .08, 2); g.fill();
  g.restore();

  if (o.style === 'truck' || o.style === 'bus' || o.style === 'van') {
    g.fillStyle = 'rgba(0,0,0,.14)';
    rr(g, -hw + w * .06, -hh + h * .32, w * .88, h * .34, r * .5); g.fill();
    g.fillStyle = o.accent || '#cbd5e1';
    g.fillRect(-hw + w * .06, -hh + h * .36, w * .88, Math.max(2, h * .03));
  } else if (o.style === 'sport') {
    g.fillStyle = 'rgba(0,0,0,.22)';
    g.fillRect(-w * .03, -hh + h * .06, w * .06, h * .88);
  }
}

function fmtTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function liveRunCash() {
  return distanceCash + nearCash + pickupCash + driftPoints * DRIFT_CASH_RATE;
}

function statusText() {
  const parts = [];
  if (starTimer > 0) parts.push('⭐ 2× ' + starTimer.toFixed(1) + 's');
  if (boostTimer > 0) parts.push('NITRO ' + boostTimer.toFixed(1) + 's');
  if (slipstreamActive) parts.push('💨 SLIPSTREAM');
  if (rushHourActive) parts.push('🚨 RUSH HOUR ×1.5');
  if (player && player.shield > 0) parts.push('SHIELD');
  if (stumbleTimer > 0) parts.push('WOBBLY!');
  return parts.join('   ');
}

function hud() {
  $('scoreHud').textContent = score;
  $('comboHud').textContent = combo;
  $('bestHud').textContent = best;
  const goal = milestones ? milestones.next() : null;
  $('goalHud').textContent = goal == null ? 'Done' : goal;
  $('fuelHud').textContent = Math.max(0, Math.round(fuel));
  $('fuelFill').style.width = Math.max(0, Math.min(1, fuel / fuelMax())) * 100 + '%';
  $('fuelCell').classList.toggle('low', fuel < fuelMax() * .3);
  const coinEl = $('coinHud');
  if (coinEl) coinEl.textContent = garage.coins;
  const tEl = $('timeHud'); if (tEl) tEl.textContent = fmtTime(timeLeft);
  const rEl = $('runHud'); if (rEl) rEl.textContent = Math.floor(liveRunCash());
  const dEl = $('driftHud'); if (dEl) dEl.textContent = drifting ? Math.floor(driftPoints) : '0';
  const sEl = $('statusHud'); if (sEl) sEl.textContent = statusText();
  if (storyRun) storyRun.setScore(score);
}

function detectWall() {
  if (cars.length < 2) return;
  for (let i = 0; i < cars.length; i++) {
    const c = cars[i];
    const ys = [c.y - c.h / 2, c.y, c.y + c.h / 2];
    for (let k = 0; k < ys.length; k++) {
      const y = ys[k];
      if (laneBlocked(0, y) && laneBlocked(1, y) && laneBlocked(2, y)) { wallFrames++; return; }
    }
  }
}
function laneBlocked(lane, y) {
  for (let i = 0; i < cars.length; i++) {
    const c = cars[i];
    if (c.wrongWay) continue;
    if (c.lane === lane && y >= c.y - c.h / 2 && y <= c.y + c.h / 2) return true;
  }
  return false;
}

function update(dt) {
  if (paused) return;

  particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 2; });
  particles = particles.filter(p => p.life > 0);
  floats.forEach(f => { f.y += f.vy * dt; f.life -= dt * 1.5; });
  floats = floats.filter(f => f.life > 0);

  updateGuide(dt);

  if (!running || dead) return;

  const refSpeed = baseSpeed();
  const eff = effectiveSpeed(refSpeed);
  dist += eff * dt;
  speed = eff * vscale;
  scoreCarry += dt * eff * .15;
  distanceCash += eff * dt * .02;
  const gain = Math.floor(scoreCarry);
  if (gain > 0) { const g = Math.floor(gain * (starTimer > 0 ? 2 : 1) * (slipstreamActive ? 1.5 : 1) * (rushHourActive ? 1.5 : 1)); score += g; scoreCarry -= gain; addMission('score', g); }
  if (milestones) milestones.check(score);

  // TrafficDash: a timed run. Reach the finish and bank a bonus.
  timeLeft -= dt;
  if (timeLeft <= 0) { timeLeft = 0; hud(); endGame('win'); return; }

  // Rush Hour: at the 60-second mark a harder wave fires for 15s
  if (!rushHourActive && timeLeft <= RUSH_HOUR_AT && rushHourTimer === 0) {
    rushHourActive = true;
    rushHourTimer = RUSH_HOUR_DURATION;
    toast('🚨 RUSH HOUR! ×1.5 score');
    spawnFloat(W / 2, H * 0.42, '🚨 RUSH HOUR', '#f97316');
    haptic(40);
    try { audio?.playLevelUp?.(); } catch(e) {}
  }
  if (rushHourActive) {
    rushHourTimer = Math.max(0, rushHourTimer - dt);
    if (rushHourTimer === 0) {
      rushHourActive = false;
      toast('Rush hour over');
    }
  }

  // Throttle: W / Up to push on, S / Down to ease off.
  const thUp = keys['w'] || keys['arrowup'];
  const thDown = keys['s'] || keys['arrowdown'];
  if (thUp && !thDown) throttle = Math.min(1, throttle + 3.5 * dt);
  else if (thDown && !thUp) throttle = Math.max(-1, throttle - 3.5 * dt);
  else throttle = throttle > 0 ? Math.max(0, throttle - 3.0 * dt) : Math.min(0, throttle + 3.0 * dt);

  if (boostTimer > 0) boostTimer = Math.max(0, boostTimer - dt);
  if (stumbleTimer > 0) stumbleTimer = Math.max(0, stumbleTimer - dt);

  // Continuous keyboard steering (held key = smooth movement across the road)
  if (!tiltActive) {
    const steerL = keys['arrowleft'] || keys['a'];
    const steerR = keys['arrowright'] || keys['d'];
    if (steerL && !steerR) {
      player.targetX = Math.max(roadL + player.w * 0.55, player.targetX - 3.0 * laneW * dt);
      player.lane = Math.max(0, Math.min(LANE_COUNT - 1, Math.round((player.targetX - roadL - laneW / 2) / laneW)));
    }
    if (steerR && !steerL) {
      player.targetX = Math.min(roadR - player.w * 0.55, player.targetX + 3.0 * laneW * dt);
      player.lane = Math.max(0, Math.min(LANE_COUNT - 1, Math.round((player.targetX - roadL - laneW / 2) / laneW)));
    }
  }
  if (invuln > 0) invuln = Math.max(0, invuln - dt);
  if (starTimer > 0) starTimer = Math.max(0, starTimer - dt);

  // Drift: sliding sideways at speed earns cash, with skid marks behind you.
  if (driftWindow > 0) {
    if (!drifting) { haptic(15); driftWindowEarned = 0; driftFloatTimer = 0.5; } // drift start
    driftWindow -= dt;
    drifting = true;
    const driftGain = (eff / 600) * 12 * dt * vscale;
    driftPoints += driftGain;
    driftWindowEarned += driftGain;
    driftSkidTimer -= dt;
    if (driftSkidTimer <= 0) { driftSkidTimer = .05; skids.push({ x: player.x, y: H - player.h * 1.3, life: 1 }); }
    // Tire smoke burst from rear wheel positions
    if (!reduceMotion) {
      driftSmokeTimer -= dt;
      if (driftSmokeTimer <= 0) {
        driftSmokeTimer = 0.055;
        const wy = H - player.h * 0.65;
        for (let s = -1; s <= 1; s += 2) {
          particles.push({ x: player.x + s * player.w * 0.22, y: wy, vx: s * (18 + Math.random() * 52), vy: -(28 + Math.random() * 68), life: 0.65 + Math.random() * 0.35, color: 'rgba(148,163,184,0.6)', size: (4 + Math.random() * 5) * U });
        }
      }
    }
    // Periodic float showing drift earnings mid-slide
    driftFloatTimer -= dt;
    if (driftFloatTimer <= 0 && driftWindowEarned > 0.5) {
      driftFloatTimer = 0.65;
      spawnFloat(player.x + (Math.random() - 0.5) * 28 * U, H - player.h * 2.1, '+' + Math.floor(driftWindowEarned * DRIFT_CASH_RATE) + ' DRIFT', '#f97316');
      driftWindowEarned = 0;
    }
  } else {
    drifting = false;
    driftWindowEarned = 0;
  }
  skids.forEach(s => { s.y += speed * dt; s.life -= dt * 1.5; });
  skids = skids.filter(s => s.life > 0);

  fuel -= (2.0 + dist * .00003) * dt;
  if (fuel <= 0) { fuel = 0; hud(); endGame('stall'); return; }

  if (combo > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 0; }
  if (combo > bestCombo) bestCombo = combo;
  if (combo >= 10) unlock('hd-combo-10');

  if (slipTimer > 0) slipTimer -= dt;
  const grip = (tiltActive ? 22 : 14 + 3.5 * lvl('grip')) * (slipTimer > 0 ? 0.3 : 1);
  // Tilt steering: map device gamma directly to targetX for free-range movement
  if (tiltActive) {
    const TILT_RANGE = 28;
    const g = Math.max(-TILT_RANGE, Math.min(TILT_RANGE, tiltGamma - tiltBaseline));
    const roadMid = (roadL + roadR) / 2;
    const maxOff = (roadR - roadL) / 2 - player.w * 0.55;
    player.targetX = Math.max(roadL + player.w * 0.55, Math.min(roadR - player.w * 0.55, roadMid + (g / TILT_RANGE) * maxOff));
    player.lane = Math.max(0, Math.min(LANE_COUNT - 1, Math.round((player.targetX - roadL - laneW / 2) / laneW)));
  }
  playerPrevX = player.x;
  player.x += (player.targetX - player.x) * Math.min(1, dt * grip);
  playerVX = (player.x - playerPrevX) / dt;
  // Fast lateral movement triggers drift (tilt hard or quick swipe)
  if (Math.abs(playerVX) > 90 * U && effectiveSpeed() > DRIFT_MIN_SPEED * 0.6) {
    driftWindow = Math.max(driftWindow, 0.28);
  }
  if (tiltActive) {
    player.tilt = Math.max(-0.28, Math.min(0.28, playerVX * 0.00055));
  } else {
    player.tilt *= .92;
  }

  engineUpdate();

  dustTimer -= dt;
  if (dustTimer <= 0 && window.JVDSShowcase && !reduceMotion) {
    JVDSShowcase.dust(particles, player.x, H - player.h * .1, 'rgba(148,163,184,.9)', 2, { drift: 40, spread: 16, up: 40, size: 2 });
    dustTimer = .12;
  }
  // Nitro exhaust: blue particle stream from exhaust pipes during boost
  if (boostTimer > 0 && !reduceMotion) {
    boostSmokeTimer -= dt;
    if (boostSmokeTimer <= 0) {
      boostSmokeTimer = 0.03;
      const ey = H - player.h * 0.62;
      for (let s = -1; s <= 1; s += 2) {
        particles.push({ x: player.x + s * player.w * 0.2, y: ey, vx: (Math.random() - 0.5) * 70, vy: 60 + Math.random() * 100, life: 0.45 + Math.random() * 0.3, color: '#38bdf8', size: (2.2 + Math.random() * 3.5) * U });
      }
    }
  }
  // Decrement visual timers
  if (flashTimer > 0) flashTimer = Math.max(0, flashTimer - dt);
  // Lightning countdown in final stretch
  if (running && timeLeft < 20 && !reduceMotion) {
    lightningTimer -= dt;
    if (lightningTimer <= 0) { lightningFlash = 1; lightningTimer = 2.5 + Math.random() * 4; }
  }
  if (lightningFlash > 0) lightningFlash = Math.max(0, lightningFlash - dt * 9);

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    if (topEdgeClear(laneW * 2.0)) {
      spawnRow();
      const gap = Math.max(.55, .98 - dist * .000025) * (rushHourActive ? 0.75 : 1);
      spawnTimer = gap + Math.random() * gap * .4;
      if (Math.random() < (rushHourActive ? 0.28 : 0.38)) pickups.push(makePickup(gapLane));
      if ((dist > 1200 && Math.random() < .14) || (rushHourActive && Math.random() < .18)) spawnWrongWay();
    } else {
      spawnTimer = 0.06;
    }
  }

  slickTimer -= dt;
  if (slickTimer <= 0) {
    spawnSlick();
    slickTimer = 4 + Math.random() * 4;
  }

  hazardTimer -= dt;
  if (hazardTimer <= 0) {
    spawnHazard();
    hazardTimer = 4 + Math.random() * 3.5;
  }

  const pTop = H - player.h * 1.8;
  const pBot = H - player.h * .5;
  const pHalfW = player.w / 2;
  const magnet = 1 + 0.35 * lvl('magnet');

  for (let i = cars.length - 1; i >= 0; i--) {
    const c = cars[i];
    // Oncoming cars move at their own factor (slower than the road scroll) so a
    // wrong-way encounter is readable, not an instant unavoidable crash.
    c.y += speed * (c.dir < 0 ? .82 : CAR_MUL) * dt;
    if (c.nearStreakTimer > 0) c.nearStreakTimer = Math.max(0, c.nearStreakTimer - dt);

    // Lane-changing AI: slowly drift toward driftTargetX
    if (c.driftTargetX !== null && c.driftTargetX !== undefined) {
      const dx = c.driftTargetX - c.x;
      if (Math.abs(dx) < 2) {
        c.driftTargetX = null;
        c.driftTilt = 0;
      } else {
        const move = Math.sign(dx) * Math.min(Math.abs(dx), c.driftRate * dt);
        c.x += move;
        c.driftTilt = Math.sign(dx) * 0.14;
        c.lane = Math.max(0, Math.min(LANE_COUNT - 1, Math.round((c.x - roadL - laneW / 2) / laneW)));
      }
    } else if (c.driftTilt) {
      c.driftTilt *= 0.88;
      if (Math.abs(c.driftTilt) < 0.01) c.driftTilt = 0;
    }

    if (c.dir < 0 ? c.y < -c.h : c.y > H + c.h) { cars.splice(i, 1); continue; }

    const cTop = c.y - c.h / 2;
    const cBot = c.y + c.h / 2;
    const cHalfW = c.w / 2;

    if (!c.passed && cBot > pBot) { c.passed = true; carsPassed++; addMission('passed', 1); }

    if (Math.abs(player.x - c.x) < pHalfW + cHalfW && pTop < cBot && pBot > cTop) {
      if (player.shield > 0) {
        player.shield -= 1;
        cars.splice(i, 1);
        score += 200;
        burst(c.x, c.y, '#22d3ee', 20);
        toast('Shield saved you!');
        haptic(25);
        try { audio?.playPop?.(); } catch(e) {}
        continue;
      }
      endGame('crash');
      return;
    }

    if (!c.nearCounted && c.y > pTop - 10 && c.y < pBot + 10) {
      const gap = Math.abs(player.x - c.x) - pHalfW - cHalfW;
      if (gap > 0 && gap < laneW * .25) {
        c.nearCounted = true;
        c.nearStreakTimer = 0.45;
        nearMiss++;
        combo++;
        comboTimer = COMBO_WINDOW;
        const bonus = Math.round((50 + combo * 25) * (1 + 0.15 * lvl('combo')) * (starTimer > 0 ? 2 : 1));
        score += bonus;
        nearCash += bonus;
        addMission('nearMiss', 1);
        if (nearMiss >= 50) unlock('hd-near-50');
        toast('Near Miss x' + combo + ' +' + bonus);
        spawnFloat(c.x + (Math.random() - 0.5) * 30 * U, c.y, '+' + bonus + ' ×' + combo, combo >= 5 ? '#f97316' : '#fbbf24');
        burst(player.x, pTop, '#fbbf24', 8);
        haptic(combo >= 5 ? [20, 10, 20] : 12);
        flashTimer = Math.max(flashTimer, 0.22);
        try { audio?.playCombo?.(combo); } catch(e) {}
      } else if (!c.wrongWay && gap >= laneW * .25 && gap < laneW * .55) {
        // Danger zone: threading close without a full near-miss earns continuous score
        const dg = Math.round(dt * eff * 0.055 * (starTimer > 0 ? 2 : 1));
        if (dg > 0) { score += dg; nearCash += dg; }
      }
    }
  }

  // Slipstream: drafting tight behind a car builds a speed boost and score multiplier
  let inDraftZone = false;
  cars.forEach(c => { c.inDraft = false; });
  for (let i = 0; i < cars.length; i++) {
    const c = cars[i];
    if (c.wrongWay) continue;
    const horizClose = Math.abs(player.x - c.x) < laneW * 0.34;
    const justAhead = c.y < pTop - 2 && c.y > pTop - laneW * 1.9;
    if (horizClose && justAhead) { c.inDraft = true; inDraftZone = true; break; }
  }
  if (inDraftZone) {
    slipstreamTimer = Math.min(1.2, slipstreamTimer + dt);
    if (slipstreamTimer > 0.72 && !slipstreamActive) {
      slipstreamActive = true;
      toast('Slipstream! +speed +score');
      spawnFloat(player.x, H - player.h * 2.2, '💨 SLIPSTREAM', '#22d3ee');
      haptic(18);
    }
  } else {
    slipstreamTimer = Math.max(0, slipstreamTimer - dt * 2.8);
    if (slipstreamTimer === 0) slipstreamActive = false;
  }

  detectWall();

  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.y += speed * dt * .8;
    p.bob += dt * 5;
    if (p.y > H + 40) { pickups.splice(i, 1); continue; }
    if (Math.abs(player.x - p.x) < pHalfW + p.r * magnet && Math.abs((pTop + pBot) / 2 - p.y) < player.h / 2 + p.r * magnet) {
      if (p.type === 'shield') {
        player.shield += 1;
        toast('Shield!');
        spawnFloat(p.x, p.y, '🛡 Shield', '#22d3ee');
        score += 100;
      } else if (p.type === 'coin') {
        garage.coins += p.value;
        pickupCash += p.value;
        coinPickups++;
        saveGarage();
        addMission('coins', 1);
        refreshCoins();
        toast('+' + p.value + ' 🪙');
        spawnFloat(p.x, p.y, '+' + p.value + ' 🪙', '#fbbf24');
        score += 20;
      } else if (p.type === 'boost') {
        boostTimer = BOOST_TIME;
        toast('Nitro!');
        spawnFloat(p.x, p.y, '⚡ NITRO', '#38bdf8');
        score += 100;
      } else if (p.type === 'star') {
        starTimer = 6;
        toast('⭐ 2× Score!');
        spawnFloat(p.x, p.y, '⭐ 2×', '#a78bfa');
        score += 100;
      } else {
        fuel = Math.min(fuelMax(), fuel + FUEL_PER_PICKUP);
        addMission('fuel', 1);
        toast('+Fuel');
        spawnFloat(p.x, p.y, '⛽ +Fuel', '#22c55e');
        score += 50;
      }
      burst(p.x, p.y, p.type === 'shield' ? '#22d3ee' : p.type === 'coin' ? '#fbbf24' : p.type === 'boost' ? '#38bdf8' : p.type === 'star' ? '#a78bfa' : '#22c55e', 12);
      haptic(10);
      try { audio?.playPop?.(); } catch(e) {}
      pickups.splice(i, 1);
    }
  }

  for (let i = slicks.length - 1; i >= 0; i--) {
    const s = slicks[i];
    s.y += speed * dt;
    if (s.y > H + 60) { slicks.splice(i, 1); continue; }
    if (slipTimer <= 0 && Math.abs(player.x - s.x) < pHalfW + s.r * .5 && Math.abs((pTop + pBot) / 2 - s.y) < player.h / 2 + 12 * U) {
      slipTimer = 1.1;
      toast('Oil! Hold your line');
      haptic(20);
    }
  }

  // Hazards: a cone sends the car wobbly, a barrel is a crash (shield absorbs).
  for (let i = hazards.length - 1; i >= 0; i--) {
    const hz = hazards[i];
    hz.y += speed * dt;
    if (hz.y > H + 60) { hazards.splice(i, 1); continue; }
    if (Math.abs(player.x - hz.x) < pHalfW + hz.r * .8 && Math.abs((pTop + pBot) / 2 - hz.y) < player.h / 2 + hz.r * .8) {
      hazards.splice(i, 1);
      if (hz.type === 'barrel') {
        if (player.shield > 0 || invuln > 0) {
          player.shield = Math.max(0, player.shield - 1);
          invuln = 1.3;
          toast('Shield saved you!');
          burst(hz.x, hz.y, '#22d3ee', 20);
          haptic(25);
        } else {
          burst(hz.x, hz.y, '#ef4444', 24);
          endGame('crash');
          return;
        }
      } else {
        stumbleTimer = STUMBLE_TIME;
        throttle *= .35;
        combo = 0;
        toast('Cone! Wobbly...');
        burst(hz.x, hz.y, '#f97316', 12);
        haptic(20);
        try { audio?.playError?.(); } catch (e) {}
      }
      continue;
    }
  }

  roadLines.forEach(l => {
    l.y += speed * dt;
    if (l.y > H + 20) l.y -= H * 1.3;
  });

  hud();
}

function hash(i) { const s = Math.sin(i * 127.1) * 43758.5453; return s - Math.floor(s); }

/* ── Scenery ── */
function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0b1730'); g.addColorStop(.55, '#0c1526'); g.addColorStop(1, '#070c16');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#e2e8f0';
  for (let i = 0; i < 70; i++) {
    const sx = hash(i * 3.13) * W;
    const sy = hash(i * 7.71) * H * .34;
    ctx.globalAlpha = .35 + .45 * (0.5 + 0.5 * Math.sin(skyTime * .0016 + i));
    const s = (i % 7 === 0 ? 2.2 : 1.4) * U;
    ctx.fillRect(sx, sy, s, s);
  }
  ctx.globalAlpha = 1;

  const mx = W * .82, my = H * .1, mr = 20 * U;
  const mg = ctx.createRadialGradient(mx, my, mr * .2, mx, my, mr * 3);
  mg.addColorStop(0, 'rgba(226,232,240,.35)'); mg.addColorStop(1, 'rgba(226,232,240,0)');
  ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, mr * 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e7ecf5'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(148,163,184,.35)';
  ctx.beginPath(); ctx.arc(mx - mr * .3, my - mr * .2, mr * .22, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(mx + mr * .25, my + mr * .3, mr * .16, 0, Math.PI * 2); ctx.fill();

  // Dynamic time-of-day overlays
  const rushFrac = rushHourActive ? Math.min(1, rushHourTimer / RUSH_HOUR_DURATION) :
    (running && timeLeft < RUSH_HOUR_AT ? Math.min(1, (RUSH_HOUR_AT - timeLeft) / 18) : 0);
  const stormFrac = running ? Math.max(0, Math.min(1, (30 - timeLeft) / 22)) : 0;
  if (rushFrac > 0) {
    ctx.save();
    ctx.globalAlpha = rushFrac * 0.2;
    const rg = ctx.createLinearGradient(0, 0, 0, H);
    rg.addColorStop(0, 'rgba(239,68,68,0)'); rg.addColorStop(0.45, 'rgba(220,60,30,0.7)'); rg.addColorStop(1, 'rgba(249,115,22,1)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  if (stormFrac > 0) {
    ctx.save();
    ctx.globalAlpha = stormFrac * 0.28;
    ctx.fillStyle = '#0a0e16'; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  const glow = ctx.createLinearGradient(0, H * .12, 0, H * .34);
  glow.addColorStop(0, 'rgba(245,158,11,.12)'); glow.addColorStop(1, 'rgba(245,158,11,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, H * .12, W, H * .22);

  const base = H * .2;
  const bGap = Math.max(34, W / 26);
  const bCount = Math.ceil(W / bGap) + 1;
  for (let i = 0; i < bCount; i++) {
    const bw = bGap * (.6 + hash(i * 1.7) * .5);
    const bx = i * bGap - bGap * .5;
    const bh = (12 + hash(i * 5.3) * 46) * U;
    ctx.fillStyle = hash(i * 2.1) > .5 ? '#0a1526' : '#0c1830';
    ctx.fillRect(bx, base - bh, bw, bh);
    ctx.fillStyle = 'rgba(251,191,36,.5)';
    for (let wy = base - bh + 5 * U; wy < base - 4 * U; wy += 7 * U) {
      for (let wx = bx + 3 * U; wx < bx + bw - 3 * U; wx += 7 * U) {
        if (hash(wx * .7 + wy * 1.3) > .68) ctx.fillRect(wx, wy, 2.4 * U, 3 * U);
      }
    }
  }
  ctx.fillStyle = 'rgba(15,23,42,.9)';
  ctx.fillRect(0, base, W, Math.max(2, 2 * U));
}

function drawVerge() {
  const cycle = Math.max(200, H / 3.2);
  const rows = Math.ceil((H + cycle) / cycle) + 1;
  for (let side = 0; side < 2; side++) {
    const shoulder = side === 0 ? roadL : (W - roadR);
    if (shoulder < 16 * U) continue;
    for (let i = 0; i < rows; i++) {
      const seed = i + side * 131;
      const y = ((i * cycle + dist * .9) % (H + cycle)) - cycle / 2;
      const size = (15 + hash(seed) * 24) * U;
      const centre = side === 0 ? roadL * .5 : roadR + shoulder * .5;
      const cx = centre + (hash(seed + 7) - .5) * shoulder * .7;
      ctx.fillStyle = hash(seed + 3) > .55 ? '#14351f' : '#102a1b';
      ctx.beginPath(); ctx.arc(cx, y, size, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.16)';
      ctx.beginPath(); ctx.arc(cx + size * .22, y + size * .22, size * .78, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawStreetlights() {
  const gap = Math.max(150, H / 3.1);
  const count = Math.ceil((H + gap) / gap) + 1;
  for (let side = 0; side < 2; side++) {
    const px = side === 0 ? roadL - 8 * U : roadR + 8 * U;
    const dir = side === 0 ? 1 : -1;
    for (let i = 0; i < count; i++) {
      const y = ((i * gap + dist * 1.02) % (H + gap)) - gap / 2;
      ctx.fillStyle = '#334155';
      ctx.fillRect(px - 1.4 * U, y, 2.8 * U, 30 * U);
      const armX = px + dir * 12 * U;
      ctx.fillRect(px, y, dir * 12 * U + dir * 2 * U, 2.6 * U);
      ctx.fillStyle = '#fde68a';
      ctx.beginPath(); ctx.arc(armX, y + 2 * U, 3 * U, 0, Math.PI * 2); ctx.fill();
      const pool = ctx.createRadialGradient(armX, y, 1, armX, y, 34 * U);
      pool.addColorStop(0, 'rgba(253,230,138,.22)'); pool.addColorStop(1, 'rgba(253,230,138,0)');
      ctx.fillStyle = pool;
      ctx.beginPath(); ctx.arc(armX, y, 34 * U, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawGuardrail() {
  const gap = Math.max(60, H / 9);
  const count = Math.ceil((H + gap) / gap) + 1;
  for (let side = 0; side < 2; side++) {
    const px = side === 0 ? roadL - 3 * U : roadR + 3 * U;
    for (let i = 0; i < count; i++) {
      const y = ((i * gap + dist * 1.04) % (H + gap)) - gap / 2;
      ctx.fillStyle = 'rgba(148,163,184,.55)';
      ctx.fillRect(px - 1.2 * U, y, 2.4 * U, 12 * U);
    }
    ctx.fillStyle = 'rgba(203,213,225,.5)';
    ctx.fillRect(px - 1.6 * U, 0, 3.2 * U, H);
  }
}

function drawRoad() {
  const glowL = ctx.createLinearGradient(roadL - 26 * U, 0, roadL, 0);
  glowL.addColorStop(0, 'rgba(245,158,11,0)'); glowL.addColorStop(1, 'rgba(245,158,11,.16)');
  ctx.fillStyle = glowL; ctx.fillRect(roadL - 26 * U, 0, 26 * U, H);
  const glowR = ctx.createLinearGradient(roadR, 0, roadR + 26 * U, 0);
  glowR.addColorStop(0, 'rgba(245,158,11,.16)'); glowR.addColorStop(1, 'rgba(245,158,11,0)');
  ctx.fillStyle = glowR; ctx.fillRect(roadR, 0, 26 * U, H);

  const grad = ctx.createLinearGradient(roadL, 0, roadR, 0);
  grad.addColorStop(0, '#1b2537'); grad.addColorStop(.5, '#303c50'); grad.addColorStop(1, '#1b2537');
  ctx.fillStyle = grad;
  ctx.fillRect(roadL, 0, roadR - roadL, H);

  const pGap = Math.max(120, H / 6);
  const pCount = Math.ceil((H + pGap) / pGap) + 1;
  ctx.fillStyle = 'rgba(15,23,42,.28)';
  for (let i = 0; i < pCount; i++) {
    const y = ((i * pGap + dist * .96) % (H + pGap)) - pGap / 2;
    const pw = laneW * (0.5 + hash(i * 4.2) * 1.2);
    const px = roadL + hash(i * 9.1) * (roadR - roadL - pw);
    rr(ctx, px, y, pw, 10 * U, 4 * U); ctx.fill();
  }

  const edge = Math.max(2, laneW * .04);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(roadL - edge, 0, edge, H);
  ctx.fillRect(roadR, 0, edge, H);

  ctx.fillStyle = 'rgba(255,255,255,.4)';
  const dashW = Math.max(2, laneW * .05);
  const dashH = laneW * .4;
  roadLines.forEach(l => {
    for (let i = 1; i < LANE_COUNT; i++) {
      ctx.fillRect(roadL + i * laneW - dashW / 2, l.y, dashW, dashH);
    }
  });
}

function drawRoadProps() {
  const spacing = Math.max(180, H / 3.6);
  const off = (dist * vscale) % spacing;
  const count = Math.ceil((H + spacing) / spacing) + 1;
  for (let i = 0; i < count; i++) {
    const seed = i * 17.3 + Math.floor(dist * vscale / spacing) * 17.3;
    const y = i * spacing + off - spacing;
    const kind = hash(seed);
    const lane = Math.floor(hash(seed + 2.2) * LANE_COUNT);
    const x = laneX(lane);
    if (kind < .34) {
      const cx = x + laneW * .34;
      ctx.fillStyle = '#f97316';
      ctx.beginPath(); ctx.moveTo(cx, y - 6 * U); ctx.lineTo(cx - 5 * U, y + 6 * U); ctx.lineTo(cx + 5 * U, y + 6 * U); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(cx - 3.4 * U, y + 1 * U, 6.8 * U, 2 * U);
    } else if (kind < .62) {
      ctx.fillStyle = 'rgba(8,10,18,.55)';
      ctx.beginPath(); ctx.ellipse(x, y, laneW * .22, 12 * U, 0, 0, Math.PI * 2); ctx.fill();
    } else if (kind < .84) {
      ctx.fillStyle = 'rgba(6,8,14,.7)';
      ctx.beginPath(); ctx.ellipse(x, y, laneW * .12, 8 * U, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(2,4,8,.5)'; ctx.lineWidth = 3 * U;
      ctx.beginPath(); ctx.moveTo(x - 4 * U, y - 24 * U); ctx.lineTo(x - 4 * U, y + 24 * U); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 4 * U, y - 24 * U); ctx.lineTo(x + 4 * U, y + 24 * U); ctx.stroke();
    }
  }
}

function drawSlick(s) {
  const y = s.y + Math.sin(skyTime * .004 + s.x) * 2;
  ctx.save();
  ctx.fillStyle = 'rgba(4,6,14,.62)';
  ctx.beginPath(); ctx.ellipse(s.x, y, s.r * .8, s.r * .34, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(120,90,160,.35)';
  ctx.beginPath(); ctx.ellipse(s.x - s.r * .18, y - s.r * .06, s.r * .42, s.r * .13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(80,200,200,.28)';
  ctx.beginPath(); ctx.ellipse(s.x + s.r * .2, y + s.r * .06, s.r * .3, s.r * .1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawVehicle(c) {
  ctx.save();
  ctx.translate(c.x, c.y);
  if (c.driftTilt) ctx.rotate(c.driftTilt);
  if (c.wrongWay) {
    ctx.save();
    ctx.strokeStyle = 'rgba(239,68,68,.9)';
    ctx.lineWidth = 3 * U;
    ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 12 * U;
    rr(ctx, -c.w / 2, -c.h / 2, c.w, c.h, 6 * U); ctx.stroke();
    ctx.restore();
  }
  const lc = '#fde68a';
  const wash = ctx.createLinearGradient(0, c.h / 2, 0, c.h / 2 + 60 * U);
  wash.addColorStop(0, 'rgba(253,230,138,.2)'); wash.addColorStop(1, 'rgba(253,230,138,0)');
  ctx.fillStyle = wash;
  ctx.beginPath(); ctx.moveTo(-c.w * .5, c.h / 2); ctx.lineTo(c.w * .5, c.h / 2); ctx.lineTo(c.w * 1.1, c.h / 2 + 60 * U); ctx.lineTo(-c.w * 1.1, c.h / 2 + 60 * U); ctx.closePath(); ctx.fill();

  if (c.nearStreakTimer > 0 && !reduceMotion) {
    // Near-miss streak: brief cyan halo + side streaks when player just threaded this car
    const st = c.nearStreakTimer / 0.45;
    ctx.save();
    ctx.globalAlpha = st * 0.72;
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 3 * U;
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 16 * U;
    rr(ctx, -c.w / 2 - 4 * U, -c.h / 2 - 4 * U, c.w + 8 * U, c.h + 8 * U, 6 * U);
    ctx.stroke();
    // Side streak lines extending outward
    const sLen = (18 + st * 32) * U;
    ctx.lineWidth = 2 * U;
    ctx.beginPath(); ctx.moveTo(-c.w * 0.6, 0); ctx.lineTo(-c.w * 0.6 - sLen, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c.w * 0.6, 0); ctx.lineTo(c.w * 0.6 + sLen, 0); ctx.stroke();
    ctx.restore();
  }

  if (c.inDraft) {
    // Slipstream glow: cyan speed-wash streaming behind the car
    const sw = ctx.createLinearGradient(0, c.h / 2, 0, c.h / 2 + 80 * U);
    sw.addColorStop(0, 'rgba(34,211,238,.55)'); sw.addColorStop(1, 'rgba(34,211,238,0)');
    ctx.fillStyle = sw;
    ctx.beginPath(); ctx.moveTo(-c.w * .55, c.h / 2); ctx.lineTo(c.w * .55, c.h / 2); ctx.lineTo(c.w * 1.3, c.h / 2 + 80 * U); ctx.lineTo(-c.w * 1.3, c.h / 2 + 80 * U); ctx.closePath(); ctx.fill();
    // Speed lines
    ctx.save();
    ctx.strokeStyle = 'rgba(34,211,238,.7)'; ctx.lineWidth = 1.5 * U;
    const lineOff = (dist * 0.08) % (14 * U);
    for (let li = 0; li < 5; li++) {
      const lx = -c.w * 0.4 + li * c.w * 0.2;
      const ly = c.h / 2 + lineOff + li * 3 * U;
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx, ly + 18 * U); ctx.stroke();
    }
    ctx.restore();
  }

  if (c.isTruck || c.type === 'bus') {
    const hw = c.w / 2, hh = c.h / 2;
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    rr(ctx, -hw * 1.04, hh * .7, c.w * 1.04, c.h * .28, 4 * U); ctx.fill();
    ctx.fillStyle = c.color;
    rr(ctx, -hw, -hh, c.w, c.h, Math.min(c.w, c.h) * .12); ctx.fill();
    ctx.lineWidth = Math.max(1, c.w * .05); ctx.strokeStyle = 'rgba(2,6,16,.55)';
    rr(ctx, -hw, -hh, c.w, c.h, Math.min(c.w, c.h) * .12); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    rr(ctx, -hw + c.w * .05, -hh + c.h * .16, c.w * .9, c.h * .3, 3 * U); ctx.fill();
    ctx.fillStyle = 'rgba(15,23,42,.85)';
    rr(ctx, -hw + c.w * .1, -hh + c.h * .06, c.w * .8, c.h * .12, 3 * U); ctx.fill();
    ctx.fillStyle = 'rgba(15,23,42,.7)';
    rr(ctx, -hw + c.w * .12, -hh + c.h * .56, c.w * .76, c.h * .3, 3 * U); ctx.fill();
    ctx.fillStyle = '#0b1220';
    rr(ctx, -hw - c.w * .03, hh - c.h * .22, c.w * .16, c.h * .18, 2 * U); ctx.fill();
    rr(ctx, hw - c.w * .13, hh - c.h * .22, c.w * .16, c.h * .18, 2 * U); ctx.fill();
    ctx.save();
    ctx.fillStyle = lc; ctx.shadowColor = lc; ctx.shadowBlur = 8 * U;
    ctx.fillRect(-hw + c.w * .06, hh - c.h * .07, c.w * .24, c.h * .05);
    ctx.fillRect(hw - c.w * .30, hh - c.h * .07, c.w * .24, c.h * .05);
    ctx.restore();
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-hw + c.w * .06, -hh + c.h * .02, c.w * .22, c.h * .04);
    ctx.fillRect(hw - c.w * .28, -hh + c.h * .02, c.w * .22, c.h * .04);
    ctx.restore();
    return;
  }

  paintCar(ctx, c.w, c.h, { body: c.color, accent: 'rgba(255,255,255,.14)', glass: 'rgba(15,23,42,.8)', lights: lc, style: c.type === 'sport' ? 'sport' : 'car' });
  ctx.restore();
}

function drawPlayer() {
  const py = H - player.h * 1.3;
  const skin = currentSkin();

  // Motion trail - cyan smear stretching upward at high speed
  if (!reduceMotion) {
    const eff = effectiveSpeed();
    const bt = Math.max(0, Math.min(1, (eff - 380) / 260));
    if (bt > 0) {
      const trailH = player.h * 1.8 * bt;
      const tg = ctx.createLinearGradient(player.x, py - player.h * 0.5, player.x, py - player.h * 0.5 - trailH);
      const col = slipstreamActive ? 'rgba(34,211,238,' : 'rgba(147,197,253,';
      tg.addColorStop(0, col + (bt * 0.32) + ')');
      tg.addColorStop(1, col + '0)');
      ctx.fillStyle = tg;
      ctx.beginPath();
      ctx.ellipse(player.x, py - player.h * 0.5 - trailH * 0.5, player.w * 0.38, trailH * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.save();
  ctx.translate(player.x, py);
  ctx.rotate(player.tilt + (slipTimer > 0 ? Math.sin(skyTime * .03) * .08 : 0));

  if (player.shield > 0) {
    ctx.strokeStyle = 'rgba(34,211,238,.6)';
    ctx.lineWidth = 3 * U;
    ctx.beginPath();
    ctx.arc(0, 0, player.w * .8, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.globalAlpha = .32;
  ctx.fillStyle = skin.rainbow ? '#22d3ee' : skin.body;
  ctx.beginPath();
  ctx.ellipse(0, 0, player.w * .85, player.h * .85, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  paintCar(ctx, player.w, player.h, { body: skin.body, accent: skin.accent, glass: skin.glass, lights: skin.lights, style: skin.style, rainbow: skin.rainbow });

  const hw = player.w / 2, hh = player.h / 2;
  const nitro = boostTimer > 0;
  const flame = ((nitro ? 18 : 8) + Math.sin(dist * .05) * 5) * U;
  ctx.fillStyle = nitro ? 'rgba(56,189,248,.85)' : 'rgba(251,146,60,.7)';
  if (nitro) { ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 18 * U; }
  ctx.beginPath();
  ctx.moveTo(-hw + 8 * U, hh); ctx.lineTo(-hw + 4 * U, hh + flame); ctx.lineTo(-hw + 16 * U, hh); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(hw - 8 * U, hh); ctx.lineTo(hw - 4 * U, hh + flame); ctx.lineTo(hw - 16 * U, hh); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;

  if (stumbleTimer > 0) {
    ctx.fillStyle = 'rgba(249,115,22,.85)';
    ctx.font = 'bold ' + (20 * U) + 'px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, -hh - 6 * U);
  }

  ctx.restore();
}

function drawPickup(p) {
  ctx.save();
  ctx.translate(p.x, p.y + Math.sin(p.bob) * 4 * U);
  const col = p.type === 'shield' ? '#22d3ee' : p.type === 'coin' ? '#fbbf24' : p.type === 'boost' ? '#38bdf8' : '#22c55e';
  ctx.fillStyle = col;
  ctx.shadowColor = col;
  ctx.shadowBlur = 14 * U;
  ctx.beginPath();
  ctx.arc(0, 0, 16 * U, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold ' + (16 * U) + 'px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(p.type === 'shield' ? '🛡' : p.type === 'coin' ? '🪙' : p.type === 'boost' ? '⚡' : p.type === 'star' ? '⭐' : '⛽', 0, 1);
  ctx.restore();
}

function drawSpeedEffect() {
  const eff = effectiveSpeed();
  const t = Math.max(0, Math.min(1, (eff - 320) / 300)); // 0 at slow, 1 at top
  if (t <= 0) return;

  // Road-surface speed streaks
  const count = reduceMotion ? 8 : 24;
  ctx.save();
  for (let i = 0; i < count; i++) {
    const seed = i * 4.37 + Math.floor(dist * 0.05) * 4.37;
    const x = roadL + hash(seed) * (roadR - roadL);
    const y = ((hash(seed + 1.1) + dist * 0.0058) % 1) * H;
    const len = (12 + t * 58 + hash(seed + 2.2) * 28) * U;
    ctx.globalAlpha = t * (0.18 + hash(seed + 3.3) * 0.26);
    ctx.strokeStyle = hash(seed + 4.4) > 0.55 ? 'rgba(226,232,240,.95)' : 'rgba(147,197,253,.95)';
    ctx.lineWidth = (0.7 + hash(seed + 5.5) * 1.5) * U;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - U, y + len); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Edge vignette - screen tunnels inward at speed
  if (t > 0.12) {
    const vt = (t - 0.12) / 0.88;
    const vg = ctx.createRadialGradient(W / 2, H * 0.52, H * 0.12, W / 2, H * 0.52, H * 0.8);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(0.65, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,4,16,' + (vt * 0.65) + ')');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }
  // Radial warp lines from vanishing point at high speed
  if (t > 0.28 && !reduceMotion) {
    const vx = W / 2, vy = H * 0.22;
    const lc = Math.floor(6 + t * 14);
    ctx.save();
    for (let i = 0; i < lc; i++) {
      const angle = (i / lc) * Math.PI * 2;
      const base = H * (0.2 + t * 0.16);
      const len = base * (0.65 + hash(i * 3.1 + Math.floor(dist * 0.018)) * 0.7);
      const cos = Math.cos(angle), sin = Math.sin(angle);
      ctx.globalAlpha = t * (0.07 + hash(i * 7.3) * 0.09);
      ctx.strokeStyle = boostTimer > 0 ? 'rgba(56,189,248,0.9)' : 'rgba(226,232,240,0.9)';
      ctx.lineWidth = (0.5 + t * 1.1) * U;
      ctx.beginPath();
      ctx.moveTo(vx + cos * len * 0.82, vy + sin * len * 0.82);
      ctx.lineTo(vx + cos * len, vy + sin * len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

function drawComboMeter() {
  if (combo <= 0) return;
  const barW = laneW * 3;
  const x = roadL, y = H * .07;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(251,191,36,.95)';
  ctx.font = 'bold ' + (17 * U) + 'px system-ui';
  ctx.fillText('NEAR MISS x' + combo, W / 2, y - 6 * U);
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  ctx.fillRect(x, y, barW, 6 * U);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(x, y, barW * Math.max(0, comboTimer / COMBO_WINDOW), 6 * U);
  ctx.restore();
}

function drawSkid(s) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, s.life) * .5;
  ctx.fillStyle = '#020409';
  rr(ctx, s.x - 3 * U, s.y, 6 * U, 20 * U, 3 * U); ctx.fill();
  ctx.restore();
}

function drawHazard(hz) {
  ctx.save();
  ctx.translate(hz.x, hz.y);
  if (hz.type === 'barrel') {
    ctx.fillStyle = '#b45309';
    rr(ctx, -hz.r * .8, -hz.r, hz.r * 1.6, hz.r * 2, hz.r * .3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    rr(ctx, -hz.r * .8, -hz.r * .2, hz.r * 1.6, hz.r * .4, hz.r * .15); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    rr(ctx, -hz.r * .8, -hz.r, hz.r * 1.6, hz.r * .35, hz.r * .2); ctx.fill();
  } else {
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(0, -hz.r);
    ctx.lineTo(-hz.r * .9, hz.r);
    ctx.lineTo(hz.r * .9, hz.r);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(-hz.r * .55, hz.r * .1, hz.r * 1.1, hz.r * .34);
  }
  ctx.restore();
}

function drawTiltHorizon() {
  if (!tiltActive || reduceMotion) return;
  const TILT_RANGE = 28;
  const g = Math.max(-TILT_RANGE, Math.min(TILT_RANGE, tiltGamma - tiltBaseline));
  if (Math.abs(g) < 0.5) return;
  // Subtle canvas roll: rotate around the road's vanishing point (top-center)
  const t = g / TILT_RANGE;        // -1 … +1
  const rollRad = t * 0.055;       // max ~3° tilt
  const vx = W / 2, vy = H * 0.25; // vanishing point anchor
  ctx.save();
  ctx.translate(vx, vy);
  ctx.rotate(rollRad);
  ctx.translate(-vx, -vy);
  // Horizon tilt line: a coloured band that shifts with lean
  const hY = H * 0.25 + t * H * 0.04;
  const hg = ctx.createLinearGradient(0, hY - 12, 0, hY + 14);
  hg.addColorStop(0, 'rgba(56,189,248,0)');
  hg.addColorStop(0.4, 'rgba(56,189,248,' + (Math.abs(t) * 0.12) + ')');
  hg.addColorStop(1, 'rgba(56,189,248,0)');
  ctx.fillStyle = hg;
  ctx.fillRect(0, hY - 12, W, 26);
  ctx.restore();
}

function drawNearMissFlash() {
  if (flashTimer <= 0 || reduceMotion) return;
  const alpha = (flashTimer / 0.22) * 0.46;
  const fg = ctx.createRadialGradient(W / 2, H / 2, H * 0.08, W / 2, H / 2, H * 0.74);
  fg.addColorStop(0, 'rgba(251,191,36,0)');
  fg.addColorStop(0.52, 'rgba(251,191,36,0)');
  fg.addColorStop(1, 'rgba(251,191,36,' + alpha.toFixed(3) + ')');
  ctx.fillStyle = fg;
  ctx.fillRect(0, 0, W, H);
}

function drawNitroOverlay() {
  if (boostTimer <= 0 || reduceMotion) return;
  const pulse = 0.55 + 0.45 * Math.sin(skyTime * 0.013);
  const alpha = Math.min(1, boostTimer / BOOST_TIME) * pulse * 0.24;
  const ng = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.14, W / 2, H * 0.5, H * 0.76);
  ng.addColorStop(0, 'rgba(56,189,248,0)');
  ng.addColorStop(0.48, 'rgba(56,189,248,0)');
  ng.addColorStop(1, 'rgba(56,189,248,' + alpha.toFixed(3) + ')');
  ctx.fillStyle = ng;
  ctx.fillRect(0, 0, W, H);
}

function draw() {
  if (!W || !H) return;
  ctx.clearRect(0, 0, W, H);

  ctx.save();
  if (shake && !reduceMotion) shake.apply(ctx, dpr);

  drawSky();
  drawTiltHorizon();
  drawVerge();
  drawStreetlights();
  drawGuardrail();
  drawRoad();
  drawRoadProps();
  skids.forEach(drawSkid);
  slicks.forEach(drawSlick);
  hazards.forEach(drawHazard);
  pickups.forEach(drawPickup);
  cars.forEach(drawVehicle);
  drawPlayer();
  drawSpeedEffect();
  drawNearMissFlash();
  drawNitroOverlay();
  drawComboMeter();

  particles.forEach(p => {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  floats.forEach(f => {
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.fillStyle = f.color;
    ctx.font = 'bold ' + Math.round(13 * U) + 'px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(f.text, f.x, f.y);
  });
  ctx.globalAlpha = 1;

  if ((dist > 3000 || (running && timeLeft < 30)) && !reduceMotion) {
    const rainAlpha = Math.min(0.26, Math.max((dist - 3000) / 10000, running ? (30 - timeLeft) / 120 : 0));
    ctx.save();
    ctx.globalAlpha = rainAlpha;
    ctx.strokeStyle = 'rgba(147,197,253,.8)';
    ctx.lineWidth = 1;
    const rainSeed = Math.floor(dist * 0.05);
    for (let i = 0; i < 44; i++) {
      const rx = ((hash(i * 5.1 + rainSeed) * W * 1.5 - W * .25) + dist * .6) % W;
      const ry = (hash(i * 2.7 + rainSeed * .3) * H + (dist * 2.2) % 80) % H;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 3, ry + 13);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Lightning flash in final countdown
  if (lightningFlash > 0) {
    ctx.fillStyle = 'rgba(210,225,255,' + (lightningFlash * 0.38).toFixed(3) + ')';
    ctx.fillRect(0, 0, W, H);
  }

  if (!running && !dead) {
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.fillRect(0, 0, W, H);
  }

  ctx.restore();
  if (shake && !reduceMotion) shake.decay();
}

function loop(now) {
  const rawDt = Math.min(.05, (now - last) / 1000);
  last = now;
  skyTime = now;
  fit();
  if (crashCamTimer > 0) {
    crashCamTimer = Math.max(0, crashCamTimer - rawDt);
    if (crashCamTimer === 0) {
      if (storyRun) storyRun.finish(score > 2000 ? 'success' : 'fail', score);
      else showEnd(crashCamEarned);
    }
  }
  const dt = crashCamTimer > 0 ? rawDt * 0.15 : rawDt;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

/* ── Tilt steering (DeviceOrientation) ── */
function initTilt() {
  const attach = function() {
    window.addEventListener('deviceorientation', function(e) {
      if (e.gamma == null) return;
      if (!tiltActive) {
        tiltActive = true;
        tiltBaseline = e.gamma;
        toast('Tilt to steer!');
        const tb = $('tiltBtn');
        if (tb) { tb.textContent = '🔄 Recal'; }
      }
      tiltGamma = e.gamma;
    });
  };
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(function(r) { if (r === 'granted') attach(); }).catch(function(){});
  } else if (typeof DeviceOrientationEvent !== 'undefined') {
    attach();
  }
}
window.__initTilt = function() { if (!tiltSetupDone) { tiltSetupDone = true; initTilt(); } else if (tiltActive) { tiltBaseline = tiltGamma; toast('Tilt calibrated!'); } };

C.addEventListener('pointerdown', e => {
  if (!running && !dead) { startGame(); return; }
  swipeStartX = e.clientX;
  swipeStartY = e.clientY;
  swiping = true;
});
C.addEventListener('pointermove', e => {
  if (!swiping || !running || dead || tiltActive) return;
  const dx = e.clientX - swipeStartX;
  if (Math.abs(dx) > 3) {
    const cssW = C.getBoundingClientRect().width || 1;
    const roadPxPerCss = (roadR - roadL) / cssW;
    player.targetX = Math.max(roadL + player.w * 0.55, Math.min(roadR - player.w * 0.55, player.targetX + dx * roadPxPerCss * 1.5));
    player.lane = Math.max(0, Math.min(LANE_COUNT - 1, Math.round((player.targetX - roadL - laneW / 2) / laneW)));
    player.tilt = Math.max(-0.28, Math.min(0.28, player.tilt + Math.sign(dx) * 0.05));
    swipeStartX = e.clientX;
  }
});
C.addEventListener('pointerup', e => {
  if (swiping && running && !dead) {
    const dx = e.clientX - swipeStartX;
    const dy = e.clientY - swipeStartY;
    // Pure tap (no drag): recalibrate tilt if active, otherwise lane-steer.
    if (Math.abs(dx) < 18 && Math.abs(dy) < 18) {
      if (tiltActive) {
        tiltBaseline = tiltGamma;
        toast('Tilt calibrated!');
      } else {
        const rect = C.getBoundingClientRect();
        const relX = e.clientX - rect.left;
        if (relX < rect.width * .38) moveLane(-1);
        else if (relX > rect.width * .62) moveLane(1);
      }
    }
  }
  swiping = false;
});

document.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') moveLane(-1);
  if (e.code === 'ArrowRight' || e.code === 'KeyD') moveLane(1);
  if (e.code === 'Space') { if (!running) startGame(); }
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','KeyW','KeyS'].includes(e.code)) e.preventDefault();
});
document.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

$('playBtn').onclick = startGame;
$('againBtn').onclick = startGame;
$('shopBtn').onclick = openShop;
if ($('startShopBtn')) $('startShopBtn').onclick = openShop;
if ($('shopCloseBtn')) $('shopCloseBtn').onclick = closeShop;
if ($('endShopBtn')) $('endShopBtn').onclick = openShop;
document.querySelectorAll('.shop-tab').forEach(b => b.addEventListener('click', () => setTab(b.getAttribute('data-tab'))));
if (window.JVDSEngine && JVDSEngine.runtime && JVDSEngine.runtime.touch) {
  JVDSEngine.runtime.touch({ buttons: [{ label: '◀', code: 'ArrowLeft' }, { label: '▶', code: 'ArrowRight' }] });
}
$('soundBtn').onclick = function() {
  const on = localStorage.getItem('soundEnabled') !== 'false';
  localStorage.setItem('soundEnabled', on ? 'false' : 'true');
  if (audio) audio.setMasterVolume(on ? 0 : .5);
  $('soundBtn').textContent = on ? '🔇' : '🔊';
};

// Auto-pause when the tab is hidden, so a run is never lost to a context switch.
if (window.GameUI && GameUI.autoPause) {
  GameUI.autoPause({
    pause: function () { if (running && !dead) paused = true; return true; },
    resume: function () { if (running && !dead && $('shopScreen').classList.contains('hidden')) paused = false; }
  });
}

rotateMissions();
reset();
fit();
$('bestHud').textContent = best;
refreshCoins();
refreshLeaderboard();
requestAnimationFrame(loop);
})();
