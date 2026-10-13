'use strict';

/* ===================================================
   IFRAME BUILDING BLOCKS (memory-match-specific)
   =================================================== */

var CSS_GAME = '<style>'
  + '*{box-sizing:border-box;margin:0;padding:0}'
  + 'body{font-family:sans-serif;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;min-height:100vh;color:#fff}'
  + '.header{text-align:center;padding:12px 0 4px}'
  + '.header h1{font-size:18px;color:#e2e2ff}'
  + '.stats{display:flex;gap:20px;justify-content:center;padding:6px 0 10px;font-size:14px;color:#aab}'
  + '.grid{display:grid;grid-template-columns:repeat(4,80px);gap:8px;perspective:600px}'
  + '.card{width:80px;height:80px;cursor:pointer;position:relative;transform-style:preserve-3d;transition:transform 0.5s}'
  + '.card.flipped{transform:rotateY(180deg)}'
  + '.card.matched{transform:rotateY(180deg)}'
  + '.card .front,.card .back{position:absolute;width:100%;height:100%;border-radius:10px;display:flex;align-items:center;justify-content:center;backface-visibility:hidden}'
  + '.card .back{background:linear-gradient(135deg,#6c5ce7,#a29bfe);font-size:28px;color:#fff}'
  + '.card .front{background:#2d2d5e;transform:rotateY(180deg);font-size:36px}'
  + '.card.matched .front{background:#1e6e3e}'
  + '.win-msg{margin-top:14px;font-size:18px;color:#ffd166;text-align:center;min-height:24px}'
  + '.best-msg{font-size:13px;color:#aab;margin-top:4px;text-align:center;min-height:18px}'
  + '</style>';

var HTML_SHELL_TOP = '<div class="header"><h1>Memory Match</h1></div>'
  + '<div class="stats">'
  + '<span>Moves: <span id="moveCount">0</span></span>'
  + '<span>Time: <span id="timer">0</span>s</span>'
  + '<span>Pairs: <span id="pairCount">0</span> / <span id="totalPairs">8</span></span>'
  + '</div>'
  + '<div class="grid" id="grid"></div>'
  + '<div class="win-msg" id="winMsg"></div>'
  + '<div class="best-msg" id="bestMsg"></div>';

var EMOJI_ARRAY = "var emojis=['\\ud83c\\udf4e','\\ud83c\\udf4a','\\ud83c\\udf4b','\\ud83c\\udf47','\\ud83d\\udc31','\\ud83d\\udc36','\\ud83d\\udc38','\\ud83e\\udd8a'];";

var DECK_BASIC = 'var deck=emojis.concat(emojis);';

var SHUFFLE_FN = 'function shuffle(arr){for(var i=arr.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=arr[i];arr[i]=arr[j];arr[j]=t}return arr}';

var BUILD_CARDS = 'var grid=document.getElementById("grid");'
  + 'deck.forEach(function(emoji,i){'
  + 'var card=document.createElement("div");card.className="card";card.dataset.index=i;card.dataset.emoji=emoji;'
  + 'card.innerHTML=\'<div class="back">?</div><div class="front">\'+emoji+\'</div>\';'
  + 'grid.appendChild(card)'
  + '});';

var STATE_VARS = 'var flippedCards=[];var matchedPairs=0;var totalPairs=emojis.length;var moves=0;var timerStarted=false;var timerVal=0;var timerInterval=null;var locked=false;';

var TIMER_FN = 'function startTimer(){if(!timerStarted){timerStarted=true;timerInterval=setInterval(function(){timerVal++;document.getElementById("timer").textContent=timerVal},1000)}}';

var MOVE_COUNTER = 'function updateMoves(){moves++;document.getElementById("moveCount").textContent=moves}';

var PAIR_COUNTER = 'function updatePairs(){document.getElementById("pairCount").textContent=matchedPairs}';

var WIN_CHECK = 'function checkWin(){if(matchedPairs===totalPairs){clearInterval(timerInterval);document.getElementById("winMsg").textContent="You won in "+moves+" moves and "+timerVal+"s!";'
  + 'var bestKey="memoryBest";var prev=localStorage.getItem(bestKey);if(!prev||moves<Number(prev)){localStorage.setItem(bestKey,moves);document.getElementById("bestMsg").textContent="New best score!"}'
  + 'else{document.getElementById("bestMsg").textContent="Best: "+prev+" moves"}}}';

