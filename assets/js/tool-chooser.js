/* Which-tool chooser (A2315).
   The tools hub is large, and a new learner often cannot name the tool they
   need. Three short questions narrow it to one tool with a first step. It runs
   entirely on the page, so it works offline and on a locked-down school PC. */
(function () {
  'use strict';

  var form = document.getElementById('chooserForm');
  if (!form) return;

  var toggle = document.getElementById('chooserToggle');
  var panel = document.getElementById('chooserPanel');
  var result = document.getElementById('chooserResult');
  var hint = document.getElementById('chooserHint');
  var closeBtn = document.getElementById('chooserClose');

  var PICKS = {
    art: {
      quick: { name: 'Pixel Studio', href: '../tools/pixel-studio.html#first-mission', step: 'Draw a simple 16x16 sprite, then save the PNG.' },
      medium: { name: 'Pixel Studio', href: '../tools/pixel-studio.html#first-mission', step: 'Draw a character from a template, then export a spritesheet.' },
      long: { name: 'Pixel Studio', href: '../tools/pixel-studio.html#first-mission', step: 'Draw a character with a few frames, then export a spritesheet.' }
    },
    game: {
      quick: { name: 'Arcade Game Maker', href: '../tools/arcade-game-maker.html', step: 'Pick a genre, press Play, then change one thing.' },
      medium: { name: 'Arcade Game Maker', href: '../tools/arcade-game-maker.html', step: 'Start from a template, then add one sound and share it.' },
      long: { name: 'World Builder', href: '../tools/level-designer.html', step: 'Build a small level, then load it into Arcade Game Maker.' }
    },
    sound: {
      quick: { name: 'Audio Studio', href: '../tools/sound-studio.html#sfx', step: 'Switch to SFX and make a short jump or coin sound.' },
      medium: { name: 'Audio Studio', href: '../tools/sound-studio.html#music', step: 'Start a short backing loop in Music mode, then export a WAV.' },
      long: { name: 'Audio Studio', href: '../tools/sound-studio.html#music', step: 'Build a full loop with drums, then export it for your game.' }
    },
    world: {
      quick: { name: 'World Builder', href: '../tools/level-designer.html', step: 'Place a few tiles to make a small level.' },
      medium: { name: 'World Builder', href: '../tools/level-designer.html', step: 'Build a level with platforms, then export the world data.' },
      long: { name: 'World Builder', href: '../tools/level-designer.html', step: 'Build a level, test it in play mode, then export it.' }
    }
  };

  function chosen(name) {
    var el = form.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : '';
  }

  function focusFirst() {
    var first = form.querySelector('input[name="making"]');
    if (first) first.focus();
  }

  function setOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      focusFirst();
    } else {
      toggle.focus();
    }
  }

  function showResult(pick) {
    result.innerHTML = '';

    var kicker = document.createElement('p');
    kicker.className = 'chooser-result-kicker';
    kicker.textContent = 'Ember suggests';

    var title = document.createElement('h3');
    title.className = 'chooser-result-title';
    title.textContent = pick.name;

    var step = document.createElement('p');
    step.className = 'chooser-result-step';
    step.textContent = 'First step: ' + pick.step;

    var link = document.createElement('a');
    link.className = 'chooser-result-link';
    link.href = pick.href;
    link.textContent = 'Open ' + pick.name;

    var again = document.createElement('button');
    again.type = 'button';
    again.className = 'chooser-result-again';
    again.textContent = 'Choose again';
    again.addEventListener('click', reset);

    result.appendChild(kicker);
    result.appendChild(title);
    result.appendChild(step);
    result.appendChild(link);
    result.appendChild(again);

    form.hidden = true;
    result.hidden = false;
    link.focus();
  }

  function reset() {
    form.reset();
    form.hidden = false;
    result.hidden = true;
    if (hint) hint.textContent = '';
    focusFirst();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var making = chosen('making');
    var time = chosen('time');
    var confidence = chosen('confidence');

    var missing = '';
    if (!making) missing = 'Pick what you want to make first.';
    else if (!time) missing = 'Pick how much time you have.';
    else if (!confidence) missing = 'Pick how confident you feel.';
    if (missing) {
      if (hint) hint.textContent = missing;
      return;
    }
    if (hint) hint.textContent = '';

    // A learner who feels brand new always gets the smallest first step.
    var level = confidence === 'new' ? 'quick' : time;
    var pick = (PICKS[making] && PICKS[making][level]) || PICKS.art.quick;
    showResult(pick);
  });

  toggle.addEventListener('click', function () {
    setOpen(panel.hidden);
  });

  if (closeBtn) closeBtn.addEventListener('click', function () { setOpen(false); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !panel.hidden) {
      e.preventDefault();
      setOpen(false);
    }
  });
})();
