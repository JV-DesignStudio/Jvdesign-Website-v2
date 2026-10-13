(function () {
'use strict';

var W = 8, H = 4, CELL = 90, OX = 60, OY = 80;

var PARTS = [
  { id: 'player',   n: 'Player',   e: '🧍', c: [64, 153, 255],  w: 40, h: 40, kind: 'player' },
  { id: 'platform', n: 'Platform', e: '🟫', c: [128, 128, 140], w: 80, h: 20, kind: 'platform' },
  { id: 'ball',     n: 'Ball',     e: '⚪', c: [255, 212, 51],  w: 20, h: 20, kind: 'ball' },
  { id: 'brick',    n: 'Brick',    e: '🧱', c: [230, 64, 64],   w: 60, h: 24, kind: 'brick' },
  { id: 'enemy',    n: 'Enemy',    e: '👾', c: [150, 70, 200],  w: 34, h: 34, kind: 'enemy' },
  { id: 'goal',     n: 'Goal',     e: '🏁', c: [51, 217, 102],  w: 50, h: 60, kind: 'goal' }
];
var BY_ID = {};
PARTS.forEach(function (p) { BY_ID[p.id] = p; });
function part(id) { return BY_ID[id] || null; }

var FEATURES = [
  { k: 'move',    n: 'Move the player', desc: 'Left and right arrow keys to walk.' },
  { k: 'ball',    n: 'Ball bounces',    desc: 'A ball moves and bounces off the walls.' },
  { k: 'bricks',  n: 'Break the bricks',desc: 'The ball clears bricks when it hits them.' },
  { k: 'enemy',   n: 'Enemies patrol',  desc: 'Enemies walk back and forth across the screen.' },
  { k: 'win',     n: 'Win on the goal', desc: 'Touching the goal shows a win message.' }
];

var S = {
  grid: new Array(W * H).fill(null),
  active: 'platform',
  eraser: false,
  project: 'My First SFML Game',
  author: '',
  features: { move: true, ball: true, bricks: true, win: true }
};

var KEY = 'jvds-cpp-mod-studio-v1';
var soundOn = false, actx = null;
function blip(freq, dur, type) {
  if (!soundOn) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    var o = actx.createOscillator(), g = actx.createGain();
    o.type = type || 'square'; o.frequency.value = freq; g.gain.value = 0.03;
    o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + (dur || 0.07));
  } catch (e) {}
}
function award(amount, onceKey) {
  try {
    var k = 'jvds-cppxp-' + onceKey;
    if (localStorage.getItem(k)) return;
    var tot = parseInt(localStorage.getItem('jvds-cpp-studio-xp') || '0', 10) + amount;
    localStorage.setItem('jvds-cpp-studio-xp', String(tot));
    localStorage.setItem(k, '1');
  } catch (e) {}
}
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify({ grid: S.grid, active: S.active, project: S.project, author: S.author, features: S.features })); } catch (e) {}
}
function restore() {
  try {
    var raw = localStorage.getItem(KEY); if (!raw) return;
    var s = JSON.parse(raw);
    if (Array.isArray(s.grid) && s.grid.length === W * H) S.grid = s.grid;
    if (s.active && part(s.active)) S.active = s.active;
    if (typeof s.project === 'string') S.project = s.project;
    if (typeof s.author === 'string') S.author = s.author;
    if (s.features && typeof s.features === 'object') S.features = s.features;
  } catch (e) {}
}

