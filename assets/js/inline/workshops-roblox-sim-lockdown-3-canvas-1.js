'use strict';

/* ===================================================
   SIM LOCKDOWN Ep 3: Gauntlet + Final Arena canvas
   A top-down final-arena simulation. Each template runs
   standalone with its step solution plugged in as u.
   =================================================== */

function wrap(css, html, code) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8">' + css +
    '</head><body>' + html + '<script>' + code + '</script></body></html>';
}

var CSS_SIM3 = '<style>body{display:flex;flex-direction:column;align-items:center;background:#160f24;padding:8px;margin:0;font-family:system-ui,sans-serif;color:#e8eaf2;gap:6px;overflow:hidden}canvas{background:#0d0a18;border:2px solid #2c2140;border-radius:8px;touch-action:none;max-width:100%}.row{display:flex;gap:12px;align-items:center;font-size:.8rem;flex-wrap:wrap;justify-content:center}#msg{font-weight:800;color:#ffd166;min-height:20px}#rankList{font-size:.72rem;opacity:.85;min-height:20px}</style>';

var HTML_SIM3 = '<div class="row"><span>Round <b id="roundNum">1</b></span><span>Tiles: <b id="tileCount">0</b></span><span>In game: <b id="leftCount">4</b></span></div><canvas id="game" width="600" height="400"></canvas><div class="row" id="msg">The final is coming</div><div class="row" id="rankList"></div>';

var SETUP_SIM3 = [
  'var canvas=document.getElementById("game"),ctx=canvas.getContext("2d");',
  'var W=600,H=400;',
  'var players=[],tiles=[],msg="The final is coming";',
  'function placePlayers(){players=[',
  '{name:"Ava",x:220,y:160,vx:0,vy:0,tool:null,glow:false,progress:0,out:false},',
  '{name:"Leo",x:380,y:160,vx:0,vy:0,tool:null,glow:false,progress:0,out:false},',
  '{name:"Mia",x:220,y:260,vx:0,vy:0,tool:null,glow:false,progress:0,out:false},',
  '{name:"Raj",x:380,y:260,vx:0,vy:0,tool:null,glow:false,progress:0,out:false}];}',
  'function driftPlayers(){for(var i=0;i<players.length;i++){var p=players[i];if(p.out)continue;',
  'p.vx+=(Math.random()-0.5)*0.4;p.vy+=(Math.random()-0.5)*0.4;p.vx*=0.96;p.vy*=0.96;',
  'p.x+=p.vx;p.y+=p.vy;',
  'if(p.x<120){p.x=120;p.vx=0}if(p.x>480){p.x=480;p.vx=0}',
  'if(p.y<60){p.y=60;p.vy=0}if(p.y>340){p.y=340;p.vy=0}}}',
  'var RING_COLORS=["#ffd166","#f5a623","#f56565","#9b2c2c"];',
  'function drawArena(){',
  'ctx.fillStyle="#0d0a18";ctx.fillRect(0,0,W,H);',
  'var i,t;',
  'for(i=0;i<tiles.length;i++){t=tiles[i];',
  'var px=300+t.gx*44,py=200+t.gz*44;',
  'ctx.fillStyle=RING_COLORS[t.ring%RING_COLORS.length];',
  'ctx.fillRect(px-20,py-20,40,40);',
  'ctx.fillStyle="rgba(0,0,0,.45)";ctx.font="bold 10px system-ui";ctx.textAlign="center";',
  'ctx.fillText("R"+t.ring,px,py+4);}',
  'for(i=0;i<players.length;i++){var p=players[i];if(p.out)continue;',
  'if(p.glow){ctx.save();ctx.shadowColor="#ffd166";ctx.shadowBlur=14;',
  'ctx.strokeStyle="#ffd166";ctx.lineWidth=2;',
  'ctx.beginPath();ctx.arc(p.x,p.y,11,0,Math.PI*2);ctx.stroke();ctx.restore();}',
  'ctx.fillStyle="#7bf1a8";ctx.beginPath();ctx.arc(p.x,p.y,7,0,Math.PI*2);ctx.fill();',
  'ctx.fillStyle="#e8eaf2";ctx.font="bold 9px system-ui";ctx.textAlign="center";',
  'ctx.fillText(p.name,p.x,p.y-14);}',
  'if(msg){ctx.fillStyle="rgba(0,0,0,.55)";ctx.fillRect(0,8,W,30);',
  'ctx.fillStyle="#ffd166";ctx.font="bold 15px system-ui";ctx.textAlign="center";',
  'ctx.fillText(msg,W/2,29);}',
  'document.getElementById("msg").textContent=msg;',
  'document.getElementById("tileCount").textContent=tiles.length;',
  'var left=players.filter(function(p){return!p.out}).length;',
  'document.getElementById("leftCount").textContent=left;',
  'var order=players.slice().sort(function(a,b){return b.progress-a.progress});',
  'document.getElementById("rankList").textContent=order.map(function(p,i){return((i+1)+". "+p.name+(p.out?" (out)":""));}).join("  ");}'
].join('');

