'use strict';

var CSS_OUTPUT = '<style>body{display:flex;flex-direction:column;background:#0f172a;margin:0;color:#e2e8f0;font-family:monospace}' +
  '#output{flex:1;padding:12px;overflow-y:auto;min-height:220px;background:#0f172a;border-top:1px solid #334155;font-size:14px;white-space:pre-wrap}' +
  '.line{margin:2px 0}.ok{color:#4ade80}.err{color:#f87171}.info{color:#94a3b8}</style>';
var OUTPUT_TAG = '<div id="output"><span class="info">Run your GDScript to see output here.</span></div>';
var SETUP = 'const out=document.getElementById("output");function print(v){var d=document.createElement("div");d.className="line ok";d.textContent=String(v);out.appendChild(d);out.scrollTop=out.scrollHeight}function printerr(v){var d=document.createElement("div");d.className="line err";d.textContent="ERROR: "+String(v);out.appendChild(d)}out.innerHTML="";';

function wbWrap(userCode) {
  var safe = userCode.replace(/\bprint\s*\(/g, 'print(').replace(/\bprint_err\s*\(/g, 'printerr(');
  return cwBlobWrap(CSS_OUTPUT, OUTPUT_TAG, SETUP, safe, '');
}

window.CW_CONFIG = {
  storageKey: 'jvds-godot-gdscript-essentials-canvas',
  downloadName: 'my-godot-gdscript-essentials.html',
  nextStep: { url: '/workshops/godot-tutorial-canvas.html', label: 'Godot Tutorial' },

  hints: [
    'Type GDScript code and press Apply to run it in the browser',
    'print() outputs a value to the panel below the code editor',
    'Variables store values: var name = "Josh"',
    'Functions group code: func greet(name): return "Hello " + name',
    'Loops repeat code: for i in range(5): print(i)',
    'Conditions branch: if score > 100: print("High score!")',
    'Arrays hold lists: var items = ["sword","shield","potion"]'
  ],

  templates: {
    1: function(u) { return wbWrap(u); },
    2: function(u) { return wbWrap(u); },
    3: function(u) { return wbWrap(u); },
    4: function(u) { return wbWrap(u); },
    5: function(u) { return wbWrap(u); },
    6: function(u) { return wbWrap(u); },
    7: function(u) {
      var lines = u.split('\n');
      var fields = {};
      lines.forEach(function(l) {
        var m = l.match(/^([^:]+):\s*(.*)$/);
        if (m && m[2].trim()) fields[m[1].trim()] = m[2].trim();
      });
      var html = '<style>body{font-family:monospace;background:#0f172a;color:#e2e8f0;padding:16px;margin:0}' +
        'h2{color:#34d399;margin:0 0 12px}' +
        '.card{background:#1e293b;border:2px solid #334155;border-radius:10px;padding:16px}' +
        '.row{display:flex;gap:8px;margin:6px 0;align-items:baseline}' +
        '.lbl{color:#94a3b8;min-width:180px;font-size:.85rem}' +
        '.val{color:#f1f5f9;font-weight:bold}' +
        '.tip{margin-top:14px;padding:10px;background:#0f172a;border-left:3px solid #34d399;font-size:.82rem;color:#94a3b8}' +
        '</style>' +
        '<div class="card"><h2>🏠 My GDScript Mod Card</h2>';
      var order = ['Favourite GDScript concept','Variable I would use','Function I would write','Loop type I prefer','Signal I would create','One thing to try at home'];
      order.forEach(function(k) {
        if (fields[k]) html += '<div class="row"><span class="lbl">' + k + '</span><span class="val">' + fields[k] + '</span></div>';
      });
      html += '<div class="tip">💡 At home: open Godot, create a new script (Ctrl+N), and type out your favourite concept from this workshop. Hit the play button in the script editor to run it and see the output in the Godot console!</div></div>';
      var blob = 'document.body.innerHTML=' + JSON.stringify(html) + ';';
      return cwBlobWrap('<style>body{margin:0;background:#0f172a}</style>', '<div></div>', '', blob, '');
    }
  },

  steps: [
    {
      num: 1,
      title: 'Variables & Types',
      activity: '📦 Variables',
      goal: 'Declare variables of different types and print them.',
      checkpoint: 'Press Apply - the output panel should show your variable values printed on separate lines.',
      points: [
        'var stores a value: var name = "Josh"',
        'int for whole numbers: var score = 0',
        'float for decimals: var speed = 2.5',
        'bool for true/false: var is_alive = true'
      ],
      challenge: '🤖 Declare and print each variable type:',
      starter: '# String\nvar player_name = "___"\nprint(player_name)\n\n# Integer\nvar score = ___\nprint(score)\n\n# Float\nvar speed = ___\nprint(speed)\n\n# Bool\nvar is_alive = true\nprint(is_alive)',
      solution: '# String\nvar player_name = "Hero"\nprint(player_name)\n\n# Integer\nvar score = 100\nprint(score)\n\n# Float\nvar speed = 2.5\nprint(speed)\n\n# Bool\nvar is_alive = true\nprint(is_alive)',
      checks: ['print', 'var', 'true'],
      height: 200,
      fills: {
        text: 'GDScript has ___ main variable types used here: String, int, float and ___.',
        answers: ['4', 'bool']
      },
      quiz: {
        question: 'Why use int instead of float for a score variable?',
        options: [
          'int is faster to type',
          'Scores are always whole numbers - using float could cause display issues like "score: 100.000001" due to floating point imprecision',
          'GDScript does not support float scores'
        ],
        correct: 1
      }
    },
    {
      num: 2,
      title: 'Functions',
      activity: '⚙️ Functions',
      goal: 'Write a function that takes parameters and returns a value.',
      checkpoint: 'Press Apply - the output should show the result of calling your function.',
      points: [
        'func declares a function: func add(a, b):',
        'return sends a value back to the caller',
        'Parameters let you reuse the function with different values',
        'In Godot all node behaviour is written as functions connected to signals'
      ],
      challenge: '🤖 Write an add function:',
      starter: 'func add(a, b):\n    return ___ + ___\n\nvar result = add(10, ___)\nprint("10 + 5 = " + str(result))',
      solution: 'func add(a, b):\n    return a + b\n\nvar result = add(10, 5)\nprint("10 + 5 = " + str(result))',
      checks: ['return', 'a + b', 'add('],
      height: 140,
      fills: {
        text: 'Functions ___ code into reusable blocks. The return keyword sends a value back to the ___.',
        answers: ['group', 'caller']
      },
      quiz: {
        question: 'Why use a function instead of writing the same code twice?',
        options: [
          'Functions use less disk space',
          'Functions mean you only fix a bug once - duplicate code requires finding and fixing every copy separately',
          'GDScript runs functions faster'
        ],
        correct: 1
      }
    },
    {
      num: 3,
      title: 'Loops',
      activity: '🔁 Loops',
      goal: 'Use a for loop to print numbers and a while loop to count down.',
      checkpoint: 'Press Apply - you should see numbers 0 to 4 followed by a countdown.',
      points: [
        'for i in range(5): loops i from 0 to 4 (5 not included)',
        'while condition: repeats while the condition is true',
        'Loops avoid writing the same line 10 or 100 times',
        'In Godot, _process() is called every frame - it is the engine loop'
      ],
      challenge: '🤖 Write a for loop and a while loop:',
      starter: '# for loop: print 0 to 4\nfor i in range(___):\n    print(i)\n\n# while loop: countdown from 3\nvar count = 3\nwhile count > ___:\n    print(count)\n    count -= 1\nprint("Go!")',
      solution: '# for loop: print 0 to 4\nfor i in range(5):\n    print(i)\n\n# while loop: countdown from 3\nvar count = 3\nwhile count > 0:\n    print(count)\n    count -= 1\nprint("Go!")',
      checks: ['range(5)', 'count > 0', 'count -= 1'],
      height: 180,
      fills: {
        text: 'range(5) generates numbers ___ to ___. A while loop must change the condition variable or it loops ___.',
        answers: ['0', '4', 'forever']
      },
      quiz: {
        question: 'What is the danger of a while loop with a condition that never becomes false?',
        options: [
          'It prints a warning',
          'An infinite loop freezes the program - always ensure the loop variable changes toward the exit condition',
          'GDScript limits while loops automatically'
        ],
        correct: 1
      }
    },
    {
      num: 4,
      title: 'Conditions',
      activity: '🔀 Conditions',
      goal: 'Use if/elif/else to print different messages based on a score.',
      checkpoint: 'Press Apply - the output should show the grade message that matches your score.',
      points: [
        'if checks the first condition',
        'elif checks another condition if the first was false',
        'else runs when no condition matched',
        'In Godot, conditions control game state: if health <= 0: die()'
      ],
      challenge: '🤖 Write a grade checker:',
      starter: 'var score = 75\n\nif score >= ___:\n    print("A - excellent!")\nelif score >= 70:\n    print("B - good job!")\nelif score >= ___:\n    print("C - keep trying!")\nelse:\n    print("D - practice more")',
      solution: 'var score = 75\n\nif score >= 90:\n    print("A - excellent!")\nelif score >= 70:\n    print("B - good job!")\nelif score >= 50:\n    print("C - keep trying!")\nelse:\n    print("D - practice more")',
      checks: ['elif', 'else', 'print'],
      height: 180,
      fills: {
        text: 'Only one branch runs even if ___ conditions are true. GDScript uses ___ instead of "else if".',
        answers: ['multiple', 'elif']
      },
      quiz: {
        question: 'Why use elif instead of separate if statements for grades?',
        options: [
          'elif is shorter to type',
          'Separate if statements would all run - a score of 95 would print all four messages because 95 >= 90, >= 70, >= 50 are all true',
          'GDScript requires elif'
        ],
        correct: 1
      }
    },
    {
      num: 5,
      title: 'Arrays & Dictionaries',
      activity: '📋 Arrays',
      goal: 'Store a list of items in an array and a set of key-value pairs in a dictionary.',
      checkpoint: 'Press Apply - output should show each item in your array and values from your dictionary.',
      points: [
        'var items = ["sword","shield"] creates an array',
        'items[0] accesses the first element (index 0)',
        'var stats = {"hp": 100, "mp": 50} creates a dictionary',
        'stats["hp"] or stats.hp reads a dictionary value'
      ],
      challenge: '🤖 Create and read an array and dictionary:',
      starter: '# Array of items\nvar inventory = ["sword", "shield", "___"]\nprint(inventory[0])\nprint(inventory.size())\n\n# Dictionary of stats\nvar stats = {"hp": 100, "mp": ___}\nprint("HP: " + str(stats["hp"]))\nprint("MP: " + str(stats["___"]))',
      solution: '# Array of items\nvar inventory = ["sword", "shield", "potion"]\nprint(inventory[0])\nprint(inventory.size())\n\n# Dictionary of stats\nvar stats = {"hp": 100, "mp": 50}\nprint("HP: " + str(stats["hp"]))\nprint("MP: " + str(stats["mp"]))',
      checks: ['inventory', 'stats', 'str('],
      height: 180,
      fills: {
        text: 'Arrays use numeric ___ to access items. Dictionaries use string ___ instead.',
        answers: ['indices', 'keys']
      },
      quiz: {
        question: 'When would you use a dictionary instead of an array?',
        options: [
          'When you have more than 10 items',
          'When items have names - a dictionary maps "hp" to 100 which is more readable than remembering that stats[0] means hp',
          'When order matters'
        ],
        correct: 1
      }
    },
    {
      num: 6,
      title: 'Signals',
      activity: '📡 Signals',
      goal: 'Simulate a signal by emitting and connecting it with a custom function.',
      checkpoint: 'Press Apply - the output should show the signal being emitted and the connected function receiving it.',
      points: [
        'signal declares an event: signal health_changed(new_hp)',
        'emit_signal("health_changed", value) fires the event',
        'connect("health_changed", on_health_changed) wires the listener',
        'Signals are Godot\'s event system - nodes communicate without knowing about each other'
      ],
      challenge: '🤖 Simulate signal emit and receive:',
      starter: '# Simulate a signal\nvar health = 100\n\nfunc on_health_changed(new_hp):\n    print("Health changed to: " + str(___))  \n\n# Emit the signal (simulate)\nhealth = 75\non_health_changed(___)',
      solution: '# Simulate a signal\nvar health = 100\n\nfunc on_health_changed(new_hp):\n    print("Health changed to: " + str(new_hp))\n\n# Emit the signal (simulate)\nhealth = 75\non_health_changed(health)',
      checks: ['on_health_changed', 'str(', 'health'],
      height: 160,
      fills: {
        text: 'Signals let nodes ___ without direct references. The connected function is called the signal ___.',
        answers: ['communicate', 'handler']
      },
      quiz: {
        question: 'Why use signals instead of calling functions directly between nodes?',
        options: [
          'Signals run faster',
          'Signals decouple nodes - the emitter does not need to know which nodes are listening, making the code easier to maintain and reuse',
          'GDScript requires signals for all function calls'
        ],
        correct: 1
      }
    },
    {
      num: 7,
      title: 'Take It Home',
      activity: '🏠 Mod card',
      goal: 'Fill in your Mod Card. At home, open Godot and write your favourite GDScript concept in a real script.',
      checkpoint: 'Fill in as many fields as you like, then hit Apply to see your card.',
      points: [
        'At home: open Godot, select any node and press Ctrl+Shift+N to create a new script',
        'Type out your favourite concept from today - variables, functions, loops or signals',
        'Press F5 to run the project and see your print() output in the Godot Output panel',
        'Try connecting a signal: select a Button node, click Node panel, double-click pressed'
      ],
      challenge: '✏️ Fill in your Mod Card:',
      starter: '# My GDScript Mod Card\nFavourite GDScript concept: ___\nVariable I would use: ___\nFunction I would write: ___\nLoop type I prefer: ___\nSignal I would create: ___\nOne thing to try at home: ___',
      solution: '# My GDScript Mod Card\nFavourite GDScript concept: functions\nVariable I would use: var score = 0\nFunction I would write: func take_damage(amount)\nLoop type I prefer: for loop\nSignal I would create: signal player_died\nOne thing to try at home: write a health system with signals',
      checks: [],
      height: 180,
      fills: {
        text: 'My favourite concept is ___ and at home I will try ___.',
        answers: ['functions', 'signals']
      }
    }
  ]
};
