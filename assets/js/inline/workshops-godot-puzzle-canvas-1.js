'use strict';

var CSS_GAME = '<style>body{display:flex;flex-direction:column;align-items:center;background:#0f172a;margin:0;overflow:hidden;padding-top:4px}canvas{display:block;cursor:pointer}</style>';
var CANVAS_TAG = '<canvas id="game" width="400" height="450"></canvas>';
var SETUP = 'const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");';

var GRID_VARS = 'const COLS=4,ROWS=4,CELL=80,OFFSET_X=40,OFFSET_Y=60;' +
  'let board=[],flipped=[],matched=[],firstPick=-1,secondPick=-1,lockBoard=false,moves=0,gameWon=false;';
var EMOJI_LIST = '["🚀","🌟","🤖","👾","💎","🍟","🐦","🌍"]';
var INIT_BOARD = 'function initBoard(){var pairs=' + EMOJI_LIST + ';var cards=pairs.concat(pairs);' +
  'for(var i=cards.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=cards[i];cards[i]=cards[j];cards[j]=t}' +
  'board=cards;flipped=new Array(16).fill(false);matched=new Array(16).fill(false);firstPick=-1;secondPick=-1;lockBoard=false;moves=0;gameWon=false}' +
  'initBoard();';

var DRAW_GRID = 'function drawGrid(){ctx.fillStyle="#0f172a";ctx.fillRect(0,0,400,450);' +
  'for(var i=0;i<16;i++){var col=i%COLS,row=Math.floor(i/COLS);var x=OFFSET_X+col*CELL,y=OFFSET_Y+row*CELL;' +
  'if(matched[i]){ctx.fillStyle="#1e3a5f";ctx.fillRect(x+2,y+2,CELL-4,CELL-4)}' +
  'else if(flipped[i]){ctx.fillStyle="#1e293b";ctx.fillRect(x+2,y+2,CELL-4,CELL-4);ctx.font="36px serif";ctx.textAlign="center";ctx.fillText(board[i],x+CELL/2,y+CELL/2+12)}' +
  'else{ctx.fillStyle="#334155";ctx.fillRect(x+2,y+2,CELL-4,CELL-4);ctx.fillStyle="#475569";ctx.fillRect(x+4,y+4,CELL-8,CELL-8)}' +
  '}' +
  'ctx.fillStyle="#94a3b8";ctx.font="14px monospace";ctx.textAlign="left";ctx.fillText("Moves: "+moves,10,30);' +
  'if(gameWon){ctx.fillStyle="rgba(34,197,94,0.25)";ctx.fillRect(0,0,400,450);ctx.fillStyle="#fff";ctx.font="bold 28px monospace";ctx.textAlign="center";ctx.fillText("🎉 You Win!",200,220);ctx.font="16px monospace";ctx.fillText("Moves: "+moves,200,254);ctx.fillText("Click to restart",200,278)}' +
  '}';

var CLICK_HANDLER = 'canvas.addEventListener("click",function(e){' +
  'if(gameWon){initBoard();return}' +
  'if(lockBoard)return;' +
  'var rect=canvas.getBoundingClientRect();var mx=e.clientX-rect.left,my=e.clientY-rect.top;' +
  'var col=Math.floor((mx-OFFSET_X)/CELL),row=Math.floor((my-OFFSET_Y)/CELL);' +
  'if(col<0||col>=COLS||row<0||row>=ROWS)return;' +
  'var idx=row*COLS+col;' +
  'if(matched[idx]||flipped[idx])return;' +
  'flipped[idx]=true;' +
  'if(firstPick===-1){firstPick=idx}' +
  'else{secondPick=idx;moves++;lockBoard=true;' +
  'if(board[firstPick]===board[secondPick]){matched[firstPick]=matched[secondPick]=true;firstPick=-1;secondPick=-1;lockBoard=false;if(matched.every(function(m){return m}))gameWon=true}' +
  'else{var f1=firstPick,f2=secondPick;firstPick=-1;secondPick=-1;setTimeout(function(){flipped[f1]=flipped[f2]=false;lockBoard=false},1000)}' +
  '}});';

