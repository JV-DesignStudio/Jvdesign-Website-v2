(function () {
  'use strict';

  var STORAGE_KEY = 'jvds_game_pips-cozy-cove';

  var FISH = [
    { id: 'bluegill', name: 'Bluegill', icon: '\uD83D\uDC20', rarity: 'Common', area: 'cove', value: 4, minW: 0.2, maxW: 1.2, strength: 0.65, minDepth: 0, fact: 'Bluegill dads build nests and guard the eggs.' },
    { id: 'carp', name: 'Common Carp', icon: '\uD83D\uDC1F', rarity: 'Common', area: 'cove', value: 5, minW: 0.4, maxW: 6.5, strength: 0.8, minDepth: 0, fact: 'Carp can grow as long as your arm and live for many years.' },
    { id: 'crab', name: 'Shore Crab', icon: '\uD83E\uDD80', rarity: 'Uncommon', area: 'cove', value: 9, minW: 0.3, maxW: 2.4, strength: 0.9, minDepth: 1, fact: 'Crabs walk sideways because their legs bend that way.' },
    { id: 'puffer', name: 'Pufferfish', icon: '\uD83D\uDC21', rarity: 'Uncommon', area: 'cove', value: 12, minW: 0.5, maxW: 3.2, strength: 1.0, minDepth: 1, fact: 'Pufferfish puff up with water when they feel scared.' },
    { id: 'squid', name: 'Squid', icon: '\uD83E\uDD91', rarity: 'Rare', area: 'cove', value: 22, minW: 0.8, maxW: 5.5, strength: 1.15, minDepth: 2, fact: 'Squid can change colour in a blink to hide or to talk.' },
    { id: 'lobster', name: 'Lobster', icon: '\uD83E\uDD9E', rarity: 'Rare', area: 'cove', value: 26, minW: 0.7, maxW: 4.5, strength: 1.2, minDepth: 2, fact: 'Lobsters taste with their legs.' },
    { id: 'starfish', name: 'Rare Starfish', icon: '\u2B50', rarity: 'Legendary', area: 'cove', value: 55, minW: 0.2, maxW: 1.8, strength: 1.35, minDepth: 2, fact: 'A starfish can grow a new arm if it loses one.' },
    { id: 'koi', name: 'Golden Koi', icon: '\u2728', rarity: 'Mythic', area: 'cove', value: 80, minW: 1.0, maxW: 7.0, strength: 1.5, minDepth: 2, fact: 'Koi can live for many years and learn to eat from a hand.' },
    { id: 'boot', name: 'Old Boot', icon: '\uD83E\uDD7E', rarity: 'Junk', area: 'cove', value: 1, minW: 0.5, maxW: 1.8, strength: 0.7, minDepth: 0, fact: 'Someone lost a boot in this cove a long time ago.' },
    { id: 'shrimp', name: 'Rockpool Shrimp', icon: '\uD83E\uDD90', rarity: 'Common', area: 'rockpool', value: 6, minW: 0.05, maxW: 0.35, strength: 0.55, minDepth: 0, fact: 'Rockpool shrimp hide under stones when the tide goes out.' },
    { id: 'hermit', name: 'Hermit Crab', icon: '\uD83D\uDC1A', rarity: 'Uncommon', area: 'rockpool', value: 11, minW: 0.1, maxW: 0.7, strength: 0.8, minDepth: 0, fact: 'Hermit crabs borrow empty shells and move house as they grow.' },
    { id: 'octopus', name: 'Deep Octopus', icon: '\uD83D\uDC19', rarity: 'Legendary', area: 'pier', value: 60, minW: 1.0, maxW: 8.0, strength: 1.45, minDepth: 2, fact: 'An octopus can squeeze through a gap the size of its eye.' },
    { id: 'rainfin', name: 'Rainfin', icon: '\uD83C\uDF27\uFE0F', rarity: 'Uncommon', area: 'cove', value: 14, minW: 0.3, maxW: 1.8, strength: 0.9, minDepth: 0, needs: { weather: ['rainy'] }, fact: 'Rainfin rise to the surface when raindrops dance on the water.' },
    { id: 'moonjelly', name: 'Moon Jelly', icon: '\uD83C\uDF19', rarity: 'Rare', area: 'cove', value: 30, minW: 0.2, maxW: 1.6, strength: 1.0, minDepth: 1, needs: { time: ['dusk', 'night'] }, fact: 'Moon jellies glow softly when the cove turns dark.' },
    { id: 'dawnkoi', name: 'Dawn Koi', icon: '\uD83C\uDF05', rarity: 'Legendary', area: 'pier', value: 65, minW: 1.0, maxW: 6.0, strength: 1.4, minDepth: 1, needs: { time: ['dawn'] }, fact: 'Dawn Koi only rise while the sun is still low and the water is calm.' }
  ];

  var VISITOR = {
    id: 'moonfin', name: 'Moonfin the Visitor', icon: '\uD83C\uDF1A', rarity: 'Visitor',
    value: 150, minW: 6.0, maxW: 14.0, strength: 2.0,
    fact: 'Moonfin only visits when the cove is still and the water is deep.'
  };

  var RARITY_BASE = { Common: 100, Uncommon: 55, Rare: 22, Legendary: 7, Mythic: 2, Junk: 26 };

  var BAITS = {
    worm: {
      id: 'worm', name: 'Worm', icon: '\uD83D\uDC1B', hint: 'Bites often, mostly common fish.',
      waitMin: 1800, waitMax: 5200,
      mul: { Common: 1.2, Uncommon: 1, Rare: 0.9, Legendary: 0.7, Mythic: 0.5, Junk: 1.2 }
    },
    corn: {
      id: 'corn', name: 'Sweetcorn', icon: '\uD83C\uDF3D', hint: 'Lots of bites, smaller fish.',
      waitMin: 1400, waitMax: 4200,
      mul: { Common: 1.5, Uncommon: 1.1, Rare: 0.6, Legendary: 0.4, Mythic: 0.2, Junk: 0.6 }
    },
    lure: {
      id: 'lure', name: 'Sparkle lure', icon: '\u2728', hint: 'Fewer bites, better fish.',
      waitMin: 2400, waitMax: 6400,
      mul: { Common: 0.7, Uncommon: 1, Rare: 1.6, Legendary: 1.8, Mythic: 2, Junk: 0.15 }
    }
  };

  BAITS.crumb = {
    id: 'crumb', name: 'Crab Crumb', icon: '\uD83C\uDF5E', hint: 'Rockpool fish love this crumbly mix.',
    waitMin: 1600, waitMax: 4400, crafted: true, areaBoost: 'rockpool',
    mul: { Common: 1.1, Uncommon: 1.4, Rare: 1, Legendary: 0.6, Mythic: 0.4, Junk: 0.5 }
  };
  BAITS.glow = {
    id: 'glow', name: 'Deep Glow', icon: '\uD83E\uDE94', hint: 'A soft glow draws rare deep fish.',
    waitMin: 2200, waitMax: 5600, crafted: true, deepBoost: true,
    mul: { Common: 0.6, Uncommon: 0.9, Rare: 1.8, Legendary: 2, Mythic: 2.2, Junk: 0.2 }
  };
  BAITS.trophy = {
    id: 'trophy', name: 'Trophy Mix', icon: '\uD83C\uDFC6', hint: 'Big fish cannot resist this one.',
    waitMin: 2600, waitMax: 6200, crafted: true, bigFish: true,
    mul: { Common: 0.5, Uncommon: 0.8, Rare: 1.2, Legendary: 2, Mythic: 2.6, Junk: 0.15 }
  };

  var BAIT_ORDER = ['worm', 'corn', 'lure'];
  var CRAFT_ORDER = ['crumb', 'glow', 'trophy'];
  var CRAFT_RECIPES = [
    { id: 'crumb', name: 'Crab Crumb', icon: '\uD83C\uDF5E', cost: 5, charges: 5, need: 3, requires: 'Catch 3 fish' },
    { id: 'glow', name: 'Deep Glow', icon: '\uD83E\uDE94', cost: 8, charges: 3, need: 5, requires: 'Catch 5 fish' },
    { id: 'trophy', name: 'Trophy Mix', icon: '\uD83C\uDFC6', cost: 12, charges: 2, need: 1, requires: 'Meet Moonfin or catch a legendary' }
  ];
  var STORY_STEPS = [
    { id: 'charm', title: 'Find the star charm', hint: 'Catch any fish so Stardust can see the cove.', metric: 'any', reward: 8 },
    { id: 'lantern', title: 'Find the lantern', hint: 'Land a fish on a glowing ripple.', metric: 'hotspot', reward: 10 },
    { id: 'shell', title: 'Find the moon shell', hint: 'Meet Moonfin the Visitor.', metric: 'visitor', reward: 15 }
  ];
  var TIDE_PERIOD = 120000;
  var ZONE_NAMES = ['Shallow water', 'Mid water', 'Deep reef'];
  var ZONE_MUL = [
    { Common: 1.1, Uncommon: 1, Rare: 0.6, Legendary: 0.3, Mythic: 0.2, Junk: 1 },
    { Common: 1, Uncommon: 1, Rare: 1, Legendary: 0.8, Mythic: 0.7, Junk: 1 },
    { Common: 0.8, Uncommon: 1, Rare: 1.35, Legendary: 1.7, Mythic: 1.9, Junk: 0.6 }
  ];

  var TACKLE = [
    { id: 'steady', name: 'Steady Reel', icon: '\uD83E\uDDF5', unlock: 5, desc: 'Line tension builds more slowly.' },
    { id: 'longline', name: 'Long Line', icon: '\uD83C\uDFA3', unlock: 12, desc: 'Every cast reaches one depth deeper.' },
    { id: 'kindhook', name: 'Kind Hook', icon: '\uD83D\uDC9A', unlock: 25, desc: 'The bite window lasts longer.' },
    { id: 'ripple', name: 'Ripple Finder', icon: '\uD83C\uDF00', unlock: 40, desc: 'An extra ripple on every cast.' }
  ];

  var AREAS = [
    { id: 'cove', name: 'Cove', unlock: 0 },
    { id: 'rockpool', name: 'Rockpool', unlock: 3 },
    { id: 'pier', name: 'Deep pier', unlock: 6 }
  ];

  var TIMES = [
    { id: 'dawn', name: 'dawn', from: 5, to: 8, rare: 1.15, bites: 1.05 },
    { id: 'day', name: 'day', from: 8, to: 17, rare: 1, bites: 1 },
    { id: 'dusk', name: 'dusk', from: 17, to: 20, rare: 1.45, bites: 1 },
    { id: 'night', name: 'night', from: 20, to: 5, rare: 1.6, bites: 0.85 }
  ];

  var WEATHERS = [
    { id: 'clear', name: 'Clear', rare: 1, bites: 1 },
    { id: 'misty', name: 'Misty', rare: 1.35, bites: 0.92 },
    { id: 'breezy', name: 'Breezy', rare: 1.1, bites: 1.12 },
    { id: 'rainy', name: 'Rainy', rare: 1.2, bites: 1.1 }
  ];

  var GOAL_TEMPLATES = [
    { id: 'catches', label: 'Catch {n} fish', targets: [3, 4, 5], metric: 'catches' },
    { id: 'species', label: 'Catch {n} different fish', targets: [2, 3], metric: 'species' },
    { id: 'hotspot', label: 'Land {n} fish on a ripple', targets: [1, 2], metric: 'hotspot' },
    { id: 'weight', label: 'Land a fish over {n} kg', targets: [2, 3], metric: 'weight' },
    { id: 'lure', label: 'Catch a fish on the sparkle lure', targets: [1], metric: 'lure' },
    { id: 'record', label: 'Beat a personal best', targets: [1], metric: 'record' }
  ];

  var DECOR = [
    { id: 'lily', name: 'Lily pad', icon: '\uD83C\uDF3F', cost: 4, slots: ['water-left', 'water-mid', 'water-right'] },
    { id: 'lantern', name: 'Lantern', icon: '\uD83C\uDFEE', cost: 10, slots: ['bank', 'dock'] },
    { id: 'bench', name: 'Bench', icon: '\uD83E\uDE91', cost: 18, slots: ['bank'] },
    { id: 'plant', name: 'Pot plant', icon: '\uD83E\uDEB4', cost: 8, slots: ['bank', 'dock'] },
    { id: 'cat', name: 'Second cat', icon: '\uD83D\uDC08', cost: 26, slots: ['dock'] },
    { id: 'rock', name: 'Smooth rock', icon: '\uD83E\uDEA8', cost: 5, slots: ['bank', 'water-left'] },
    { id: 'shellpile', name: 'Shell pile', icon: '\uD83D\uDC1A', cost: 7, slots: ['bank', 'water-right'] },
    { id: 'flag', name: 'Tiny flag', icon: '\uD83D\uDEA9', cost: 14, slots: ['dock', 'bank'] }
  ];

  var DECOR_SLOTS = [
    { id: 'bank', name: 'the bank', left: 9, bottom: 30 },
    { id: 'dock', name: 'the dock', left: 29, bottom: 25 },
    { id: 'water-left', name: 'the shallow water', left: 52, bottom: 13 },
    { id: 'water-mid', name: 'the middle water', left: 68, bottom: 20 },
    { id: 'water-right', name: 'the far water', left: 84, bottom: 9 }
  ];

  var REQUEST_TEMPLATES = [
    { id: 'lumo-crab', character: 'Lumo', icon: '\uD83D\uDCD8', text: 'Bring me a Shore Crab for the rockpool lesson.', metric: 'species', target: 'crab', reward: 8 },
    { id: 'ember-big', character: 'Ember', icon: '\uD83D\uDD25', text: 'Land a fish over 2.5 kg. I want to see a big one.', metric: 'weight', target: 2.5, reward: 10 },
    { id: 'pip-streak', character: 'Pip', icon: '\uD83D\uDC22', text: 'Catch three fish in a row without losing one.', metric: 'streak', target: 3, reward: 9 },
    { id: 'echo-record', character: 'Echo', icon: '\uD83D\uDD01', text: 'Beat one of your best weights. Show me an improvement.', metric: 'record', target: 1, reward: 12 },
    { id: 'lumo-lure', character: 'Lumo', icon: '\uD83D\uDCD8', text: 'Try the sparkle lure and catch something with it.', metric: 'lure', target: 1, reward: 7 },
    { id: 'ember-visitor', character: 'Ember', icon: '\uD83D\uDD25', text: 'Meet the rare visitor of the deep. I have heard stories.', metric: 'visitor', target: 1, reward: 20 }
  ];

  var TROPHIES = [
    { id: 'first', icon: '\uD83C\uDFA3', name: 'First catch', test: function (s) { return s.totalCaught >= 1; } },
    { id: 'ten', icon: '\uD83D\uDD1F', name: 'Ten catches', test: function (s) { return s.totalCaught >= 10; } },
    { id: 'legend', icon: '\u2B50', name: 'Legendary catch', test: function (s) { return s.legendary; } },
    { id: 'big', icon: '\u2696\uFE0F', name: 'Four kilo fish', test: function (s) { return s.heaviest >= 4; } },
    { id: 'streak', icon: '\uD83D\uDD25', name: 'Five in a row', test: function (s) { return s.bestStreak >= 5; } },
    { id: 'log', icon: '\uD83D\uDCD6', name: 'Full log', test: function (s) { return s.discovered >= FISH.length; } },
    { id: 'explorer', icon: '\uD83D\uDDFA\uFE0F', name: 'Cove explorer', test: function (s) { return s.areas >= AREAS.length; } },
    { id: 'visitor', icon: '\uD83C\uDF1A', name: 'Moonfin met', test: function (s) { return s.visitor; } },
    { id: 'story', icon: '\u2728', name: "Stardust's treasures", test: function (s) { return s.story; } }
  ];

  var els = {
    cove: document.getElementById('cove'),
    status: document.getElementById('statusText'),
    a11y: document.getElementById('a11yStatus'),
    action: document.getElementById('actionBtn'),
    pause: document.getElementById('pauseBtn'),
    sound: document.getElementById('soundBtn'),
    reset: document.getElementById('resetBtn'),
    gentle: document.getElementById('gentleBtn'),
    bobber: document.getElementById('bobber'),
    rod: document.getElementById('rod'),
    rodLine: document.getElementById('rodLine'),
    pip: document.getElementById('pip'),
    hotspots: document.getElementById('hotspots'),
    catchFish: document.getElementById('catchFish'),
    birds: document.getElementById('birds'),
    fireflies: document.getElementById('fireflies'),
    conditionLabel: document.getElementById('conditionLabel'),
    score: document.getElementById('scoreHud'),
    best: document.getElementById('bestHud'),
    caught: document.getElementById('caughtHud'),
    streak: document.getElementById('streakHud'),
    bucketCount: document.getElementById('bucketCount'),
    bucketList: document.getElementById('bucketList'),
    bucketEmpty: document.getElementById('bucketEmpty'),
    foundCount: document.getElementById('foundCount'),
    trophyStrip: document.getElementById('trophyStrip'),
    dailyGoals: document.getElementById('dailyGoals'),
    areas: document.getElementById('areas'),
    tackleStrip: document.getElementById('tackleStrip'),
    depthTip: document.getElementById('depthTip'),
    powerMeter: document.getElementById('powerMeter'),
    powerFill: document.getElementById('powerFill'),
    powerLabel: document.getElementById('powerLabel'),
    tensionMeter: document.getElementById('tensionMeter'),
    tensionFill: document.getElementById('tensionFill'),
    tensionLabel: document.getElementById('tensionLabel'),
    reelFill: document.getElementById('reelFill'),
    reelLabel: document.getElementById('reelLabel'),
    resultCard: document.getElementById('resultCard'),
    resultIcon: document.getElementById('resultIcon'),
    resultTitle: document.getElementById('resultTitle'),
    resultDetail: document.getElementById('resultDetail'),
    resultNote: document.getElementById('resultNote'),
    cardBtn: document.getElementById('cardBtn'),
    shellHud: document.getElementById('shellHud'),
    tideLabel: document.getElementById('tideLabel'),
    tideCover: document.getElementById('tideCover'),
    storyStar: document.getElementById('storyStar'),
    craftedBaits: document.getElementById('craftedBaits'),
    photoBar: document.getElementById('photoBar'),
    photoSave: document.getElementById('photoSave'),
    photoExit: document.getElementById('photoExit'),
    tankBtn: document.getElementById('tankBtn'),
    shareBtn: document.getElementById('shareBtn'),
    tankBtnPanel: document.getElementById('tankBtnPanel'),
    craftBtn: document.getElementById('craftBtn'),
    shelfBtn: document.getElementById('shelfBtn'),
    storyBtn: document.getElementById('storyBtn'),
    photoBtn: document.getElementById('photoBtn'),
    requestCard: document.getElementById('requestCard'),
    albumCount: document.getElementById('albumCount'),
    guideBtn: document.getElementById('guideBtn'),
    albumBtn: document.getElementById('albumBtn'),
    decorBtn: document.getElementById('decorBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    panel: document.getElementById('panel'),
    panelTitle: document.getElementById('panelTitle'),
    panelBody: document.getElementById('panelBody'),
    panelClose: document.getElementById('panelClose'),
    decorator: document.getElementById('decorator'),
    decorPalette: document.getElementById('decorPalette'),
    decorDone: document.getElementById('decorDone'),
    decorShells: document.getElementById('decorShells'),
    decorLayer: document.getElementById('decorLayer'),
    decorSlots: document.getElementById('decorSlots'),
    decorHelp: document.getElementById('decorHelp'),
    baits: {
      worm: document.getElementById('baitWorm'),
      corn: document.getElementById('baitCorn'),
      lure: document.getElementById('baitLure')
    }
  };

  var save = loadSave();
  var CONDITIONS = buildConditions();
  var session = {
    phase: 'idle',
    paused: false,
    score: 0,
    streak: 0,
    power: 0,
    chargeStart: 0,
    zone: 0,
    hotspots: [],
    hotspotHit: false,
    fishLeft: 63,
    tension: 30,
    progress: 0,
    strength: 1,
    fish: null,
    hookQuality: '',
    hookAt: 0,
    holdingReel: false,
    pointerDown: false,
    running: false,
    runUntil: 0,
    nextRunAt: 0,
    visitorPending: false,
    visitor: false,
    stage: 1,
    bait: BAITS[save.bait] ? save.bait : 'worm',
    lastCatch: null,
    decorating: false,
    selectedDecor: null,
    photoMode: false,
    tide: 0.2,
    tideRising: true,
    tidePhase: 'low',
    tideOverride: null,
    startedAt: Date.now(),
    baitExpired: false,
    audioStarted: false,
    tensionBand: 0,
    progressBand: 0,
    panelView: '',
    lastPanelTrigger: null,
    biteTimer: null,
    nibbleTimers: [],
    escapeTimer: null,
    resultTimer: null,
    sfx: null,
    counted: false,
    lastFrame: 0,
    raf: null
  };

  function num(value) {
    var n = Number(value);
    return isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }

  function round1(value) {
    var n = Number(value);
    return isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : 0;
  }

  function round2(value) {
    var n = Number(value);
    return isFinite(n) ? Math.round(n * 100) / 100 : 1;
  }

  function clamp(value, lo, hi) {
    return Math.max(lo, Math.min(hi, value));
  }

  function seeded(seed) {
    var x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  function pad2(value) {
    return (value < 10 ? '0' : '') + value;
  }

  function dateKey() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function daySeed() {
    var d = new Date();
    return d.getFullYear() * 372 + (d.getMonth() + 1) * 31 + d.getDate();
  }

  function normaliseSave(stored) {
    var base = {
      version: 4, highScore: 0, bestStreak: 0, totalCaught: 0, gamesPlayed: 0,
      counts: {}, log: {}, sound: true, bait: 'worm', legendary: false,
      heaviest: 0, trophies: [], gentle: false, visitorCaught: false,
      visitorBest: 0, daily: null, shells: 0, ownedDecor: [], decor: {},
      album: [], request: null, theme: 'default', largeText: false,
      crafted: {}, tank: [], story: null, audio: { water: 28, birds: 18, chimes: 20 }
    };
    if (!stored || typeof stored !== 'object') return base;

    var known = {};
    FISH.forEach(function (f) { known[f.id] = true; });
    var rawCounts = stored.counts && typeof stored.counts === 'object' ? stored.counts : {};
    var rawLog = stored.log && typeof stored.log === 'object' ? stored.log : {};
    var counts = {};
    var log = {};
    Object.keys(rawCounts).forEach(function (id) {
      if (known[id]) counts[id] = num(rawCounts[id]);
    });
    Object.keys(rawLog).forEach(function (id) {
      if (!known[id]) return;
      var entry = rawLog[id];
      if (!entry || typeof entry !== 'object') return;
      log[id] = { count: num(entry.count), best: round1(entry.best) };
    });
    if (!stored.log) {
      Object.keys(counts).forEach(function (id) {
        log[id] = { count: num(counts[id]), best: 0 };
      });
    }

    var owned = [];
    if (Array.isArray(stored.ownedDecor)) {
      stored.ownedDecor.forEach(function (id) {
        if (owned.indexOf(id) === -1 && DECOR.some(function (d) { return d.id === id; })) owned.push(id);
      });
    }
    var decor = {};
    DECOR_SLOTS.forEach(function (slot) {
      var id = stored.decor && stored.decor[slot.id];
      if (id && DECOR.some(function (d) { return d.id === id; })) decor[slot.id] = id;
    });

    var album = [];
    if (Array.isArray(stored.album)) {
      stored.album.forEach(function (item) {
        if (!item || typeof item !== 'object') return;
        if (typeof item.fishId !== 'string' || !/^[a-z]+$/.test(item.fishId)) return;
        album.push({
          fishId: item.fishId,
          name: String(item.name || '').slice(0, 40),
          icon: String(item.icon || '').slice(0, 8),
          weight: round1(item.weight),
          points: num(item.points),
          date: String(item.date || '').slice(0, 30),
          visitor: item.visitor === true
        });
      });
      album = album.slice(0, 30);
    }

    var request = null;
    if (stored.request && typeof stored.request === 'object' && Number.isInteger(stored.request.index)) {
      request = {
        index: Math.max(0, Math.min(REQUEST_TEMPLATES.length - 1, stored.request.index)),
        value: Number(stored.request.value) || 0,
        done: stored.request.done === true
      };
    }

    var crafted = {};
    CRAFT_ORDER.forEach(function (id) {
      crafted[id] = stored.crafted && typeof stored.crafted === 'object' ? num(stored.crafted[id]) : 0;
    });

    var tank = [];
    if (Array.isArray(stored.tank)) {
      stored.tank.forEach(function (item) {
        if (!item || typeof item !== 'object') return;
        if (!findFish(item.fishId) || tank.length >= 5) return;
        tank.push({
          fishId: item.fishId,
          weight: round1(item.weight),
          growth: clamp(num(item.growth), 0, 10)
        });
      });
    }

    var story = { step: 0, found: [] };
    if (stored.story && typeof stored.story === 'object') {
      story.step = clamp(num(stored.story.step), 0, STORY_STEPS.length);
      story.found = Array.isArray(stored.story.found) ? stored.story.found.filter(function (id) { return typeof id === 'string'; }).slice(0, STORY_STEPS.length) : [];
    }

    var audio = { water: 28, birds: 18, chimes: 20 };
    if (stored.audio && typeof stored.audio === 'object') {
      audio.water = clamp(num(stored.audio.water), 0, 100);
      audio.birds = clamp(num(stored.audio.birds), 0, 100);
      audio.chimes = clamp(num(stored.audio.chimes), 0, 100);
    }

    return {
      version: 4,
      highScore: num(stored.highScore),
      bestStreak: num(stored.bestStreak),
      totalCaught: num(stored.totalCaught),
      gamesPlayed: num(stored.gamesPlayed),
      counts: counts,
      log: log,
      sound: stored.sound !== false,
      bait: BAITS[stored.bait] ? stored.bait : 'worm',
      legendary: stored.legendary === true,
      heaviest: round1(stored.heaviest),
      trophies: Array.isArray(stored.trophies) ? stored.trophies : [],
      gentle: stored.gentle === true,
      visitorCaught: stored.visitorCaught === true,
      visitorBest: round1(stored.visitorBest),
      daily: stored.daily && typeof stored.daily === 'object' ? stored.daily : null,
      shells: num(stored.shells),
      ownedDecor: owned,
      decor: decor,
      album: album,
      request: request,
      theme: stored.theme === 'contrast' ? 'contrast' : 'default',
      largeText: stored.largeText === true,
      crafted: crafted,
      tank: tank,
      story: story,
      audio: audio
    };
  }

  function loadSave() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return normaliseSave(null);
      return normaliseSave(JSON.parse(raw));
    } catch (e) {
      return normaliseSave(null);
    }
  }

  function persist() {
    try {
      save.updated = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
    } catch (e) {}
  }

  function soundOn() {
    return save.sound !== false;
  }

  function getSfx() {
    if (session.sfx) return session.sfx;
    if (typeof AudioEffects === 'function') {
      try {
        session.sfx = new AudioEffects(0.6);
      } catch (e) {
        session.sfx = null;
      }
    }
    return session.sfx;
  }

  function play(name) {
    if (!soundOn()) return;
    var sfx = getSfx();
    if (!sfx) return;
    try {
      if (name === 'cast') sfx.playTap(520);
      else if (name === 'nibble') sfx.playTap(640);
      else if (name === 'bite') sfx.playTap(880);
      else if (name === 'run') sfx.playTap(420);
      else if (name === 'catch') sfx.playSuccess(1100);
      else if (name === 'junk') sfx.playPop();
      else if (name === 'miss') sfx.playError();
    } catch (e) {}
  }

  function setStatus(text) {
    if (els.status) els.status.textContent = text;
  }

  function setTip(text) {
    if (els.depthTip) els.depthTip.textContent = text;
  }

  function announce(text) {
    if (!els.a11y) return;
    els.a11y.textContent = '';
    window.setTimeout(function () {
      els.a11y.textContent = text;
    }, 40);
  }

  function clearTimers() {
    if (session.biteTimer) window.clearTimeout(session.biteTimer);
    if (session.escapeTimer) window.clearTimeout(session.escapeTimer);
    if (session.resultTimer) window.clearTimeout(session.resultTimer);
    session.nibbleTimers.forEach(function (t) { window.clearTimeout(t); });
    session.biteTimer = null;
    session.escapeTimer = null;
    session.resultTimer = null;
    session.nibbleTimers = [];
  }

  function tackleModsAt(total) {
    var mods = {};
    TACKLE.forEach(function (t) { mods[t.id] = total >= t.unlock; });
    return mods;
  }

  function tackleMods() {
    return tackleModsAt(save.totalCaught);
  }

  function areasAt(found) {
    return AREAS.filter(function (a) { return found >= a.unlock; }).map(function (a) { return a.id; });
  }

  function areaUnlocked(id) {
    return areasAt(discoveredCount()).indexOf(id) !== -1;
  }

  function effectiveZone(base) {
    var zone = base;
    if (tackleMods().longline) zone += 1;
    if (session.hotspotHit) zone += 1;
    return clamp(zone, 0, 2);
  }

  function biteWindow() {
    var base = save.gentle ? 2400 : 1500;
    if (tackleMods().kindhook) base += 350;
    return base;
  }

  function buildConditions() {
    var now = new Date();
    var hour = now.getHours();
    var time = TIMES[1];
    TIMES.forEach(function (t) {
      var inRange = t.from < t.to ? (hour >= t.from && hour < t.to) : (hour >= t.from || hour < t.to);
      if (inRange) time = t;
    });
    var weather = WEATHERS[Math.floor(seeded(daySeed()) * WEATHERS.length) % WEATHERS.length];
    return {
      time: time.id,
      timeName: time.name,
      weather: weather.id,
      weatherName: weather.name,
      rare: round2(time.rare * weather.rare),
      bites: round2(time.bites * weather.bites),
      label: weather.name + ' ' + time.name
    };
  }

  function renderAmbient() {
    var seed = daySeed();
    if (els.birds) {
      els.birds.innerHTML = (CONDITIONS.time === 'day' || CONDITIONS.time === 'dawn')
        ? '<span class="bird b1">\uD83D\uDD4A</span><span class="bird b2">\uD83D\uDD4A</span>'
        : '';
    }
    if (els.fireflies) {
      var html = '';
      if (CONDITIONS.time === 'dusk' || CONDITIONS.time === 'night') {
        for (var i = 0; i < 7; i++) {
          var x = 8 + Math.floor(seeded(seed + i * 3) * 80);
          var y = 12 + Math.floor(seeded(seed + i * 7) * 42);
          var delay = (seeded(seed + i * 11) * 3).toFixed(1);
          html += '<span class="firefly" style="left:' + x + '%;bottom:' + y + '%;animation-delay:-' + delay + 's"></span>';
        }
      }
      els.fireflies.innerHTML = html;
    }
  }

  function applyConditions() {
    if (els.cove) {
      els.cove.setAttribute('data-time', CONDITIONS.time);
      els.cove.setAttribute('data-weather', CONDITIONS.weather);
    }
    if (els.conditionLabel) els.conditionLabel.textContent = CONDITIONS.label;
    renderAmbient();
  }

  function discoveredCount() {
    var found = 0;
    FISH.forEach(function (f) {
      var entry = save.log[f.id];
      if (entry && num(entry.count) > 0) found += 1;
    });
    return found;
  }

  function unlockedTrophies() {
    var snapshot = {
      totalCaught: save.totalCaught,
      bestStreak: save.bestStreak,
      legendary: save.legendary,
      heaviest: save.heaviest,
      discovered: discoveredCount(),
      areas: areasAt(discoveredCount()).length,
      visitor: save.visitorCaught === true,
      story: storyDone()
    };
    return TROPHIES.filter(function (t) {
      try { return t.test(snapshot); } catch (e) { return false; }
    }).map(function (t) { return t.id; });
  }

  function ensureDaily() {
    var key = dateKey();
    if (!save.daily || save.daily.date !== key || !Array.isArray(save.daily.goals) || save.daily.goals.length !== 3) {
      save.daily = buildDaily();
      persist();
    }
    if (!Array.isArray(save.daily.seenSpecies)) save.daily.seenSpecies = [];
    return save.daily;
  }

  function buildDaily() {
    var seed = daySeed();
    var order = GOAL_TEMPLATES.slice();
    for (var i = order.length - 1; i > 0; i--) {
      var j = Math.floor(seeded(seed + i * 13) * (i + 1));
      var tmp = order[i]; order[i] = order[j]; order[j] = tmp;
    }
    var goals = [];
    for (var k = 0; k < 3; k++) {
      var t = order[k];
      var idx = Math.floor(seeded(seed + k * 29) * t.targets.length) % t.targets.length;
      var target = t.targets[idx];
      goals.push({
        id: t.id, metric: t.metric, target: target,
        label: t.label.replace('{n}', String(target)), value: 0, done: false
      });
    }
    return { date: dateKey(), goals: goals, seenSpecies: [], bonusGiven: false };
  }

  function updateDaily(fish, weight, isRecord, wasHotspot, isNew) {
    var daily = ensureDaily();
    var bonus = 0;
    var newly = [];
    daily.goals.forEach(function (g) {
      if (g.done) return;
      if (g.metric === 'catches') g.value += 1;
      else if (g.metric === 'species') {
        if (daily.seenSpecies.indexOf(fish.id) === -1) daily.seenSpecies.push(fish.id);
        g.value = daily.seenSpecies.length;
      } else if (g.metric === 'hotspot') {
        if (wasHotspot) g.value += 1;
      } else if (g.metric === 'weight') {
        if (weight > g.value) g.value = weight;
      } else if (g.metric === 'lure') {
        if (session.bait === 'lure') g.value = 1;
      } else if (g.metric === 'record') {
        if (isRecord && !isNew) g.value = 1;
      }
      if (g.value >= g.target) {
        g.done = true;
        newly.push(g);
        bonus += 10;
      }
    });
    if (newly.length) {
      session.score += bonus;
      var allDone = daily.goals.every(function (g) { return g.done; });
      if (allDone && !daily.bonusGiven) {
        daily.bonusGiven = true;
        session.score += 25;
      }
    }
    persist();
    return newly;
  }

  function renderTrophies() {
    if (!els.trophyStrip) return;
    var have = save.trophies || [];
    var html = TROPHIES.map(function (t) {
      var on = have.indexOf(t.id) !== -1;
      return '<span class="trophy' + (on ? '' : ' is-off') + '" title="' +
        (on ? 'Unlocked: ' : 'Locked: ') + t.name + '" aria-label="' +
        (on ? 'Unlocked: ' : 'Locked: ') + t.name + '">' + t.icon + '</span>';
    }).join('');
    html += '<span class="trophy-note">' + have.length + ' of ' + TROPHIES.length + ' trophies</span>';
    els.trophyStrip.innerHTML = html;
  }

  function renderDaily() {
    if (!els.dailyGoals) return;
    var daily = ensureDaily();
    els.dailyGoals.innerHTML = daily.goals.map(function (g) {
      var shown = g.metric === 'weight' ? round1(Math.min(g.value, g.target)) : Math.min(g.value, g.target);
      return '<span class="goal' + (g.done ? ' is-done' : '') + '">' +
        (g.done ? '\u2713 ' : '') + g.label + ' <b>' + shown + '/' + g.target + '</b></span>';
    }).join('');
  }

  function renderTackle() {
    if (!els.tackleStrip) return;
    var mods = tackleMods();
    var html = TACKLE.map(function (t) {
      var on = mods[t.id];
      return '<span class="unlock' + (on ? '' : ' is-off') + '" title="' + t.desc + '">' +
        t.icon + ' ' + t.name + '</span>';
    }).join('');
    var next = null;
    TACKLE.forEach(function (t) { if (!next && save.totalCaught < t.unlock) next = t; });
    html += next
      ? '<span class="unlock-note">Next: ' + next.name + ' at ' + next.unlock + ' catches</span>'
      : '<span class="unlock-note">All tackle unlocked.</span>';
    els.tackleStrip.innerHTML = html;
  }

  function renderAreas() {
    if (!els.areas) return;
    var found = discoveredCount();
    els.areas.innerHTML = AREAS.filter(function (a) { return a.unlock > 0; }).map(function (a) {
      var on = found >= a.unlock;
      return '<span class="area' + (on ? ' is-on' : '') + '">' + a.name + ': ' +
        (on ? 'open' : found + '/' + a.unlock + ' fish') + '</span>';
    }).join('');
  }

  function renderLog() {
    if (!els.bucketList) return;
    var total = 0;
    var found = 0;
    var rows = [];
    var unknown = [];
    FISH.forEach(function (fish) {
      var entry = save.log[fish.id];
      var n = entry ? num(entry.count) : 0;
      total += n;
      if (!n) {
        unknown.push(
          '<li class="bucket-item is-unknown" title="Undiscovered fish">' +
            '<span class="icon" aria-hidden="true">\u2753</span>' +
            '<span class="name">???</span>' +
            '<span class="rarity">???</span>' +
          '</li>'
        );
        return;
      }
      found += 1;
      var legendary = fish.rarity === 'Legendary' || fish.rarity === 'Mythic';
      rows.push(
        '<li class="bucket-item' + (legendary ? ' is-legendary' : '') + '" title="' +
          fish.rarity + ' ' + fish.name + '. ' + fish.fact + '">' +
          '<span class="icon" aria-hidden="true">' + fish.icon + '</span>' +
          '<span class="name">' + fish.name + '</span>' +
          '<span class="rarity">' + fish.rarity + '</span>' +
          '<b class="count">' + n + '</b>' +
          (entry && entry.best ? '<span class="best">' + round1(entry.best) + ' kg</span>' : '') +
        '</li>'
      );
    });
    if (save.visitorCaught) {
      total += 1;
      rows.unshift(
        '<li class="bucket-item is-legendary is-visitor" title="The rare visitor of the deep">' +
          '<span class="icon" aria-hidden="true">' + VISITOR.icon + '</span>' +
          '<span class="name">' + VISITOR.name + '</span>' +
          '<span class="rarity">Visitor</span>' +
          '<b class="count">1</b>' +
          (save.visitorBest ? '<span class="best">' + round1(save.visitorBest) + ' kg</span>' : '') +
        '</li>'
      );
    }
    if (total > 0) rows = rows.concat(unknown);
    els.bucketList.innerHTML = rows.join('');
    els.bucketCount.textContent = total;
    if (els.bucketEmpty) els.bucketEmpty.hidden = total > 0;
    if (els.foundCount) {
      els.foundCount.hidden = total === 0;
      els.foundCount.textContent = found + ' of ' + FISH.length + ' fish found.';
    }
    renderTrophies();
    renderAreas();
    renderDaily();
    renderTackle();
  }

  function renderHud() {
    els.score.textContent = session.score;
    els.best.textContent = save.highScore;
    els.caught.textContent = save.totalCaught;
    els.streak.textContent = session.streak;
    renderLog();
    renderShells();
    renderRequest();
  }

  function renderShells() {
    var shells = num(save.shells);
    if (els.shellHud) els.shellHud.textContent = '\uD83D\uDC1A ' + shells;
    if (els.decorShells) els.decorShells.textContent = '\uD83D\uDC1A ' + shells;
    if (els.albumCount) els.albumCount.textContent = (save.album || []).length;
  }

  function ensureRequest() {
    if (!save.request || !REQUEST_TEMPLATES[save.request.index]) {
      save.request = { index: 0, value: 0, done: false };
      persist();
    }
    return save.request;
  }

  function advanceRequest() {
    var current = ensureRequest();
    current.index = (current.index + 1) % REQUEST_TEMPLATES.length;
    current.value = 0;
    current.done = false;
    persist();
    renderRequest();
  }

  function updateRequest(fish, weight, isRecord, isNew, isVisitor) {
    var request = ensureRequest();
    if (request.done) advanceRequest();
    request = ensureRequest();
    var template = REQUEST_TEMPLATES[request.index];
    var value = request.value;
    if (template.metric === 'species') {
      if (fish.id === template.target) value = 1;
    } else if (template.metric === 'weight') {
      value = Math.max(value, weight);
    } else if (template.metric === 'streak') {
      value = session.streak;
    } else if (template.metric === 'record') {
      if (isRecord && !isNew) value = 1;
    } else if (template.metric === 'lure') {
      if (session.bait === 'lure') value = 1;
    } else if (template.metric === 'visitor') {
      if (isVisitor) value = 1;
    }
    request.value = value;
    var completed = null;
    if (!request.done && value >= template.target) {
      request.done = true;
      save.shells = num(save.shells) + template.reward;
      completed = template;
    }
    persist();
    renderRequest();
    return completed;
  }

  function renderRequest() {
    if (!els.requestCard) return;
    var request = ensureRequest();
    var template = REQUEST_TEMPLATES[request.index];
    var shown = template.metric === 'weight' ? round1(Math.min(request.value, template.target)) : Math.min(request.value, template.target);
    var body = '<span class="request-icon" aria-hidden="true">' + template.icon + '</span>' +
      '<span class="request-body"><b>' + template.character + ' asks</b>' +
      '<span>' + template.text + '</span></span>' +
      '<span class="request-progress">' + (request.done ? 'Done!' : shown + '/' + template.target) + '</span>' +
      '<span class="request-reward">+\uD83D\uDC1A' + template.reward + '</span>';
    if (request.done) {
      body += '<button class="request-next" type="button" data-request-next="1">Next</button>';
    }
    els.requestCard.innerHTML = body;
    els.requestCard.classList.toggle('is-done', request.done);
    var next = els.requestCard.querySelector('[data-request-next]');
    if (next) next.addEventListener('click', advanceRequest);
  }

  function shellReward(isNew, isVisitor, rarity, wasHotspot) {
    var shells = 1;
    if (isNew) shells += 2;
    if (isVisitor) shells += 10;
    else if (rarity === 'Legendary' || rarity === 'Mythic') shells += 3;
    if (wasHotspot) shells += 1;
    return shells;
  }

  function addToAlbum(fish, weight, points, isVisitor) {
    if (!Array.isArray(save.album)) save.album = [];
    save.album.unshift({
      fishId: fish.id,
      name: fish.name,
      icon: fish.icon,
      weight: round1(weight),
      points: points,
      date: dateKey(),
      visitor: !!isVisitor
    });
    save.album = save.album.slice(0, 30);
  }

  function conditionOk(fish) {
    if (!fish.needs) return true;
    if (fish.needs.time && fish.needs.time.indexOf(CONDITIONS.time) === -1) return false;
    if (fish.needs.weather && fish.needs.weather.indexOf(CONDITIONS.weather) === -1) return false;
    return true;
  }

  function availableFish() {
    return FISH.filter(function (f) {
      return areaUnlocked(f.area) && conditionOk(f);
    }).map(function (f) { return f.id; });
  }

  function needText(fish) {
    if (fish.needs && fish.needs.weather) {
      return 'Only when the weather is ' + fish.needs.weather.join(' or ') + '.';
    }
    if (fish.needs && fish.needs.time) {
      return 'Only at ' + fish.needs.time.join(' or ') + '.';
    }
    return '';
  }

  function areaName(id) {
    var area = AREAS.filter(function (a) { return a.id === id; })[0];
    return area ? area.name : 'the cove';
  }

  function findFish(id) {
    var fish = FISH.filter(function (f) { return f.id === id; })[0];
    if (fish) return fish;
    return VISITOR.id === id ? VISITOR : null;
  }

  function panelOpen() {
    return els.panel && !els.panel.hidden;
  }

  function guideHtml() {
    var html = '<p class="panel-note">Lumo says: every fish has a story. Meet them all and the cove starts to feel like home.</p>';
    if (save.visitorCaught) {
      html += '<div class="guide-entry is-visitor"><span class="guide-icon">' + VISITOR.icon + '</span>' +
        '<div class="guide-info"><b>' + VISITOR.name + '</b><span class="guide-meta">Visitor \u00b7 ' + areaName('pier') + '</span>' +
        '<span class="guide-meta">Best: ' + (save.visitorBest ? round1(save.visitorBest) + ' kg' : 'not yet') + '</span>' +
        '<span class="guide-fact">' + VISITOR.fact + '</span></div></div>';
    } else {
      html += '<div class="guide-entry is-locked"><span class="guide-icon">\u2753</span>' +
        '<div class="guide-info"><b>???</b><span class="guide-meta">Visitor \u00b7 deep water</span>' +
        '<span class="guide-fact">Only in deep water at dusk, night or in mist.</span></div></div>';
    }
    FISH.forEach(function (f) {
      var entry = save.log[f.id];
      var n = entry ? num(entry.count) : 0;
      var known = n > 0;
      var need = needText(f);
      html += '<div class="guide-entry' + (known ? '' : ' is-locked') + '">' +
        '<span class="guide-icon">' + (known ? f.icon : '\u2753') + '</span>' +
        '<div class="guide-info"><b>' + (known ? f.name : '???') + '</b>' +
        '<span class="guide-meta">' + (known ? f.rarity + ' \u00b7 ' + areaName(f.area) : 'Unknown \u00b7 ' + areaName(f.area)) + '</span>' +
        (known
          ? '<span class="guide-meta">Best: ' + (entry.best ? round1(entry.best) + ' kg' : 'not yet') + ' \u00b7 Caught ' + n + '</span>'
          : '<span class="guide-meta">' + need + '</span>') +
        '<span class="guide-fact">' + (known ? f.fact : (need || 'Keep fishing to meet this one.')) + '</span>' +
        '</div></div>';
    });
    return html;
  }

  function albumHtml() {
    var album = save.album || [];
    if (!album.length) {
      return '<p class="panel-note">No catches in the album yet. Land a fish and its card will appear here.</p>';
    }
    var html = '<p class="panel-note">Every catch is kept here. Open a card to save the PNG again.</p><div class="album-grid">';
    album.forEach(function (item, index) {
      html += '<article class="album-card">' +
        '<span class="album-icon" aria-hidden="true">' + item.icon + '</span>' +
        '<div class="album-meta"><b>' + item.name + '</b>' +
        '<span>' + round1(item.weight) + ' kg \u00b7 +' + item.points + ' points</span>' +
        '<span>' + item.date + '</span></div>' +
        '<button class="album-save" type="button" data-album="' + index + '">Save card</button>' +
        '</article>';
    });
    return html + '</div>';
  }

  function bindAlbum() {
    if (!els.panelBody) return;
    els.panelBody.querySelectorAll('[data-album]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = (save.album || [])[Number(btn.getAttribute('data-album'))];
        if (!item) return;
        var fish = findFish(item.fishId);
        if (!fish) return;
        downloadCatchCard({
          fish: fish,
          weight: item.weight,
          points: item.points,
          date: item.date ? new Date(item.date + 'T12:00:00') : new Date()
        });
      });
    });
  }

  function settingsRow(label, hint, attrs) {
    return '<button class="settings-toggle" type="button" ' + attrs + '>' +
      '<span><b>' + label + '</b><span>' + hint + '</span></span>' +
      '<span class="settings-state">On</span></button>';
  }

  function settingsHtml() {
    var html = '<p class="panel-note">Everything stays on this device. You can copy your save to another computer as a small file.</p>';
    html += settingsRow('High contrast', 'Stronger colours and borders.', 'data-toggle="contrast" aria-pressed="' + (save.theme === 'contrast') + '"');
    html += settingsRow('Larger text', 'Bigger labels for easier reading.', 'data-toggle="large" aria-pressed="' + (save.largeText === true) + '"');
    html += settingsRow('Gentle mode', 'Tap to reel and the line will not snap.', 'data-toggle="gentle" aria-pressed="' + (save.gentle === true) + '"');
    html += settingsRow('Sound', 'Little taps and catch chimes.', 'data-toggle="sound" aria-pressed="' + soundOn() + '"');
    html += '<div class="mixer"><b>Soundscape</b>' +
      '<label class="mixer-row">Water <input type="range" min="0" max="100" value="' + num(save.audio.water) + '" data-mix="water" aria-label="Water volume"></label>' +
      '<label class="mixer-row">Birds <input type="range" min="0" max="100" value="' + num(save.audio.birds) + '" data-mix="birds" aria-label="Birds volume"></label>' +
      '<label class="mixer-row">Chimes <input type="range" min="0" max="100" value="' + num(save.audio.chimes) + '" data-mix="chimes" aria-label="Chimes volume"></label>' +
      '</div>';
    html += '<div class="settings-actions">' +
      '<button class="settings-btn" id="exportBtn" type="button">Save progress file</button>' +
      '<button class="settings-btn" id="importBtn" type="button">Load progress file</button>' +
      '<input id="importFile" type="file" accept="application/json,.json" hidden>' +
      '</div><p class="panel-note" id="settingsStatus"></p>';
    return html;
  }

  function setSettingsStatus(text) {
    var el = document.getElementById('settingsStatus');
    if (el) el.textContent = text;
  }

  function paintSettingsState(button, on) {
    var state = button.querySelector('.settings-state');
    if (state) state.textContent = on ? 'On' : 'Off';
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function bindSettings() {
    if (!els.panelBody) return;
    els.panelBody.querySelectorAll('[data-toggle]').forEach(function (button) {
      var name = button.getAttribute('data-toggle');
      var on = button.getAttribute('aria-pressed') === 'true';
      paintSettingsState(button, on);
      button.addEventListener('click', function () {
        if (name === 'contrast') {
          save.theme = save.theme === 'contrast' ? 'default' : 'contrast';
          applyAccessibility();
        } else if (name === 'large') {
          save.largeText = !save.largeText;
          applyAccessibility();
        } else if (name === 'gentle') {
          save.gentle = !save.gentle;
          paintGentle();
        } else if (name === 'sound') {
          save.sound = !soundOn();
          paintSound();
        }
        persist();
        paintSettingsState(button, name === 'contrast' ? save.theme === 'contrast' : name === 'large' ? save.largeText : name === 'gentle' ? save.gentle : soundOn());
      });
    });
    els.panelBody.querySelectorAll('[data-mix]').forEach(function (input) {
      input.addEventListener('input', function () { setLayerVolume(input.getAttribute('data-mix'), input.value); });
    });
    var exportBtn = document.getElementById('exportBtn');
    if (exportBtn) exportBtn.addEventListener('click', downloadSave);
    var importBtn = document.getElementById('importBtn');
    var importFile = document.getElementById('importFile');
    if (importBtn && importFile) {
      importBtn.addEventListener('click', function () { importFile.click(); });
      importFile.addEventListener('change', function () {
        var file = importFile.files && importFile.files[0];
        if (!file) return;
        if (file.size > 1024 * 1024) { setSettingsStatus('That file is too large.'); return; }
        var reader = new FileReader();
        reader.onload = function () {
          var ok = importSaveJson(String(reader.result || ''));
          if (!ok) setSettingsStatus('That file did not look like a Cozy Cove save.');
        };
        reader.onerror = function () { setSettingsStatus('The file could not be read.'); };
        reader.readAsText(file);
      });
    }
  }

  function renderPanel() {
    if (!els.panelBody) return;
    if (session.panelView === 'guide') {
      els.panelTitle.textContent = "Lumo's field guide";
      els.panelBody.innerHTML = guideHtml();
    } else if (session.panelView === 'album') {
      els.panelTitle.textContent = 'Catch album';
      els.panelBody.innerHTML = albumHtml();
      bindAlbum();
    } else if (session.panelView === 'settings') {
      els.panelTitle.textContent = 'Save and settings';
      els.panelBody.innerHTML = settingsHtml();
      bindSettings();
    } else if (session.panelView === 'craft') {
      els.panelTitle.textContent = 'Bait bench';
      els.panelBody.innerHTML = craftHtml();
      bindCraft();
    } else if (session.panelView === 'tank') {
      els.panelTitle.textContent = 'Aquarium';
      els.panelBody.innerHTML = tankHtml();
      bindTank();
    } else if (session.panelView === 'shelf') {
      els.panelTitle.textContent = 'Trophy shelf';
      els.panelBody.innerHTML = shelfHtml();
    } else if (session.panelView === 'story') {
      els.panelTitle.textContent = "Stardust's lost things";
      els.panelBody.innerHTML = storyHtml();
    }
  }

  function openPanel(view, trigger) {
    if (session.decorating || session.photoMode) return;
    if (session.phase !== 'idle' || session.paused) { setStatus('Finish this cast first.'); return; }
    session.panelView = view;
    session.lastPanelTrigger = trigger || null;
    if (!els.panel) return;
    els.panel.hidden = false;
    renderPanel();
    if (els.panelClose) els.panelClose.focus();
  }

  function closePanel() {
    if (!els.panel) return;
    els.panel.hidden = true;
    session.panelView = '';
    if (session.lastPanelTrigger && session.lastPanelTrigger.focus) session.lastPanelTrigger.focus();
    session.lastPanelTrigger = null;
  }

  function applyAccessibility() {
    if (!els.cove) return;
    els.cove.setAttribute('data-theme', save.theme === 'contrast' ? 'contrast' : 'default');
    els.cove.classList.toggle('text-large', save.largeText === true);
  }

  function exportSaveJson() {
    return JSON.stringify({ app: 'pips-cozy-cove', version: 4, exported: new Date().toISOString(), data: save }, null, 2);
  }

  function downloadSave() {
    try {
      var blob = new Blob([exportSaveJson()], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = 'pips-cozy-cove-save.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      setSettingsStatus('Save file downloaded.');
    } catch (e) {
      setSettingsStatus('This browser could not save the file.');
    }
  }

  function importSaveJson(text) {
    try {
      var parsed = JSON.parse(text);
      var data = parsed && typeof parsed === 'object' && parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
      if (!data || typeof data !== 'object' || (!data.log && !data.counts)) return false;
      save = normaliseSave(data);
      session.bait = BAITS[save.bait] ? save.bait : 'worm';
      ensureDaily();
      persist();
      applyAccessibility();
      paintBait();
      paintGentle();
      paintSound();
      renderHud();
      renderDecorLayer();
      closePanel();
      setStatus('Progress loaded from your save file.');
      announce('Progress loaded.');
      return true;
    } catch (e) {
      return false;
    }
  }

  function decorName(id) {
    var item = DECOR.filter(function (d) { return d.id === id; })[0];
    return item ? item.name : 'item';
  }

  function renderDecorLayer() {
    if (!els.decorLayer) return;
    var html = '';
    DECOR_SLOTS.forEach(function (slot) {
      var id = save.decor && save.decor[slot.id];
      if (!id) return;
      var item = DECOR.filter(function (d) { return d.id === id; })[0];
      if (!item) return;
      html += '<span class="decor-placed" style="left:' + slot.left + '%;bottom:' + slot.bottom + '%" title="' + item.name + '">' + item.icon + '</span>';
    });
    els.decorLayer.innerHTML = html;
  }

  function renderDecor() {
    renderShells();
    renderDecorLayer();
    if (els.decorSlots) {
      var slotsHtml = '';
      DECOR_SLOTS.forEach(function (slot) {
        var placed = save.decor && save.decor[slot.id];
        var item = placed ? DECOR.filter(function (d) { return d.id === placed; })[0] : null;
        slotsHtml += '<button class="decor-slot' + (item ? ' has-item' : '') + '" type="button" data-slot="' + slot.id + '" style="left:' + slot.left + '%;bottom:' + slot.bottom + '%" aria-label="' + slot.name + (item ? ', ' + item.name : '') + '">' + (item ? item.icon : '') + '</button>';
      });
      els.decorSlots.innerHTML = slotsHtml;
      els.decorSlots.querySelectorAll('[data-slot]').forEach(function (button) {
        button.addEventListener('click', function () { placeDecor(button.getAttribute('data-slot')); });
      });
    }
    if (els.decorPalette) {
      var palette = '';
      DECOR.forEach(function (item) {
        var owned = (save.ownedDecor || []).indexOf(item.id) !== -1;
        var selected = session.selectedDecor === item.id;
        palette += '<button class="decor-item' + (owned ? '' : ' is-locked') + (selected ? ' is-selected' : '') + '" type="button" data-decor="' + item.id + '" aria-pressed="' + (selected ? 'true' : 'false') + '">' +
          '<span class="decor-item-icon" aria-hidden="true">' + item.icon + '</span>' +
          '<span class="decor-item-name">' + item.name + '</span>' +
          '<span class="decor-item-cost">' + (owned ? 'Owned' : '\uD83D\uDC1A ' + item.cost) + '</span>' +
          '</button>';
      });
      els.decorPalette.innerHTML = palette;
      els.decorPalette.querySelectorAll('[data-decor]').forEach(function (button) {
        button.addEventListener('click', function () { chooseDecor(button.getAttribute('data-decor')); });
      });
    }
    if (els.decorHelp) {
      els.decorHelp.textContent = session.selectedDecor
        ? 'Now tap a glowing spot to place the ' + decorName(session.selectedDecor) + '. Tap the same spot again to remove it.'
        : 'Pick an item, then tap a spot in the water or on the dock.';
    }
  }

  function chooseDecor(id) {
    var item = DECOR.filter(function (d) { return d.id === id; })[0];
    if (!item) return;
    var owned = (save.ownedDecor || []).indexOf(id) !== -1;
    if (!owned) {
      if (num(save.shells) < item.cost) {
        setStatus('You need ' + (item.cost - num(save.shells)) + ' more shells for the ' + item.name + '.');
        return;
      }
      save.shells = num(save.shells) - item.cost;
      save.ownedDecor.push(id);
      persist();
      setStatus('You bought the ' + item.name + '! Now pick a spot.');
    }
    session.selectedDecor = id;
    renderDecor();
  }

  function placeDecor(slotId) {
    if (!session.selectedDecor) {
      setStatus('Pick a decor item first.');
      return;
    }
    var item = DECOR.filter(function (d) { return d.id === session.selectedDecor; })[0];
    var slot = DECOR_SLOTS.filter(function (s) { return s.id === slotId; })[0];
    if (!item || !slot) return;
    if (item.slots.indexOf(slotId) === -1) {
      setStatus('The ' + item.name + ' does not go on ' + slot.name + '.');
      return;
    }
    if (save.decor[slotId] === item.id) {
      delete save.decor[slotId];
      setStatus('Removed the ' + item.name + '.');
    } else {
      save.decor[slotId] = item.id;
      setStatus('Placed the ' + item.name + ' on ' + slot.name + '.');
    }
    persist();
    renderDecor();
  }

  function enterDecor() {
    if (session.phase !== 'idle' || session.paused || session.photoMode) {
      setStatus('Finish this cast first.');
      return;
    }
    closePanel();
    session.decorating = true;
    session.selectedDecor = null;
    if (els.resultCard) els.resultCard.hidden = true;
    if (els.cove) els.cove.classList.add('is-decorating');
    if (els.decorator) els.decorator.hidden = false;
    var controls = document.querySelector('.controls');
    if (controls) controls.hidden = true;
    setStatus('Decorate the cove. Pick an item, then tap a spot.');
    renderDecor();
  }

  function exitDecor() {
    session.decorating = false;
    session.selectedDecor = null;
    if (els.cove) els.cove.classList.remove('is-decorating');
    if (els.decorator) els.decorator.hidden = true;
    var controls = document.querySelector('.controls');
    if (controls) controls.hidden = false;
    renderDecor();
    setStatus('Ready to fish. Press and hold to cast.');
  }

  function tideValue() {
    if (session.tideOverride !== null) return clamp(session.tideOverride, 0, 1);
    var t = ((Date.now() - session.startedAt) % TIDE_PERIOD) / TIDE_PERIOD;
    return (Math.sin(t * Math.PI * 2 - Math.PI / 2) + 1) / 2;
  }

  function applyTide(force) {
    var level = tideValue();
    var t = ((Date.now() - session.startedAt) % TIDE_PERIOD) / TIDE_PERIOD;
    var rising = Math.cos(t * Math.PI * 2 - Math.PI / 2) > 0;
    var phase = level < 0.3 ? 'low' : level > 0.7 ? 'high' : (rising ? 'rising' : 'falling');
    var label = phase === 'low' ? 'Low tide' : phase === 'high' ? 'High tide' : (rising ? 'Tide coming in' : 'Tide going out');
    var changed = force || phase !== session.tidePhase;
    session.tide = level;
    session.tideRising = rising;
    session.tidePhase = phase;
    if (changed) {
      if (els.cove) els.cove.setAttribute('data-tide', phase === 'high' ? 'high' : phase === 'low' ? 'low' : 'mid');
      if (els.tideLabel) els.tideLabel.textContent = label;
      if (els.tideCover) els.tideCover.style.height = (8 + level * 30).toFixed(1) + '%';
    }
  }

  function tideFactor(fish) {
    var level = session.tide;
    var factor = 1;
    if (fish.area === 'rockpool') factor *= level < 0.35 ? 1.7 : level > 0.65 ? 0.65 : 1;
    if (fish.minDepth >= 2) factor *= level > 0.65 ? 1.3 : level < 0.35 ? 0.85 : 1;
    return factor;
  }

  function craftedCharges(id) {
    return num(save.crafted[id]);
  }

  function recipeReady(recipe) {
    if (recipe.id === 'trophy') return save.legendary === true || save.visitorCaught === true;
    return save.totalCaught >= recipe.need;
  }

  function craftBait(id) {
    var recipe = CRAFT_RECIPES.filter(function (r) { return r.id === id; })[0];
    if (!recipe) return false;
    if (!recipeReady(recipe)) {
      setStatus('You are not ready for ' + recipe.name + ' yet. ' + recipe.requires + '.');
      return false;
    }
    if (num(save.shells) < recipe.cost) {
      setStatus('You need ' + (recipe.cost - num(save.shells)) + ' more shells for ' + recipe.name + '.');
      return false;
    }
    save.shells = num(save.shells) - recipe.cost;
    save.crafted[id] = craftedCharges(id) + recipe.charges;
    persist();
    renderShells();
    renderCraftedBaits();
    renderPanelIf('craft');
    setStatus('Crafted ' + recipe.name + '! ' + save.crafted[id] + ' charges ready.');
    announce('Crafted ' + recipe.name + '.');
    return true;
  }

  function renderCraftedBaits() {
    if (!els.craftedBaits) return;
    var html = '';
    CRAFT_ORDER.forEach(function (id) {
      var n = craftedCharges(id);
      if (!n) return;
      var bait = BAITS[id];
      var pressed = session.bait === id;
      html += '<button class="bait bait-crafted" data-craft-bait="' + id + '" type="button" aria-pressed="' + (pressed ? 'true' : 'false') + '">' +
        bait.icon + ' ' + bait.name + ' <span class="charge">' + n + '</span></button>';
    });
    els.craftedBaits.innerHTML = html;
    els.craftedBaits.hidden = html === '';
    els.craftedBaits.querySelectorAll('[data-craft-bait]').forEach(function (button) {
      button.addEventListener('click', function () { selectBait(button.getAttribute('data-craft-bait')); });
    });
  }

  function craftHtml() {
    var html = '<p class="panel-note">Combine shells with what you have caught. Crafted bait uses one charge each time you cast.</p>';
    CRAFT_RECIPES.forEach(function (recipe) {
      var ready = recipeReady(recipe);
      var charges = craftedCharges(recipe.id);
      var afford = num(save.shells) >= recipe.cost;
      html += '<div class="craft-card' + (ready ? '' : ' is-locked') + '">' +
        '<span class="craft-icon" aria-hidden="true">' + recipe.icon + '</span>' +
        '<div class="craft-info"><b>' + recipe.name + '</b>' +
        '<span>' + recipe.requires + '</span>' +
        '<span>' + recipe.charges + ' charges \u00b7 \uD83D\uDC1A ' + recipe.cost + '</span>' +
        (charges ? '<span class="craft-have">You have ' + charges + ' charges</span>' : '') +
        '</div>' +
        '<button class="craft-btn" type="button" data-craft="' + recipe.id + '"' + (ready && afford ? '' : ' disabled') + '>' +
        (ready && afford ? 'Craft' : 'Not yet') + '</button>' +
        '</div>';
    });
    return html;
  }

  function bindCraft() {
    if (!els.panelBody) return;
    els.panelBody.querySelectorAll('[data-craft]').forEach(function (button) {
      button.addEventListener('click', function () { craftBait(button.getAttribute('data-craft')); });
    });
  }

  function ensureStory() {
    if (!save.story || typeof save.story !== 'object' || !Array.isArray(save.story.found)) {
      save.story = { step: 0, found: [] };
    }
    return save.story;
  }

  function updateStory(isVisitor, wasHotspot) {
    var story = ensureStory();
    if (story.step >= STORY_STEPS.length) return null;
    var step = STORY_STEPS[story.step];
    var ok = false;
    if (step.metric === 'any') ok = true;
    else if (step.metric === 'hotspot') ok = wasHotspot;
    else if (step.metric === 'visitor') ok = isVisitor;
    if (!ok) return null;
    story.found.push(step.id);
    story.step += 1;
    save.shells = num(save.shells) + step.reward;
    persist();
    renderStoryStar();
    renderPanelIf('story');
    return step;
  }

  function storyDone() {
    return ensureStory().step >= STORY_STEPS.length;
  }

  function renderStoryStar() {
    if (els.storyStar) els.storyStar.hidden = !storyDone();
  }

  function storyHtml() {
    var story = ensureStory();
    var html = '<p class="panel-note">Stardust says: a little wind took three treasures from the cove. Will you help me find them?</p>';
    STORY_STEPS.forEach(function (step, index) {
      var done = index < story.step;
      var next = index === story.step;
      html += '<div class="guide-entry' + (done ? '' : ' is-locked') + '">' +
        '<span class="guide-icon">' + (done ? '\u2728' : '\u2753') + '</span>' +
        '<div class="guide-info"><b>' + (done ? step.title : (next ? 'Next: ' + step.title : '???')) + '</b>' +
        '<span class="guide-fact">' + step.hint + '</span></div></div>';
    });
    if (storyDone()) {
      html += '<p class="panel-note">Stardust says: you found them all. A new star is shining over the cove tonight. Thank you, Pip.</p>';
    }
    return html;
  }

  function tankHtml() {
    var html = '<p class="panel-note">Fish you keep swim here. Feed them shells to help them grow, or release them back.</p>';
    html += '<div class="tank">';
    if (!save.tank.length) {
      html += '<span class="tank-empty">The tank is empty. Keep a catch from the result card or add one below.</span>';
    }
    save.tank.forEach(function (item, index) {
      var fish = findFish(item.fishId);
      if (!fish) return;
      var size = (1.9 * (1 + item.growth * 0.06)).toFixed(2);
      html += '<span class="tank-fish" style="left:' + (10 + index * 17) + '%;top:' + (20 + (index % 3) * 18) + '%;font-size:' + size + 'rem" title="' + fish.name + '" aria-hidden="true">' + fish.icon + '</span>';
    });
    html += '</div><div class="tank-list">';
    save.tank.forEach(function (item, index) {
      var fish = findFish(item.fishId);
      if (!fish) return;
      html += '<div class="tank-row"><span>' + fish.icon + ' ' + fish.name + ' \u00b7 ' + round1(item.weight) + ' kg \u00b7 growth ' + item.growth + '/10</span>' +
        '<span class="tank-actions"><button class="tank-btn" type="button" data-feed="' + index + '">Feed \uD83D\uDC1A1</button>' +
        '<button class="tank-btn tank-release" type="button" data-release="' + index + '">Release</button></span></div>';
    });
    html += '</div><div class="tank-add"><b>Add a fish</b>';
    FISH.forEach(function (fish) {
      var entry = save.log[fish.id];
      if (entry && num(entry.count) > 0) {
        html += '<button class="tank-add-btn" type="button" data-add="' + fish.id + '">' + fish.icon + ' ' + fish.name + '</button>';
      }
    });
    if (save.visitorCaught) {
      html += '<button class="tank-add-btn" type="button" data-add="' + VISITOR.id + '">' + VISITOR.icon + ' ' + VISITOR.name + '</button>';
    }
    html += '</div>';
    return html;
  }

  function bindTank() {
    if (!els.panelBody) return;
    els.panelBody.querySelectorAll('[data-add]').forEach(function (button) {
      button.addEventListener('click', function () { addTankFromLog(button.getAttribute('data-add')); });
    });
    els.panelBody.querySelectorAll('[data-feed]').forEach(function (button) {
      button.addEventListener('click', function () { feedTank(Number(button.getAttribute('data-feed'))); });
    });
    els.panelBody.querySelectorAll('[data-release]').forEach(function (button) {
      button.addEventListener('click', function () { releaseTank(Number(button.getAttribute('data-release'))); });
    });
  }

  function addFishToTank(fish, weight) {
    if (!fish) return false;
    if (save.tank.length >= 5) {
      setStatus('The tank is full. Release a fish before adding another.');
      return false;
    }
    save.tank.push({ fishId: fish.id, weight: round1(weight), growth: 0 });
    persist();
    renderPanelIf('tank');
    setStatus(fish.name + ' is swimming in the tank.');
    return true;
  }

  function addTankFromLog(id) {
    var fish = findFish(id);
    if (!fish) return false;
    var entry = fish.id === VISITOR.id ? { best: save.visitorBest } : save.log[fish.id];
    return addFishToTank(fish, entry && entry.best ? entry.best : 0.5);
  }

  function feedTank(index) {
    var item = save.tank[index];
    if (!item) return false;
    if (num(item.growth) >= 10) {
      setStatus('That fish is already fully grown.');
      return false;
    }
    if (num(save.shells) < 1) {
      setStatus('You need a shell to feed a fish.');
      return false;
    }
    save.shells = num(save.shells) - 1;
    item.growth = num(item.growth) + 1;
    persist();
    renderShells();
    renderPanelIf('tank');
    setStatus('Fed the fish. It grew a little.');
    return true;
  }

  function releaseTank(index) {
    if (!save.tank[index]) return false;
    var item = save.tank.splice(index, 1)[0];
    var fish = findFish(item.fishId);
    persist();
    renderPanelIf('tank');
    setStatus((fish ? fish.name : 'The fish') + ' has gone back to the cove.');
    return true;
  }

  function shelfHtml() {
    var entries = [];
    FISH.forEach(function (fish) {
      var entry = save.log[fish.id];
      if (entry && num(entry.count) > 0) {
        entries.push({ name: fish.name, icon: fish.icon, weight: round1(entry.best) });
      }
    });
    if (save.visitorCaught) {
      entries.push({ name: VISITOR.name, icon: VISITOR.icon, weight: round1(save.visitorBest) });
    }
    entries.sort(function (a, b) { return b.weight - a.weight; });
    if (!entries.length) {
      return '<p class="panel-note">Land a fish and its plaque will appear on the shelf.</p>';
    }
    var html = '<p class="panel-note">Your biggest catches, from the heaviest down. Echo says: a good record is one you can beat.</p><div class="shelf">';
    entries.slice(0, 10).forEach(function (entry, index) {
      html += '<div class="shelf-plaque' + (index === 0 ? ' is-top' : '') + '">' +
        '<span class="shelf-rank">' + (index + 1) + '</span>' +
        '<span class="shelf-icon" aria-hidden="true">' + entry.icon + '</span>' +
        '<span class="shelf-name">' + entry.name + '</span>' +
        '<span class="shelf-weight">' + entry.weight + ' kg</span></div>';
    });
    return html + '</div>';
  }

  function enterPhoto() {
    if (session.phase !== 'idle' || session.paused || session.decorating) {
      setStatus('Finish this first, then take a photo.');
      return;
    }
    closePanel();
    session.photoMode = true;
    if (els.resultCard) els.resultCard.hidden = true;
    if (els.cove) els.cove.classList.add('is-photo');
    if (els.photoBar) els.photoBar.hidden = false;
    setStatus('Photo mode. Frame the cove, then save a postcard.');
  }

  function exitPhoto() {
    session.photoMode = false;
    if (els.cove) els.cove.classList.remove('is-photo');
    if (els.photoBar) els.photoBar.hidden = true;
    setStatus('Ready to fish. Press and hold to cast.');
  }

  function postcardColors() {
    if (CONDITIONS.time === 'dawn') return ['#ffe9c9', '#c9e8e7', '#7fb3b3', '#3f6f73'];
    if (CONDITIONS.time === 'dusk') return ['#f7c6a3', '#d9a9b8', '#7f9aa8', '#3f5f6b'];
    if (CONDITIONS.time === 'night') return ['#1e2a3a', '#23384a', '#2c5a63', '#16333a'];
    return ['#cfeff2', '#a8dadc', '#70a3a7', '#4a7c80'];
  }

  function buildPostcard() {
    return loadImage('../assets/mascots/pip-hero.webp').then(function (img) {
      var c = document.createElement('canvas');
      c.width = 900;
      c.height = 600;
      var ctx = c.getContext('2d');
      var colours = postcardColors();
      var g = ctx.createLinearGradient(0, 0, 0, 600);
      g.addColorStop(0, colours[0]);
      g.addColorStop(0.35, colours[1]);
      g.addColorStop(0.55, colours[2]);
      g.addColorStop(1, colours[3]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 900, 600);

      ctx.fillStyle = 'rgba(255, 246, 207, 0.9)';
      ctx.beginPath();
      ctx.arc(760, 95, 46, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 2;
      for (var y = 250; y < 560; y += 34) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(900, y);
        ctx.stroke();
      }

      ctx.fillStyle = '#7a4d24';
      ctx.fillRect(0, 430, 320, 170);
      ctx.fillStyle = '#654321';
      ctx.fillRect(0, 420, 330, 14);

      Object.keys(save.decor || {}).forEach(function (slotId) {
        var item = DECOR.filter(function (d) { return d.id === save.decor[slotId]; })[0];
        var slot = DECOR_SLOTS.filter(function (s) { return s.id === slotId; })[0];
        if (!item || !slot) return;
        ctx.font = '42px "Segoe UI Emoji", "Apple Color Emoji", serif';
        ctx.textAlign = 'center';
        ctx.fillText(item.icon, (slot.left / 100) * 900, 600 - (slot.bottom / 100) * 600);
      });

      ctx.font = '44px "Segoe UI Emoji", "Apple Color Emoji", serif';
      ctx.fillText(VISITOR.icon === '' ? '' : '\uD83D\uDC08', 250, 455);

      if (img) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(150, 460, 88, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, 62, 372, 176, 176);
        ctx.restore();
        ctx.beginPath();
        ctx.arc(150, 460, 88, 0, Math.PI * 2);
        ctx.strokeStyle = '#70a3a7';
        ctx.lineWidth = 6;
        ctx.stroke();
      }

      if (storyDone()) {
        ctx.font = '40px "Segoe UI Emoji", "Apple Color Emoji", serif';
        ctx.fillText('\u2728', 690, 170);
      }

      ctx.fillStyle = 'rgba(251, 248, 242, 0.92)';
      ctx.strokeStyle = '#70a3a7';
      ctx.lineWidth = 4;
      roundRect(ctx, 40, 500, 820, 72, 18);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#1a1208';
      ctx.font = 'bold 28px Fredoka, Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText("Pip's Cozy Cove", 66, 532);
      ctx.fillStyle = '#4e7d80';
      ctx.font = '20px Inter, system-ui, sans-serif';
      ctx.fillText(CONDITIONS.label + ' \u00b7 ' + formatDate(new Date()), 66, 558);
      ctx.textAlign = 'right';
      ctx.fillText('jvdesignstudio.co.uk', 836, 548);
      return c;
    });
  }

  function downloadPostcard() {
    buildPostcard().then(function (canvas) {
      try {
        canvas.toBlob(function (blob) {
          if (!blob) return;
          var url = URL.createObjectURL(blob);
          var link = document.createElement('a');
          link.href = url;
          link.download = 'pips-cozy-cove-postcard.png';
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
          setStatus('Postcard saved. Check your downloads.');
        }, 'image/png');
      } catch (e) {
        setStatus('This browser could not save the postcard.');
      }
    });
  }

  function sharePayload(info) {
    return {
      v: 1,
      fishId: info.fish.id,
      weight: round1(info.weight),
      points: num(info.points),
      date: dateKey(),
      visitor: info.fish.id === VISITOR.id
    };
  }

  function buildShareUrl(info) {
    var data = info || session.lastCatch;
    if (!data) return '';
    return location.origin + location.pathname + '#catch=' + encodeURIComponent(JSON.stringify(sharePayload(data)));
  }

  function shareCatch(info) {
    var data = info || session.lastCatch;
    if (!data) return '';
    var url = buildShareUrl(data);
    try {
      history.replaceState(null, '', '#catch=' + encodeURIComponent(JSON.stringify(sharePayload(data))));
    } catch (e) {}
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        setStatus('Share link copied. Send it to a friend.');
      }, function () {
        setStatus('Share link is in the address bar.');
      });
    } else {
      setStatus('Share link is in the address bar.');
    }
    return url;
  }

  function handleSharedLink() {
    if (!location.hash || location.hash.indexOf('#catch=') !== 0) return false;
    try {
      var payload = JSON.parse(decodeURIComponent(location.hash.slice(7)));
      var fish = findFish(payload.fishId);
      var weight = round1(payload.weight);
      if (!fish || !(weight > 0)) return false;
      showResult(fish, weight, num(payload.points), false, false, false, fish.id === VISITOR.id);
      setStatus('A friend shared this catch. Save the card if you like.');
      return true;
    } catch (e) {
      return false;
    }
  }

  var ambientAudio = { ctx: null, master: null, water: null, waterGain: null, timers: [], started: false };

  function ensureAudio() {
    if (ambientAudio.started) return ambientAudio;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ambientAudio.ctx = new AC(); } catch (e) { return null; }
    var ctx = ambientAudio.ctx;
    ambientAudio.master = ctx.createGain();
    ambientAudio.master.gain.value = soundOn() ? 1 : 0;
    ambientAudio.master.connect(ctx.destination);

    var buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.35;
    var source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    var gain = ctx.createGain();
    gain.gain.value = (num(save.audio.water) / 100) * 0.22;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ambientAudio.master);
    source.start();
    ambientAudio.water = source;
    ambientAudio.waterGain = gain;
    ambientAudio.started = true;
    scheduleLayer('birds');
    scheduleLayer('chimes');
    return ambientAudio;
  }

  function scheduleLayer(layer) {
    if (!ambientAudio.started) return;
    var delay = layer === 'birds' ? 5000 + Math.random() * 7000 : 7000 + Math.random() * 9000;
    ambientAudio.timers.push(window.setTimeout(function () {
      playLayer(layer);
      scheduleLayer(layer);
    }, delay));
  }

  function playLayer(layer) {
    var audio = ambientAudio;
    if (!audio.ctx || !soundOn()) return;
    var volume = num(save.audio[layer]) / 100;
    if (volume <= 0.01) return;
    var ctx = audio.ctx;
    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    if (layer === 'birds') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1600 + Math.random() * 700, now);
      osc.frequency.exponentialRampToValueAtTime(2200, now + 0.12);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume * 0.05, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start(now);
      osc.stop(now + 0.3);
    } else {
      osc.type = 'sine';
      osc.frequency.value = [880, 1046, 1318][Math.floor(Math.random() * 3)];
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume * 0.06, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start(now);
      osc.stop(now + 1.5);
    }
  }

  function setLayerVolume(layer, value) {
    if (['water', 'birds', 'chimes'].indexOf(layer) === -1) return;
    save.audio[layer] = clamp(num(value), 0, 100);
    persist();
    if (layer === 'water' && ambientAudio.waterGain) {
      ambientAudio.waterGain.gain.value = (save.audio.water / 100) * 0.22;
    }
  }

  function startAudioOnce() {
    if (soundOn()) ensureAudio();
  }

  function renderPanelIf(view) {
    if (panelOpen() && session.panelView === view) renderPanel();
  }

  function paintSound() {
    if (!els.sound) return;
    var on = soundOn();
    els.sound.textContent = on ? 'Sound: On' : 'Sound: Off';
    els.sound.setAttribute('aria-pressed', on ? 'false' : 'true');
    els.sound.setAttribute('aria-label', on ? 'Mute sound' : 'Turn sound on');
  }

  function paintBait() {
    BAIT_ORDER.forEach(function (id) {
      var btn = els.baits[id];
      if (!btn) return;
      btn.setAttribute('aria-pressed', session.bait === id ? 'true' : 'false');
    });
    if (session.phase === 'idle' && BAITS[session.bait]) setTip(BAITS[session.bait].hint);
    renderCraftedBaits();
  }

  function paintGentle() {
    if (!els.gentle) return;
    els.gentle.textContent = save.gentle ? 'Gentle: On' : 'Gentle: Off';
    els.gentle.setAttribute('aria-pressed', save.gentle ? 'true' : 'false');
    els.gentle.setAttribute('aria-label', save.gentle ? 'Turn gentle mode off' : 'Turn gentle mode on');
    if (els.cove) els.cove.classList.toggle('is-gentle', save.gentle);
  }

  function paintReelButton() {
    if (session.phase !== 'fighting') return;
    if (!save.gentle) {
      els.action.textContent = 'Hold to reel';
    } else {
      els.action.textContent = session.holdingReel ? 'Tap to stop' : 'Tap to reel';
    }
  }

  function pickZone(power) {
    if (power < 40) return 0;
    if (power < 72) return 1;
    return 2;
  }

  function chooseFish(zone, baitId) {
    var bait = BAITS[baitId] || BAITS.worm;
    var zm = ZONE_MUL[zone] || ZONE_MUL[0];
    var rareMul = CONDITIONS.rare;
    var pool = [];
    var total = 0;
    FISH.forEach(function (f) {
      if (f.minDepth > zone) return;
      if (!areaUnlocked(f.area)) return;
      if (!conditionOk(f)) return;
      var w = (RARITY_BASE[f.rarity] || 10) * (bait.mul[f.rarity] || 1) * (zm[f.rarity] || 1);
      if (f.rarity === 'Rare') w *= rareMul;
      else if (f.rarity === 'Legendary' || f.rarity === 'Mythic') w *= rareMul * rareMul;
      else if (f.rarity === 'Junk') w /= rareMul;
      if (bait.areaBoost && f.area === bait.areaBoost) w *= 2.2;
      if (bait.deepBoost && f.minDepth >= 2) w *= 1.8;
      w *= tideFactor(f);
      if (w <= 0) return;
      pool.push({ fish: f, weight: w });
      total += w;
    });
    if (!pool.length) return FISH[0];
    var roll = Math.random() * total;
    var acc = 0;
    for (var i = 0; i < pool.length; i++) {
      acc += pool[i].weight;
      if (roll < acc) return pool[i].fish;
    }
    return pool[pool.length - 1].fish;
  }

  function aimRod() {
    if (!els.rodLine) return;
    var bx = 44 + session.power * 0.36;
    var by = 66;
    var d = 'M 12 54 Q ' + ((12 + bx) / 2) + ' ' + (by - 18) + ' ' + bx + ' ' + by;
    els.rodLine.setAttribute('d', d);
  }

  function resetRod() {
    if (!els.rodLine) return;
    els.rodLine.setAttribute('d', 'M 15 54 Q 38 16 63 62');
  }

  function bobberLeft(power) {
    return 44 + clamp(power, 0, 100) * 0.36;
  }

  function spawnHotspots() {
    session.hotspots = [];
    if (!els.hotspots) return;
    var count = tackleMods().ripple ? 2 + (Math.random() < 0.5 ? 1 : 0) : (Math.random() < 0.55 ? 1 : 2);
    var html = '';
    for (var i = 0; i < count; i++) {
      var power = 14 + Math.random() * 80;
      session.hotspots.forEach(function (h) {
        if (Math.abs(h.power - power) < 18) power = clamp(power + 28, 10, 95);
      });
      var left = bobberLeft(power);
      session.hotspots.push({ power: power, left: left });
      html += '<span class="hotspot" data-index="' + i + '" style="left:' + left.toFixed(1) + '%;bottom:34%"></span>';
    }
    els.hotspots.innerHTML = html;
  }

  function hotspotFor(power) {
    var best = null;
    session.hotspots.forEach(function (h) {
      var d = Math.abs(h.power - power);
      if (d <= 11 && (!best || d < best.d)) best = { d: d, spot: h };
    });
    return best ? best.spot : null;
  }

  function paintHotspotHit(spot) {
    if (!els.hotspots) return;
    var nodes = els.hotspots.querySelectorAll('.hotspot');
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove('is-hit');
    if (!spot) return;
    var index = session.hotspots.indexOf(spot);
    if (index >= 0 && nodes[index]) nodes[index].classList.add('is-hit');
  }

  function cheerPip() {
    if (!els.pip) return;
    els.pip.classList.remove('is-happy');
    void els.pip.offsetWidth;
    els.pip.classList.add('is-happy');
    window.setTimeout(function () { els.pip.classList.remove('is-happy'); }, 1400);
  }

  function resetScene() {
    clearTimers();
    session.phase = 'idle';
    session.holdingReel = false;
    session.pointerDown = false;
    session.running = false;
    session.fish = null;
    session.visitor = false;
    session.visitorPending = false;
    session.stage = 1;
    session.power = 0;
    session.chargeStart = 0;
    session.tension = 30;
    session.progress = 0;
    session.hookQuality = '';
    els.action.textContent = 'Hold to cast';
    els.action.classList.remove('is-bite', 'is-fight');
    els.bobber.hidden = true;
    els.rod.hidden = true;
    els.bobber.classList.remove('bite-shake', 'nibble');
    els.bobber.style.left = '';
    els.pip.classList.remove('casting');
    if (els.catchFish) {
      els.catchFish.hidden = true;
      els.catchFish.classList.remove('is-running');
      els.catchFish.textContent = '';
    }
    els.powerMeter.hidden = true;
    els.tensionMeter.hidden = true;
    if (els.resultCard) els.resultCard.hidden = true;
    resetRod();
    session.hotspotHit = false;
    if (session.baitExpired) {
      session.baitExpired = false;
      session.bait = 'worm';
      save.bait = 'worm';
      persist();
    }
    spawnHotspots();
    paintBait();
    paintGentle();
    renderCraftedBaits();
  }

  function scheduleWait() {
    var bait = BAITS[session.bait] || BAITS.worm;
    var wait = bait.waitMin + Math.random() * (bait.waitMax - bait.waitMin);
    wait /= CONDITIONS.bites;
    if (session.hotspotHit) wait *= 0.6;
    var nibbles = Math.random() < 0.75 ? 1 + Math.floor(Math.random() * 2) : 0;
    for (var i = 0; i < nibbles; i++) {
      var at = (wait * (i + 1)) / (nibbles + 1) + (Math.random() * 500 - 250);
      if (at > 300 && at < wait - 250) {
        session.nibbleTimers.push(window.setTimeout(nibble, at));
      }
    }
    session.biteTimer = window.setTimeout(bite, wait);
  }

  function nibble() {
    if (session.phase !== 'waiting') return;
    els.bobber.classList.add('nibble');
    window.setTimeout(function () { els.bobber.classList.remove('nibble'); }, 260);
    setStatus('Something is nibbling... wait for the real bite.');
    play('nibble');
  }

  function castAt(power) {
    if (session.paused || session.photoMode || session.decorating) return;
    clearTimers();
    if (session.bait !== 'worm' && BAITS[session.bait] && BAITS[session.bait].crafted) {
      var charges = craftedCharges(session.bait);
      if (charges <= 0) {
        session.bait = 'worm';
        save.bait = 'worm';
        persist();
        paintBait();
      } else {
        save.crafted[session.bait] = charges - 1;
        if (charges - 1 <= 0) session.baitExpired = true;
        persist();
        renderCraftedBaits();
      }
    }
    if (!session.counted) {
      session.counted = true;
      save.gamesPlayed += 1;
      persist();
    }
    session.power = clamp(Number(power) || 0, 0, 100);
    session.zone = pickZone(session.power);
    var spot = hotspotFor(session.power);
    session.hotspotHit = !!spot;
    session.visitorPending = false;
    var deep = effectiveZone(session.zone) >= 2;
    var visitorChance = 0.05 + (session.hotspotHit ? 0.05 : 0) + (CONDITIONS.rare >= 1.4 ? 0.04 : 0);
    if (deep && Math.random() < visitorChance) session.visitorPending = true;
    session.phase = 'waiting';
    session.running = false;
    els.action.textContent = 'Reel in';
    els.action.classList.remove('is-bite', 'is-fight');
    if (els.resultCard) els.resultCard.hidden = true;
    els.bobber.hidden = false;
    els.rod.hidden = false;
    els.bobber.classList.remove('bite-shake', 'nibble');
    els.bobber.style.left = bobberLeft(session.power) + '%';
    els.pip.classList.add('casting');
    paintHotspotHit(spot);
    aimRod();
    if (session.hotspotHit) {
      setStatus('Right on the ripple! Big fish like this spot.');
      announce('Right on the ripple. This is a good spot.');
      setTip('Hot spot! Better fish bite here.');
    } else {
      setStatus('Line cast into the ' + ZONE_NAMES[session.zone].toLowerCase() + '. Waiting for a bite...');
      setTip(ZONE_NAMES[session.zone]);
      announce('Line cast. Waiting for a bite.');
    }
    play('cast');
    scheduleWait();
  }

  function bite() {
    if (session.phase !== 'waiting') return;
    session.phase = 'biting';
    session.hookAt = (window.performance && performance.now) ? performance.now() : Date.now();
    els.action.textContent = 'Set hook!';
    els.action.classList.add('is-bite');
    els.bobber.classList.add('bite-shake');
    if (session.visitorPending) {
      setStatus('The water goes still... something big is circling.');
      announce('The water goes still. Something big is circling.');
    } else {
      setStatus('A real bite! Set the hook now!');
      announce('A real bite. Press Set hook now.');
    }
    play('bite');
    session.escapeTimer = window.setTimeout(escape, biteWindow());
  }

  function setHook() {
    if (session.phase !== 'biting') return;
    if (session.escapeTimer) window.clearTimeout(session.escapeTimer);
    session.escapeTimer = null;
    var now = (window.performance && performance.now) ? performance.now() : Date.now();
    var reaction = now - session.hookAt;
    session.hookQuality = reaction < 380 ? 'perfect' : reaction < 850 ? 'good' : 'late';
    session.visitor = !!session.visitorPending;
    session.visitorPending = false;
    session.stage = 1;
    var fish = session.visitor ? VISITOR : chooseFish(effectiveZone(session.zone), session.bait);
    var strength = fish.strength;
    if (session.hookQuality === 'perfect') strength *= 0.8;
    else if (session.hookQuality === 'good') strength *= 0.92;
    session.fish = fish;
    session.strength = strength;
    session.tension = 26;
    session.progress = 14;
    session.tensionBand = 0;
    session.progressBand = 0;
    session.phase = 'fighting';
    session.running = false;
    session.runUntil = 0;
    session.nextRunAt = now + 1200 + Math.random() * 1400;
    els.action.classList.remove('is-bite');
    els.action.classList.add('is-fight');
    paintReelButton();
    els.bobber.hidden = true;
    els.bobber.classList.remove('bite-shake', 'nibble');
    session.fishLeft = bobberLeft(session.power);
    if (els.catchFish) {
      els.catchFish.hidden = false;
      els.catchFish.textContent = fish.icon;
      els.catchFish.style.left = session.fishLeft + '%';
      els.catchFish.style.bottom = '34%';
      els.catchFish.classList.toggle('is-running', false);
      els.catchFish.classList.toggle('is-visitor', session.visitor);
    }
    els.powerMeter.hidden = true;
    els.tensionMeter.hidden = false;
    if (els.resultCard) els.resultCard.hidden = true;
    var qualityText = session.hookQuality === 'perfect' ? 'Perfect hook! ' :
      session.hookQuality === 'good' ? 'Good hook. ' : '';
    if (session.visitor) {
      setStatus(qualityText + 'Something huge is on the line! ' + (save.gentle ? 'Tap to reel.' : 'Hold to reel.'));
      announce('Something huge is on the line. Reel with care.');
    } else {
      setStatus(qualityText + 'Fish on! ' + (save.gentle ? 'Tap to reel, tap again to ease off.' : 'Hold to reel, let go when the line strains.'));
      announce('Fish on. Reel with care.');
    }
    play('bite');
    updateMeters();
  }

  function beginReel() {
    session.holdingReel = true;
  }

  function endReel() {
    session.holdingReel = false;
  }

  function chargePowerAt(now) {
    var half = 100 / 92;
    var cycle = half * 2;
    var elapsed = Math.max(0, (now - session.chargeStart) / 1000) % cycle;
    return elapsed <= half ? elapsed * 92 : (cycle - elapsed) * 92;
  }

  function updateCharge() {
    var now = (window.performance && performance.now) ? performance.now() : Date.now();
    session.power = chargePowerAt(now);
    setTip(ZONE_NAMES[pickZone(session.power)]);
  }

  function updateFight(dt) {
    var now = (window.performance && performance.now) ? performance.now() : Date.now();
    if (!session.running && now >= session.nextRunAt) {
      session.running = true;
      session.runUntil = now + 800 + Math.random() * 900;
      setStatus('It is pulling! Ease off the reel!');
      play('run');
    } else if (session.running && now >= session.runUntil) {
      session.running = false;
      session.nextRunAt = now + 1300 + Math.random() * 1500;
      setStatus('It is tiring. Reel it in!');
    }

    var strength = session.strength || 1;
    var tensionMul = tackleMods().steady ? 0.85 : 1;
    if (session.running) {
      session.tension += 46 * strength * dt * tensionMul;
      session.progress -= 14 * dt;
      if (session.holdingReel) {
        session.tension += 18 * strength * dt * tensionMul;
        session.progress += (10 / strength) * dt;
      }
    } else if (session.holdingReel) {
      session.progress += (30 / strength) * dt;
      session.tension += 30 * strength * dt * tensionMul;
    } else {
      session.tension -= 40 * dt;
      session.progress -= 7 * dt;
    }

    session.tension = clamp(session.tension, 0, 100);
    session.progress = clamp(session.progress, 0, 110);

    if (els.catchFish) {
      els.catchFish.style.left = (session.fishLeft - (session.progress / 100) * 16).toFixed(1) + '%';
      els.catchFish.classList.toggle('is-running', session.running);
    }

    if (session.tension >= 100) {
      if (save.gentle) {
        session.tension = 100;
        session.progress = clamp(session.progress - 8 * dt, 0, 110);
        if (session.holdingReel) setStatus('The line is too tight. Tap to ease off.');
      } else {
        snap();
        return;
      }
    }

    if (session.progress >= 100) {
      if (session.visitor && session.stage < 2) {
        session.stage = 2;
        session.progress = 34;
        session.tension = Math.max(session.tension, 45);
        session.strength *= 1.1;
        session.nextRunAt = now + 500;
        setStatus('Moonfin makes one last run! Hold on!');
        announce('Moonfin makes one last run. Hold on.');
        play('run');
        return;
      }
      land();
    }
  }

  function updateMeters() {
    if (els.powerFill) els.powerFill.style.width = clamp(session.power, 0, 100) + '%';
    if (els.powerLabel) els.powerLabel.textContent = 'Cast power ' + Math.round(session.power) + '%';
    if (els.tensionFill) els.tensionFill.style.width = clamp(session.tension, 0, 100) + '%';
    if (els.reelFill) els.reelFill.style.width = clamp(session.progress, 0, 100) + '%';
    if (els.tensionLabel) els.tensionLabel.textContent = 'Line tension ' + Math.round(session.tension) + '%';
    if (els.reelLabel) els.reelLabel.textContent = 'Reeled ' + Math.round(session.progress) + '%';
    if (els.tensionMeter) {
      els.tensionMeter.classList.toggle('is-warn', session.tension >= 78 && session.tension < 92);
      els.tensionMeter.classList.toggle('is-danger', session.tension >= 92);
    }
    if (session.phase === 'fighting') {
      var band = session.tension >= 95 ? 3 : session.tension >= 85 ? 2 : session.tension >= 70 ? 1 : 0;
      if (band !== session.tensionBand) {
        session.tensionBand = band;
        if (band === 3) announce('Line tension very high. Let go now.');
        else if (band === 2) announce('Line tension high. Ease off the reel.');
        else if (band === 0) announce('Line tension safe.');
      }
      var pband = session.progress >= 90 ? 2 : session.progress >= 50 ? 1 : 0;
      if (pband !== session.progressBand) {
        session.progressBand = pband;
        if (pband === 2) announce('Almost landed.');
        else if (pband === 1) announce('Half way in.');
      }
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      return;
    }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function wrapLines(ctx, text, maxWidth) {
    var words = String(text).split(' ');
    var lines = [];
    var line = '';
    words.forEach(function (word) {
      var test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    return lines;
  }

  function formatDate(date) {
    try {
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
      return '';
    }
  }

  function loadImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  function buildCatchCard(cardInfo) {
    return loadImage('../assets/mascots/pip-hero.webp').then(function (img) {
      var c = document.createElement('canvas');
      c.width = 720;
      c.height = 900;
      var ctx = c.getContext('2d');
      var info = cardInfo || session.lastCatch || { fish: FISH[0], weight: 0, points: 0, date: new Date() };
      var fish = info.fish;

      var g = ctx.createLinearGradient(0, 0, 0, 900);
      g.addColorStop(0, '#cfeff2');
      g.addColorStop(0.45, '#a8dadc');
      g.addColorStop(1, '#3f6f73');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 720, 900);

      ctx.fillStyle = 'rgba(255, 246, 207, 0.9)';
      ctx.beginPath();
      ctx.arc(592, 118, 52, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      for (var y = 300; y < 900; y += 60) ctx.fillRect(0, y, 720, 3);

      ctx.fillStyle = 'rgba(251, 248, 242, 0.95)';
      ctx.strokeStyle = '#70a3a7';
      ctx.lineWidth = 6;
      roundRect(ctx, 60, 200, 600, 620, 28);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#4e7d80';
      ctx.font = 'bold 22px Inter, system-ui, sans-serif';
      ctx.fillText("PIP'S COZY COVE", 360, 252);

      ctx.font = '140px "Segoe UI Emoji", "Apple Color Emoji", serif';
      ctx.fillText(fish.icon, 360, 408);

      ctx.fillStyle = '#1a1208';
      ctx.font = 'bold 46px Fredoka, Inter, system-ui, sans-serif';
      ctx.fillText(fish.name, 360, 482);

      ctx.fillStyle = '#4e7d80';
      ctx.font = 'bold 30px Inter, system-ui, sans-serif';
      ctx.fillText(round1(info.weight) + ' kg   +' + info.points + ' points', 360, 527);

      ctx.fillStyle = '#6b6152';
      ctx.font = '20px Inter, system-ui, sans-serif';
      ctx.fillText(formatDate(info.date), 360, 562);

      if (fish.fact) {
        ctx.fillStyle = '#4b4232';
        ctx.font = 'italic 22px Inter, system-ui, sans-serif';
        wrapLines(ctx, 'Pip says: ' + fish.fact, 500).slice(0, 3).forEach(function (line, i) {
          ctx.fillText(line, 360, 606 + i * 30);
        });
      }

      if (img) {
        var cx = 160;
        var cy = 742;
        var r = 62;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
        ctx.restore();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = '#70a3a7';
        ctx.lineWidth = 5;
        ctx.stroke();
      }

      ctx.fillStyle = '#4e7d80';
      ctx.font = 'bold 22px Inter, system-ui, sans-serif';
      ctx.fillText('jvdesignstudio.co.uk', 360, 800);

      return c;
    });
  }

  function downloadCatchCard(cardInfo) {
    var info = cardInfo || session.lastCatch;
    if (!info) return;
    buildCatchCard(info).then(function (canvas) {
      try {
        canvas.toBlob(function (blob) {
          if (!blob) return;
          var url = URL.createObjectURL(blob);
          var link = document.createElement('a');
          link.href = url;
          link.download = 'pips-cozy-cove-' + info.fish.id + '.png';
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
          setStatus('Catch card saved. Check your downloads.');
        }, 'image/png');
      } catch (e) {
        setStatus('This browser could not save the card.');
      }
    });
  }

  function showResult(fish, weight, points, isNew, isRecord, wasHotspot, isVisitor) {
    if (!els.resultCard) return;
    session.lastCatch = { fish: fish, weight: weight, points: points, date: new Date(), isNew: isNew };
    els.resultIcon.textContent = fish.icon;
    els.resultTitle.textContent = fish.name;
    els.resultDetail.textContent = round1(weight) + ' kg, +' + points + ' points' +
      (isNew ? ', new fish!' : '') + (isRecord && !isNew ? ', best yet!' : '');
    if (els.resultNote) {
      if (isVisitor) {
        els.resultNote.textContent = 'Pip says: ' + fish.fact;
        els.resultNote.hidden = false;
      } else if (isNew && fish.fact) {
        els.resultNote.textContent = 'Pip says: ' + fish.fact;
        els.resultNote.hidden = false;
      } else if (wasHotspot) {
        els.resultNote.textContent = 'Hot spot catch! That is 10 bonus points.';
        els.resultNote.hidden = false;
      } else {
        els.resultNote.hidden = true;
      }
    }
    els.resultCard.classList.toggle('is-visitor', !!isVisitor);
    els.resultCard.hidden = false;
  }

  function land() {
    if (session.phase !== 'fighting' || !session.fish) return;
    var fish = session.fish;
    var isVisitor = session.visitor;
    var weight = round1(fish.minW + Math.random() * (fish.maxW - fish.minW));
    if (BAITS[session.bait] && BAITS[session.bait].bigFish) {
      weight = round1(Math.min(fish.maxW, weight * 1.25 + 0.3));
    }
    var hookBonus = session.hookQuality === 'perfect' ? 8 : session.hookQuality === 'good' ? 4 : 0;
    var wasHotspot = session.hotspotHit;
    var spotBonus = wasHotspot ? 10 : 0;
    session.streak += 1;
    var points = fish.value + Math.round(weight * 2) + hookBonus + Math.min(session.streak - 1, 5) + spotBonus;
    session.score += points;

    var areasBefore = areasAt(discoveredCount());
    var isNew;
    var isRecord;

    if (isVisitor) {
      isNew = !save.visitorCaught;
      isRecord = weight > round1(save.visitorBest);
      save.visitorCaught = true;
      if (isRecord) save.visitorBest = weight;
      save.totalCaught += 1;
      save.legendary = true;
      if (weight > save.heaviest) save.heaviest = weight;
    } else {
      var entry = save.log[fish.id] && typeof save.log[fish.id] === 'object' ? save.log[fish.id] : { count: 0, best: 0 };
      isNew = num(entry.count) === 0;
      isRecord = weight > round1(entry.best);
      entry.count = num(entry.count) + 1;
      if (isRecord) entry.best = weight;
      save.log[fish.id] = entry;
      save.counts[fish.id] = num(save.counts[fish.id]) + 1;
      save.totalCaught += 1;
      if (fish.rarity === 'Legendary' || fish.rarity === 'Mythic') save.legendary = true;
      if (weight > save.heaviest) save.heaviest = weight;
    }

    var newGoals = updateDaily(fish, weight, isRecord, wasHotspot, isNew);
    var shells = shellReward(isNew, isVisitor, fish.rarity, wasHotspot);
    save.shells = num(save.shells) + shells;
    addToAlbum(fish, weight, points, isVisitor);
    var requestDone = updateRequest(fish, weight, isRecord, isNew, isVisitor);
    var storyStep = updateStory(isVisitor, wasHotspot);

    if (session.score > save.highScore) save.highScore = session.score;
    if (session.streak > save.bestStreak) save.bestStreak = session.streak;

    var previous = save.trophies || [];
    save.trophies = unlockedTrophies();
    var newTrophies = TROPHIES.filter(function (t) {
      return save.trophies.indexOf(t.id) !== -1 && previous.indexOf(t.id) === -1;
    });
    persist();

    var areasAfter = areasAt(discoveredCount());
    var newArea = null;
    AREAS.forEach(function (a) {
      if (!newArea && areasAfter.indexOf(a.id) !== -1 && areasBefore.indexOf(a.id) === -1) newArea = a;
    });

    var extras = ' +' + shells + ' shells.';
    if (newTrophies.length) extras += ' Trophy: ' + newTrophies[0].name + '.';
    if (newGoals.length) extras += ' Goal done: ' + newGoals[0].label + '.';
    if (newArea) extras += ' ' + newArea.name + ' unlocked!';
    if (requestDone) extras += ' ' + requestDone.character + ' says thank you! +' + requestDone.reward + ' shells.';
    if (storyStep) extras += ' Stardust: ' + storyStep.title + '.';
    if (storyStep && storyDone()) extras += ' The cove has a new star!';

    if (isVisitor) {
      setStatus('You met ' + fish.name + ', ' + round1(weight) + ' kg! +' + points + ' points.' + extras);
      announce('You met the visitor, ' + round1(weight) + ' kilos. ' + points + ' points.' + extras);
      play('catch');
    } else if (fish.id === 'boot') {
      setStatus('You caught an old boot. It still counts!' + extras);
      announce('You caught an old boot. It still counts.' + extras);
      play('junk');
    } else {
      setStatus('You caught a ' + fish.name + ', ' + round1(weight) + ' kg! +' + points + ' points.' + extras);
      announce('You caught a ' + fish.name + ', ' + round1(weight) + ' kilos. ' + points + ' points.' + extras);
      play('catch');
    }

    if (isRecord || isVisitor || fish.rarity === 'Legendary' || fish.rarity === 'Mythic') cheerPip();
    resetScene();
    showResult(fish, weight, points, isNew, isRecord, wasHotspot, isVisitor);
    renderHud();
  }

  function snap() {
    session.streak = 0;
    session.holdingReel = false;
    setStatus('The line snapped! That one was strong. Cast again.');
    announce('The line snapped. That one was strong. Cast again.');
    play('miss');
    resetScene();
    renderHud();
  }

  function escape() {
    if (session.phase !== 'biting') return;
    session.escapeTimer = null;
    session.streak = 0;
    setStatus('It spat out the hook. Wait for the next bite.');
    announce('It got away. Wait for the next bite.');
    play('miss');
    resetScene();
    renderHud();
  }

  function reelEarly() {
    if (session.phase !== 'waiting') return;
    session.streak = 0;
    resetScene();
    setStatus('Reeled in too early. Nothing there yet.');
    announce('Reeled in too early. Nothing there yet.');
    play('miss');
    renderHud();
  }

  function startCharge() {
    if (session.paused || session.decorating || session.photoMode || panelOpen()) return;
    session.phase = 'charging';
    session.power = 0;
    session.chargeStart = (window.performance && performance.now) ? performance.now() : Date.now();
    els.action.textContent = 'Let go to cast';
    els.action.classList.remove('is-bite', 'is-fight');
    if (els.resultCard) els.resultCard.hidden = true;
    els.powerMeter.hidden = false;
    els.tensionMeter.hidden = true;
    setStatus('Hold to build power, then let go to cast.');
    announce('Hold to build power, then let go to cast.');
    setTip(ZONE_NAMES[0]);
    updateMeters();
  }

  function releaseCast() {
    if (session.phase !== 'charging') return;
    updateCharge();
    castAt(session.power);
  }

  function handlePointerDown() {
    if (session.paused) return;
    if (session.decorating || session.photoMode || panelOpen()) return;
    if (session.phase === 'idle') startCharge();
    else if (session.phase === 'waiting') reelEarly();
    else if (session.phase === 'biting') setHook();
    else if (session.phase === 'fighting') {
      if (save.gentle) {
        session.holdingReel = !session.holdingReel;
        setStatus(session.holdingReel ? 'Reeling in. Tap again to ease off.' : 'Easing off. Tap to reel again.');
        paintReelButton();
      } else {
        beginReel();
      }
    }
  }

  function handlePointerUp() {
    if (session.phase === 'charging') releaseCast();
    else if (session.phase === 'fighting' && !save.gentle) endReel();
  }

  function pause() {
    if (session.paused) return;
    session.paused = true;
    session.holdingReel = false;
    if (session.phase === 'waiting' || session.phase === 'biting' || session.phase === 'charging') {
      resetScene();
    } else {
      clearTimers();
    }
    els.pause.textContent = 'Resume';
    els.pause.setAttribute('aria-pressed', 'true');
    els.pause.setAttribute('aria-label', 'Resume game');
    setStatus('Paused. Take your time.');
    announce('Paused.');
  }

  function resume() {
    if (!session.paused) return;
    session.paused = false;
    if (session.phase === 'fighting') {
      session.nextRunAt = ((window.performance && performance.now) ? performance.now() : Date.now()) + 900;
      setStatus('Fish on! ' + (save.gentle ? 'Tap to reel.' : 'Hold to reel, let go when the line strains.'));
      paintReelButton();
    } else {
      setStatus('Ready to fish. Press and hold to cast.');
    }
    els.pause.textContent = 'Pause';
    els.pause.setAttribute('aria-pressed', 'false');
    els.pause.setAttribute('aria-label', 'Pause game');
    announce('Resumed.');
  }

  function togglePause() {
    if (session.paused) resume();
    else pause();
  }

  function selectBait(id) {
    if (!BAITS[id]) return;
    if (session.phase !== 'idle' || session.paused) {
      setStatus('Reel in first, then change bait.');
      return;
    }
    if (BAITS[id].crafted && craftedCharges(id) <= 0) {
      setStatus('That crafted bait has run out. Craft more at the bait bench.');
      return;
    }
    session.bait = id;
    save.bait = id;
    persist();
    paintBait();
    renderCraftedBaits();
    setStatus('Bait set to ' + BAITS[id].name + '. ' + BAITS[id].hint);
    announce('Bait set to ' + BAITS[id].name + '.');
  }

  function toggleGentle() {
    if (session.phase !== 'idle' || session.paused) {
      setStatus('Finish this cast, then change mode.');
      return;
    }
    save.gentle = !save.gentle;
    persist();
    paintGentle();
    setStatus(save.gentle
      ? 'Gentle mode on. Tap to reel, and the line will not snap.'
      : 'Gentle mode off. Hold to reel.');
    announce(save.gentle ? 'Gentle mode on.' : 'Gentle mode off.');
  }

  function resetBucket() {
    var total = 0;
    Object.keys(save.counts).forEach(function (key) {
      total += num(save.counts[key]);
    });
    if (total && !window.confirm('Empty the bucket and fish log? Your best score stays.')) return;
    save.counts = {};
    save.log = {};
    save.totalCaught = 0;
    save.heaviest = 0;
    save.legendary = false;
    save.trophies = [];
    save.visitorCaught = false;
    save.visitorBest = 0;
    persist();
    renderHud();
    setStatus('Bucket emptied. Best score kept.');
    announce('Bucket emptied. Best score kept.');
  }

  function toggleSound() {
    save.sound = !soundOn();
    persist();
    paintSound();
    if (ambientAudio.master) ambientAudio.master.gain.value = save.sound ? 1 : 0;
    if (save.sound) {
      ensureAudio();
      play('cast');
    }
  }

  function frame(ts) {
    if (!session.lastFrame) session.lastFrame = ts;
    var dt = Math.min(0.1, (ts - session.lastFrame) / 1000);
    session.lastFrame = ts;
    applyTide(false);
    if (!session.paused) {
      if (session.phase === 'charging') updateCharge();
      else if (session.phase === 'fighting') updateFight(dt);
    }
    if (session.phase === 'charging' || session.phase === 'fighting') updateMeters();
    session.raf = window.requestAnimationFrame(frame);
  }

  els.action.addEventListener('pointerdown', function (event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    session.pointerDown = true;
    handlePointerDown();
  });

  window.addEventListener('pointerup', function () {
    if (!session.pointerDown) return;
    session.pointerDown = false;
    handlePointerUp();
  });

  window.addEventListener('pointercancel', function () {
    if (!session.pointerDown) return;
    session.pointerDown = false;
    handlePointerUp();
  });

  els.action.addEventListener('contextmenu', function (event) { event.preventDefault(); });

  els.pause.addEventListener('click', togglePause);
  els.sound.addEventListener('click', toggleSound);
  els.reset.addEventListener('click', resetBucket);
  if (els.gentle) els.gentle.addEventListener('click', toggleGentle);
  if (els.cardBtn) els.cardBtn.addEventListener('click', function () { downloadCatchCard(); });
  if (els.guideBtn) els.guideBtn.addEventListener('click', function () { openPanel('guide', els.guideBtn); });
  if (els.albumBtn) els.albumBtn.addEventListener('click', function () { openPanel('album', els.albumBtn); });
  if (els.settingsBtn) els.settingsBtn.addEventListener('click', function () { openPanel('settings', els.settingsBtn); });
  if (els.decorBtn) els.decorBtn.addEventListener('click', enterDecor);
  if (els.decorDone) els.decorDone.addEventListener('click', exitDecor);
  if (els.panelClose) els.panelClose.addEventListener('click', closePanel);
  if (els.tankBtnPanel) els.tankBtnPanel.addEventListener('click', function () { openPanel('tank', els.tankBtnPanel); });
  if (els.craftBtn) els.craftBtn.addEventListener('click', function () { openPanel('craft', els.craftBtn); });
  if (els.shelfBtn) els.shelfBtn.addEventListener('click', function () { openPanel('shelf', els.shelfBtn); });
  if (els.storyBtn) els.storyBtn.addEventListener('click', function () { openPanel('story', els.storyBtn); });
  if (els.photoBtn) els.photoBtn.addEventListener('click', enterPhoto);
  if (els.photoSave) els.photoSave.addEventListener('click', downloadPostcard);
  if (els.photoExit) els.photoExit.addEventListener('click', exitPhoto);
  if (els.tankBtn) els.tankBtn.addEventListener('click', function () {
    if (session.lastCatch) addFishToTank(session.lastCatch.fish, session.lastCatch.weight);
  });
  if (els.shareBtn) els.shareBtn.addEventListener('click', function () { shareCatch(); });
  document.addEventListener('pointerdown', startAudioOnce, { once: true });
  document.addEventListener('keydown', startAudioOnce, { once: true });

  BAIT_ORDER.forEach(function (id) {
    var btn = els.baits[id];
    if (!btn) return;
    btn.addEventListener('click', function () { selectBait(id); });
  });

  document.addEventListener('keydown', function (event) {
    var tag = event.target && event.target.tagName ? event.target.tagName : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (event.key === 'Escape') {
      if (session.photoMode) { event.preventDefault(); exitPhoto(); return; }
      if (session.decorating) { event.preventDefault(); exitDecor(); return; }
      if (panelOpen()) { event.preventDefault(); closePanel(); return; }
    }
    if (session.decorating || session.photoMode || panelOpen()) return;
    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      if (event.repeat) return;
      session.pointerDown = true;
      handlePointerDown();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (event.repeat) return;
      session.pointerDown = true;
      handlePointerDown();
      session.pointerDown = false;
      handlePointerUp();
    } else if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') {
      event.preventDefault();
      togglePause();
    }
  });

  document.addEventListener('keyup', function (event) {
    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      if (!session.pointerDown) return;
      session.pointerDown = false;
      handlePointerUp();
    }
  });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden || session.paused) return;
    if (session.photoMode) exitPhoto();
    else if (session.decorating) exitDecor();
    else pause();
  });

  ensureDaily();
  ensureRequest();
  ensureStory();
  applyAccessibility();
  paintSound();
  paintBait();
  paintGentle();
  applyConditions();
  applyTide(true);
  spawnHotspots();
  renderDecorLayer();
  renderStoryStar();
  renderCraftedBaits();
  renderHud();
  setStatus('Ready to fish. Press and hold to cast.');
  handleSharedLink();
  if (window.requestAnimationFrame) session.raf = window.requestAnimationFrame(frame);

  window.__cozyCove = {
    state: function () {
      return {
        phase: session.phase,
        paused: session.paused,
        score: session.score,
        streak: session.streak,
        highScore: save.highScore,
        totalCaught: save.totalCaught,
        counts: JSON.parse(JSON.stringify(save.counts)),
        log: JSON.parse(JSON.stringify(save.log)),
        trophies: (save.trophies || []).slice(),
        heaviest: save.heaviest,
        bait: session.bait,
        gentle: !!save.gentle,
        reeling: session.holdingReel,
        power: Math.round(session.power),
        zone: session.zone,
        hotspots: session.hotspots.map(function (h) { return Math.round(h.power); }),
        hotspotHit: session.hotspotHit,
        tension: Math.round(session.tension),
        progress: Math.round(session.progress),
        hookQuality: session.hookQuality,
        visitor: session.visitor,
        visitorPending: session.visitorPending,
        visitorCaught: !!save.visitorCaught,
        stage: session.stage,
        discovered: discoveredCount(),
        tackle: tackleMods(),
        areas: areasAt(discoveredCount()),
        shells: num(save.shells),
        album: (save.album || []).map(function (a) { return { fishId: a.fishId, name: a.name, weight: a.weight, points: a.points, date: a.date, visitor: a.visitor }; }),
        ownedDecor: (save.ownedDecor || []).slice(),
        decor: JSON.parse(JSON.stringify(save.decor || {})),
        crafted: JSON.parse(JSON.stringify(save.crafted || {})),
        tank: (save.tank || []).map(function (t) { return { fishId: t.fishId, weight: t.weight, growth: t.growth }; }),
        story: save.story ? { step: save.story.step, found: (save.story.found || []).slice() } : { step: 0, found: [] },
        storyDone: storyDone(),
        audio: { water: save.audio.water, birds: save.audio.birds, chimes: save.audio.chimes },
        tide: round2(session.tide),
        tidePhase: session.tidePhase,
        tideRising: session.tideRising,
        photoMode: session.photoMode,
        request: save.request ? { index: save.request.index, value: save.request.value, done: save.request.done } : null,
        theme: save.theme,
        largeText: !!save.largeText,
        decorating: session.decorating,
        selectedDecor: session.selectedDecor,
        panel: panelOpen() ? session.panelView : '',
        tensionBand: session.tensionBand,
        progressBand: session.progressBand,
        daily: save.daily ? JSON.parse(JSON.stringify(save.daily)) : null,
        conditions: {
          time: CONDITIONS.time,
          weather: CONDITIONS.weather,
          label: CONDITIONS.label,
          rare: CONDITIONS.rare,
          bites: CONDITIONS.bites
        },
        lastCatch: session.lastCatch ? {
          id: session.lastCatch.fish.id,
          name: session.lastCatch.fish.name,
          weight: session.lastCatch.weight,
          points: session.lastCatch.points
        } : null
      };
    },
    cast: function (power) { castAt(typeof power === 'number' ? power : 55); },
    charge: startCharge,
    release: releaseCast,
    forceBite: function () {
      if (session.biteTimer) window.clearTimeout(session.biteTimer);
      session.biteTimer = null;
      bite();
    },
    forceVisitor: function () { session.visitorPending = true; },
    clearVisitor: function () { session.visitorPending = false; },
    setHook: setHook,
    forceCatch: land,
    reel: function (on) {
      session.holdingReel = !!on;
      paintReelButton();
    },
    snap: snap,
    step: function (seconds) {
      if (session.phase !== 'fighting') return;
      updateFight(Math.min(0.5, Math.max(0.01, Number(seconds) || 0.1)));
      updateMeters();
    },
    setTension: function (value) { session.tension = clamp(Number(value) || 0, 0, 100); },
    setProgress: function (value) { session.progress = clamp(Number(value) || 0, 0, 110); },
    selectBait: selectBait,
    toggleGentle: toggleGentle,
    reset: resetBucket,
    refreshHotspots: spawnHotspots,
    tackleAt: function (total) { return tackleModsAt(num(total)); },
    areasAt: function (found) { return areasAt(num(found)); },
    cardDataUrl: function () {
      return buildCatchCard().then(function (canvas) { return canvas.toDataURL('image/png'); });
    },
    exportSave: exportSaveJson,
    importSave: importSaveJson,
    setTide: function (value) {
      session.tideOverride = value === null ? null : clamp(Number(value) || 0, 0, 1);
      applyTide(true);
    },
    tideFactor: function (id) {
      var fish = findFish(id);
      return fish ? round2(tideFactor(fish)) : 1;
    },
    craftBait: craftBait,
    craftCharges: craftedCharges,
    addTank: function (index) {
      var entry = (save.album || [])[Number(index) || 0];
      var fish = entry ? findFish(entry.fishId) : null;
      if (!fish) return false;
      return addFishToTank(fish, entry.weight);
    },
    addTankFish: function (id) { return addTankFromLog(id); },
    feedTank: feedTank,
    releaseTank: releaseTank,
    enterPhoto: enterPhoto,
    exitPhoto: exitPhoto,
    postcardDataUrl: function () {
      return buildPostcard().then(function (canvas) { return canvas.toDataURL('image/png'); });
    },
    shareUrl: function () { return buildShareUrl(session.lastCatch); },
    shareCatch: shareCatch,
    handleSharedLink: handleSharedLink,
    setLayerVolume: setLayerVolume,
    availableFish: availableFish,
    fishNeeds: function (id) {
      var fish = findFish(id);
      return fish ? (fish.needs || null) : null;
    },
    enterDecor: enterDecor,
    exitDecor: exitDecor,
    chooseDecor: chooseDecor,
    placeDecor: placeDecor,
    openPanel: openPanel,
    closePanel: closePanel,
    fish: FISH,
    visitor: VISITOR,
    baits: BAITS,
    tackle: TACKLE,
    areasList: AREAS,
    decorList: DECOR,
    decorSlots: DECOR_SLOTS,
    requests: REQUEST_TEMPLATES,
    trophies: TROPHIES
  };
})();