var COMPLETE_GAUNTLET = [
  'function giveGauntlet(players){for(var i=0;i<players.length;i++){',
  'players[i].tool="Glitch Gauntlet";players[i].glow=true;}return players.length;}'
].join('');

var COMPLETE_SHOVE = [
  'function shove(player,others){var hits=0;',
  'for(var i=0;i<others.length;i++){var o=others[i];if(o===player||o.out)continue;',
  'var dx=o.x-player.x,dy=o.y-player.y;',
  'if(dx>0&&dx<120&&Math.abs(dy)<40){o.vx+=8;o.vy+=(Math.random()*4-2);hits++;}}',
  'return hits;}'
].join('');

var COMPLETE_RANK = [
  'function rankPlayers(players){',
  'var ranked=players.slice().sort(function(a,b){return b.progress-a.progress});',
  'var out=ranked[ranked.length-1];out.out=true;return{ranked:ranked,out:out};}'
].join('');

var COMPLETE_ARENA = [
  'function buildArena(rings){var tiles=[];',
  'for(var gx=-rings+1;gx<rings;gx++){for(var gz=-rings+1;gz<rings;gz++){',
  'var ring=Math.max(Math.abs(gx),Math.abs(gz));tiles.push({gx:gx,gz:gz,ring:ring});}}',
  'return tiles;}'
].join('');

var COMPLETE_SHRINK = [
  'function shrinkArena(tiles){var max=0,i;',
  'for(i=0;i<tiles.length;i++){if(tiles[i].ring>max)max=tiles[i].ring;}',
  'var left=[];',
  'for(var k=0;k<tiles.length;k++){if(tiles[k].ring<max)left.push(tiles[k]);}',
  'return left;}'
].join('');

/* ===================================================
   CW_CONFIG - Sim Lockdown Ep 3 canvas steps + templates
   =================================================== */