/* ---------- code build ---------- */
function slug(s, fb) { var out = String(s || '').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, ''); return out || fb; }
function rgb(c) { return c[0] + ', ' + c[1] + ', ' + c[2]; }
function placedItems() {
  var out = [];
  for (var i = 0; i < S.grid.length; i++) {
    var id = S.grid[i];
    if (!id || !part(id)) continue;
    var col = i % W, row = Math.floor(i / W);
    out.push({ id: id, p: BY_ID[id], x: OX + col * CELL, y: OY + row * CELL, w: byIdW(id), h: byIdH(id) });
  }
  return out;
}
function byIdW(id) { return BY_ID[id].w; }
function byIdH(id) { return BY_ID[id].h; }
function byKind(k) { return placedItems().filter(function (it) { return it.p.kind === k; }); }
function emitList(kind, varName) {
  var items = byKind(kind);
  if (!items.length) return ['    std::vector<sf::RectangleShape> ' + varName + ';'];
  var L = ['    std::vector<sf::RectangleShape> ' + varName + ';'];
  items.forEach(function (it) {
    L.push('    ' + varName + '.push_back(sf::RectangleShape(sf::Vector2f(' + it.w + 'f, ' + it.h + 'f)));');
    L.push('    ' + varName + '.back().setPosition(' + it.x + 'f, ' + it.y + 'f);');
    L.push('    ' + varName + '.back().setFillColor(sf::Color(' + rgb(it.p.c) + '));');
  });
  return L;
}
function buildMain() {
  var name = String(S.project || 'My Game').replace(/"/g, '');
  var players = byKind('player');
  var start = players[0] || { x: OX, y: OY, w: 40, h: 40 };
  var L = [];
  L.push('#include <SFML/Graphics.hpp>');
  L.push('#include <vector>');
  L.push('');
  L.push('int main()');
  L.push('{');
  L.push('    sf::RenderWindow window(sf::VideoMode(800, 500), "' + name + '");');
  L.push('    window.setFramerateLimit(60);');
  L.push('');
  L.push('    sf::RectangleShape player(sf::Vector2f(' + start.w + 'f, ' + start.h + 'f));');
  L.push('    player.setPosition(' + start.x + 'f, ' + start.y + 'f);');
  L.push('    player.setFillColor(sf::Color(64, 153, 255));');
  L.push('');
  L.concat(emitList('platform', 'platforms')).forEach(function (l) { L.push(l); });
  if (byKind('brick').length) { L.push(''); L.concat(emitList('brick', 'bricks')).forEach(function (l) { L.push(l); }); }
  if (byKind('enemy').length) { L.push(''); L.concat(emitList('enemy', 'enemies')).forEach(function (l) { L.push(l); }); }
  if (byKind('goal').length) { L.push(''); L.concat(emitList('goal', 'goals')).forEach(function (l) { L.push(l); }); }
  var balls = byKind('ball');
  if (S.features.ball) {
    L.push('');
    var b = balls[0] || { x: 380, y: 220 };
    L.push('    sf::RectangleShape ball(sf::Vector2f(20.f, 20.f));');
    L.push('    ball.setPosition(' + b.x + 'f, ' + b.y + 'f);');
    L.push('    ball.setFillColor(sf::Color(255, 212, 51));');
    L.push('    float ballVX = 4.f, ballVY = 3.f;');
  }
  L.push('');
  L.push('    float speed = 5.f;');
  L.push('    bool won = false;');
  L.push('');
  L.push('    while (window.isOpen())');
  L.push('    {');
  L.push('        sf::Event event;');
  L.push('        while (window.pollEvent(event))');
  L.push('        {');
  L.push('            if (event.type == sf::Event::Closed)');
  L.push('                window.close();');
  L.push('        }');
  L.push('');
  if (S.features.move) {
    L.push('        // --- move the player ---');
    L.push('        if (sf::Keyboard::isKeyPressed(sf::Keyboard::Left))');
    L.push('            player.move(-speed, 0.f);');
    L.push('        if (sf::Keyboard::isKeyPressed(sf::Keyboard::Right))');
    L.push('            player.move(speed, 0.f);');
    L.push('');
  }
  if (S.features.ball) {
    L.push('        // --- move the ball and bounce it off the walls ---');
    L.push('        ball.move(ballVX, ballVY);');
    L.push('        if (ball.getPosition().x < 0.f || ball.getPosition().x > 780.f) ballVX = -ballVX;');
    L.push('        if (ball.getPosition().y < 0.f || ball.getPosition().y > 480.f) ballVY = -ballVY;');
    L.push('');
  }
  if (S.features.bricks) {
    L.push('        // --- break a brick when the ball hits it ---');
    L.push('        if (ball.getGlobalBounds().intersects(player.getGlobalBounds())) { /* bounce off the player */ }');
    L.push('        for (std::size_t i = 0; i < bricks.size(); ++i)');
    L.push('        {');
    L.push('            if (ball.getGlobalBounds().intersects(bricks[i].getGlobalBounds()))');
    L.push('            {');
    L.push('                bricks.erase(bricks.begin() + i);');
    L.push('                ballVY = -ballVY;');
    L.push('                break;');
    L.push('            }');
    L.push('        }');
    L.push('');
  }
  if (S.features.enemy) {
    L.push('        // --- enemies patrol ---');
    L.push('        for (std::size_t i = 0; i < enemies.size(); ++i)');
    L.push('        {');
    L.push('            enemies[i].move(1.5f, 0.f);');
    L.push('            if (enemies[i].getPosition().x < 0.f || enemies[i].getPosition().x > 760.f)');
    L.push('                enemies[i].setPosition(0.f, enemies[i].getPosition().y);');
    L.push('        }');
    L.push('');
  }
  if (S.features.win) {
    L.push('        // --- win when you reach the goal ---');
    L.push('        for (std::size_t i = 0; i < goals.size(); ++i)');
    L.push('            if (player.getGlobalBounds().intersects(goals[i].getGlobalBounds()))');
    L.push('                won = true;');
    L.push('');
  }
  L.push('        // --- draw everything ---');
  L.push('        window.clear(sf::Color(240, 244, 250));');
  L.push('        for (std::size_t i = 0; i < platforms.size(); ++i) window.draw(platforms[i]);');
  if (byKind('brick').length) L.push('        for (std::size_t i = 0; i < bricks.size(); ++i) window.draw(bricks[i]);');
  if (byKind('enemy').length) L.push('        for (std::size_t i = 0; i < enemies.size(); ++i) window.draw(enemies[i]);');
  if (byKind('goal').length) L.push('        for (std::size_t i = 0; i < goals.size(); ++i) window.draw(goals[i]);');
  if (S.features.ball) L.push('        window.draw(ball);');
  L.push('        window.draw(player);');
  if (S.features.win) {
    L.push('        if (won)');
    L.push('        {');
    L.push('            sf::RectangleShape banner(sf::Vector2f(160.f, 40.f));');
    L.push('            banner.setPosition(320.f, 20.f);');
    L.push('            banner.setFillColor(sf::Color(51, 217, 102));');
    L.push('            window.draw(banner);');
    L.push('        }');
  }
  L.push('        window.display();');
  L.push('    }');
  L.push('');
  L.push('    return 0;');
  L.push('}');
  return L.join('\n');
}
function buildCMake() {
  return [
    'cmake_minimum_required(VERSION 3.16)',
    'project(' + slug(S.project, 'my_sfml_game') + ')',
    '',
    'set(CMAKE_CXX_STANDARD 17)',
    '',
    'find_package(SFML 2.5 COMPONENTS graphics window system REQUIRED)',
    '',
    'add_executable(game main.cpp)',
    'target_link_libraries(game sfml-graphics sfml-window sfml-system)'
  ].join('\n');
}
function codePreview() {
  var lines = buildMain().split('\n');
  return lines.slice(0, 34).join('\n') + (lines.length > 34 ? '\n... (' + (lines.length - 34) + ' more lines)' : '');
}

/* ---------- render level ---------- */
function renderBoard() {
  var g = document.getElementById('cBoard'); if (!g) return;
  g.style.gridTemplateColumns = 'repeat(' + W + ', 1fr)';
  g.innerHTML = '';
  S.grid.forEach(function (cell, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'cms-cell' + (cell ? ' is-filled' : '');
    b.setAttribute('role', 'gridcell');
    b.setAttribute('aria-label', 'Square ' + (i + 1) + (cell && part(cell) ? ': ' + part(cell).n : ': empty'));
    if (cell && part(cell)) {
      var pc = part(cell).c;
      b.textContent = part(cell).e;
      b.style.boxShadow = 'inset 0 0 0 2px rgba(' + Math.round(pc[0] * 255) + ',' + Math.round(pc[1] * 255) + ',' + Math.round(pc[2] * 255) + ',.8)';
    }
    b.addEventListener('click', function () {
      if (S.eraser) { S.grid[i] = null; }
      else { S.grid[i] = (S.grid[i] === S.active) ? null : S.active; }
      blip(cell ? 300 : 440, 0.05, 'triangle');
      renderAll();
    });
    g.appendChild(b);
  });
}
function renderPalette() {
  var p = document.getElementById('cPalette'); if (!p) return;
  p.innerHTML = '';
  PARTS.forEach(function (it) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'cms-swatch' + (!S.eraser && S.active === it.id ? ' is-active' : '');
    b.title = it.n; b.setAttribute('aria-label', it.n);
    b.innerHTML = '<span class="cms-swatch-emoji">' + it.e + '</span><span class="cms-swatch-name">' + it.n + '</span>';
    b.addEventListener('click', function () { S.active = it.id; S.eraser = false; renderAll(); });
    p.appendChild(b);
  });
}
function renderMini() {
  var m = document.getElementById('cMini'); if (!m) return;
  m.style.gridTemplateColumns = 'repeat(' + W + ', 1fr)';
  m.innerHTML = '';
  S.grid.forEach(function (cell) {
    var d = document.createElement('span');
    d.className = 'cms-mini-cell';
    if (cell && part(cell)) {
      var mpc = part(cell).c;
      d.textContent = part(cell).e;
      d.style.background = 'rgba(' + Math.round(mpc[0] * 255) + ',' + Math.round(mpc[1] * 255) + ',' + Math.round(mpc[2] * 255) + ',.22)';
    }
    m.appendChild(d);
  });
}
function counts() { var n = {}; S.grid.forEach(function (c) { if (c) n[c] = (n[c] || 0) + 1; }); return n; }
function levelCheck() {
  var ul = document.getElementById('cLevelCheck'); if (!ul) return;
  var c = counts();
  var checks = [
    ['A player to control', !!c.player],
    ['A platform to stand on', !!c.platform],
    ['A goal to reach', !!c.goal],
    ['At least 4 objects placed', Object.keys(c).reduce(function (s, k) { return s + c[k]; }, 0) >= 4]
  ];
  ul.innerHTML = '';
  checks.forEach(function (ch) { var li = document.createElement('li'); li.className = ch[1] ? 'done' : ''; li.textContent = ch[0]; ul.appendChild(li); });
}

