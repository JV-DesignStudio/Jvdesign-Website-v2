'use strict';

/* Godot Auto Clicker build-along.
   A Biscuit Tin style idle game. The learner writes GDScript-shaped functions
   that the live preview turns into JavaScript, so every step can be played. */

/* A small GDScript to JavaScript translator. It understands the block shape
   this workshop uses: func, if, elif, else, for ... in range and while. */
function gdToJs(code) {
  var lines = String(code || '').split('\n');
  var out = [];
  var stack = [];

  function closeTo(indent) {
    while (stack.length && stack[stack.length - 1] >= indent) {
      out.push('}');
      stack.pop();
    }
  }

  for (var i = 0; i < lines.length; i++) {
    var raw = lines[i].replace(/\t/g, '    ');
    var trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed.charAt(0) === '#') continue;

    var indent = raw.match(/^ */)[0].length;
    closeTo(indent);

    var line = trimmed;
    var opens = false;

    if (/^func\s+/.test(line)) {
      line = line.replace(/^func\s+(\w+)\s*\(([^)]*)\)\s*:/, 'function $1($2) {');
      opens = true;
    } else if (/^if\s+(.+):$/.test(line)) {
      line = line.replace(/^if\s+(.+):$/, 'if ($1) {');
      opens = true;
    } else if (/^elif\s+(.+):$/.test(line)) {
      line = line.replace(/^elif\s+(.+):$/, 'else if ($1) {');
      opens = true;
    } else if (/^else\s*:$/.test(line)) {
      line = 'else {';
      opens = true;
    } else if (/^for\s+(\w+)\s+in\s+range\(([^)]+)\)\s*:$/.test(line)) {
      var range = line.match(/^for\s+(\w+)\s+in\s+range\(([^)]+)\)\s*:$/);
      line = 'for (let ' + range[1] + ' = 0; ' + range[1] + ' < ' + range[2] + '; ' + range[1] + '++) {';
      opens = true;
    } else if (/^while\s+(.+):$/.test(line)) {
      line = line.replace(/^while\s+(.+):$/, 'while ($1) {');
      opens = true;
    }

    line = line
      .replace(/\bvar\b/g, 'let')
      .replace(/\band\b/g, '&&')
      .replace(/\bor\b/g, '||')
      .replace(/\bnot\b/g, '!')
      .replace(/\btrue\b/g, 'true')
      .replace(/\bfalse\b/g, 'false')
      .replace(/\bnull\b/g, 'null')
      .replace(/\babs\(/g, 'Math.abs(')
      .replace(/\broundi\(/g, 'Math.round(')
      .replace(/\bround\(/g, 'Math.round(')
      .replace(/\bfloor\(/g, 'Math.floor(')
      .replace(/\bmax\(/g, 'Math.max(')
      .replace(/\bmin\(/g, 'Math.min(')
      .replace(/\brandf\(\)/g, 'Math.random()')
      .replace(/\brandi\(\)\s*%\s*(\w+)/g, 'Math.floor(Math.random() * $1)')
      .replace(/\bclamp\(([^,]+),\s*([^,]+),\s*([^)]+)\)/g, 'Math.max($2, Math.min($3, $1))');

    out.push(line);
    if (opens) stack.push(indent);
  }

  closeTo(-1);
  return out.join('\n');
}

var CSS_GAME = '<style>html,body{height:100%}body{display:flex;flex-direction:column;align-items:center;justify-content:center;background:#140f0b;margin:0;overflow:hidden;font-family:Inter,system-ui,sans-serif}canvas{display:block;width:100%;max-width:480px;height:auto;touch-action:manipulation;cursor:pointer}</style>';
var CANVAS_TAG = '<canvas id="game" width="480" height="360" aria-label="Biscuit clicker game"></canvas>';
var SETUP = 'const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");';

var STATE = 'let biscuits=0,click_power=1,total_taps=0,auto_tappers=0,auto_power=1,auto_cost=50,faster_cost=250,cps=0,pulse=0,golden_flash=0,floaters=[],golden={active:false,x:0,y:0,timer:8,life:0};';

var CLICK_HANDLER = 'let clicked=false,click_x=0,click_y=0;' +
  'canvas.addEventListener("click",function(e){' +
  'var r=canvas.getBoundingClientRect();' +
  'click_x=(e.clientX-r.left)*(480/r.width);' +
  'click_y=(e.clientY-r.top)*(360/r.height);' +
  'clicked=true});';

var DEFAULTS = 'function on_tap(){}\n' +
  'function biscuits_per_second(){return auto_tappers*auto_power;}\n' +
  'function auto_tick(delta){}\n' +
  'function buy_auto_tapper(){}\n' +
  'function buy_faster_tapper(){}\n' +
  'function golden_bonus(){}\n';

var WORKING_AUTO_TICK = 'function auto_tick(delta){biscuits+=auto_tappers*auto_power*delta;}\n';
var WORKING_BUY_TAPPER = 'function buy_auto_tapper(){if(biscuits>=auto_cost){biscuits-=auto_cost;auto_tappers+=1;auto_cost=Math.round(auto_cost*1.6);}}\n';
var WORKING_BUY_FASTER = 'function buy_faster_tapper(){if(biscuits>=faster_cost){biscuits-=faster_cost;auto_power+=1;faster_cost=Math.round(faster_cost*2.5);}}\n';

var ENGINE_PROJECT = {
  href: '/biscuit-tycoon-godot.zip',
  label: 'Download the Godot starter project'
};

function drawLoop() {
  return [
    'function fmt(n){return Math.floor(n).toLocaleString("en-GB")}',
    'function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}',
    'function addFloater(x,y,text){floaters.push({x:x,y:y,text:text,life:1})}',
    'function drawBiscuit(cx,cy,r){',
      'ctx.fillStyle="#c98a2e";ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();',
      'ctx.fillStyle="#e8b96a";ctx.beginPath();ctx.arc(cx,cy,r*0.84,0,Math.PI*2);ctx.fill();',
      'ctx.fillStyle="#6b4423";',
      'for(var i=0;i<6;i++){var a=i*Math.PI/3+0.3;ctx.beginPath();ctx.arc(cx+Math.cos(a)*r*0.44,cy+Math.sin(a)*r*0.44,Math.max(2,r*0.08),0,Math.PI*2);ctx.fill()}',
    '}',
    'function drawButton(x,y,w,h,label,cost,level,ready){',
      'ctx.fillStyle=ready?"#1f4d2c":"#27231f";rr(x,y,w,h,10);ctx.fill();',
      'ctx.strokeStyle=ready?"#4ade80":"#5b544c";ctx.lineWidth=2;ctx.stroke();',
      'ctx.textAlign="left";ctx.fillStyle="#f5efe0";ctx.font="bold 12px Inter,system-ui,sans-serif";ctx.fillText(label,x+12,y+19);',
      'ctx.fillStyle=ready?"#bbf7d0":"#a8a29e";ctx.font="11px Inter,system-ui,sans-serif";ctx.fillText(fmt(cost)+" biscuits",x+12,y+36);',
      'ctx.textAlign="right";ctx.fillStyle="#ffd166";ctx.font="bold 12px Inter,system-ui,sans-serif";ctx.fillText("Lv "+level,x+w-12,y+19);',
      'if(!ready){ctx.fillStyle="rgba(0,0,0,.35)";rr(x,y,w,h,10);ctx.fill()}',
    '}',
    'function draw(now){',
      'ctx.fillStyle="#140f0b";ctx.fillRect(0,0,480,360);',
      'ctx.fillStyle="#231a12";ctx.fillRect(0,56,480,166);',
      'ctx.fillStyle="rgba(255,209,102,.06)";ctx.fillRect(0,54,480,2);',
      'ctx.textAlign="left";ctx.fillStyle="#ffd166";ctx.font="bold 17px Inter,system-ui,sans-serif";ctx.fillText("Biscuit Tycoon",16,26);',
      'ctx.fillStyle="#f5efe0";ctx.font="bold 15px Inter,system-ui,sans-serif";ctx.fillText(fmt(biscuits)+" biscuits",16,47);',
      'ctx.textAlign="right";ctx.fillStyle="#9ccfd2";ctx.font="bold 13px Inter,system-ui,sans-serif";ctx.fillText(cps.toFixed(1)+" / sec",464,26);',
      'ctx.fillStyle="rgba(245,239,224,.6)";ctx.font="12px Inter,system-ui,sans-serif";ctx.fillText("Auto tappers: "+auto_tappers,464,45);',
      'var r=78+pulse*12;',
      'ctx.fillStyle="rgba(201,138,46,"+(0.10+pulse*0.25)+")";ctx.beginPath();ctx.arc(240,145,r+16,0,Math.PI*2);ctx.fill();',
      'drawBiscuit(240,145,r);',
      'ctx.textAlign="center";ctx.fillStyle="rgba(245,239,224,.55)";ctx.font="11px Inter,system-ui,sans-serif";ctx.fillText("Tap the tin",240,236);',
      'if(golden.active){',
        'var gr=16+Math.sin(now/180)*2;',
        'ctx.fillStyle="#ffd166";ctx.beginPath();ctx.arc(golden.x,golden.y,gr,0,Math.PI*2);ctx.fill();',
        'ctx.fillStyle="#fff7d6";ctx.beginPath();ctx.arc(golden.x,golden.y,gr*0.55,0,Math.PI*2);ctx.fill();',
        'ctx.fillStyle="#b45309";ctx.font="bold 9px Inter,system-ui,sans-serif";ctx.textAlign="center";ctx.fillText("BONUS",golden.x,golden.y+3);',
      '}',
      'drawButton(20,256,210,50,"AUTO TAPPER",auto_cost,auto_tappers,biscuits>=auto_cost);',
      'drawButton(250,256,210,50,"FASTER TAPPER",faster_cost,auto_power,biscuits>=faster_cost);',
      'ctx.textAlign="center";ctx.fillStyle="rgba(245,239,224,.45)";ctx.font="11px Inter,system-ui,sans-serif";ctx.fillText("Tap biscuits, then spend them on auto tappers.",240,336);',
      'for(var fi=0;fi<floaters.length;fi++){var f=floaters[fi];ctx.textAlign="center";ctx.fillStyle="rgba(255,209,102,"+f.life+")";ctx.font="bold 16px Inter,system-ui,sans-serif";ctx.fillText(f.text,f.x,f.y-(1-f.life)*28)}',
      'if(golden_flash>0){ctx.fillStyle="rgba(255,209,102,"+(golden_flash*0.08)+")";ctx.fillRect(0,0,480,360)}',
    '}',
    'function loop(now){',
      'var delta=Math.min((now-last_time)/1000,0.12);last_time=now;',
      'if(pulse>0)pulse=Math.max(0,pulse-delta*3);',
      'if(typeof auto_tick==="function")auto_tick(delta);',
      'cps=(typeof biscuits_per_second==="function")?biscuits_per_second():auto_tappers*auto_power;',
      'if(golden.active){golden.life-=delta;if(golden.life<=0){golden.active=false;golden.timer=14}}else{golden.timer-=delta;if(golden.timer<=0){golden.active=true;golden.life=7;golden.x=90+Math.random()*300;golden.y=100+Math.random()*100}}',
      'if(clicked){clicked=false;var hit=false;',
        'if(click_x>=20&&click_x<=230&&click_y>=256&&click_y<=306){if(typeof buy_auto_tapper==="function")buy_auto_tapper();hit=true}',
        'else if(click_x>=250&&click_x<=460&&click_y>=256&&click_y<=306){if(typeof buy_faster_tapper==="function")buy_faster_tapper();hit=true}',
        'else if(golden.active){var gdx=click_x-golden.x,gdy=click_y-golden.y;if(gdx*gdx+gdy*gdy<=28*28){if(typeof golden_bonus==="function")golden_bonus();golden.active=false;golden.timer=14;golden_flash=1;addFloater(golden.x,golden.y,"GOLDEN!");hit=true}}',
        'if(!hit){var tdx=click_x-240,tdy=click_y-145;if(tdx*tdx+tdy*tdy<=84*84){if(typeof on_tap==="function")on_tap();pulse=1;addFloater(240,145,"+"+click_power)}}',
      '}',
      'for(var fi2=floaters.length-1;fi2>=0;fi2--){floaters[fi2].life-=delta*0.9;if(floaters[fi2].life<=0)floaters.splice(fi2,1)}',
      'if(golden_flash>0)golden_flash=Math.max(0,golden_flash-delta*2);',
      'draw(now);',
      'requestAnimationFrame(loop)',
    '}',
    'var last_time=performance.now();requestAnimationFrame(loop);'
  ].join('');
}

var DRAW_LOOP = drawLoop();

function buildTemplate(presetup, userCode) {
  return cwBlobWrap(CSS_GAME, CANVAS_TAG, SETUP + STATE + CLICK_HANDLER + DEFAULTS + presetup, gdToJs(userCode), DRAW_LOOP);
}

function cardTemplate(userCode) {
  var lines = String(userCode || '').split('\n');
  var fields = {};
  lines.forEach(function (l) {
    var m = l.match(/^([^:]+):\s*(.*)$/);
    if (m && m[2].trim()) fields[m[1].trim()] = m[2].trim();
  });
  var order = ['Game name', 'Biscuit type', 'Tap power', 'Auto tapper name', 'Starting auto tappers', 'One thing to add at home'];
  var html = '<style>body{font-family:Inter,system-ui,sans-serif;background:#140f0b;color:#f5efe0;padding:18px;margin:0}' +
    'h2{font-family:Fredoka,cursive;color:#ffd166;margin:0 0 12px}' +
    '.card{background:#231a12;border:2px solid #c98a2e;border-radius:14px;padding:18px}' +
    '.row{display:flex;gap:8px;margin:7px 0;align-items:baseline}' +
    '.lbl{color:#c8b9a6;min-width:180px;font-size:.82rem}' +
    '.val{color:#fff;font-weight:700}' +
    '.tip{margin-top:14px;padding:11px;background:#140f0b;border-left:3px solid #ffd166;font-size:.8rem;color:#c8b9a6;line-height:1.5}' +
    '</style><div class="card"><h2>Biscuit Tycoon Mod Card</h2>';
  order.forEach(function (k) {
    if (fields[k]) html += '<div class="row"><span class="lbl">' + k + '</span><span class="val">' + fields[k] + '</span></div>';
  });
  html += '<div class="tip">At home: add a Button node, connect its pressed signal to on_tap, and call auto_tick(delta) from _process. Save biscuits with FileAccess.open("user://bakery.save", FileAccess.WRITE).</div></div>';
  var blob = 'document.body.innerHTML=' + JSON.stringify(html) + ';';
  return cwBlobWrap('<style>body{margin:0;background:#140f0b}</style>', '<div></div>', '', blob, '');
}

window.CW_CONFIG = {
  storageKey: 'jvds-godot-autoclicker-v1',
  downloadName: 'my-biscuit-tycoon.html',
  version: 1,
  engineProject: ENGINE_PROJECT,
  nextStep: { url: '/workshops/godot-lab/', label: 'Godot Lab' },

  hints: [
    'A big biscuit tin in the middle and a biscuit counter at the top',
    'The tap power number sits behind every tap, ready for an upgrade',
    'A biscuits per second readout appears at the top right',
    'Auto tappers make the counter climb while you watch',
    'Two shop buttons at the bottom show what you can afford',
    'A golden biscuit appears now and then for a big bonus',
    'Your mod card shows the bakery you designed'
  ],

  templates: {
    1: function (u) {
      return buildTemplate('', u);
    },
    2: function (u) {
      return buildTemplate('auto_tappers=2;function biscuits_per_second(){return 0;}', u);
    },
    3: function (u) {
      return buildTemplate('auto_tappers=1;', u);
    },
    4: function (u) {
      return buildTemplate('auto_tappers=1;biscuits=60;auto_cost=50;' + WORKING_AUTO_TICK, u);
    },
    5: function (u) {
      return buildTemplate('auto_tappers=2;auto_power=1;biscuits=300;faster_cost=250;' + WORKING_AUTO_TICK + WORKING_BUY_TAPPER, u);
    },
    6: function (u) {
      return buildTemplate('auto_tappers=2;auto_power=1;biscuits=200;' + WORKING_AUTO_TICK + WORKING_BUY_TAPPER + WORKING_BUY_FASTER, u);
    },
    7: function (u) {
      return cardTemplate(u);
    }
  },

  steps: [
    {
      num: 1,
      title: 'The Big Biscuit',
      activity: '🍪 First tap',
      goal: 'Make a tap on the biscuit tin add biscuits to your counter.',
      checkpoint: 'Click the biscuit. The counter at the top left should go up by one each time.',
      points: [
        '<code>click_power</code> starts at 1, so each tap adds one biscuit',
        '<code>on_tap()</code> is the function the tin runs when it is clicked',
        'The counter is drawn in the top left of the preview',
        'In Godot you would connect a Button node pressed signal to this function'
      ],
      challenge: '🍪 Write the tap function:',
      starter: '# Add biscuits when the tin is tapped\nfunc on_tap():\n    biscuits += ___',
      solution: '# Add biscuits when the tin is tapped\nfunc on_tap():\n    biscuits += click_power',
      checks: ['on_tap', 'biscuits', 'click_power'],
      height: 90,
      minutes: 5,
      engine: {
        name: 'Godot 4',
        file: 'res://bakery.gd',
        intro: 'The starter project already has the tin button, labels and shop wired. You only fill in the functions.',
        do: [
          'Download and unzip the starter project, then import project.godot in Godot 4.',
          'Open bakery.gd and find func on_tap().',
          'Add one line inside it: biscuits += click_power',
          'Press F5 and click TAP THE TIN.'
        ],
        check: 'Click TAP THE TIN. The BiscuitsLabel should count up by one.'
      },
      fills: {
        text: 'A tap adds ___ to the counter. The tap power starts at ___.',
        answers: ['click_power', '1']
      },
      quiz: {
        question: 'Why keep the tap power in a variable instead of always adding 1?',
        options: [
          'Variables make the code shorter',
          'An upgrade can raise click_power later without rewriting the tap function',
          'Godot cannot add 1 directly'
        ],
        correct: 1
      }
    },
    {
      num: 2,
      title: 'Biscuits per Second',
      activity: '⏱️ CPS',
      goal: 'Work out the biscuits per second so the bakery can grow on its own.',
      checkpoint: 'The top right of the preview should show a biscuits per second number.',
      points: [
        '<code>auto_tappers</code> is how many helpers you own',
        '<code>auto_power</code> is how many biscuits each helper bakes',
        'Multiply them to get the rate for one second',
        'The preview calls <code>biscuits_per_second()</code> every frame'
      ],
      challenge: '⏱️ Write the rate function:',
      starter: '# How many biscuits arrive each second?\nfunc biscuits_per_second():\n    return auto_tappers * ___',
      solution: '# How many biscuits arrive each second?\nfunc biscuits_per_second():\n    return auto_tappers * auto_power',
      checks: ['biscuits_per_second', 'auto_tappers', 'auto_power'],
      height: 90,
      minutes: 5,
      engine: {
        name: 'Godot 4',
        file: 'res://bakery.gd',
        do: [
          'Find func biscuits_per_second().',
          'Change return 0.0 to return auto_tappers * auto_power.',
          'Press F5. The CpsLabel updates every frame.',
          'Hire an auto tapper in step 4 to watch the number rise.'
        ],
        check: 'The CpsLabel should show the product of auto_tappers and auto_power.'
      },
      fills: {
        text: 'With ___ auto tappers at ___ power each, the rate is their product.',
        answers: ['2', '1']
      },
      quiz: {
        question: 'If you own 3 auto tappers at power 2, what is the rate?',
        options: ['5 per second', '6 per second', '2 per second'],
        correct: 1
      }
    },
    {
      num: 3,
      title: 'Hire an Auto Tapper',
      activity: '🤖 Auto tick',
      goal: 'Make an auto tapper add biscuits every frame, so the bakery earns while you watch.',
      checkpoint: 'The biscuit count should rise on its own, about once per second.',
      points: [
        '<code>auto_tick(delta)</code> runs every frame',
        '<code>delta</code> is the seconds since the last frame',
        'Multiply by delta so the rate stays per second',
        'The preview starts with one auto tapper already hired'
      ],
      challenge: '🤖 Write the auto tapper:',
      starter: '# Auto tappers bake on their own\nfunc auto_tick(delta):\n    biscuits += auto_tappers * auto_power * ___',
      solution: '# Auto tappers bake on their own\nfunc auto_tick(delta):\n    biscuits += auto_tappers * auto_power * delta',
      checks: ['auto_tick', 'delta', 'auto_tappers', 'auto_power'],
      height: 90,
      minutes: 6,
      engine: {
        name: 'Godot 4',
        file: 'res://bakery.gd',
        do: [
          'Find func auto_tick(delta). _process already calls it every frame.',
          'Add biscuits += auto_tappers * auto_power * delta.',
          'For a quick test, change var auto_tappers = 0 to 1 at the top of the script.',
          'Press F5 and watch the biscuit count climb.'
        ],
        check: 'With one auto tapper the counter should rise about once per second.'
      },
      fills: {
        text: 'The ___ argument holds the seconds since the last frame. Multiplying by it keeps the rate per ___.',
        answers: ['delta', 'second']
      },
      quiz: {
        question: 'Why multiply by delta?',
        options: [
          'To make biscuits count faster',
          'So the rate is per second and stays the same on fast and slow computers',
          'Godot requires delta in every function'
        ],
        correct: 1
      }
    },
    {
      num: 4,
      title: 'Open the Upgrade Shop',
      activity: '🛒 Shop',
      goal: 'Let the player spend biscuits to hire another auto tapper, with a price that rises each time.',
      checkpoint: 'Click AUTO TAPPER in the preview. The cost should go up after each buy.',
      points: [
        'Check <code>biscuits &gt;= auto_cost</code> before buying',
        'Subtract the cost, then add one auto tapper',
        'Multiply the cost by 1.6 and round it',
        'The preview starts with 60 biscuits so the first buy is ready'
      ],
      challenge: '🛒 Write the buy function:',
      starter: '# Buy one auto tapper\nfunc buy_auto_tapper():\n    if biscuits >= auto_cost:\n        biscuits -= auto_cost\n        auto_tappers += 1\n        auto_cost = roundi(auto_cost * ___)',
      solution: '# Buy one auto tapper\nfunc buy_auto_tapper():\n    if biscuits >= auto_cost:\n        biscuits -= auto_cost\n        auto_tappers += 1\n        auto_cost = roundi(auto_cost * 1.6)',
      checks: ['buy_auto_tapper', 'auto_cost', 'auto_tappers', '1.6'],
      height: 150,
      minutes: 7,
      engine: {
        name: 'Godot 4',
        file: 'res://bakery.gd',
        do: [
          'Find func buy_auto_tapper().',
          'Add the if block from the canvas. It uses roundi, not round, because auto_cost is a whole number.',
          'Press F5 and tap until the label reaches 50.',
          'Press AUTO TAPPER. The cost should rise to 80.'
        ],
        check: 'The button takes 50 biscuits, adds one tapper and raises the next cost to 80.'
      },
      fills: {
        text: 'Each new auto tapper costs ___ times the last price. The check uses biscuits >= ___.',
        answers: ['1.6', 'auto_cost']
      },
      quiz: {
        question: 'Why does the price go up after each auto tapper?',
        options: [
          'To make the game slower',
          'So early buys stay cheap and later buys are a real choice, which keeps the game balanced',
          'Godot does not allow fixed prices'
        ],
        correct: 1
      }
    },
    {
      num: 5,
      title: 'Faster Tappers',
      activity: '⚡ Upgrades',
      goal: 'Add a second upgrade that makes every auto tapper bake more biscuits.',
      checkpoint: 'Buy a FASTER TAPPER and watch the / sec number jump.',
      points: [
        '<code>auto_power</code> multiplies every auto tapper you own',
        'The faster upgrade costs more because it boosts all of them',
        'Raise its cost by 2.5 times each level',
        'The preview starts with 300 biscuits so you can try it'
      ],
      challenge: '⚡ Write the faster tapper upgrade:',
      starter: '# Make every auto tapper stronger\nfunc buy_faster_tapper():\n    if biscuits >= faster_cost:\n        biscuits -= faster_cost\n        auto_power += 1\n        faster_cost = roundi(faster_cost * ___)',
      solution: '# Make every auto tapper stronger\nfunc buy_faster_tapper():\n    if biscuits >= faster_cost:\n        biscuits -= faster_cost\n        auto_power += 1\n        faster_cost = roundi(faster_cost * 2.5)',
      checks: ['buy_faster_tapper', 'faster_cost', 'auto_power', '2.5'],
      height: 150,
      minutes: 7,
      engine: {
        name: 'Godot 4',
        file: 'res://bakery.gd',
        do: [
          'Find func buy_faster_tapper().',
          'Add the if block from the canvas, with roundi.',
          'Press F5 and earn 250 biscuits, then press FASTER TAPPER.'
        ],
        check: 'The faster upgrade adds 1 to auto_power and raises its own cost.'
      },
      fills: {
        text: 'The faster tapper adds ___ to auto power. Its price grows by ___ times each time.',
        answers: ['1', '2.5']
      },
      quiz: {
        question: 'Why make the faster upgrade cost more than the auto tapper?',
        options: [
          'It looks nicer',
          'It multiplies every auto tapper you already own, so it is worth more than one extra tapper',
          'It uses more memory'
        ],
        correct: 1
      }
    },
    {
      num: 6,
      title: 'Golden Biscuit',
      activity: '✨ Bonus',
      goal: 'Add a rare golden biscuit that gives a big one-off bonus when you click it.',
      checkpoint: 'Wait for the golden biscuit, then click it for a bonus.',
      points: [
        'The golden biscuit appears every 14 seconds',
        '<code>golden_bonus()</code> runs when it is clicked',
        'The bonus scales with your bakery so it stays useful',
        'The golden biscuit disappears after it is clicked'
      ],
      challenge: '✨ Write the golden bonus:',
      starter: '# Golden biscuit bonus\nfunc golden_bonus():\n    biscuits += max(25, round(auto_tappers * auto_power * ___))',
      solution: '# Golden biscuit bonus\nfunc golden_bonus():\n    biscuits += max(25, round(auto_tappers * auto_power * 10))',
      checks: ['golden_bonus', 'biscuits', 'max', '10'],
      height: 100,
      minutes: 6,
      engine: {
        name: 'Godot 4',
        file: 'res://bakery.gd',
        do: [
          'Find func golden_bonus().',
          'Add the line from the canvas. max and round work in GDScript 4.',
          'Press F5 and wait 14 seconds for the GOLDEN button.',
          'Click it. The bonus is added and the button hides.'
        ],
        check: 'The golden button appears on the timer, pays at least 25 biscuits and hides after one click.'
      },
      fills: {
        text: 'The golden bonus is at least ___ biscuits. It also adds ten seconds of your ___ rate.',
        answers: ['25', 'auto']
      },
      quiz: {
        question: 'Why make the golden biscuit appear on a timer instead of every click?',
        options: [
          'Timers are easier',
          'A rare bonus feels special and gives the player a reason to keep watching',
          'Clicks are too fast to track'
        ],
        correct: 1
      }
    },
    {
      num: 7,
      title: 'Take It Home',
      activity: '🏠 Mod card',
      goal: 'Fill in your bakery plan so you can build it in the real Godot editor at home.',
      checkpoint: 'Fill in the fields, then press Apply to see your card.',
      points: [
        'In Godot, add a Button node and connect its pressed signal to on_tap',
        'Use a Timer node for the auto tapper, or call auto_tick from _process(delta)',
        'Save biscuits with <code>FileAccess.open("user://bakery.save", FileAccess.WRITE)</code>',
        'Open the Godot Lab to edit the same scene in the browser'
      ],
      challenge: '🏠 Fill in your mod card:',
      starter: '# My Biscuit Tycoon card\nGame name: ___\nBiscuit type: ___\nTap power: ___\nAuto tapper name: ___\nStarting auto tappers: ___\nOne thing to add at home: ___',
      solution: '# My Biscuit Tycoon card\nGame name: Crunchy Creamery\nBiscuit type: chocolate chip\nTap power: 2\nAuto tapper name: Tin Tapper\nStarting auto tappers: 1\nOne thing to add at home: a bakery cat that swipes biscuits',
      checks: [],
      height: 180,
      minutes: 4,
      engine: {
        name: 'Godot 4',
        file: 'res://project.godot',
        do: [
          'Your bakery is the project. Press F5 and check every feature once.',
          'Open Project > Export and add a Windows Desktop or Web preset.',
          'Choose Export Project and keep the whole export folder.',
          'Open the Godot Lab to compare the same scene in the browser.'
        ],
        check: 'The exported folder runs on another computer and the bakery keeps working.'
      },
      fills: {
        text: 'At home I want a ___ bakery with ___ starting auto tappers.',
        answers: ['chocolate chip', '1']
      }
    }
  ]
};
