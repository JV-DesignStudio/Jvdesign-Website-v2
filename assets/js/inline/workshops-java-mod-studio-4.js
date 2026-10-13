(function () {
'use strict';

var W = 6, H = 4, CELL = 80;

var PARTS = [
  { id: 'player',   n: 'Player',   e: '🧍', c: [0.25, 0.60, 1.00], kind: 'player',   node: 'CharacterBody2D', script: 'player', size: 40 },
  { id: 'platform', n: 'Platform', e: '🟫', c: [0.45, 0.45, 0.52], kind: 'platform', node: 'StaticBody2D',    script: '',       size: 80 },
  { id: 'coin',     n: 'Coin',     e: '🟡', c: [1.00, 0.84, 0.20], kind: 'coin',     node: 'Area2D',          script: 'coin',   size: 28 },
  { id: 'enemy',    n: 'Enemy',    e: '👾', c: [0.90, 0.25, 0.25], kind: 'enemy',    node: 'Area2D',          script: 'enemy',  size: 36 },
  { id: 'spike',    n: 'Spike',    e: '🔺', c: [0.80, 0.30, 0.60], kind: 'spike',    node: 'Area2D',          script: 'spike',  size: 32 },
  { id: 'goal',     n: 'Goal',     e: '🏁', c: [0.20, 0.85, 0.40], kind: 'goal',     node: 'Area2D',          script: 'goal',   size: 44 }
];
var BY_ID = {};
PARTS.forEach(function (p) { BY_ID[p.id] = p; });
function part(id) { return BY_ID[id] || null; }

var SCRIPTS = [
  {
    k: 'player', n: 'Player move', desc: 'Move left and right with the arrow keys.',
    code: [
      'void movePlayer() {',
      '    int speed = 5;',
      '    if (left) playerX -= speed;',
      '    if (right) playerX += speed;',
      '}'
    ].join('\n')
  },
  {
    k: 'coin', n: 'Coin collect', desc: 'Touching a coin adds to your score and removes it.',
    code: [
      'void collectCoins() {',
      '    for (int i = 0; i < objects.length; i++) {',
      '        if (alive[i] && objects[i][0] == COIN && hits(playerX, playerY, i)) {',
      '            alive[i] = false;',
      '            score++;',
      '        }',
      '    }',
      '}'
    ].join('\n')
  },
  {
    k: 'enemy', n: 'Enemy patrol', desc: 'An enemy that walks back and forth between two points.',
    code: [
      'void patrolEnemy() {',
      '    for (int i = 0; i < objects.length; i++) {',
      '        if (alive[i] && objects[i][0] == ENEMY) {',
      '            objects[i][1] += dir[i] * 2;',
      '            if (objects[i][1] < 40 || objects[i][1] > W - 40) dir[i] = -dir[i];',
      '        }',
      '    }',
      '}'
    ].join('\n')
  },
  {
    k: 'spike', n: 'Spike reset', desc: 'Touching a spike sends the player back to the start.',
    code: [
      'void spikeCheck() {',
      '    for (int i = 0; i < objects.length; i++) {',
      '        if (alive[i] && objects[i][0] == SPIKE && hits(playerX, playerY, i)) {',
      '            playerX = startX;',
      '            playerY = startY;',
      '        }',
      '    }',
      '}'
    ].join('\n')
  },
  {
    k: 'goal', n: 'Goal check', desc: 'Reaching the goal prints a win message in the console.',
    code: [
      'void checkGoal() {',
      '    for (int i = 0; i < objects.length; i++) {',
      '        if (alive[i] && objects[i][0] == GOAL && hits(playerX, playerY, i)) {',
      '            if (!won) {',
      '                System.out.println("You reached the goal. Well done!");',
      '                won = true;',
      '            }',
      '        }',
      '    }',
      '}'
    ].join('\n')
  }
];
var SCRIPT_BY_K = {};
SCRIPTS.forEach(function (s) { SCRIPT_BY_K[s.k] = s; });

var S = {
  grid: new Array(W * H).fill(null),
  active: 'platform',
  eraser: false,
  project: 'My First Platformer',
  author: '',
  scripts: { player: true, coin: true, goal: true }
};

var KEY = 'jvds-java-mod-studio-v1';
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
    var k = 'jvds-javaxp-' + onceKey;
    if (localStorage.getItem(k)) return;
    var tot = parseInt(localStorage.getItem('jvds-java-studio-xp') || '0', 10) + amount;
    localStorage.setItem('jvds-java-studio-xp', String(tot));
    localStorage.setItem(k, '1');
  } catch (e) {}
}
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