function wbWrap(blobSrc) {
  return cwBlobWrap(CSS_GAME, CANVAS_TAG, SETUP + GRID_VARS + EMOJI_LIST + ';' + INIT_BOARD + DRAW_GRID + CLICK_HANDLER, blobSrc, 'function loop(){drawGrid();requestAnimationFrame(loop)}requestAnimationFrame(loop);');
}

window.CW_CONFIG = {
  storageKey: 'jvds-godot-puzzle-canvas',
  downloadName: 'my-godot-puzzle.html',
  nextStep: { url: '/workshops/godot-gatekeeper-3d-part1-canvas.html', label: 'Gatekeeper Stealth' },

  hints: [
    '16 face-down cards arranged in a 4x4 grid',
    'Click a card to flip it and reveal the emoji',
    'Click a second card - if they match, both stay face-up',
    'If they do not match, both flip back after 1 second',
    'Match all 8 pairs to win; your move count is tracked',
    'Click the win screen to restart with a fresh shuffle',
    'Your mod card - design your own puzzle variant to build at home in Godot'
  ],

  templates: {
    1: function() {
      return cwBlobWrap(CSS_GAME, CANVAS_TAG,
        SETUP + GRID_VARS + 'var board=' + EMOJI_LIST + ';' +
        'var pairs=board.concat(board);for(var i=pairs.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=pairs[i];pairs[i]=pairs[j];pairs[j]=t}board=pairs;' +
        'var flipped=new Array(16).fill(false);var matched=new Array(16).fill(false);',
        '',
        DRAW_GRID + CLICK_HANDLER + 'function loop(){drawGrid();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    2: function(u) {
      return cwBlobWrap(CSS_GAME, CANVAS_TAG,
        SETUP + GRID_VARS + EMOJI_LIST + ';' + INIT_BOARD + DRAW_GRID,
        'window.cwStep=function(){' + u + '};',
        CLICK_HANDLER + 'function loop(){if(typeof cwStep==="function")cwStep();drawGrid();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    3: function(u) {
      return cwBlobWrap(CSS_GAME, CANVAS_TAG,
        SETUP + GRID_VARS + EMOJI_LIST + ';' + INIT_BOARD + DRAW_GRID,
        'window.cwStep=function(){' + u + '};',
        CLICK_HANDLER + 'function loop(){if(typeof cwStep==="function")cwStep();drawGrid();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    4: function(u) {
      return cwBlobWrap(CSS_GAME, CANVAS_TAG,
        SETUP + GRID_VARS + EMOJI_LIST + ';' + INIT_BOARD + DRAW_GRID,
        'window.cwStep=function(){' + u + '};',
        CLICK_HANDLER + 'function loop(){if(typeof cwStep==="function")cwStep();drawGrid();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    5: function(u) {
      return cwBlobWrap(CSS_GAME, CANVAS_TAG,
        SETUP + GRID_VARS + EMOJI_LIST + ';' + INIT_BOARD + DRAW_GRID,
        'window.cwStep=function(){' + u + '};',
        CLICK_HANDLER + 'function loop(){if(typeof cwStep==="function")cwStep();drawGrid();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    6: function(u) {
      return cwBlobWrap(CSS_GAME, CANVAS_TAG,
        SETUP + GRID_VARS + EMOJI_LIST + ';' + INIT_BOARD + DRAW_GRID,
        'window.cwStep=function(){' + u + '};',
        CLICK_HANDLER + 'function loop(){if(typeof cwStep==="function")cwStep();drawGrid();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    7: function(u) {
      var lines = u.split('\n');
      var fields = {};
      lines.forEach(function(l) {
        var m = l.match(/^([^:]+):\s*(.*)$/);
        if (m && m[2].trim()) fields[m[1].trim()] = m[2].trim();
      });
      var html = '<style>body{font-family:monospace;background:#0f172a;color:#e2e8f0;padding:16px;margin:0}' +
        'h2{color:#a78bfa;margin:0 0 12px}' +
        '.card{background:#1e293b;border:2px solid #334155;border-radius:10px;padding:16px}' +
        '.row{display:flex;gap:8px;margin:6px 0;align-items:baseline}' +
        '.lbl{color:#94a3b8;min-width:160px;font-size:.85rem}' +
        '.val{color:#f1f5f9;font-weight:bold}' +
        '.tip{margin-top:14px;padding:10px;background:#0f172a;border-left:3px solid #a78bfa;font-size:.82rem;color:#94a3b8}' +
        '</style>' +
        '<div class="card"><h2>🏠 My Puzzle Mod Card</h2>';
      var order = ['Game name','Card theme','Grid size','Pairs to match','Card back colour','Background colour','One thing to add at home'];
      order.forEach(function(k) {
        if (fields[k]) html += '<div class="row"><span class="lbl">' + k + '</span><span class="val">' + fields[k] + '</span></div>';
      });
      html += '<div class="tip">💡 At home: open Godot, create a GridContainer node and add 16 Button children. Use a script to shuffle an array of image pairs and assign them to buttons. Connect each button\'s pressed signal to your flip logic!</div></div>';
      var blob = 'document.body.innerHTML=' + JSON.stringify(html) + ';';
      return cwBlobWrap('<style>body{margin:0;background:#0f172a}</style>', '<div></div>', '', blob, '');
    }
  },

  steps: [
    {
      num: 1,
      title: 'The Grid',
      activity: '🎴 Grid',
      goal: 'Draw a 4x4 grid of face-down cards.',
      checkpoint: 'You should see 16 blue-grey squares arranged in four rows and four columns.',
      points: [
        '4 columns, 4 rows = 16 cards total (8 matching pairs)',
        'Each card is 80x80 pixels with a small gap',
        'Cards start face-down showing a plain blue-grey back',
        'In Godot you would use a GridContainer node with 4 columns'
      ],
      challenge: '🤖 Set up the grid dimensions:',
      starter: '# Grid dimensions\nvar cols = 4\nvar rows = ___\nvar cell_size = ___\nvar total_cards = cols * rows',
      solution: '# Grid dimensions\nvar cols = 4\nvar rows = 4\nvar cell_size = 80\nvar total_cards = cols * rows',
      checks: ['rows = 4', 'cell_size = 80'],
      height: 120,
      fills: {
        text: 'A 4x4 grid has ___ cards total. With 8 pairs that means ___ unique images.',
        answers: ['16', '8']
      },
      quiz: {
        question: 'Why use a power-of-2 grid size (4x4) for a memory game?',
        options: [
          'Powers of 2 are required by canvas',
          'An even total ensures every card has exactly one matching partner - an odd number would leave one card with no match',
          '4x4 is the only size that fits on screen'
        ],
        correct: 1
      }
    },
    {
      num: 2,
      title: 'Clicking to Flip',
      activity: '🖥️ Click',
      goal: 'Click a card to flip it and show the emoji.',
      checkpoint: 'Click any grey square - it should flip over to reveal an emoji symbol.',
      points: [
        'Convert mouse position to grid column and row using integer division',
        'Calculate card index: row * cols + col',
        'Set flipped[index] = true to reveal the card',
        'Already-flipped and matched cards should not respond to clicks'
      ],
      challenge: '🤖 Convert click position to card index:',
      starter: '# Convert mouse x,y to grid index\nvar col = floor((mouse_x - offset_x) / cell_size)\nvar row = floor((mouse_y - offset_y) / ___)\nvar index = row * cols + ___',
      solution: '# Convert mouse x,y to grid index\nvar col = floor((mouse_x - offset_x) / cell_size)\nvar row = floor((mouse_y - offset_y) / cell_size)\nvar index = row * cols + col',
      checks: ['cell_size', 'col', 'row'],
      height: 130,
      fills: {
        text: 'The card index formula is row * ___ + col. This converts 2D grid position to a ___ array index.',
        answers: ['cols', '1D']
      },
      quiz: {
        question: 'Why convert 2D grid position to a 1D array index?',
        options: [
          'Canvas only works with 1D arrays',
          'A 1D array is simpler to shuffle, compare and iterate - a 2D array would require nested loops everywhere',
          '2D arrays use more memory'
        ],
        correct: 1
      }
    },
    {
      num: 3,
      title: 'Checking for Matches',
      activity: '✅ Match',
      goal: 'After flipping two cards, check if they match.',
      checkpoint: 'Flip two cards with the same emoji - they should stay face-up highlighted in blue. Different emoji should flip back.',
      points: [
        'Track firstPick and secondPick indices',
        'When secondPick is set: compare board[firstPick] === board[secondPick]',
        'Match: set matched[firstPick] = matched[secondPick] = true',
        'No match: wait 1 second then set flipped[firstPick] = flipped[secondPick] = false'
      ],
      challenge: '🤖 Write the match check:',
      starter: '# After selecting two cards\nif first_pick != -1 and second_pick != -1:\n    if board[first_pick] == board[___]:\n        matched[first_pick] = true\n        matched[___] = true\n    else:\n        # Flip both back after a delay\n        flipped[first_pick] = ___\n        flipped[second_pick] = false',
      solution: '# After selecting two cards\nif first_pick != -1 and second_pick != -1:\n    if board[first_pick] == board[second_pick]:\n        matched[first_pick] = true\n        matched[second_pick] = true\n    else:\n        # Flip both back after a delay\n        flipped[first_pick] = false\n        flipped[second_pick] = false',
      checks: ['second_pick', 'matched', 'false'],
      height: 180,
      fills: {
        text: 'Cards match when board[firstPick] ___ board[secondPick]. Non-matching cards flip back after a ___ second delay.',
        answers: ['===', '1']
      },
      quiz: {
        question: 'Why add a delay before flipping non-matching cards back?',
        options: [
          'The animation requires it',
          'Without a delay both cards would flip instantly and the player could not see what was on the second card - the brief reveal is a core memory game mechanic',
          'setTimeout is required by GDScript'
        ],
        correct: 1
      }
    },
    {
      num: 4,
      title: 'Move Counter',
      activity: '🔢 Counter',
      goal: 'Count the number of pairs attempted and display it.',
      checkpoint: 'Flip two cards - the move count at the top should increase by 1 each time you select a second card.',
      points: [
        'Increment moves each time secondPick is set (one move = one pair attempt)',
        'Display moves in the HUD at the top of the canvas',
        'A lower move count means a better performance - this is the score',
        'In Godot you would update a Label node text to show the move count'
      ],
      challenge: '🤖 Increment and display move count:',
      starter: '# Increment when second card is selected\nif second_pick != -1:\n    moves += ___\n\n# Display in HUD\nctx.fillText("Moves: " + ___, 10, 30)',
      solution: '# Increment when second card is selected\nif second_pick != -1:\n    moves += 1\n\n# Display in HUD\nctx.fillText("Moves: " + moves, 10, 30)',
      checks: ['1', 'moves'],
      height: 120,
      fills: {
        text: 'Moves increment by ___ per pair attempt. Lower moves = ___ performance.',
        answers: ['1', 'better']
      },
      quiz: {
        question: 'Why count pair attempts rather than individual card flips?',
        options: [
          'It is easier to code',
          'Counting attempts reflects decision quality - each attempt should be a deliberate choice, and counting individual flips would reward clicking fast',
          'Canvas cannot count individual clicks'
        ],
        correct: 1
      }
    },
    {
      num: 5,
      title: 'Win Screen',
      activity: '🏆 Win screen',
      goal: 'Show a win screen when all 8 pairs are matched.',
      checkpoint: 'Match all 16 cards - a green overlay should appear with your final move count.',
      points: [
        'Check matched.every(m => m) after each successful match',
        'Show a green overlay with congratulations message and final move count',
        'In Godot you would show a Control node or CanvasLayer on top of the game',
        'The win condition makes the game finite - without it the game would just end silently'
      ],
      challenge: '🤖 Write the win check:',
      starter: '# Check if all cards are matched\nif matched.every(function(m) { return ___ }):\n    game_won = ___',
      solution: '# Check if all cards are matched\nif matched.every(function(m) { return m }):\n    game_won = true',
      checks: ['true', 'game_won'],
      height: 100,
      fills: {
        text: 'The win condition checks that ___ cards are matched. The win screen shows the ___ count.',
        answers: ['all', 'moves']
      },
      quiz: {
        question: 'What is the minimum possible move count for a 4x4 memory game?',
        options: [
          '4 moves',
          '8 moves - you need at least one attempt per pair, and if you remember every first flip you can match each on the second card',
          '16 moves'
        ],
        correct: 1
      }
    },
    {
      num: 6,
      title: 'Shuffle & Restart',
      activity: '🔀 Shuffle',
      goal: 'Clicking the win screen shuffles the cards and starts a new game.',
      checkpoint: 'Win a game, then click the screen - the cards should reset and be in a different order.',
      points: [
        'Fisher-Yates shuffle: loop backward, swap each element with a random earlier one',
        'Reset flipped, matched, firstPick, secondPick, moves and gameWon',
        'A new shuffle means each playthrough is unique',
        'In Godot you would use an Array.shuffle() method (built in to GDScript)'
      ],
      challenge: '🤖 Write the Fisher-Yates shuffle:',
      starter: '# Shuffle the cards array\nfor i in range(cards.length - 1, 0, -1):\n    var j = randi() % ___\n    var temp = cards[i]\n    cards[i] = cards[___]\n    cards[j] = temp',
      solution: '# Shuffle the cards array\nfor i in range(cards.length - 1, 0, -1):\n    var j = randi() % (i + 1)\n    var temp = cards[i]\n    cards[i] = cards[j]\n    cards[j] = temp',
      checks: ['i + 1', 'cards[j]', 'temp'],
      height: 160,
      fills: {
        text: 'The Fisher-Yates shuffle runs ___ to 1. Each element is swapped with a random element at index ___ or lower.',
        answers: ['backward', 'i']
      },
      quiz: {
        question: 'Why use Fisher-Yates instead of cards.sort(() => Math.random() - 0.5)?',
        options: [
          'Fisher-Yates is shorter code',
          'The sort trick produces biased shuffles - Fisher-Yates guarantees every permutation is equally likely, giving fair replayability',
          'sort() does not work on arrays'
        ],
        correct: 1
      }
    },
    {
      num: 7,
      title: 'Take It Home',
      activity: '🏠 Mod card',
      goal: 'Fill in your Mod Card. At home, open Godot and build your own memory game.',
      checkpoint: 'Fill in as many fields as you like, then hit Apply to see your card.',
      points: [
        'At home: open Godot and create a new 2D project with a GridContainer node',
        'Set the GridContainer columns property to 4 (or your chosen grid width)',
        'Add 16 Button children and assign your card images via texture property',
        'Write a script with a shuffle() function and connect button pressed signals to your flip logic'
      ],
      challenge: '✏️ Fill in your Mod Card:',
      starter: '# My Puzzle Mod Card\nGame name: ___\nCard theme: ___\nGrid size: ___\nPairs to match: ___\nCard back colour: ___\nBackground colour: ___\nOne thing to add at home: ___',
      solution: '# My Puzzle Mod Card\nGame name: Space Memory\nCard theme: planets\nGrid size: 4x4\nPairs to match: 8\nCard back colour: dark blue\nBackground colour: black\nOne thing to add at home: timer that counts down 60 seconds',
      checks: [],
      height: 180,
      fills: {
        text: 'My card theme is ___ and at home I will add a ___.',
        answers: ['planets', 'timer']
      }
    }
  ]
};
