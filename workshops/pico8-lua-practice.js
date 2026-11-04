/* A1878: four-stage Lua practice for the PICO-8 workshops.
   Each page gets Predict, Type, Debug and Create. The final Create stage
   only completes when the learner writes a code change and explains it.
   Progress saves in localStorage on this device. */
(function () {
  'use strict';

  var DATA = {
    'pico8-pong': {
      predict: {
        code: 'if by <= 0 or by + bsz >= 128 then\n  bvy = -bvy\nend',
        question: 'What happens when the ball reaches the top or bottom edge?',
        options: ['It disappears', 'It reverses vertical direction', 'It speeds up', 'It resets the score'],
        correct: 1,
        why: 'Flipping bvy reverses the vertical direction, so the ball bounces off the wall.'
      },
      type: {
        prompt: 'Inside _update(), write the line that moves the ball horizontally by its velocity bvx.',
        accept: ['bx += bvx', 'bx = bx + bvx'],
        hint: 'Start with bx and add bvx.'
      },
      debug: {
        code: 'if bx <= 8 and bvx < 0 then\n  bvx = bvx\nend',
        prompt: 'The ball does not bounce off the left paddle. Type the fixed line inside the if.',
        accept: ['bvx = -bvx', 'bvx = -bvx * 1.05'],
        hint: 'Reverse the horizontal speed.'
      },
      create: {
        prompt: 'Make every paddle hit speed the ball up a little. Write the line that changes bvx.',
        mustInclude: ['bvx', '-', '*'],
        minWhy: 40,
        example: 'bvx = -bvx * 1.05'
      }
    },
    'pico8-snake': {
      predict: {
        code: 'if head.x == fx and head.y == fy then\n  score += 1\n  placeFood()\nelse\n  snake.pop()\nend',
        question: 'What happens to the snake when the head reaches the food?',
        options: ['It loses a segment', 'It scores and keeps its tail', 'It stops moving', 'It restarts'],
        correct: 1,
        why: 'The score goes up and the tail is not removed, so the snake grows by one segment.'
      },
      type: {
        prompt: 'Add the first snake segment at grid position x=8, y=8.',
        accept: ['add(snake, {x=8, y=8})', 'add(snake,{x=8,y=8})'],
        hint: 'Use add() and a table with x and y.'
      },
      debug: {
        code: 'if head.x == fx and head.y == fy then\n  snake.pop()\nend',
        prompt: 'The snake shrinks when it eats. Type the line that should run inside the if instead of snake.pop().',
        accept: ['score += 1', 'score = score + 1'],
        hint: 'Add one to the score.'
      },
      create: {
        prompt: 'Change the growth rule so one food adds two segments. Write the code that adds them.',
        mustInclude: ['snake', 'add'],
        minWhy: 40,
        example: 'for i=1,2 do add(snake, {x=head.x, y=head.y}) end'
      }
    },
    'pico8-shooter': {
      predict: {
        code: 'if btn(4) and fireTimer == 0 then\n  add(bullets, {x=sx+sw/2-1, y=sy-4, w=2, h=4})\n  fireTimer = 8\nend',
        question: 'Why does the code check fireTimer before adding a bullet?',
        options: ['To make the ship invisible', 'To limit the fire rate', 'To move the enemy', 'To change the score'],
        correct: 1,
        why: 'The timer stops the player from firing a bullet every single frame.'
      },
      type: {
        prompt: 'Write the line that adds 1 to the enemy spawn timer each frame.',
        accept: ['spawnTimer += 1', 'spawnTimer = spawnTimer + 1'],
        hint: 'Start with spawnTimer and add 1.'
      },
      debug: {
        code: 'if overlap then\n  enemies[e].hp -= 0\nend',
        prompt: 'A bullet hits an enemy but the enemy never loses health. Type the fixed line that removes 1 HP.',
        accept: ['enemies[e].hp -= 1', 'enemies[e].hp = enemies[e].hp - 1'],
        hint: 'Subtract 1 from hp.'
      },
      create: {
        prompt: 'Make each enemy take two hits before it is destroyed. Write the line that sets its health.',
        mustInclude: ['hp', '2'],
        minWhy: 40,
        example: 'enemies[e].hp = 2'
      }
    },
    'pico8-match3': {
      predict: {
        code: 'local temp = grid[curY][curX]\ngrid[curY][curX] = grid[curY][curX + 1]\ngrid[curY][curX + 1] = temp',
        question: 'Why is a temp variable needed to swap two gems?',
        options: ['To slow the game down', 'To save the first value before it is overwritten', 'To draw the board', 'To add a new colour'],
        correct: 1,
        why: 'Without temp, the first value is lost as soon as the second value is written.'
      },
      type: {
        prompt: 'Write the line that saves the gem under the cursor in a local temp variable.',
        accept: ['local temp = grid[curY][curX]', 'temp = grid[curY][curX]'],
        hint: 'Use local temp = ... and the cursor row and column.'
      },
      debug: {
        code: 'if grid[r][c] == grid[r][c+1] and grid[r][c] == grid[r][c+3] then',
        prompt: 'A match of three should check c+2, not c+3. Type the corrected condition.',
        accept: ['grid[r][c] == grid[r][c+1] and grid[r][c] == grid[r][c+2]', 'grid[r][c] == grid[r][c+2]', 'grid[r][c+2]'],
        hint: 'The third gem is two columns from the first.'
      },
      create: {
        prompt: 'Make a match of four give a bonus. Write code that checks for a fourth gem and adds score.',
        mustInclude: ['score', 'grid'],
        minWhy: 40,
        example: 'if grid[r][c] == grid[r][c+3] then score += 5 end'
      }
    },
    'pico8-dungeon': {
      predict: {
        code: 'if btn(0) then mx = -1.5 end\nif btn(1) then mx = 1.5 end',
        question: 'Which direction does the player move when btn(0) is held?',
        options: ['Up', 'Down', 'Left', 'Right'],
        correct: 2,
        why: 'btn(0) is the left button, so mx becomes negative and the player moves left.'
      },
      type: {
        prompt: 'Write the line that moves the player left at 1.5 pixels per frame when btn(0) is held.',
        accept: ['if btn(0) then mx = -1.5 end'],
        hint: 'Use btn(0) and a negative mx.'
      },
      debug: {
        code: 'if hp <= 1 then\n  gameOver()\nend',
        prompt: 'The game ends while the player still has 1 HP. Type the fixed condition so it ends at 0 HP.',
        accept: ['if hp <= 0 then', 'hp <= 0'],
        hint: 'The game should end when hp reaches 0.'
      },
      create: {
        prompt: 'Add a potion that restores 1 HP. Write the line that changes hp.',
        mustInclude: ['hp', '1'],
        minWhy: 40,
        example: 'hp = hp + 1'
      }
    },
    'pico8-platformer': {
      predict: {
        code: 'if btnp(4) and grounded then\n  pvy = -3\nend',
        question: 'Why use btnp(4) instead of btn(4) for the jump?',
        options: ['It makes the player heavier', 'It fires only on the frame the button is pressed', 'It draws the player', 'It changes the map'],
        correct: 1,
        why: 'btnp() returns true once on the press, so holding the button does not repeat the jump every frame.'
      },
      type: {
        prompt: 'Write the line that adds gravity to the player vertical speed each frame.',
        accept: ['pvy += 0.15', 'pvy = pvy + 0.15'],
        hint: 'Start with pvy and add 0.15.'
      },
      debug: {
        code: 'pvy += 1.5',
        prompt: 'Gravity is far too strong and the player slams into the ground. Type the fixed gravity line.',
        accept: ['pvy += 0.15', 'pvy = pvy + 0.15'],
        hint: 'The starter value is 0.15, not 1.5.'
      },
      create: {
        prompt: 'Add a double jump. Write code that allows a second jump while the player is in the air.',
        mustInclude: ['jump', '2'],
        minWhy: 40,
        example: 'if jumps < 2 then jumps += 1; pvy = -3 end'
      }
    }
  };

  var id = String(window.WORKSHOP_PROFILE_ID || '').replace(/-workshop$/, '');
  if (!id) {
    var m = /pico8-([a-z0-9]+)-workshop/.exec(location.pathname);
    if (m) id = 'pico8-' + m[1];
  }
  var cfg = DATA[id];
  if (!cfg) return;
  if (document.querySelector('[data-lua-practice]')) return;

  var KEY = 'jvds-pico8-lua-' + id;
  var STAGES = ['predict', 'type', 'debug', 'create'];
  var state = load();

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function load() {
    var blank = { predict: false, type: false, debug: false, create: false, values: { type: '', debug: '', code: '', why: '' } };
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return blank;
      var d = JSON.parse(raw);
      if (!d || typeof d !== 'object') return blank;
      return {
        predict: !!d.predict, type: !!d.type, debug: !!d.debug, create: !!d.create,
        values: { type: d.values && d.values.type || '', debug: d.values && d.values.debug || '', code: d.values && d.values.code || '', why: d.values && d.values.why || '' }
      };
    } catch (e) { return blank; }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* keep going */ }
  }

  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, '').replace(/;+$/, '');
  }

  function accepted(value, list) {
    var v = norm(value);
    return (list || []).some(function (a) { return norm(a) === v; });
  }

  var css = [
    '.lua-practice{max-width:900px;margin:0 auto 42px;padding:0 20px;scroll-margin-top:80px}',
    '.lua-practice-inner{background:var(--card,#fff);border:1.5px solid var(--border,rgba(64,59,51,.14));border-radius:16px;padding:24px}',
    '.lp-kicker{margin:0 0 6px;font-size:.72rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--teal-dk,#4e7d80)}',
    '.lua-practice h2{font-family:Fredoka,cursive;font-size:1.35rem;margin:0 0 8px;color:var(--charcoal,#1a1208)}',
    '.lua-practice .lp-intro{margin:0 0 14px;font-size:.9rem;line-height:1.6;color:var(--charcoal-lt,#3d3224)}',
    '.lp-progress{display:flex;align-items:center;gap:10px;margin:0 0 14px}',
    '.lp-count{font-size:.78rem;font-weight:800;color:var(--charcoal-lt,#3d3224);white-space:nowrap}',
    '.lp-bar{flex:1;height:8px;border-radius:999px;background:var(--border,rgba(64,59,51,.14));overflow:hidden}',
    '.lp-fill{display:block;width:0;height:100%;background:var(--teal-dk,#4e7d80);transition:width .3s}',
    '.lp-stage{border:1.5px solid var(--border,rgba(64,59,51,.14));border-radius:12px;padding:14px 16px;margin:0 0 10px;background:var(--beige,#F0EAD6)}',
    '.lp-stage.is-done{border-color:var(--teal-dk,#4e7d80);background:var(--teal-lt,#e8f2f3)}',
    '.lp-stage h3{font-family:Fredoka,cursive;font-size:1.05rem;margin:0 0 4px;color:var(--charcoal,#1a1208)}',
    '.lp-num{display:inline-block;margin-right:6px;font-size:.7rem;font-weight:800;color:var(--teal-dk,#4e7d80)}',
    '.lp-stage p{margin:0 0 8px;font-size:.86rem;line-height:1.55;color:var(--charcoal-lt,#3d3224)}',
    '.lp-code{margin:0 0 10px;padding:10px 12px;border-radius:8px;background:#1e1b2e;color:#f8f4d8;font-family:"JetBrains Mono",monospace;font-size:.78rem;line-height:1.5;white-space:pre-wrap;overflow-x:auto}',
    '.lp-options{display:grid;gap:6px;margin:0 0 10px}',
    '.lp-opt{font:inherit;text-align:left;padding:8px 12px;border-radius:8px;border:1.5px solid var(--border,rgba(64,59,51,.2));background:var(--card,#fff);color:var(--charcoal,#1a1208);cursor:pointer}',
    '.lp-opt.sel{border-color:var(--teal-dk,#4e7d80);background:var(--teal-lt,#e8f2f3)}',
    '.lp-label{display:block;margin:0 0 8px;font-size:.78rem;font-weight:800;color:var(--charcoal,#1a1208)}',
    '.lp-input,.lp-textarea{display:block;width:100%;margin-top:4px;font:inherit;font-size:.88rem;padding:9px 10px;border-radius:8px;border:1.5px solid var(--border,rgba(64,59,51,.2));background:var(--card,#fff);color:var(--charcoal,#1a1208)}',
    '.lp-textarea{min-height:70px;resize:vertical;font-family:"JetBrains Mono",monospace;font-size:.82rem}',
    '.lp-btn{font:inherit;font-weight:800;font-size:.82rem;padding:9px 16px;border-radius:999px;border:1.5px solid var(--teal-dk,#4e7d80);background:var(--teal-dk,#4e7d80);color:#fff;cursor:pointer}',
    '.lp-btn[disabled]{opacity:.5;cursor:not-allowed}',
    '.lp-fb{margin:8px 0 0;font-size:.82rem;line-height:1.5;font-weight:700;color:var(--charcoal-lt,#3d3224)}',
    '.lp-fb.ok{color:#2f7d5c}',
    '.lp-fb.no{color:var(--rose,#BC4749)}',
    '.lp-done{margin:12px 0 0;font-size:.86rem;font-weight:800;color:#2f7d5c}',
    '@media(max-width:560px){.lua-practice-inner{padding:18px 16px}.lp-progress{flex-direction:column;align-items:flex-start}}'
  ].join('');

  function optionsHtml(p) {
    return p.options.map(function (o, i) {
      return '<button type="button" class="lp-opt" data-opt="' + i + '">' + esc(o) + '</button>';
    }).join('');
  }

  var html = '<div class="lua-practice-inner">'
    + '<p class="lp-kicker">Lumo\'s Lua practice</p>'
    + '<h2 id="lua-practice-title">Predict, type, debug, create</h2>'
    + '<p class="lp-intro">Four short stages for this workshop. The last one asks you to change the game in your own way.</p>'
    + '<div class="lp-progress"><span class="lp-count" data-lp-count>0 of 4 done</span><span class="lp-bar" aria-hidden="true"><span class="lp-fill" data-lp-fill></span></span></div>'
    + '<article class="lp-stage" data-stage="predict">'
    + '<h3><span class="lp-num">1</span>Predict</h3>'
    + '<p>' + esc(cfg.predict.question) + '</p>'
    + '<pre class="lp-code">' + esc(cfg.predict.code) + '</pre>'
    + '<div class="lp-options" role="group" aria-label="Predict the result">' + optionsHtml(cfg.predict) + '</div>'
    + '<button type="button" class="lp-btn" data-act="predict">Check prediction</button>'
    + '<p class="lp-fb" data-fb="predict" role="status" aria-live="polite"></p>'
    + '</article>'
    + '<article class="lp-stage" data-stage="type">'
    + '<h3><span class="lp-num">2</span>Type</h3>'
    + '<p>' + esc(cfg.type.prompt) + '</p>'
    + '<label class="lp-label">Your line' + '<input class="lp-input" data-input="type" type="text" autocomplete="off" spellcheck="false"></label>'
    + '<button type="button" class="lp-btn" data-act="type">Check code</button>'
    + '<p class="lp-fb" data-fb="type" role="status" aria-live="polite"></p>'
    + '</article>'
    + '<article class="lp-stage" data-stage="debug">'
    + '<h3><span class="lp-num">3</span>Debug</h3>'
    + '<p>' + esc(cfg.debug.prompt) + '</p>'
    + '<pre class="lp-code">' + esc(cfg.debug.code) + '</pre>'
    + '<label class="lp-label">Your fixed line' + '<input class="lp-input" data-input="debug" type="text" autocomplete="off" spellcheck="false"></label>'
    + '<button type="button" class="lp-btn" data-act="debug">Check fix</button>'
    + '<p class="lp-fb" data-fb="debug" role="status" aria-live="polite"></p>'
    + '</article>'
    + '<article class="lp-stage" data-stage="create">'
    + '<h3><span class="lp-num">4</span>Create</h3>'
    + '<p>' + esc(cfg.create.prompt) + '</p>'
    + '<label class="lp-label">Your code change' + '<textarea class="lp-textarea" data-input="code" spellcheck="false"></textarea></label>'
    + '<label class="lp-label">Why this change? (at least ' + cfg.create.minWhy + ' characters)' + '<textarea class="lp-textarea" data-input="why" spellcheck="false"></textarea></label>'
    + '<button type="button" class="lp-btn" data-act="create">Finish the challenge</button>'
    + '<p class="lp-fb" data-fb="create" role="status" aria-live="polite"></p>'
    + '</article>'
    + '<p class="lp-done" data-lp-done hidden>Practice complete. You predicted, typed, fixed and changed the code.</p>'
    + '</div>';

  var section = document.createElement('section');
  section.className = 'lua-practice';
  section.id = 'lua-practice';
  section.setAttribute('data-lua-practice', '');
  section.setAttribute('aria-labelledby', 'lua-practice-title');
  section.innerHTML = '<style>' + css + '</style>' + html;

  var release = document.querySelector('[data-workshop-release]');
  if (release && release.parentNode) release.parentNode.insertBefore(section, release.nextSibling);
  else {
    var steps = document.getElementById('stepsPanel');
    if (steps && steps.parentNode && steps.parentNode.parentNode) steps.parentNode.parentNode.insertBefore(section, steps.parentNode);
    else document.querySelector('main').appendChild(section);
  }

  var root = section;
  var countEl = root.querySelector('[data-lp-count]');
  var fillEl = root.querySelector('[data-lp-fill]');
  var doneEl = root.querySelector('[data-lp-done]');

  function fb(stage, text, ok) {
    var el = root.querySelector('[data-fb="' + stage + '"]');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'lp-fb' + (text ? (ok ? ' ok' : ' no') : '');
  }

  function award() {
    if (window._wsEngine && typeof window._wsEngine.awardXp === 'function') {
      window._wsEngine.awardXp(10, 'Lua practice');
    }
  }

  function render() {
    STAGES.forEach(function (stage) {
      var card = root.querySelector('[data-stage="' + stage + '"]');
      if (!card) return;
      var done = !!state[stage];
      card.classList.toggle('is-done', done);
      card.setAttribute('data-done', done ? 'true' : 'false');
      card.querySelectorAll('button, input, textarea').forEach(function (el) { el.disabled = done; });
      if (done) {
        if (stage === 'predict') fb(stage, 'Correct.', true);
        else if (stage === 'type' || stage === 'debug') fb(stage, 'Correct.', true);
        else fb(stage, 'Challenge complete.', true);
      }
    });
    var doneCount = STAGES.filter(function (s) { return state[s]; }).length;
    if (countEl) countEl.textContent = doneCount + ' of 4 done';
    if (fillEl) fillEl.style.width = (doneCount / 4 * 100) + '%';
    if (doneEl) doneEl.hidden = doneCount < 4;
  }

  function restoreValues() {
    ['type', 'debug', 'code', 'why'].forEach(function (k) {
      var el = root.querySelector('[data-input="' + k + '"]');
      if (el) el.value = state.values[k] || '';
    });
  }

  root.querySelectorAll('[data-opt]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (state.predict) return;
      root.querySelectorAll('[data-opt]').forEach(function (o) { o.classList.remove('sel'); });
      b.classList.add('sel');
    });
  });

  root.querySelector('[data-act="predict"]').addEventListener('click', function () {
    if (state.predict) return;
    var sel = root.querySelector('[data-opt].sel');
    if (!sel) { fb('predict', 'Pick an answer first.', false); return; }
    if (parseInt(sel.getAttribute('data-opt'), 10) === cfg.predict.correct) {
      state.predict = true;
      save(); render(); award();
    } else {
      fb('predict', 'Not quite. Read the code again, then try another answer.', false);
    }
  });

  function checkLine(stage) {
    if (state[stage]) return;
    var input = root.querySelector('[data-input="' + stage + '"]');
    if (!input) return;
    if (accepted(input.value, cfg[stage].accept)) {
      state[stage] = true;
      state.values[stage] = input.value;
      save(); render(); award();
    } else {
      fb(stage, (cfg[stage].hint ? 'Not yet. ' + cfg[stage].hint : 'Not yet. Check the variable names and spelling.'), false);
    }
  }

  root.querySelector('[data-act="type"]').addEventListener('click', function () { checkLine('type'); });
  root.querySelector('[data-act="debug"]').addEventListener('click', function () { checkLine('debug'); });

  root.querySelector('[data-act="create"]').addEventListener('click', function () {
    if (state.create) return;
    var code = root.querySelector('[data-input="code"]').value;
    var why = root.querySelector('[data-input="why"]').value;
    if (!code.trim()) { fb('create', 'Write your code change first.', false); return; }
    var lower = code.toLowerCase();
    var missing = (cfg.create.mustInclude || []).filter(function (t) { return lower.indexOf(String(t).toLowerCase()) === -1; });
    if (missing.length) { fb('create', 'Your code needs to use: ' + missing.join(', ') + '.', false); return; }
    if (why.trim().length < (cfg.create.minWhy || 40)) { fb('create', 'Write at least ' + (cfg.create.minWhy || 40) + ' characters about why you made this change.', false); return; }
    state.create = true;
    state.values.code = code;
    state.values.why = why;
    save(); render(); award();
  });

  restoreValues();
  render();
})();