/* ---------- render features ---------- */
function renderFeatureList() {
  var box = document.getElementById('cFeatureList'); if (!box) return;
  box.innerHTML = '';
  FEATURES.forEach(function (s) {
    var l = document.createElement('label');
    l.style.cssText = 'display:flex;gap:10px;align-items:flex-start;padding:10px 0;cursor:pointer;font-size:.88rem;border-bottom:1px solid var(--border)';
    var cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = !!S.features[s.k]; cb.style.marginTop = '3px';
    cb.addEventListener('change', function () { S.features[s.k] = cb.checked; renderAll(); });
    var span = document.createElement('span');
    span.innerHTML = '<strong>' + esc(s.n) + '</strong><br><span style="color:var(--muted);font-size:.82rem">' + esc(s.desc) + '</span>';
    l.appendChild(cb); l.appendChild(span);
    box.appendChild(l);
  });
}
function renderCodePreview() {
  var pre = document.getElementById('cFeaturePreview'); if (!pre) return;
  pre.textContent = codePreview() + '\n// ... plus the event loop and drawing';
}
function featureFiles() {
  var out = [];
  FEATURES.forEach(function (f) { if (S.features[f.k]) out.push({ name: f.n, key: f.k }); });
  return out;
}

/* ---------- render files ---------- */
function renderFiles() {
  var pre = document.getElementById('cFilesPreview'); if (!pre) return;
  pre.textContent = codePreview();
  renderChecklist();
}
function renderChecklist() {
  var ul = document.getElementById('cChecklist'); if (!ul) return;
  var c = counts();
  var checks = [
    ['The game name has no odd symbols', /^[\w \-.]+$/.test(S.project)],
    ['At least one object is placed', placedItems().length > 0],
    ['There is a player', !!c.player],
    ['A goal is placed', !!c.goal],
    ['At least one feature is ticked', featureFiles().length > 0]
  ];
  ul.innerHTML = '';
  checks.forEach(function (ch) { var li = document.createElement('li'); li.className = ch[1] ? 'done' : ''; li.textContent = ch[0]; ul.appendChild(li); });
}