var CLICK_HANDLER_FULL = 'document.getElementById("grid").addEventListener("click",function(e){'
  + 'var card=e.target.closest(".card");if(!card||card.classList.contains("flipped")||card.classList.contains("matched")||locked)return;'
  + 'startTimer();card.classList.add("flipped");flippedCards.push(card);'
  + 'if(flippedCards.length===2){updateMoves();locked=true;'
  + 'var a=flippedCards[0],b=flippedCards[1];'
  + 'if(a.dataset.emoji===b.dataset.emoji){a.classList.add("matched");b.classList.add("matched");matchedPairs++;updatePairs();flippedCards=[];locked=false;checkWin()}'
  + 'else{setTimeout(function(){a.classList.remove("flipped");b.classList.remove("flipped");flippedCards=[];locked=false},800)}'
  + '}});';

function wrap(code) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + CSS_GAME
    + '<\/head><body>'
    + HTML_SHELL_TOP
    + '<script>'
    + code
    + '<\/script><\/body><\/html>';
}

/* ===================================================
   CW_CONFIG - memory-match-specific steps + templates
   =================================================== */

window.CW_CONFIG = {
  storageKey: 'jvds-js-memory-canvas',
  downloadName: 'my-memory-game.html',

  hints: [
    'A 4x4 grid of cards appears - your game board is ready',
    'The cards are shuffled - no two games are the same',
    'Click a card to flip it and reveal the emoji underneath',
    'Two cards flipped - if they match, they stay face up!',
    'Track your moves and time - can you clear the board?',
    'Your best score is saved - challenge yourself to beat it!'
  ],

  templates: {
    1: function(u) {
      return wrap(
        EMOJI_ARRAY + DECK_BASIC + STATE_VARS +
        'try{' + u + '}catch(e){}' +
        TIMER_FN + MOVE_COUNTER + PAIR_COUNTER + WIN_CHECK +
        CLICK_HANDLER_FULL
      );
    },
    2: function(u) {
      return wrap(
        EMOJI_ARRAY +
        'try{' + u + '}catch(e){var deck=emojis.concat(emojis)}' +
        'if(typeof deck==="undefined")var deck=emojis.concat(emojis);' +
        BUILD_CARDS + STATE_VARS +
        TIMER_FN + MOVE_COUNTER + PAIR_COUNTER + WIN_CHECK +
        CLICK_HANDLER_FULL
      );
    },
    3: function(u) {
      return wrap(
        EMOJI_ARRAY + DECK_BASIC + SHUFFLE_FN + 'shuffle(deck);' +
        BUILD_CARDS + STATE_VARS +
        TIMER_FN + MOVE_COUNTER + PAIR_COUNTER + WIN_CHECK +
        'document.getElementById("grid").addEventListener("click",function(e){'
        + 'var card=e.target.closest(".card");if(!card||card.classList.contains("flipped")||card.classList.contains("matched")||locked)return;'
        + 'startTimer();'
        + 'try{' + u + '}catch(e){}'
        + 'flippedCards.push(card);'
        + 'if(flippedCards.length===2){updateMoves();locked=true;'
        + 'var a=flippedCards[0],b=flippedCards[1];'
        + 'if(a.dataset.emoji===b.dataset.emoji){a.classList.add("matched");b.classList.add("matched");matchedPairs++;updatePairs();flippedCards=[];locked=false;checkWin()}'
        + 'else{setTimeout(function(){a.classList.remove("flipped");b.classList.remove("flipped");flippedCards=[];locked=false},800)}'
        + '}});'
      );
    },
    4: function(u) {
      return wrap(
        EMOJI_ARRAY + DECK_BASIC + SHUFFLE_FN + 'shuffle(deck);' +
        BUILD_CARDS + STATE_VARS +
        TIMER_FN + MOVE_COUNTER + PAIR_COUNTER + WIN_CHECK +
        'document.getElementById("grid").addEventListener("click",function(e){'
        + 'var card=e.target.closest(".card");if(!card||card.classList.contains("flipped")||card.classList.contains("matched")||locked)return;'
        + 'startTimer();card.classList.add("flipped");flippedCards.push(card);'
        + 'if(flippedCards.length===2){updateMoves();locked=true;'
        + 'var a=flippedCards[0],b=flippedCards[1];'
        + 'try{' + u + '}catch(e){setTimeout(function(){a.classList.remove("flipped");b.classList.remove("flipped");flippedCards=[];locked=false},800)}'
        + '}});'
      );
    },
    5: function(u) {
      return wrap(
        EMOJI_ARRAY + DECK_BASIC + SHUFFLE_FN + 'shuffle(deck);' +
        BUILD_CARDS +
        'var flippedCards=[];var matchedPairs=0;var totalPairs=emojis.length;var locked=false;' +
        'try{' + u + '}catch(e){var moves=0;var timerStarted=false;var timerVal=0;var timerInterval=null;' +
        'function startTimer(){if(!timerStarted){timerStarted=true;timerInterval=setInterval(function(){timerVal++;document.getElementById("timer").textContent=timerVal},1000)}}' +
        'function updateMoves(){moves++;document.getElementById("moveCount").textContent=moves}' +
        'function updatePairs(){document.getElementById("pairCount").textContent=matchedPairs}' +
        '}' +
        'if(typeof startTimer==="undefined"){' +
        'var moves=0;var timerStarted=false;var timerVal=0;var timerInterval=null;' +
        'function startTimer(){if(!timerStarted){timerStarted=true;timerInterval=setInterval(function(){timerVal++;document.getElementById("timer").textContent=timerVal},1000)}}' +
        'function updateMoves(){moves++;document.getElementById("moveCount").textContent=moves}' +
        'function updatePairs(){document.getElementById("pairCount").textContent=matchedPairs}' +
        '}' +
        WIN_CHECK +
        CLICK_HANDLER_FULL
      );
    },
    6: function(u) {
      return wrap(
        EMOJI_ARRAY + DECK_BASIC + SHUFFLE_FN + 'shuffle(deck);' +
        BUILD_CARDS + STATE_VARS +
        TIMER_FN + MOVE_COUNTER + PAIR_COUNTER +
        'function checkWin(){if(matchedPairs===totalPairs){clearInterval(timerInterval);document.getElementById("winMsg").textContent="You won in "+moves+" moves and "+timerVal+"s!"}}' +
        CLICK_HANDLER_FULL +
        'try{' + u + '}catch(e){}'
      );
    }
  },

  steps: [
    {
      num: 1,
      title: 'The Board from Code',
      goal: 'Generate 16 card divs from an emoji array and add them to the grid.',
      points: [
        'The deck is two copies of 8 emojis - <code>[...emojis, ...emojis]</code> gives 16 cards',
        '<code>document.createElement("div")</code> builds a card, <code>innerHTML</code> fills it',
        '<code>grid.appendChild(card)</code> puts each card on the board'
      ],
      challenge: 'Write the loop that creates card elements and adds them to the grid:',
      starter: '// The grid element and deck array are ready\nvar grid = document.getElementById("grid");\n\n// Loop through each emoji in the deck\ndeck.forEach(function(emoji, i) {\n  // Create a card div\n  var card = document.createElement("div");\n  card.className = "card";\n  card.dataset.index = i;\n  card.dataset.emoji = emoji;\n  // Fill the card with a front and back face\n  card.innerHTML = \'<div class="back">?</div>\'\n    + \'<div class="front">\' + emoji + \'</div>\';\n  // Add the card to the grid\n  grid.appendChild(card);\n});',
      solution: 'var grid = document.getElementById("grid");\ndeck.forEach(function(emoji, i) {\n  var card = document.createElement("div");\n  card.className = "card";\n  card.dataset.index = i;\n  card.dataset.emoji = emoji;\n  card.innerHTML = \'<div class="back">?</div>\'\n    + \'<div class="front">\' + emoji + \'</div>\';\n  grid.appendChild(card);\n});',
      checks: ['createelement', 'appendchild', 'innerhtml'],
      height: 240,
      fills: {
        text: 'New elements are built with document.___(). Each card is placed on the board with grid.___().',
        answers: ['createElement', 'appendChild']
      },
      quiz: {
        question: 'Why do we use <code>deck.forEach()</code> instead of writing 16 card divs by hand?',
        options: [
          'Browsers cannot display hand-written HTML',
          'Loops let you build any number of cards from data - change the array and the board updates automatically',
          'forEach is faster than HTML'
        ],
        correct: 1
      }
    },
    {
      num: 2,
      title: 'Fisher-Yates Shuffle',
      goal: 'Shuffle the deck so every game is different.',
      points: [
        'Fisher-Yates walks backward through the array, swapping each element with a random earlier one',
        '<code>Math.floor(Math.random() * (i + 1))</code> picks the random index',
        'This gives a perfectly fair shuffle - every arrangement is equally likely'
      ],
      challenge: 'Write the shuffle function that randomises the deck:',
      starter: '// Fisher-Yates shuffle\nfunction shuffle(arr) {\n  for (var i = arr.length - 1; i > 0; i--) {\n    // Pick a random index from 0 to i\n    var j = Math.floor(Math.random() * (i + 1));\n    // Swap arr[i] and arr[j]\n    var temp = arr[i];\n    arr[i] = arr[j];\n    arr[j] = temp;\n  }\n  return arr;\n}\n\n// Shuffle the deck before building cards\nvar deck = emojis.concat(emojis);\nshuffle(deck);',
      solution: 'function shuffle(arr) {\n  for (var i = arr.length - 1; i > 0; i--) {\n    var j = Math.floor(Math.random() * (i + 1));\n    var temp = arr[i];\n    arr[i] = arr[j];\n    arr[j] = temp;\n  }\n  return arr;\n}\nvar deck = emojis.concat(emojis);\nshuffle(deck);',
      checks: ['math.random', 'math.floor', 'length'],
      height: 260,
      fills: {
        text: 'The random index is chosen with Math.___(Math.___() * (i + 1)). The loop walks ___ through the array.',
        answers: ['floor', 'random', 'backward']
      },
      quiz: {
        question: 'What happens if you just use <code>array.sort(() => Math.random() - 0.5)</code> instead?',
        options: [
          'It works perfectly fine',
          'The shuffle is biased - some arrangements appear more often than others, making the game unfair',
          'It reverses the array'
        ],
        correct: 1
      }
    },
    {
      num: 3,
      title: 'CSS Flip Animation',
      goal: 'Click a card to flip it with a smooth 3D rotation.',
      points: [
        'Each card has a <code>.back</code> (question mark) and <code>.front</code> (emoji) face',
        'Adding the class <code>.flipped</code> triggers <code>transform: rotateY(180deg)</code>',
        '<code>backface-visibility: hidden</code> ensures only one face shows at a time'
      ],
      challenge: 'Write the click handler that flips a card:',
      starter: '// When a card is clicked, flip it\ncard.classList.add("flipped");',
      solution: 'card.classList.add("flipped");',
      checks: ['classlist', 'flipped', 'add'],
      height: 80,
      fills: {
        text: 'The flip is triggered by adding the ___ class. CSS ___: rotateY(180deg) does the 3D rotation.',
        answers: ['flipped', 'transform']
      },
      quiz: {
        question: 'What does <code>backface-visibility: hidden</code> do?',
        options: [
          'It makes the card invisible',
          'It hides the reverse side of an element during a 3D transform - so you see only one face at a time',
          'It removes the card from the page'
        ],
        correct: 1
      }
    },
    {
      num: 4,
      title: 'Match Logic',
      goal: 'If two flipped cards match, keep them face up. Otherwise flip them back after a delay.',
      points: [
        'Compare <code>a.dataset.emoji === b.dataset.emoji</code> to check for a match',
        'Matched cards get the <code>.matched</code> class and stay revealed',
        '<code>setTimeout</code> adds a short delay before flipping non-matches back'
      ],
      challenge: 'Write the matching check for two flipped cards:',
      starter: '// a and b are the two flipped cards\nif (a.dataset.emoji === b.dataset.emoji) {\n  // They match - mark them\n  a.classList.add("matched");\n  b.classList.add("matched");\n  matchedPairs++;\n  updatePairs();\n  flippedCards = [];\n  locked = false;\n  checkWin();\n} else {\n  // No match - flip back after a delay\n  setTimeout(function() {\n    a.classList.remove("flipped");\n    b.classList.remove("flipped");\n    flippedCards = [];\n    locked = false;\n  }, 800);\n}',
      solution: 'if (a.dataset.emoji === b.dataset.emoji) {\n  a.classList.add("matched");\n  b.classList.add("matched");\n  matchedPairs++;\n  updatePairs();\n  flippedCards = [];\n  locked = false;\n  checkWin();\n} else {\n  setTimeout(function() {\n    a.classList.remove("flipped");\n    b.classList.remove("flipped");\n    flippedCards = [];\n    locked = false;\n  }, 800);\n}',
      checks: ['settimeout', 'matched', 'classlist'],
      height: 280,
      fills: {
        text: 'Matched cards keep the ___ class. Non-matches flip back after a delay using ___.',
        answers: ['matched', 'setTimeout']
      },
      quiz: {
        question: 'Why do we set <code>locked = true</code> while checking two cards?',
        options: [
          'To speed up the game',
          'To prevent clicking a third card while the match check and flip-back animation are in progress',
          'To lock the browser'
        ],
        correct: 1
      }
    },
    {
      num: 5,
      title: 'Moves & Timer',
      goal: 'Count moves, run a timer, and detect when all pairs are found.',
      points: [
        'Increment <code>moves</code> each time two cards are compared',
        '<code>setInterval</code> ticks the timer up every second once the first card is clicked',
        'When <code>matchedPairs === totalPairs</code>, the game is won - stop the timer and show a message'
      ],
      challenge: 'Write the moves counter, timer, and pair tracker:',
      starter: '// Track moves and time\nvar moves = 0;\nvar timerStarted = false;\nvar timerVal = 0;\nvar timerInterval = null;\n\nfunction startTimer() {\n  if (!timerStarted) {\n    timerStarted = true;\n    timerInterval = setInterval(function() {\n      timerVal++;\n      document.getElementById("timer").textContent = timerVal;\n    }, 1000);\n  }\n}\n\nfunction updateMoves() {\n  moves++;\n  document.getElementById("moveCount").textContent = moves;\n}\n\nfunction updatePairs() {\n  document.getElementById("pairCount").textContent = matchedPairs;\n}',
      solution: 'var moves = 0;\nvar timerStarted = false;\nvar timerVal = 0;\nvar timerInterval = null;\n\nfunction startTimer() {\n  if (!timerStarted) {\n    timerStarted = true;\n    timerInterval = setInterval(function() {\n      timerVal++;\n      document.getElementById("timer").textContent = timerVal;\n    }, 1000);\n  }\n}\n\nfunction updateMoves() {\n  moves++;\n  document.getElementById("moveCount").textContent = moves;\n}\n\nfunction updatePairs() {\n  document.getElementById("pairCount").textContent = matchedPairs;\n}',
      checks: ['moves', 'timer', 'pairs'],
      height: 340,
      fills: {
        text: 'The timer ticks using ___. The game is won when ___ equals totalPairs.',
        answers: ['setInterval', 'matchedPairs']
      },
      quiz: {
        question: 'Why start the timer on the first click rather than on page load?',
        options: [
          'Timers cannot start on page load',
          'Starting on first click is fairer - the player is not penalised for reading the board before they begin',
          'It saves battery'
        ],
        correct: 1
      }
    },
    {
      num: 6,
      title: 'Best Score & Difficulty',
      goal: 'Save your best score to localStorage and add an option for a harder board.',
      points: [
        '<code>localStorage.setItem("memoryBest", moves)</code> saves across sessions',
        'Compare the current score against the saved best and update if lower',
        'For a 6x6 board, just add more emoji pairs and change the CSS grid columns'
      ],
      challenge: 'Write the best-score save and display logic:',
      starter: '// Save and display best score\nvar bestKey = "memoryBest";\nvar prevBest = localStorage.getItem(bestKey);\n\nif (!prevBest || moves < Number(prevBest)) {\n  localStorage.setItem(bestKey, moves);\n  document.getElementById("bestMsg").textContent =\n    "New best score!";\n} else {\n  document.getElementById("bestMsg").textContent =\n    "Best: " + prevBest + " moves";\n}',
      solution: 'var bestKey = "memoryBest";\nvar prevBest = localStorage.getItem(bestKey);\nif (!prevBest || moves < Number(prevBest)) {\n  localStorage.setItem(bestKey, moves);\n  document.getElementById("bestMsg").textContent = "New best score!";\n} else {\n  document.getElementById("bestMsg").textContent = "Best: " + prevBest + " moves";\n}',
      checks: ['localstorage', 'best', 'setitem'],
      height: 200,
      fills: {
        text: 'Scores persist across sessions with ___. A lower move count means a ___ score.',
        answers: ['localStorage', 'better']
      },
      quiz: {
        question: '<code>localStorage</code> survives closing the browser. Which feature of THIS website uses the same trick?',
        options: [
          'The fonts on each page',
          'Your XP, streaks and workshop progress on My Progress',
          'The navigation bar'
        ],
        correct: 1
      }
    }
  ]
};
