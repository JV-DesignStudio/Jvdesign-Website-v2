/* JVDS Code Snippet Generator - Echo line explainers (A2767)
   Turns a code line into a short, plain-English explanation in Echo's voice. */
(function (root) {
  'use strict';

  function say(text) { return { who: 'Echo', text: text }; }

  var RULES = [
    { re: /^\s*(?:\/\/|#|--)/, make: function () { return say('This is a comment. The computer skips it, so it is a note for humans.'); } },
    { re: /^\s*$/, make: function () { return say('A blank line just makes the code easier to read. The computer ignores it.'); } },
    { re: /\bextends\s+(\w+)/, make: function (m) { return say('This script controls a ' + m[1] + '. Godot gives it the built-in behaviour of that node type.'); } },
    { re: /^\s*class\s+(\w+)/, make: function (m) { return say('This defines a class called ' + m[1] + '. A class is a blueprint for an object in your game.'); } },
    { re: /^\s*(?:func|function)\s+(\w+)\s*\(/, make: function (m) { return say('This defines a function called ' + m[1] + '. The code inside runs when something calls it.'); } },
    { re: /^\s*def\s+(\w+)\s*\(/, make: function (m) { return say('This defines a Python function called ' + m[1] + '. You can reuse it whenever you need that job done.'); } },
    { re: /^\s*(?:public|private|protected|static|void|int|float|double|bool|string).*\b(\w+)\s*\([^)]*\)\s*\{?\s*$/, make: function (m) { return say('This creates a function called ' + m[1] + '. It groups the steps so you can run them by name.'); } },
    { re: /^\s*(?:var|const|let)\s+(\w+)\s*=/, make: function (m) { return say('This makes a variable called ' + m[1] + ' and stores a value in it so you can use it later.'); } },
    { re: /^\s*local\s+(\w+)\s*=/, make: function (m) { return say('This makes a local variable called ' + m[1] + '. It only exists inside this script.'); } },
    { re: /^\s*@export\b/, make: function () { return say('The @export tag shows this value in the Godot Inspector so you can change it without editing code.'); } },
    { re: /^\s*if\s*[\(:]/, make: function () { return say('This checks a condition. The code inside only runs when the condition is true.'); } },
    { re: /^\s*elif\s+|^\s*else\s*if\b/, make: function () { return say('This checks another condition when the earlier ones were false.'); } },
    { re: /^\s*else\b/, make: function () { return say('This runs when the condition above was false.'); } },
    { re: /^\s*for\s+/, make: function () { return say('This loops through items and runs the code once for each one.'); } },
    { re: /^\s*while\s+/, make: function () { return say('This repeats the code while the condition stays true. Make sure the condition can become false.'); } },
    { re: /^\s*return\b/, make: function () { return say('This sends a value back to whatever called the function, then stops running the function.'); } },
    { re: /^\s*(?:import|from|using|include)\b/, make: function () { return say('This brings in code from another file or library so you can use it here.'); } },
    { re: /^\s*try\b|^\s*except\b|^\s*catch\b|^\s*finally\b/, make: function () { return say('This handles errors so the game can keep running instead of crashing.'); } },
    { re: /^\s*match\b|^\s*switch\b/, make: function () { return say('This chooses one branch based on a value, like a set of options.'); } },
    { re: /^\s*await\b|^\s*yield\b/, make: function () { return say('This waits for something to finish before carrying on.'); } },
    { re: /^\s*(?:signal|emit_signal)\b|:Connect\b|\.connect\(/, make: function () { return say('A signal lets one part of the code tell another part that something happened.'); } },
    { re: /^\s*print\s*\(|console\.log\s*\(/, make: function () { return say('This prints a message so you can see what is happening while the game runs.'); } },
    { re: /localStorage\.(?:setItem|getItem)/, make: function () { return say('This saves or loads data in the browser on this device, so it is still there next time.'); } },
    { re: /\.physics\.add\.sprite\s*\(/, make: function () { return say('This creates the player on screen and gives it physics, so it can fall, move and bump into things.'); } },
    { re: /\.setVelocityX?\s*\(|setVelocity\s*\(/, make: function () { return say('This sets how fast the object moves each frame.'); } },
    { re: /\.addEventListener\s*\(/, make: function () { return say('This tells the page to watch for an event, such as a key press or a click.'); } },
    { re: /createCursorKeys|Input\.is_action|keyboard_check|pygame\.key/, make: function () { return say('This reads the player input so the game knows which control is being pressed.'); } },
    { re: /get_tree\(\)\.change_scene|SceneManager|load_scene/, make: function () { return say('This switches the game to a different scene, such as the next level.'); } },
    { re: /preload\s*\(|load\s*\(|require\s*\(/, make: function () { return say('This loads a file or module so the code can use it.'); } },
    { re: /\.play\s*\(|play\s*\(/, make: function () { return say('This starts playing a sound or animation.'); } },
    { re: /^\s*[{}]\s*$/, make: function () { return say('Curly braces group lines of code together as one block.'); } },
    { re: /^\s*(?:var|const|let)?\s*\w+\s*[-+*/]?=/, make: function () { return say('This stores a new value, so the game remembers it for the next step.'); } }
  ];

  function explain(lang, line) {
    var text = String(line == null ? '' : line);
    for (var i = 0; i < RULES.length; i++) {
      var m = RULES[i].re.exec(text);
      if (m) return RULES[i].make(m);
    }
    return say('This line is part of the pattern. Change one value, run the code, and watch what happens.');
  }

  var api = { explain: explain };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root = root || (typeof self !== 'undefined' ? self : this);
  root.CSGExplainers = api;
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : this));