/* ---------- tabs ---------- */
function showTab(name) {
  [].forEach.call(document.querySelectorAll('.cms-tab'), function (t) {
    var on = t.getAttribute('data-tab') === name;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
    t.tabIndex = on ? 0 : -1;
  });
  [].forEach.call(document.querySelectorAll('.cms-panel'), function (p) {
    p.classList.toggle('is-active', p.id === 'panel-' + name);
  });
  if (name === 'export') { renderExport(); award(10, 'seen-export'); }
}
function initTabs() {
  var tabs = [].slice.call(document.querySelectorAll('.cms-tab'));
  tabs.forEach(function (t) {
    t.addEventListener('click', function () { showTab(t.getAttribute('data-tab')); });
    t.addEventListener('keydown', function (e) {
      var i = tabs.indexOf(t);
      if (e.key === 'ArrowRight') { tabs[(i + 1) % tabs.length].focus(); tabs[(i + 1) % tabs.length].click(); }
      if (e.key === 'ArrowLeft') { tabs[(i - 1 + tabs.length) % tabs.length].focus(); tabs[(i - 1 + tabs.length) % tabs.length].click(); }
    });
  });
}

/* ---------- debug ---------- */
var SCENARIOS = [
  {
    log: [
      'main.cpp:1:10: fatal error: SFML/Graphics.hpp: No such file or directory',
      '    1 | #include <SFML/Graphics.hpp>',
      'compilation terminated.'
    ],
    q: 'The compiler cannot find SFML. What is the fix?',
    opts: [
      { t: 'SFML is not installed, or the compiler does not know where it is. Install SFML and make sure your build file points at its include folder. The bundled CMakeLists.txt does this for you.', ok: true },
      { t: 'Rename the include to graphics.hpp.' },
      { t: 'Delete the #include line entirely.' }
    ]
  },
  {
    log: [
      'main.cpp:24:5: error: expected ";" before "}" token',
      '   24 |     }',
      '      |     ^'
    ],
    q: 'The compiler wants a semicolon. What is the fix?',
    opts: [
      { t: 'A statement just before the brace is missing its ; at the end. C++ needs a semicolon after almost every statement.', ok: true },
      { t: 'Add a semicolon after the closing brace of main().' },
      { t: 'Remove the brace at line 24.' }
    ]
  },
  {
    log: [
      '/usr/bin/ld: undefined reference to `sf::RenderWindow::clear(sf::Color)`',
      'collect2: error: ld returned 1 exit status'
    ],
    q: 'It compiled but will not link. What is the fix?',
    opts: [
      { t: 'This is a linking error: you must tell the linker to link the SFML libraries (sfml-graphics, sfml-window, sfml-system). The CMakeLists.txt target_link_libraries line does this.', ok: true },
      { t: 'Change clear() to a different function.' },
      { t: 'Compile it as C instead of C++.' }
    ]
  },
  {
    log: [
      "main.cpp:31:5: error: 'player' was not declared in this scope",
      '   31 |     player.move(speed, 0.f);',
      '      |     ^~~~~~'
    ],
    q: 'The compiler does not know the name player here. What is the fix?',
    opts: [
      { t: 'The variable is not in scope at this line, or the name is spelled differently. Declare player before you use it and check the exact spelling.', ok: true },
      { t: 'Add #include <player> at the top.' },
      { t: 'Make player a global with the keyword export.' }
    ]
  },
  {
    log: [
      "main.cpp:15:45: error: no matching function for call to 'sf::RectangleShape::setPosition(int, int)'",
      '   15 |     player.setPosition(60, 340);'
    ],
    q: 'The arguments do not match. What is the fix?',
    opts: [
      { t: 'SFML wants floats, not ints. Write player.setPosition(60.f, 340.f); the little f makes the number a float.', ok: true },
      { t: 'setPosition only takes one argument.' },
      { t: 'Draw the shape before setting its position.' }
    ]
  }
];
var dbgIndex = 0;
function renderDebug() {
  var logEl = document.getElementById('cLog'); if (!logEl) return;
  var sc = SCENARIOS[dbgIndex];
  logEl.innerHTML = '';
  sc.log.forEach(function (line) {
    var el = document.createElement('span');
    var isErr = /error|fatal|undefined reference|No such file/i.test(line) && !/^\s*\d+\s*\|/.test(line) && !/^\s*\^/.test(line);
    el.className = 'line' + (isErr ? ' err' : '');
    el.textContent = line;
    if (isErr) el.addEventListener('click', function () { openOptions(); });
    logEl.appendChild(el);
  });
  var opts = document.getElementById('cOptions'); opts.innerHTML = '';
  var msg = document.getElementById('cDebugMsg'); msg.className = 'cms-msg'; msg.textContent = 'Click the red line, then pick the fix.';
  document.getElementById('cNext').style.display = 'none';
}
function openOptions() {
  var opts = document.getElementById('cOptions'); if (!opts) return;
  opts.innerHTML = '';
  var sc = SCENARIOS[dbgIndex];
  var correct = sc.opts.findIndex(function (o) { return o.ok; });
  sc.opts.forEach(function (o, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'cms-dbg-opt'; b.textContent = o.t;
    b.addEventListener('click', function () {
      if (i === correct) {
        b.classList.add('is-correct');
        var msg = document.getElementById('cDebugMsg'); msg.className = 'cms-msg ok'; msg.textContent = 'Correct. That is exactly what the compiler is telling you.';
        blip(660, 0.12, 'triangle'); award(15, 'debug-' + dbgIndex);
        document.getElementById('cNext').style.display = '';
        [].forEach.call(opts.children, function (c, k) { if (k !== i) c.disabled = true; });
      } else {
        b.classList.add('is-wrong');
        var m2 = document.getElementById('cDebugMsg'); m2.className = 'cms-msg bad'; m2.textContent = 'Not quite. Read the red line again and try another fix.';
        blip(180, 0.12, 'sawtooth');
      }
    });
    opts.appendChild(b);
  });
}
function nextProblem() { dbgIndex = (dbgIndex + 1) % SCENARIOS.length; renderDebug(); }