window.CW_CONFIG = {
  storageKey: 'jvds-sim-lockdown-3-canvas',
  downloadName: 'my-sim-final-arena.html',

  hints: [
    'Hand every player the Glitch Gauntlet and light it up',
    'Launch whoever stands in front of you, cone check first',
    'Order by progress, cut the last player to spectate',
    'Lay a tile grid where every tile knows its ring number',
    'Delete the whole outer ring, keep everything inside',
    'Find the last player standing and crown them champion'
  ],

  templates: {
    1: function(u) {
      return wrap(CSS_SIM3, HTML_SIM3,
        SETUP_SIM3 + 'placePlayers();' +
        'try{' + u + '}catch(e){}' +
        'if(typeof giveGauntlet==="function")giveGauntlet(players);' +
        'function loop(){driftPlayers();drawArena();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    2: function(u) {
      return wrap(CSS_SIM3, HTML_SIM3,
        SETUP_SIM3 + 'placePlayers();' + COMPLETE_GAUNTLET + 'giveGauntlet(players);' +
        'try{' + u + '}catch(e){}' +
        'var lastShove=0;' +
        'function loop(){driftPlayers();if(Date.now()-lastShove>2000){lastShove=Date.now();if(typeof shove==="function")shove(players[0],players);}drawArena();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    3: function(u) {
      return wrap(CSS_SIM3, HTML_SIM3,
        SETUP_SIM3 + 'placePlayers();' + COMPLETE_GAUNTLET + 'giveGauntlet(players);' + COMPLETE_SHOVE +
        'try{' + u + '}catch(e){}' +
        'var lastRank=0,lastTick=0;' +
        'function loop(){driftPlayers();var now=Date.now();if(now-lastTick>1000){lastTick=now;for(var i=0;i<players.length;i++){if(!players[i].out)players[i].progress++;}}if(now-lastRank>4000){lastRank=now;if(typeof rankPlayers==="function")rankPlayers(players);}drawArena();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    4: function(u) {
      return wrap(CSS_SIM3, HTML_SIM3,
        SETUP_SIM3 + 'placePlayers();' + COMPLETE_GAUNTLET + 'giveGauntlet(players);' + COMPLETE_SHOVE + COMPLETE_RANK +
        'try{' + u + '}catch(e){}' +
        'if(typeof buildArena==="function")tiles=buildArena(3);' +
        'function loop(){driftPlayers();drawArena();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    5: function(u) {
      return wrap(CSS_SIM3, HTML_SIM3,
        SETUP_SIM3 + 'placePlayers();' + COMPLETE_GAUNTLET + 'giveGauntlet(players);' + COMPLETE_SHOVE + COMPLETE_RANK + COMPLETE_ARENA +
        'tiles=buildArena(3);' +
        'try{' + u + '}catch(e){}' +
        'var lastShrink=0;' +
        'function loop(){driftPlayers();if(Date.now()-lastShrink>3000){lastShrink=Date.now();if(typeof shrinkArena==="function"&&tiles.length>1)tiles=shrinkArena(tiles);}drawArena();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    6: function(u) {
      return wrap(CSS_SIM3, HTML_SIM3,
        SETUP_SIM3 + 'placePlayers();' + COMPLETE_GAUNTLET + 'giveGauntlet(players);' + COMPLETE_SHOVE + COMPLETE_RANK + COMPLETE_ARENA + COMPLETE_SHRINK +
        'tiles=buildArena(2);players[0].progress=5;players[1].progress=3;players[2].progress=1;' +
        'try{' + u + '}catch(e){}' +
        'if(typeof crownChampion==="function")crownChampion(players);' +
        'function loop(){driftPlayers();drawArena();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    }
  },

  steps: [
    {
      num: 1,
      title: 'Hand Out the Gauntlet',
      goal: 'A tool called the Glitch Gauntlet, given to every player when a round starts.',
      points: [
        'Every player holds the same glowing Tool',
        'The glow ring shows who is armed at a glance',
        'Tools live on the player, so shoves can find them later'
      ],
      challenge: 'Write the handout for all four players:',
      starter: '// Give every player the Glitch Gauntlet\nfunction giveGauntlet(players) {\n  for (var i = 0; i < players.length; i++) {\n    players[i].tool = ???;\n    players[i].glow = ???;\n  }\n  return players.length;\n}',
      solution: 'function giveGauntlet(players) {\n  for (var i = 0; i < players.length; i++) {\n    players[i].tool = "Glitch Gauntlet";\n    players[i].glow = true;\n  }\n  return players.length;\n}',
      checks: ['tool', 'glow', 'players.length'],
      height: 200,
      fills: {
        text: 'The gauntlet is a ___ every player holds, and glow paints the ring.',
        answers: ['Tool']
      },
      quiz: {
        question: 'In Roblox Studio, a Tool with a Part named Handle means:',
        options: [
          'Players see and hold it, and touching works through the Handle',
          'It only works on mobile',
          'It deletes itself after one use'
        ],
        correct: 0
      }
    },
    {
      num: 2,
      title: 'The Shove',
      goal: 'Find nearby players in a cone in front of you and launch them away.',
      points: [
        'Only players in front count: ahead, close, and nearly level',
        'A launch sets horizontal velocity, friction does the rest',
        'Skipped players (self, out) never move'
      ],
      challenge: 'Write the cone check that launches rivals:',
      starter: '// Shove everyone in a cone in front of you\nfunction shove(player, others) {\n  var hits = 0;\n  for (var i = 0; i < others.length; i++) {\n    var o = others[i];\n    if (o === player || o.out) continue;\n    var dx = o.x - player.x, dy = o.y - player.y;\n    if (dx > 0 && dx < 120 && Math.abs(dy) < 40) {\n      o.vx += ???;\n      hits++;\n    }\n  }\n  return hits;\n}',
      solution: 'function shove(player, others) {\n  for (var i = 0, hits = 0; i < others.length; i++) {\n    var o = others[i];\n    if (o === player || o.out) continue;\n    var dx = o.x - player.x, dy = o.y - player.y;\n    if (dx > 0 && dx < 120 && Math.abs(dy) < 40) {\n      o.vx += 8;\n      o.vy += (Math.random() * 4 - 2);\n      hits++;\n    }\n  }\n  return hits;\n}',
      checks: ['math.abs', 'vx', 'hits'],
      height: 280,
      fills: {
        text: 'The cone is ahead, close and nearly ___: that is the fairness of the shove.',
        answers: ['level']
      },
      quiz: {
        question: 'Checking |dy| < 40 (nearly level) stops what unfair move?',
        options: [
          'Shoving players far above or below you through the floor',
          'Shoving yourself',
          'Shoving too many players at once'
        ],
        correct: 0
      }
    },
    {
      num: 3,
      title: 'Rank and Eliminate',
      goal: 'At the end of a round, put the players in order and cut the last one.',
      points: [
        'Sorting by progress puts the fastest first',
        'The last player spectates instead of playing on',
        'The ranked list stays visible so cuts feel fair'
      ],
      challenge: 'Write the ranking that cuts the last player:',
      starter: '// Order fastest first, cut the slowest\nfunction rankPlayers(players) {\n  var ranked = players.slice().sort(function(a, b) {\n    return ???;\n  });\n  var out = ranked[ranked.length - 1];\n  out.out = true;\n  return { ranked: ranked, out: out };\n}',
      solution: 'function rankPlayers(players) {\n  var ranked = players.slice().sort(function(a, b) {\n    return b.progress - a.progress;\n  });\n  var out = ranked[ranked.length - 1];\n  out.out = true;\n  return { ranked: ranked, out: out };\n}',
      checks: ['sort', 'progress', 'out'],
      height: 220,
      fills: {
        text: 'Sorting fastest first means the cut always lands on the ___ runner.',
        answers: ['slowest']
      },
      quiz: {
        question: 'Why sort a copy (slice) instead of the players list itself?',
        options: [
          'Copies sort faster',
          'The live list keeps join order while the ranking is just a view',
          'Roblox forbids sorting'
        ],
        correct: 1
      }
    },
    {
      num: 4,
      title: 'Build the Final Arena',
      goal: 'A circular-looking platform built from square tiles, each tagged with its ring.',
      points: [
        'A grid from -rings+1 to rings-1 in both directions',
        'Each tile tags its ring: the max of |x| and |z|',
        'Ring 0 is the safe heart, the top ring falls first'
      ],
      challenge: 'Write the arena grid with ring tags:',
      starter: '// Tile grid where every tile knows its ring\nfunction buildArena(rings) {\n  var tiles = [];\n  for (var gx = -rings + 1; gx < rings; gx++) {\n    for (var gz = -rings + 1; gz < rings; gz++) {\n      var ring = Math.max(???);\n      tiles.push({ gx: gx, gz: gz, ring: ring });\n    }\n  }\n  return tiles;\n}',
      solution: 'function buildArena(rings) {\n  var tiles = [];\n  for (var gx = -rings + 1; gx < rings; gx++) {\n    for (var gz = -rings + 1; gz < rings; gz++) {\n      var ring = Math.max(Math.abs(gx), Math.abs(gz));\n      tiles.push({ gx: gx, gz: gz, ring: ring });\n    }\n  }\n  return tiles;\n}',
      checks: ['math.max', 'ring', 'tiles.push'],
      height: 240,
      fills: {
        text: 'Ring 0 is the safe ___, the top ring is the first to fall.',
        answers: ['heart']
      },
      quiz: {
        question: 'max(|x|, |z|) as the ring number gives:',
        options: [
          'Square rings that shrink evenly from the outside in',
          'Round tiles',
          'Random rings'
        ],
        correct: 0
      }
    },
    {
      num: 5,
      title: 'The Arena Shrinks',
      goal: 'Delete the outermost ring on a timer and crown the last player standing.',
      points: [
        'Find the top ring number across all tiles',
        'Keep every tile below it, drop the rest',
        'Three rings become two, then one, then a heart'
      ],
      challenge: 'Write the shrink that eats the outer ring:',
      starter: '// Delete the whole outer ring, keep the inside\nfunction shrinkArena(tiles) {\n  var max = 0, i;\n  for (i = 0; i < tiles.length; i++) {\n    if (tiles[i].ring > max) max = tiles[i].ring;\n  }\n  var left = [];\n  for (var k = 0; k < tiles.length; k++) {\n    if (tiles[k].ring < max) left.push(tiles[k]);\n  }\n  return ???;\n}',
      solution: 'function shrinkArena(tiles) {\n  var max = 0, i;\n  for (i = 0; i < tiles.length; i++) {\n    if (tiles[i].ring > max) max = tiles[i].ring;\n  }\n  var left = [];\n  for (var k = 0; k < tiles.length; k++) {\n    if (tiles[k].ring < max) left.push(tiles[k]);\n  }\n  return left;\n}',
      checks: ['tiles.length', 'left.push', 'return left'],
      height: 240,
      fills: {
        text: 'Shrinking keeps tiles ___ max and drops the ring equal to it.',
        answers: ['below']
      },
      quiz: {
        question: 'Why delete by ring instead of random tiles?',
        options: [
          'Random is slower',
          'Rings close in fairly from every side, so no corner is safe',
          'Roblox can only delete rings'
        ],
        correct: 1
      }
    },
    {
      num: 6,
      title: 'Champion and Publish',
      goal: 'Celebrate the winner and put your game online.',
      points: [
        'Scan the players still in the game for top progress',
        'Crown exactly one champion by name',
        'The banner names the winner for the whole lobby'
      ],
      challenge: 'Write the crowning of the champion:',
      starter: '// Find the last player standing and crown them\nfunction crownChampion(players) {\n  var best = null;\n  for (var i = 0; i < players.length; i++) {\n    if (!players[i].out && (!best || players[i].progress > best.progress)) best = players[i];\n  }\n  msg = "CHAMPION: " + ???;\n  return best.name;\n}',
      solution: 'function crownChampion(players) {\n  var best = null;\n  for (var i = 0; i < players.length; i++) {\n    if (!players[i].out && (!best || players[i].progress > best.progress)) best = players[i];\n  }\n  msg = "CHAMPION: " + best.name;\n  return best.name;\n}',
      checks: ['champion', 'best.name', 'progress'],
      height: 200,
      fills: {
        text: 'The crown goes to top progress among players still ___ the game.',
        answers: ['in']
      },
      quiz: {
        question: 'Before publishing for friends, the last check is:',
        options: [
          'Delete the champion',
          'Play once more: join, shove, shrink and crown with no errors',
          'Rename every player'
        ],
        correct: 1
      }
    }
  ]
};