/* ---------- persist ---------- */
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify({
    grid: S.grid, active: S.active, project: S.project, author: S.author, scripts: S.scripts
  })); } catch (e) {}
}
function restore() {
  try {
    var raw = localStorage.getItem(KEY); if (!raw) return;
    var s = JSON.parse(raw);
    if (Array.isArray(s.grid) && s.grid.length === W * H) S.grid = s.grid;
    if (s.active && part(s.active)) S.active = s.active;
    if (typeof s.project === 'string') S.project = s.project;
    if (typeof s.author === 'string') S.author = s.author;
    if (s.scripts && typeof s.scripts === 'object') S.scripts = s.scripts;
  } catch (e) {}
}

/* ---------- project build ---------- */
function slug(s, fb) { var out = String(s || '').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, ''); return out || fb; }
function colorStr(c) { return 'Color(' + c[0] + ', ' + c[1] + ', ' + c[2] + ', 1)'; }
function placedItems() {
  var out = [];
  for (var i = 0; i < S.grid.length; i++) {
    var id = S.grid[i];
    if (!id || !part(id)) continue;
    var col = i % W, row = Math.floor(i / W);
    var x = col * CELL + CELL / 2;
    var y = row * CELL + CELL / 2;
    out.push({ id: id, p: BY_ID[id], name: BY_ID[id].n, x: x, y: y });
  }
  return out;
}
var SCRIPT_IDS = { player: true, coin: true, enemy: true, spike: true, goal: true };
var TYPE_IDS = ['player', 'platform', 'coin', 'enemy', 'spike', 'goal'];
var SIZES = [40, 80, 28, 36, 32, 44];
function typeIndex(id) { var i = TYPE_IDS.indexOf(id); return i < 0 ? 0 : i; }
function colorJava(c) { return 'new Color(' + Math.round(c[0] * 255) + ', ' + Math.round(c[1] * 255) + ', ' + Math.round(c[2] * 255) + ')'; }
function objectLiteral() {
  var items = placedItems();
  if (!items.length) return '{}';
  var rows = items.map(function (it) { return '        {' + typeIndex(it.id) + ', ' + it.x + ', ' + it.y + '}'; });
  return '{\n' + rows.join(',\n') + '\n    }';
}
function colorArray() {
  return '{\n' + PARTS.map(function (p) { return '        ' + colorJava(p.c); }).join(',\n') + '\n    }';
}
function sizeArray() { return '{ ' + SIZES.join(', ') + ' }'; }
function tickedMethods() { return SCRIPTS.filter(function (s) { return S.scripts[s.k]; }); }
var CALLS = { player: 'movePlayer();', coin: 'collectCoins();', enemy: 'patrolEnemy();', spike: 'spikeCheck();', goal: 'checkGoal();' };
function callsBlock() {
  return tickedMethods().map(function (s) { return '        ' + CALLS[s.k]; }).join('\n');
}
function buildMainJava() {
  var lines = [
    'import javax.swing.*;',
    'import java.awt.*;',
    'import java.awt.event.*;',
    '',
    'public class Main extends JPanel implements ActionListener, KeyListener {',
    '    static final int W = 960, H = 640;',
    '    static final int PLAYER = 0, PLATFORM = 1, COIN = 2, ENEMY = 3, SPIKE = 4, GOAL = 5;',
    '    static final int[] SIZES = ' + sizeArray() + ';',
    '    static final Color[] COLORS = ' + colorArray() + ';',
    '    static final int[][] START = ' + objectLiteral() + ';',
    '',
    '    int[][] objects = new int[START.length][];',
    '    boolean[] alive = new boolean[START.length];',
    '    int[] dir = new int[START.length];',
    '    int playerX, playerY, startX, startY, score = 0;',
    '    boolean left, right, won = false;',
    '    Timer timer;',
    '',
    '    public Main() {',
    '        setPreferredSize(new Dimension(W, H));',
    '        setBackground(new Color(250, 248, 240));',
    '        setFocusable(true);',
    '        addKeyListener(this);',
    '        for (int i = 0; i < START.length; i++) {',
    '            objects[i] = START[i].clone();',
    '            alive[i] = true;',
    '            dir[i] = 1;',
    '        }',
    '        for (int i = 0; i < objects.length; i++) {',
    '            if (objects[i][0] == PLAYER) { playerX = objects[i][1]; playerY = objects[i][2]; }',
    '        }',
    '        startX = playerX; startY = playerY;',
    '        timer = new Timer(16, this);',
    '        timer.start();',
    '    }',
    '',
    '    public void actionPerformed(ActionEvent e) {',
    callsBlock(),
    '        repaint();',
    '    }',
    '',
    '    boolean hits(int x, int y, int i) {',
    '        int s = SIZES[objects[i][0]];',
    '        return x < objects[i][1] + s && x + SIZES[PLAYER] > objects[i][1]',
    '            && y < objects[i][2] + s && y + SIZES[PLAYER] > objects[i][2];',
    '    }',
    '',
    tickedMethods().map(function (s) { return '    ' + s.code.split('\n').join('\n    '); }).join('\n\n'),
    '',
    '    public void paintComponent(Graphics g) {',
    '        super.paintComponent(g);',
    '        for (int i = 0; i < objects.length; i++) {',
    '            if (!alive[i] || objects[i][0] == PLAYER) continue;',
    '            g.setColor(COLORS[objects[i][0]]);',
    '            int s = SIZES[objects[i][0]];',
    '            g.fillRect(objects[i][1], objects[i][2], s, s);',
    '        }',
    '        g.setColor(COLORS[PLAYER]);',
    '        g.fillRect(playerX, playerY, SIZES[PLAYER], SIZES[PLAYER]);',
    '        g.setColor(Color.BLACK);',
    '        g.drawString("Score: " + score, 20, 20);',
    '    }',
    '',
    '    public void keyPressed(KeyEvent e) {',
    '        if (e.getKeyCode() == KeyEvent.VK_LEFT) left = true;',
    '        if (e.getKeyCode() == KeyEvent.VK_RIGHT) right = true;',
    '    }',
    '',
    '    public void keyReleased(KeyEvent e) {',
    '        if (e.getKeyCode() == KeyEvent.VK_LEFT) left = false;',
    '        if (e.getKeyCode() == KeyEvent.VK_RIGHT) right = false;',
    '    }',
    '',
    '    public void keyTyped(KeyEvent e) {}',
    '',
    '    public static void main(String[] args) {',
    '        JFrame frame = new JFrame("' + (S.project || 'My First Java Game').replace(/["\\]/g, '') + '");',
    '        frame.add(new Main());',
    '        frame.pack();',
    '        frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);',
    '        frame.setLocationRelativeTo(null);',
    '        frame.setVisible(true);',
    '    }',
    '}'
  ];
  return lines.join('\n') + '\n';
}
function scriptFiles() {
  return tickedMethods().map(function (s) { return { name: s.n, file: s.k + '.java', code: s.code }; });
}

/* ---------- render scene ---------- */
function renderBoard() {
  var g = document.getElementById('gmBoard'); if (!g) return;
  g.style.gridTemplateColumns = 'repeat(' + W + ', 1fr)';
  g.innerHTML = '';
  S.grid.forEach(function (cell, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'jms-cell' + (cell ? ' is-filled' : '');
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
  var p = document.getElementById('gmPalette'); if (!p) return;
  p.innerHTML = '';
  PARTS.forEach(function (it) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'jms-swatch' + (!S.eraser && S.active === it.id ? ' is-active' : '');
    b.title = it.n; b.setAttribute('aria-label', it.n);
    b.innerHTML = '<span class="jms-swatch-emoji">' + it.e + '</span><span class="jms-swatch-name">' + esc(it.n) + '</span>';
    b.addEventListener('click', function () { S.active = it.id; S.eraser = false; renderAll(); });
    p.appendChild(b);
  });
}
function renderMini() {
  var m = document.getElementById('gmMini'); if (!m) return;
  m.style.gridTemplateColumns = 'repeat(' + W + ', 1fr)';
  m.innerHTML = '';
  S.grid.forEach(function (cell) {
    var d = document.createElement('span');
    d.className = 'jms-mini-cell';
    if (cell && part(cell)) {
      var mpc = part(cell).c;
      d.textContent = part(cell).e;
      d.style.background = 'rgba(' + Math.round(mpc[0] * 255) + ',' + Math.round(mpc[1] * 255) + ',' + Math.round(mpc[2] * 255) + ',.22)';
    }
    m.appendChild(d);
  });
}
function counts() { var n = {}; S.grid.forEach(function (c) { if (c) n[c] = (n[c] || 0) + 1; }); return n; }
function sceneCheck() {
  var ul = document.getElementById('gmSceneCheck'); if (!ul) return;
  var c = counts();
  var checks = [
    ['A player to control', !!c.player],
    ['Some platforms to stand on', !!c.platform],
    ['A goal to reach', !!c.goal],
    ['At least 4 objects placed', Object.keys(c).reduce(function (s, k) { return s + c[k]; }, 0) >= 4]
  ];
  ul.innerHTML = '';
  checks.forEach(function (ch) { var li = document.createElement('li'); li.className = ch[1] ? 'done' : ''; li.textContent = ch[0]; ul.appendChild(li); });
}

/* ---------- render scripts ---------- */
function renderScriptList() {
  var box = document.getElementById('gmScriptList'); if (!box) return;
  box.innerHTML = '';
  SCRIPTS.forEach(function (s) {
    var l = document.createElement('label');
    l.style.cssText = 'display:flex;gap:10px;align-items:flex-start;padding:10px 0;cursor:pointer;font-size:.88rem;border-bottom:1px solid var(--border)';
    var cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = !!S.scripts[s.k]; cb.style.marginTop = '3px';
    cb.addEventListener('change', function () { S.scripts[s.k] = cb.checked; renderAll(); });
    var span = document.createElement('span');
    span.innerHTML = '<strong>' + esc(s.n) + '</strong><br><span style="color:var(--charcoal-lt);font-size:.82rem">' + esc(s.desc) + '</span>';
    l.appendChild(cb); l.appendChild(span);
    box.appendChild(l);
  });
}
function renderScriptPreview() {
  var pre = document.getElementById('gmScriptPreview'); if (!pre) return;
  var files = scriptFiles();
  if (!files.length) { pre.textContent = '// Tick a method to write it.'; return; }
  pre.textContent = files.map(function (f) { return '// ' + f.file + '\n' + f.code; }).join('\n\n');
}

/* ---------- render files ---------- */
function renderFiles() {
  var pre = document.getElementById('gmFilesPreview'); if (!pre) return;
  var src = buildMainJava().split('\n');
  var head = src.slice(0, 34).join('\n');
  var more = src.length > 34 ? '\n... (' + (src.length - 34) + ' more lines, ' + placedItems().length + ' objects)' : '';
  pre.textContent = 'Main.java\n' + head + more;
  renderChecklist();
}
function renderChecklist() {
  var ul = document.getElementById('gmChecklist'); if (!ul) return;
  var c = counts();
  var checks = [
    ['The project name has no odd symbols', /^[\w \-.]+$/.test(S.project)],
    ['At least one object is placed', placedItems().length > 0],
    ['There is a player', !!c.player],
    ['There is a goal', !!c.goal],
    ['At least one script is ticked', scriptFiles().length > 0]
  ];
  ul.innerHTML = '';
  checks.forEach(function (ch) { var li = document.createElement('li'); li.className = ch[1] ? 'done' : ''; li.textContent = ch[0]; ul.appendChild(li); });
}

/* ---------- tabs ---------- */
function showTab(name) {
  [].forEach.call(document.querySelectorAll('.jms-tab'), function (t) {
    var on = t.getAttribute('data-tab') === name;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
    t.tabIndex = on ? 0 : -1;
  });
  [].forEach.call(document.querySelectorAll('.jms-panel'), function (p) {
    p.classList.toggle('is-active', p.id === 'panel-' + name);
  });
  if (name === 'export') { renderExport(); award(10, 'seen-export'); }
}
function initTabs() {
  var tabs = [].slice.call(document.querySelectorAll('.jms-tab'));
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
      'Main.java:24: error: \';\' expected',
      '        playerX += speed',
      '                         ^'
    ],
    q: 'The compiler wants a semicolon. What is the fix?',
    opts: [
      { t: 'Add the missing ; at the end of the line. Every Java statement ends with a semicolon.', ok: true },
      { t: 'Delete the line.' },
      { t: 'Add a colon : instead.' }
    ]
  },
  {
    log: [
      'Main.java:31: error: cannot find symbol',
      '        if (left) playerX -= speed;',
      '                  ^',
      '  symbol:   variable playerX'
    ],
    q: 'Java cannot find playerX. What is the fix?',
    opts: [
      { t: 'Declare the variable before using it, for example int playerX; at the top of the class.', ok: true },
      { t: 'Wrap playerX in quotes.' },
      { t: 'Rename the class to playerX.' }
    ]
  },
  {
    log: [
      'Main.java:6: error: class Game is public, should be declared in a file named Game.java',
      'public class Game extends JPanel {',
      '       ^'
    ],
    q: 'The public class name does not match the file name. What is the fix?',
    opts: [
      { t: 'A public class must live in a file with the same name. Rename the class to Main, or the file to Game.java.', ok: true },
      { t: 'Delete the word public.' },
      { t: 'Move the class inside main().' }
    ]
  },
  {
    log: [
      'Main.java:40: error: incompatible types: possible lossy conversion from double to int',
      '        int speed = 4.5;',
      '                    ^'
    ],
    q: 'A double cannot fit into an int. What is the fix?',
    opts: [
      { t: 'Use a whole number like 4, or cast it: int speed = (int) 4.5.', ok: true },
      { t: 'Rename the variable to speedDouble.' },
      { t: 'Add more decimal places.' }
    ]
  },
  {
    log: [
      'Main.java:33: error: cannot find symbol',
      '        collectCoins();',
      '        ^',
      '  symbol:   method collectCoins()'
    ],
    q: 'Java cannot find collectCoins(). What is the fix?',
    opts: [
      { t: 'Define the method in the class (tick Coin collect in the Studio), and check the spelling matches.', ok: true },
      { t: 'Call it as this.collectCoins.' },
      { t: 'Methods do not need to be defined.' }
    ]
  }
];
var dbgIndex = 0;
function renderDebug() {
  var logEl = document.getElementById('gmLog'); if (!logEl) return;
  var sc = SCENARIOS[dbgIndex];
  logEl.innerHTML = '';
  sc.log.forEach(function (line) {
    var el = document.createElement('span');
    var isErr = /Nonexistent|Parse Error|Invalid|cannot be connected|error/i.test(line) && !/^\[Output\]/.test(line);
    el.className = 'line' + (isErr ? ' err' : '');
    el.textContent = line;
    if (isErr) el.addEventListener('click', function () { openOptions(); });
    logEl.appendChild(el);
  });
  var opts = document.getElementById('gmOptions'); opts.innerHTML = '';
  var msg = document.getElementById('gmDebugMsg'); msg.className = 'jms-msg'; msg.textContent = 'Click the red line, then pick the fix.';
  document.getElementById('gmNext').style.display = 'none';
}
function openOptions() {
  var opts = document.getElementById('gmOptions'); if (!opts) return;
  opts.innerHTML = '';
  var sc = SCENARIOS[dbgIndex];
  var correct = sc.opts.findIndex(function (o) { return o.ok; });
  sc.opts.forEach(function (o, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'jms-dbg-opt'; b.textContent = o.t;
    b.addEventListener('click', function () {
      if (i === correct) {
        b.classList.add('is-correct');
        var msg = document.getElementById('gmDebugMsg'); msg.className = 'jms-msg ok'; msg.textContent = 'Correct. That is exactly what the Output is telling you.';
        blip(660, 0.12, 'triangle'); award(15, 'debug-' + dbgIndex);
        document.getElementById('gmNext').style.display = '';
        [].forEach.call(opts.children, function (c, k) { if (k !== i) c.disabled = true; });
      } else {
        b.classList.add('is-wrong');
        var m2 = document.getElementById('gmDebugMsg'); m2.className = 'jms-msg bad'; m2.textContent = 'Not quite. Read the Output line again and try another fix.';
        blip(180, 0.12, 'sawtooth');
      }
    });
    opts.appendChild(b);
  });
}
function nextProblem() { dbgIndex = (dbgIndex + 1) % SCENARIOS.length; renderDebug(); }