/* ---------- export ---------- */
function projectFiles() {
  var folder = slug(S.project, 'my_sfml_game');
  var by = (S.author || '').trim();
  var readme = S.project + ' - an SFML project made in the JVDesignStudio C++ Mod Studio.\n' +
    (by ? 'Made by: ' + by + '\n' : '') + '\n' +
    'HOW TO BUILD IT (a compiler and SFML are free):\n' +
    '1. Install a C++ compiler and the SFML library (sfml-dev.org).\n' +
    '2. Open a terminal in this folder and run:\n' +
    '     cmake -B build\n' +
    '     cmake --build build\n' +
    '3. Run the game from the build folder.\n' +
    '   (Or compile by hand: g++ main.cpp -o game -lsfml-graphics -lsfml-window -lsfml-system)\n\n' +
    'Arrow keys: left and right to move.\n\n' +
    'Full guide: https://jvdesignstudio.co.uk/workshops/cpp-world-workshop.html\n';
  return [
    { name: folder + '/main.cpp', text: buildMain() + '\n' },
    { name: folder + '/CMakeLists.txt', text: buildCMake() + '\n' },
    { name: folder + '/README.txt', text: readme }
  ];
}
function renderExport() {
  var folder = slug(S.project, 'my_sfml_game');
  var tree = document.getElementById('cExportTree');
  if (tree) {
    tree.textContent = folder + '.zip\n' +
      '└── ' + folder + '/\n' +
      '    ├── main.cpp\n' +
      '    ├── CMakeLists.txt\n' +
      '    ├── README.txt\n' +
      '    └── (your level is written inside main.cpp)';
  }
  var ul = document.getElementById('cExportCheck');
  if (ul) {
    var c = counts();
    var checks = [
      ['main.cpp will be included', placedItems().length > 0],
      ['A player is placed', !!c.player],
      ['A goal is placed', !!c.goal],
      [featureFiles().length ? featureFiles().length + ' feature(s) will be included' : 'No features yet (optional)', featureFiles().length > 0]
    ];
    ul.innerHTML = '';
    checks.forEach(function (ch) { var li = document.createElement('li'); li.className = ch[1] ? 'done' : ''; li.textContent = ch[0]; ul.appendChild(li); });
  }
}
var CRC_TABLE = (function () { var t = [], n, k, c; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) { c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); } t[n] = c >>> 0; } return t; })();
function crc32(bytes) { var c = 0xFFFFFFFF; for (var i = 0; i < bytes.length; i++) { c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8); } return (c ^ 0xFFFFFFFF) >>> 0; }
function u16(v) { return [v & 0xFF, (v >> 8) & 0xFF]; }
function u32(v) { return [v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >>> 24) & 0xFF]; }
function makeZip(files) {
  var enc = new TextEncoder(); var chunks = [], central = [], offset = 0;
  files.forEach(function (f) {
    var nameBytes = enc.encode(f.name), data = f.data, crc = crc32(data);
    var local = [].concat(u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0));
    var header = new Uint8Array(local.length + nameBytes.length); header.set(local, 0); header.set(nameBytes, local.length);
    chunks.push(header); chunks.push(data);
    var cd = [].concat(u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset));
    var cdh = new Uint8Array(cd.length + nameBytes.length); cdh.set(cd, 0); cdh.set(nameBytes, cd.length);
    central.push(cdh); offset += header.length + data.length;
  });
  var cdSize = central.reduce(function (s, c) { return s + c.length; }, 0);
  var eocd = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cdSize), u32(offset), u16(0)));
  var total = chunks.reduce(function (s, c) { return s + c.length; }, 0) + cdSize + eocd.length;
  var out = new Uint8Array(total), p = 0;
  chunks.forEach(function (c) { out.set(c, p); p += c.length; });
  central.forEach(function (c) { out.set(c, p); p += c.length; });
  out.set(eocd, p); return out;
}
function download() {
  var msg = document.getElementById('cExportMsg');
  try {
    var enc = new TextEncoder();
    var folder = slug(S.project, 'my_sfml_game');
    if (placedItems().length === 0) { msg.className = 'cms-msg bad'; msg.textContent = 'Place at least one object on the grid first.'; showTab('level'); return; }
    var files = projectFiles().map(function (f) { return { name: f.name, data: enc.encode(f.text) }; });
    var zip = makeZip(files);
    var blob = new Blob([zip], { type: 'application/zip' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = folder + '.zip';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
    try { var c = parseInt(localStorage.getItem('jvds_tool_export_cpp-mod-studio') || '0', 10) + 1; localStorage.setItem('jvds_tool_export_cpp-mod-studio', String(c)); } catch (e) {}
    award(25, 'export');
    blip(740, 0.12, 'triangle');
    msg.className = 'cms-msg ok'; msg.textContent = 'Downloaded ' + folder + '.zip. Build it with the CMakeLists.txt.';
  } catch (e) { msg.className = 'cms-msg bad'; msg.textContent = 'Something went wrong building the zip. Try again.'; }
}

/* ---------- copy ---------- */
function copyText(text, msgEl) {
  function done() { if (msgEl) { msgEl.className = 'cms-msg ok'; msgEl.textContent = 'Copied.'; } }
  if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, function () { fallback(text, done); }); }
  else { fallback(text, done); }
}
function fallback(text, done) {
  try { var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); done(); } catch (e) {}
}

