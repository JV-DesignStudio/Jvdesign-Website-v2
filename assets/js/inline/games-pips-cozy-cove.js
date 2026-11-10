(function () {
  'use strict';

  var STORAGE_KEY = 'jvds_game_pips-cozy-cove';
  var WAIT_MIN = 2000;
  var WAIT_MAX = 6000;
  var BITE_WINDOW = 1500;

  var FISH = [
    { id: 'carp', name: 'Common Carp', icon: '\uD83D\uDC1F', chance: 45, value: 5, rarity: 'Common' },
    { id: 'puffer', name: 'Pufferfish', icon: '\uD83D\uDC21', chance: 25, value: 10, rarity: 'Uncommon' },
    { id: 'squid', name: 'Squid', icon: '\uD83E\uDD91', chance: 13, value: 25, rarity: 'Rare' },
    { id: 'starfish', name: 'Rare Starfish', icon: '\u2B50', chance: 5, value: 50, rarity: 'Legendary' },
    { id: 'boot', name: 'Old Boot', icon: '\uD83E\uDD7E', chance: 12, value: 1, rarity: 'Junk' }
  ];

  var els = {
    status: document.getElementById('statusText'),
    a11y: document.getElementById('a11yStatus'),
    action: document.getElementById('actionBtn'),
    pause: document.getElementById('pauseBtn'),
    sound: document.getElementById('soundBtn'),
    reset: document.getElementById('resetBtn'),
    bobber: document.getElementById('bobber'),
    rod: document.getElementById('rod'),
    pip: document.getElementById('pip'),
    score: document.getElementById('scoreHud'),
    best: document.getElementById('bestHud'),
    caught: document.getElementById('caughtHud'),
    streak: document.getElementById('streakHud'),
    bucketCount: document.getElementById('bucketCount'),
    bucketList: document.getElementById('bucketList'),
    bucketEmpty: document.getElementById('bucketEmpty')
  };

  var save = loadSave();
  var session = {
    phase: 'idle',
    paused: false,
    score: 0,
    streak: 0,
    biteTimer: null,
    escapeTimer: null,
    sfx: null,
    counted: false
  };

  function num(value) {
    var n = Number(value);
    return isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }

  function loadSave() {
    var base = { version: 1, highScore: 0, bestStreak: 0, totalCaught: 0, gamesPlayed: 0, counts: {}, sound: true };
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return base;
      var stored = JSON.parse(raw);
      if (!stored || typeof stored !== 'object') return base;
      return {
        version: 1,
        highScore: num(stored.highScore),
        bestStreak: num(stored.bestStreak),
        totalCaught: num(stored.totalCaught),
        gamesPlayed: num(stored.gamesPlayed),
        counts: stored.counts && typeof stored.counts === 'object' ? stored.counts : {},
        sound: stored.sound !== false
      };
    } catch (e) {
      return base;
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
      else if (name === 'bite') sfx.playTap(880);
      else if (name === 'catch') sfx.playSuccess(1100);
      else if (name === 'junk') sfx.playPop();
      else if (name === 'miss') sfx.playError();
    } catch (e) {}
  }

  function setStatus(text) {
    if (els.status) els.status.textContent = text;
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
    session.biteTimer = null;
    session.escapeTimer = null;
  }

  function renderBucket() {
    if (!els.bucketList) return;
    var total = 0;
    var rows = [];
    FISH.forEach(function (fish) {
      var n = num(save.counts[fish.id]);
      if (!n) return;
      total += n;
      rows.push(
        '<li class="bucket-item" title="' + fish.rarity + ' ' + fish.name + '">' +
          '<span class="icon" aria-hidden="true">' + fish.icon + '</span>' +
          '<span class="name">' + fish.name + '</span>' +
          '<b class="count">' + n + '</b>' +
        '</li>'
      );
    });
    els.bucketList.innerHTML = rows.join('');
    els.bucketCount.textContent = total;
    els.bucketEmpty.hidden = total > 0;
  }

  function renderHud() {
    els.score.textContent = session.score;
    els.best.textContent = save.highScore;
    els.caught.textContent = save.totalCaught;
    els.streak.textContent = session.streak;
    renderBucket();
  }

  function paintSound() {
    if (!els.sound) return;
    var on = soundOn();
    els.sound.textContent = on ? 'Sound: On' : 'Sound: Off';
    els.sound.setAttribute('aria-pressed', on ? 'false' : 'true');
    els.sound.setAttribute('aria-label', on ? 'Mute sound' : 'Turn sound on');
  }

  function finishCast() {
    session.phase = 'idle';
    els.action.textContent = 'Cast line';
    els.action.classList.remove('is-bite');
    els.bobber.hidden = true;
    els.rod.hidden = true;
    els.bobber.classList.remove('bite-shake');
    els.pip.classList.remove('casting');
  }

  function rollFish() {
    var roll = Math.random() * 100;
    var acc = 0;
    for (var i = 0; i < FISH.length; i++) {
      acc += FISH[i].chance;
      if (roll < acc) return FISH[i];
    }
    return FISH[0];
  }

  function cast() {
    if (session.paused) return;
    clearTimers();
    if (!session.counted) {
      session.counted = true;
      save.gamesPlayed += 1;
      persist();
    }
    session.phase = 'waiting';
    els.action.textContent = 'Reel in';
    els.action.classList.remove('is-bite');
    els.bobber.hidden = false;
    els.rod.hidden = false;
    els.bobber.classList.remove('bite-shake');
    els.pip.classList.add('casting');
    setStatus('Waiting for a bite...');
    announce('Line cast. Waiting for a bite.');
    play('cast');
    var wait = WAIT_MIN + Math.floor(Math.random() * (WAIT_MAX - WAIT_MIN + 1));
    session.biteTimer = window.setTimeout(bite, wait);
  }

  function bite() {
    if (session.phase !== 'waiting') return;
    session.phase = 'biting';
    els.action.textContent = 'Pull!';
    els.action.classList.add('is-bite');
    els.bobber.classList.add('bite-shake');
    setStatus('A bite! Reel it in!');
    announce('A bite! Press Pull now.');
    play('bite');
    session.escapeTimer = window.setTimeout(escape, BITE_WINDOW);
  }

  function catchFish() {
    if (session.phase !== 'biting') return;
    if (session.escapeTimer) window.clearTimeout(session.escapeTimer);
    session.escapeTimer = null;
    var fish = rollFish();
    session.score += fish.value;
    session.streak += 1;
    save.totalCaught += 1;
    save.counts[fish.id] = num(save.counts[fish.id]) + 1;
    if (session.score > save.highScore) save.highScore = session.score;
    if (session.streak > save.bestStreak) save.bestStreak = session.streak;
    persist();
    if (fish.id === 'boot') {
      setStatus('You caught an old boot. Still counts!');
      announce('You caught an old boot. Still counts.');
      play('junk');
    } else {
      setStatus('You caught a ' + fish.name + '! +' + fish.value);
      announce('You caught a ' + fish.name + '. ' + fish.value + ' points.');
      play('catch');
    }
    finishCast();
    renderHud();
  }

  function escape() {
    if (session.phase !== 'biting') return;
    session.escapeTimer = null;
    session.streak = 0;
    setStatus('It got away... cast again.');
    announce('It got away. Cast again.');
    play('miss');
    finishCast();
    renderHud();
  }

  function reelEarly() {
    if (session.phase !== 'waiting') return;
    clearTimers();
    session.streak = 0;
    setStatus('Reeled in too early. Nothing there.');
    announce('Reeled in too early. Nothing there.');
    play('miss');
    finishCast();
    renderHud();
  }

  function handleAction() {
    if (session.paused) return;
    if (session.phase === 'idle') cast();
    else if (session.phase === 'waiting') reelEarly();
    else if (session.phase === 'biting') catchFish();
  }

  function pause() {
    if (session.paused) return;
    session.paused = true;
    clearTimers();
    finishCast();
    els.pause.textContent = 'Resume';
    els.pause.setAttribute('aria-pressed', 'true');
    els.pause.setAttribute('aria-label', 'Resume game');
    setStatus('Paused. Take your time.');
    announce('Paused.');
  }

  function resume() {
    if (!session.paused) return;
    session.paused = false;
    els.pause.textContent = 'Pause';
    els.pause.setAttribute('aria-pressed', 'false');
    els.pause.setAttribute('aria-label', 'Pause game');
    setStatus('Ready to fish.');
    announce('Resumed. Ready to fish.');
  }

  function togglePause() {
    if (session.paused) resume();
    else pause();
  }

  function resetBucket() {
    var total = 0;
    Object.keys(save.counts).forEach(function (key) {
      total += num(save.counts[key]);
    });
    if (total && !window.confirm('Empty the bucket? Your best score stays.')) return;
    save.counts = {};
    save.totalCaught = 0;
    persist();
    renderHud();
    setStatus('Bucket emptied. Best score kept.');
    announce('Bucket emptied. Best score kept.');
  }

  function toggleSound() {
    save.sound = !soundOn();
    persist();
    paintSound();
    if (save.sound) play('cast');
  }

  els.action.addEventListener('click', handleAction);
  els.pause.addEventListener('click', togglePause);
  els.sound.addEventListener('click', toggleSound);
  els.reset.addEventListener('click', resetBucket);

  document.addEventListener('keydown', function (event) {
    var tag = event.target && event.target.tagName ? event.target.tagName : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') {
      event.preventDefault();
      togglePause();
    }
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && !session.paused) pause();
  });

  paintSound();
  renderHud();
  setStatus('Ready to fish. Cast a line when you are.');

  window.__cozyCove = {
    state: function () {
      return {
        phase: session.phase,
        paused: session.paused,
        score: session.score,
        streak: session.streak,
        highScore: save.highScore,
        totalCaught: save.totalCaught,
        counts: JSON.parse(JSON.stringify(save.counts))
      };
    },
    cast: cast,
    forceBite: function () {
      if (session.biteTimer) window.clearTimeout(session.biteTimer);
      session.biteTimer = null;
      bite();
    },
    catchFish: catchFish,
    reset: resetBucket,
    fish: FISH
  };
})();