/* ---------- export ---------- */
function projectFiles() {
  var folder = slug(S.project, 'my_java_game');
  return [
    { name: folder + '/Main.java', text: buildMainJava() },
    { name: folder + '/run.bat', text: '@echo off\r\njavac Main.java\r\njava Main\r\npause\r\n' },
    { name: folder + '/run.sh', text: '#!/bin/sh\njavac Main.java && java Main\n' },
    { name: folder + '/README.txt', text: readmeText(folder) }
  ];
}
function readmeText(folder) {
  var by = (S.author || '').trim();
  return S.project + ' - a Java game made in the JVDesignStudio Java Mod Studio.\n' +
    (by ? 'Made by: ' + by + '\n' : '') + '\n' +
    'HOW TO RUN IT (a free JDK is all you need, for example Adoptium Temurin):\n' +
    '1. Install a free JDK (ask a grown-up first).\n' +
    '2. Open a terminal in this folder.\n' +
    '3. Type: javac Main.java   then: java Main\n' +
    '   On Windows you can also double-click run.bat.\n' +
    '4. Move the player with the left and right arrow keys.\n\n' +
    'Full guides: https://jvdesignstudio.co.uk/workshop\n';
}
function renderExport() {
  var folder = slug(S.project, 'my_java_game');
  var tree = document.getElementById('gmExportTree');
  if (tree) {
    var lines = [folder + '.zip', '└── ' + folder + '/', '    ├── Main.java', '    ├── run.bat', '    ├── run.sh', '    └── README.txt'];
    tree.textContent = lines.join('\n');
  }
  var ul = document.getElementById('gmExportCheck');
  if (ul) {
    var c = counts();
    var checks = [
      ['Main.java will be included', true],
      ['run.bat and run.sh will be included', true],
      ['A player is placed', !!c.player],
      [tickedMethods().length ? tickedMethods().length + ' Java method(s) will be included' : 'No methods yet (optional)', tickedMethods().length > 0]
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
  var msg = document.getElementById('gmExportMsg');
  try {
    var enc = new TextEncoder();
    var folder = slug(S.project, 'my_java_game');
    if (placedItems().length === 0) { msg.className = 'jms-msg bad'; msg.textContent = 'Place at least one object on the grid first.'; showTab('scene'); return; }
    var files = projectFiles().map(function (f) { return { name: f.name, data: f.bytes ? f.bytes : enc.encode(f.text) }; });
    var zip = makeZip(files);
    var blob = new Blob([zip], { type: 'application/zip' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = folder + '.zip';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
    try { var c = parseInt(localStorage.getItem('jvds_tool_export_java-mod-studio') || '0', 10) + 1; localStorage.setItem('jvds_tool_export_java-mod-studio', String(c)); } catch (e) {}
    award(25, 'export');
    blip(740, 0.12, 'triangle');
    msg.className = 'jms-msg ok'; msg.textContent = 'Downloaded ' + folder + '.zip. Unzip it, then run the run script or javac Main.java.';
  } catch (e) { msg.className = 'jms-msg bad'; msg.textContent = 'Something went wrong building the zip. Try again.'; }
}

/* ---------- copy ---------- */
function copyText(text, msgEl) {
  function done() { if (msgEl) { msgEl.className = 'jms-msg ok'; msgEl.textContent = 'Copied.'; } }
  if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, function () { fallback(text, done); }); }
  else { fallback(text, done); }
}
function fallback(text, done) {
  try { var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); done(); } catch (e) {}
}

/* ---------- render all ---------- */
function renderAll() {
  var pn = document.getElementById('gmProjectName'); if (pn && pn.value !== S.project) pn.value = S.project;
  var au = document.getElementById('gmAuthor'); if (au && au.value !== S.author) au.value = S.author;
  var er = document.getElementById('gmEraser'); if (er) { er.setAttribute('aria-pressed', S.eraser ? 'true' : 'false'); er.classList.toggle('jms-btn--primary', S.eraser); }
  renderBoard(); renderPalette(); renderMini(); sceneCheck();
  renderScriptList(); renderScriptPreview(); renderFiles(); renderExport();
  persist();
}
function setExample() {
  S.grid = new Array(W * H).fill(null);
  var place = function (col, row, id) { S.grid[row * W + col] = id; };
  place(0, 3, 'player');
  place(0, 3, 'player');
  S.grid[3 * W + 0] = 'player';
  S.grid[3 * W + 1] = 'platform'; S.grid[3 * W + 2] = 'platform';
  S.grid[2 * W + 3] = 'coin'; S.grid[1 * W + 4] = 'spike';
  S.grid[2 * W + 2] = 'enemy';
  S.grid[0 * W + 5] = 'goal';
  S.grid[3 * W + 4] = 'platform';
  renderAll();
  var msg = document.getElementById('gmMsg'); if (msg) { msg.className = 'jms-msg ok'; msg.textContent = 'Example scene loaded. Click 5. Download your project when you are ready.'; }
}

/* ---------- tour ---------- */
var TOUR = [
  { t: 'Welcome to the Studio', b: 'This is a little Java project maker. In a few steps you will lay out a game, add Java methods, write your file and download a real Swing project.' },
  { t: '1. Lay out a scene', b: 'Pick an object and click grid squares. Add a Player to control and a Goal to reach. The grid is a bird\'s eye view.' },
  { t: '2. Add methods', b: 'Tick the Java methods you want, like player movement or collecting coins. The Studio writes each method for you.' },
  { t: '3. Name your file', b: 'Give your project a name and check the ready list. The Studio fills in Main.java for you.' },
  { t: '4. Fix the log', b: 'Real code breaks in small ways. Practise reading the compiler log and choosing the fix, the same skill you use in Java.' },
  { t: '5. Download', b: 'Download the zip, then compile and run it with any free JDK. Move with the arrow keys.' }
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
  ['gmProjectName', 'gmAuthor'].forEach(function (id) {
    var el = document.getElementById(id); if (!el) return;
    el.addEventListener('input', function () {
      if (id === 'gmProjectName') S.project = el.value;
      if (id === 'gmAuthor') S.author = el.value;
      renderFiles(); renderExport(); persist();
    });
  });
  var er = document.getElementById('gmEraser'); if (er) er.addEventListener('click', function () { S.eraser = !S.eraser; renderAll(); });
  var cl = document.getElementById('gmClear'); if (cl) cl.addEventListener('click', function () { S.grid = new Array(W * H).fill(null); renderAll(); });
  var ex = document.getElementById('gmExample'); if (ex) ex.addEventListener('click', setExample);
  var copyBtn = document.getElementById('gmFilesCopy'); if (copyBtn) copyBtn.addEventListener('click', function () {
    var files = scriptFiles();
    var text = buildMainJava();
    copyText(text, document.getElementById('gmFilesMsg'));
  });
  var dl = document.getElementById('gmDownload'); if (dl) dl.addEventListener('click', download);
  var nx = document.getElementById('gmNext'); if (nx) nx.addEventListener('click', nextProblem);
  var tb = document.getElementById('gmTourBtn'); if (tb) tb.addEventListener('click', openTour);
  var ts = document.getElementById('tourSkip'); if (ts) ts.addEventListener('click', closeTour);
  var tn = document.getElementById('tourNext'); if (tn) tn.addEventListener('click', function () { if (tourIndex === TOUR.length - 1) { closeTour(); } else { tourIndex++; renderTour(); } });
  var ov = document.getElementById('tourOverlay'); if (ov) ov.addEventListener('click', function (e) { if (e.target === ov) closeTour(); });
  renderAll();
  renderDebug();
}

/* expose for tests */
window.JMS_buildMain = buildMainJava;
window.JMS_methodNames = function () { return scriptFiles().map(function (f) { return f.file; }); };
window.JMS_objectLiteral = objectLiteral;

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