/* ---------- render all ---------- */
function renderAll() {
  var pn = document.getElementById('cProjectName'); if (pn && pn.value !== S.project) pn.value = S.project;
  var au = document.getElementById('cAuthor'); if (au && au.value !== S.author) au.value = S.author;
  var er = document.getElementById('cEraser'); if (er) { er.setAttribute('aria-pressed', S.eraser ? 'true' : 'false'); er.classList.toggle('cms-btn--primary', S.eraser); }
  renderBoard(); renderPalette(); renderMini(); levelCheck();
  renderFeatureList(); renderCodePreview(); renderFiles(); renderExport();
  persist();
}
function setExample() {
  S.grid = new Array(W * H).fill(null);
  var place = function (col, row, id) { S.grid[row * W + col] = id; };
  place(0, 3, 'player');
  place(1, 3, 'platform'); place(2, 3, 'platform'); place(4, 3, 'platform'); place(5, 3, 'platform');
  place(0, 1, 'brick'); place(1, 1, 'brick'); place(2, 1, 'brick');
  place(4, 2, 'enemy');
  place(5, 2, 'ball');
  place(7, 2, 'goal');
  S.project = S.project || 'My First SFML Game';
  renderAll();
  var msg = document.getElementById('cMsg'); if (msg) { msg.className = 'cms-msg ok'; msg.textContent = 'Example level loaded. Click 5. Download your project when you are ready.'; }
}

/* ---------- tour ---------- */
var TOUR = [
  { t: 'Welcome to the Studio', b: 'This is a little SFML project maker. In a few steps you will lay out a level, add features, write your code and download a real C++ project you can build.' },
  { t: '1. Lay out a level', b: 'Pick an object and click grid squares. Add a Player to control and a Goal to reach. The grid is a bird\'s eye view.' },
  { t: '2. Add features', b: 'Tick the C++ you want, like a bouncing ball or bricks. Each one folds working code into your main.cpp.' },
  { t: '3. Name your game', b: 'Give your game a name and check the ready list. The Studio writes the whole main.cpp for you.' },
  { t: '4. Fix the error', b: 'Real C++ breaks in small ways. Practise reading the compiler output and choosing the fix, the same skill you use in any editor.' },
  { t: '5. Download', b: 'Download the zip, install a compiler and SFML, build with CMake, then run your game.' }
];
var tourIndex = 0;
function renderTour() {
  var t = TOUR[tourIndex];
  document.getElementById('tourTitle').textContent = t.t;
  document.getElementById('tourBody').textContent = t.b;
  var dots = document.getElementById('tourDots'); dots.innerHTML = '';
  TOUR.forEach(function (_, i) { var s = document.createElement('span'); if (i === tourIndex) s.className = 'on'; dots.appendChild(s); });
  document.getElementById('tourNext').textContent = tourIndex === TOUR.length - 1 ? 'Done' : 'Next →';
}
function openTour() { tourIndex = 0; renderTour(); document.getElementById('tourOverlay').hidden = false; }
function closeTour() { document.getElementById('tourOverlay').hidden = true; }

/* ---------- init ---------- */
function init() {
  restore();
  initTabs();
  ['cProjectName', 'cAuthor'].forEach(function (id) {
    var el = document.getElementById(id); if (!el) return;
    el.addEventListener('input', function () {
      if (id === 'cProjectName') S.project = el.value;
      if (id === 'cAuthor') S.author = el.value;
      renderFiles(); renderExport(); persist();
    });
  });
  var er = document.getElementById('cEraser'); if (er) er.addEventListener('click', function () { S.eraser = !S.eraser; renderAll(); });
  var cl = document.getElementById('cClear'); if (cl) cl.addEventListener('click', function () { S.grid = new Array(W * H).fill(null); renderAll(); });
  var ex = document.getElementById('cExample'); if (ex) ex.addEventListener('click', setExample);
  var copyBtn = document.getElementById('cFilesCopy'); if (copyBtn) copyBtn.addEventListener('click', function () { copyText(buildMain(), document.getElementById('cFilesMsg')); });
  var dl = document.getElementById('cDownload'); if (dl) dl.addEventListener('click', download);
  var nx = document.getElementById('cNext'); if (nx) nx.addEventListener('click', nextProblem);
  var tb = document.getElementById('cTourBtn'); if (tb) tb.addEventListener('click', openTour);
  var ts = document.getElementById('tourSkip'); if (ts) ts.addEventListener('click', closeTour);
  var tn = document.getElementById('tourNext'); if (tn) tn.addEventListener('click', function () { if (tourIndex === TOUR.length - 1) { closeTour(); } else { tourIndex++; renderTour(); } });
  var ov = document.getElementById('tourOverlay'); if (ov) ov.addEventListener('click', function (e) { if (e.target === ov) closeTour(); });
  renderAll();
  renderDebug();
}

/* expose for tests */
window.CMS_buildMain = buildMain;
window.CMS_buildCMake = buildCMake;
window.CMS_featureNames = function () { return featureFiles().map(function (f) { return f.key; }); };

/* LiveEdit API: editable constants in generated code */
var EDITABLE = [
  { key: 'speed',  min: 1,  max: 20,  def: 5 },
  { key: 'ballVX', min: 1,  max: 15,  def: 4 },
  { key: 'ballVY', min: 1,  max: 15,  def: 3 }
];
var editVals = {};
EDITABLE.forEach(function (e) { editVals[e.key] = e.def; });

/* patch generated code so editable values take effect */
var _origBuildMain = buildMain;
buildMain = function () {
  var src = _origBuildMain();
  var lines = src.split('\n');
  for (var i = 0; i < lines.length; i++) {
    var m;
    m = lines[i].match(/^(\s*float speed = )[\d.]+f(;.*)/);
    if (m) { lines[i] = m[1] + editVals.speed + '.f' + m[2]; continue; }
    m = lines[i].match(/^(\s*float ballVX = )[\d.]+f(, ballVY = )[\d.]+f(;.*)/);
    if (m) { lines[i] = m[1] + editVals.ballVX + '.f' + m[2] + editVals.ballVY + '.f' + m[3]; continue; }
  }
  return lines.join('\n');
};

function applyValsToScripts() {
  /* values are applied dynamically via the wrapped buildMain */
}

window.JVDS_MOD_STUDIO = {
  getScriptCode: function () {
    return buildMain();
  },
  getFieldMeta: function () { return EDITABLE; },
  getValues: function () { var o = {}; EDITABLE.forEach(function (e) { o[e.key] = editVals[e.key]; }); return o; },
  setValue: function (k, v) { if (editVals.hasOwnProperty(k)) { editVals[k] = v; applyValsToScripts(); } },
  resetValues: function () { EDITABLE.forEach(function (e) { editVals[e.key] = e.def; }); applyValsToScripts(); },
  refresh: function () { renderCodePreview(); renderFiles(); renderExport(); persist(); },
  paletteEl: null
};

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', function () { init(); window.JVDS_MOD_STUDIO.paletteEl = document.getElementById('cPalette'); }); } else { init(); window.JVDS_MOD_STUDIO.paletteEl = document.getElementById('cPalette'); }
})();
