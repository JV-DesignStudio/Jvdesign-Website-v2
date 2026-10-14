'use strict';

/* ===================================================
   IFRAME BUILDING BLOCKS (Sim Lockdown party-game simulation)
   A top-down arena of beans. The match runs lobby ->
   countdown -> race, following a generated path of nodes.
   Used by the SIM LOCKDOWN build-canvases.
   =================================================== */

var CSS_PARTY = '<style>body{display:flex;flex-direction:column;align-items:center;background:#0b0616;padding:8px;margin:0;font-family:system-ui,sans-serif;color:#ffe6ef;gap:6px;overflow:hidden}canvas{background:#0a0714;border:2px solid #3a1030;border-radius:8px;touch-action:none;max-width:100%}.row{display:flex;gap:14px;align-items:center;font-size:.8rem;flex-wrap:wrap}b{color:#ff3b5c}</style>';

var CANVAS_PARTY = '<div class="row"><span>Phase: <b id="phase">lobby</b></span><span>Round: <b id="round">1</b></span><span>Left: <b id="left">8</b></span></div><canvas id="game" width="600" height="400"></canvas><div class="row" style="font-size:.7rem;opacity:.5">A party game: lobby, countdown, then race to survive</div>';

var SETUP_PARTY = [
  'const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");',
  'const W=600,H=400;',
  'let phase="lobby",round=1,seed=Date.now()%9973,safeR=200,winner="",last=Date.now();',
  'let beans=[],nodes=[];',
  'function rnd(){seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;}',
  'function makeBeans(n){beans=[];for(let i=0;i<n;i++){beans.push({x:W/2+Math.cos(i/n*6.283)*70,y:H/2+Math.sin(i/n*6.283)*70,r:11,c:i%2?"#ff3b5c":"#22d3ee",alive:true,prog:0,glove:false});}return beans;}'
].join('');

/* Default hooks. The step code in CW_CONFIG overrides these via the editor. */
var HOOKS_PARTY = [
  'function placeBeans(){for(let i=0;i<beans.length;i++){let b=beans[i];b.x=W/2+Math.cos(i/beans.length*6.283)*70;b.y=H/2+Math.sin(i/beans.length*6.283)*70;}}',
  'function nextPhase(p){if(p==="lobby")return "countdown";if(p==="countdown")return "race";return "lobby";}',
  'function countdownText(t){return Math.max(0,7-Math.floor(t));}',
  'function raceProgress(b,t){return Math.min(1,b.prog+0.02);}',
  'function pickArchetype(){var a=["line","zigzag","spiral","tower","islands"];return a[Math.floor(rnd()*a.length)];}',
  'function buildPath(archetype){nodes=[];for(let i=0;i<16;i++){let t=i/15;if(archetype==="spiral"){nodes.push({x:W/2+Math.cos(i*0.6)*(40+i*7),y:H/2+Math.sin(i*0.6)*(40+i*7)});}else{nodes.push({x:60+t*(W-120),y:H/2+Math.sin(i*1.1)*(archetype==="zigzag"?90:20)});}}return nodes;}',
  'function moodColour(){var p=["#22d3ee","#e879f9","#34d399"];return p[Math.floor(rnd()*p.length)];}',
  'function giveGauntlet(b){b.glove=true;}',
  'function shove(b){var dx=b.x-W/2,dy=b.y-H/2,d=Math.sqrt(dx*dx+dy*dy)||1;b.x+=dx/d*60;b.y+=dy/d*60;}',
  'function rankCut(list){list.sort(function(a,b){return b.prog-a.prog;});return list.slice(0,Math.max(1,Math.round(list.length/2)));}',
  'function buildArena(){return 6;}',
  'function shrinkRing(r){safeR=Math.max(30,(r/6)*200);}',
  'function championText(){return "CHAMPION!";}',
  'function updateHUD(){var pe=document.getElementById("phase");if(pe)pe.textContent=phase;var re=document.getElementById("round");if(re)re.textContent=round;var le=document.getElementById("left");if(le){var a=beans.filter(function(b){return b.alive;}).length;le.textContent=a;}}'
].join('');

var SIM_PARTY = [
  'function stepSim(){',
  'var now=Date.now(),cycle=(now%14000)/1000;last=now;',
  'if(cycle<4)phase="lobby";else if(cycle<7)phase="countdown";else phase="race";',
  'if(phase==="lobby"){placeBeans();}else{',
  'for(let i=0;i<beans.length;i++){let b=beans[i];if(!b.alive)continue;',
  'let idx=Math.min(nodes.length-1,Math.floor(Math.max(0,cycle-7)*2)+i);',
  'let n=nodes[idx]||nodes[nodes.length-1]||{x:W/2,y:H/2};',
  'b.x+=(n.x-b.x)*0.06;b.y+=(n.y-b.y)*0.06;b.prog=raceProgress(b,cycle);}}',
  'if(phase==="race"&&cycle>10){shrinkRing(6);safeR=Math.max(26,safeR-0.55);',
  'for(let i=0;i<beans.length;i++){let b=beans[i];if(!b.alive)continue;',
  'let d=Math.sqrt((b.x-W/2)*(b.x-W/2)+(b.y-H/2)*(b.y-H/2));if(d>safeR)b.alive=false;}}',
  'let alive=beans.filter(function(b){return b.alive;}).length;',
  'if(phase==="race"&&alive<=1&&!winner)winner=championText();',
  'if(phase!=="race")winner="";',
  'if(cycle<0.25){beans=makeBeans(8);nodes=buildPath(pickArchetype());safeR=200;round++;}',
  '}',
  'function drawParty(){',
  'if(window.CWArt){CWArt.bg(ctx,W,H,"#1a0b2e","#0a0714");}else{ctx.fillStyle="#0a0714";ctx.fillRect(0,0,W,H);}',
  'ctx.save();ctx.strokeStyle="rgba(255,59,92,.45)";ctx.lineWidth=3;ctx.beginPath();ctx.arc(W/2,H/2,safeR,0,6.283);ctx.stroke();ctx.restore();',
  'ctx.save();ctx.fillStyle="rgba(148,163,184,.45)";for(let i=0;i<nodes.length;i++){ctx.beginPath();ctx.arc(nodes[i].x,nodes[i].y,4,0,6.283);ctx.fill();}ctx.restore();',
  'for(let i=0;i<beans.length;i++){let b=beans[i];if(!b.alive)continue;',
  'ctx.save();ctx.shadowColor=b.c;ctx.shadowBlur=12;ctx.fillStyle=b.c;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,6.283);ctx.fill();ctx.restore();',
  'ctx.fillStyle="#0a0714";ctx.fillRect(b.x-4,b.y-3,3,4);ctx.fillRect(b.x+1,b.y-3,3,4);}',
  'var label=phase==="lobby"?"LOBBY":phase==="countdown"?"STARTING "+countdownText((Date.now()%14000)/1000):"RACE!";',
  'ctx.fillStyle="rgba(255,255,255,.85)";ctx.font="bold 22px system-ui";ctx.textAlign="center";ctx.fillText(label,W/2,40);',
  'if(winner){ctx.fillStyle="rgba(0,0,0,.55)";ctx.fillRect(0,0,W,H);ctx.fillStyle="#ffd166";ctx.font="bold 30px system-ui";ctx.fillText(winner,W/2,H/2);}',
  'updateHUD();',
  '}',
  'function loop(){stepSim();drawParty();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
].join('');

function wrap(css, html, code) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8">' + css +
    '</head><body>' + html + '<script>' + code + '</script></body></html>';
}

function scene(user) {
  return SETUP_PARTY + HOOKS_PARTY + 'makeBeans(8);nodes=buildPath(pickArchetype());' +
    'try{' + user + '}catch(e){}' + SIM_PARTY;
}

/* ===================================================
   CW_CONFIG - SIM LOCKDOWN Ep 1: The Match Loop
   =================================================== */

window.CW_CONFIG = {
  storageKey: 'jvds-roblox-sim-lockdown-1-canvas',
  downloadName: 'my-sim-lockdown-ep1.html',

  hints: [
    'Keep every tuning number in one Config module',
    'Players wait on a floating lobby until enough have joined',
    'One loop runs the whole match, changing a "phase" as it goes',
    'Wait for players, count down, then launch the round',
    'A round moves everyone to the course and back',
    'Test with two players to see a full loop'
  ],

  templates: {
    1: function(u) { return wrap(CSS_PARTY, CANVAS_PARTY, scene(u)); },
    2: function(u) { return wrap(CSS_PARTY, CANVAS_PARTY, scene(u)); },
    3: function(u) { return wrap(CSS_PARTY, CANVAS_PARTY, scene(u)); },
    4: function(u) { return wrap(CSS_PARTY, CANVAS_PARTY, scene(u)); },
    5: function(u) { return wrap(CSS_PARTY, CANVAS_PARTY, scene(u)); },
    6: function(u) { return wrap(CSS_PARTY, CANVAS_PARTY, scene(u)); }
  },

  steps: [
    {
      num: 1,
      title: 'Set Up the Project',
      goal: 'Create the shared Config that holds every number the match needs.',
      points: [
        'The server runs the rules, each client shows the player their screen',
        'MIN_PLAYERS is how many are needed before a match can start',
        'One Config means you tune the game in a single place'
      ],
      challenge: 'Write the Config table with the match numbers:',
      starter: '// ReplicatedStorage/Config\nconst CONFIG = {\n  MIN_PLAYERS: 0,      // players needed to start\n  START_COUNTDOWN: 0,  // seconds in the lobby\n  ROUND_TIME: 0        // seconds per round\n};',
      solution: 'const CONFIG = {\n  MIN_PLAYERS: 2,\n  START_COUNTDOWN: 3,\n  ROUND_TIME: 150\n};',
      checks: ['config', 'min_players', 'round_time'],
      height: 170,
      fills: {
        text: 'A match needs at least ___ players, and the lobby countdown runs for ___ seconds.',
        answers: ['2', '3']
      },
      quiz: {
        question: 'Where does the server script that runs the rules live?',
        options: [
          'StarterPlayerScripts',
          'ServerScriptService',
          'ReplicatedStorage'
        ],
        correct: 1
      }
    },
    {
      num: 2,
      title: 'Build the Lobby',
      goal: 'Give every player a place to wait on the lobby floor.',
      points: [
        'The lobby is a single platform high above the course',
        'Each player is placed around a circle so they do not stack',
        'When the match starts the same helper moves them to the course'
      ],
      challenge: 'Write placeBeans() to spread the players around the lobby:',
      starter: '// Move every player onto the lobby floor\nfunction placeBeans() {\n  for (let i = 0; i < beans.length; i++) {\n    let b = beans[i];\n    b.x = W/2 + Math.cos(i/beans.length*6.283)*0;\n    b.y = H/2 + Math.sin(i/beans.length*6.283)*0;\n  }\n}',
      solution: 'function placeBeans() {\n  for (let i = 0; i < beans.length; i++) {\n    let b = beans[i];\n    b.x = W/2 + Math.cos(i/beans.length*6.283)*70;\n    b.y = H/2 + Math.sin(i/beans.length*6.283)*70;\n  }\n}',
      checks: ['placebeans', 'cos', 'sin'],
      height: 220,
      fills: {
        text: 'We spread the players around a circle using Math.___ for x and Math.___ for y.',
        answers: ['cos', 'sin']
      },
      quiz: {
        question: 'Why do we control where players spawn instead of letting them auto-load?',
        options: [
          'So we choose when and where each player appears',
          'To make the game load faster',
          'To stop players from jumping'
        ],
        correct: 0
      }
    },
    {
      num: 3,
      title: 'The Match Loop',
      goal: 'Run the whole match in one loop that changes a "phase" as it goes.',
      points: [
        'A while loop repeats the match forever',
        'phase tells us which stage we are in: lobby, countdown, race',
        'Each stage hands off to the next'
      ],
      challenge: 'Write nextPhase() so the match moves through its stages:',
      starter: '// lobby -> countdown -> race -> back to lobby\nfunction nextPhase(p) {\n  if (p === "lobby") return "";\n  if (p === "countdown") return "";\n  return "";\n}',
      solution: 'function nextPhase(p) {\n  if (p === "lobby") return "countdown";\n  if (p === "countdown") return "race";\n  return "lobby";\n}',
      checks: ['nextphase', 'countdown', 'race'],
      height: 180,
      fills: {
        text: 'The match runs in the order lobby, then ___, then ___.',
        answers: ['countdown', 'race']
      },
      quiz: {
        question: 'What does the phase variable tell us?',
        options: [
          'How many players are online',
          'Which stage of the match we are in',
          'How much time is left'
        ],
        correct: 1
      }
    },
    {
      num: 4,
      title: 'Wait, Count Down, Launch',
      goal: 'Wait for enough players, then show a countdown before the round.',
      points: [
        'waitForPlayers waits until the count reaches MIN_PLAYERS',
        'The countdown ticks down from START_COUNTDOWN',
        'The number is shared so every screen can show it'
      ],
      challenge: 'Write countdownText() to turn elapsed time into a countdown number:',
      starter: '// Turn elapsed time into a number counting down\nfunction countdownText(t) {\n  return Math.max(0, 7 - Math.floor(t));\n}',
      solution: 'function countdownText(t) {\n  return Math.max(0, 7 - Math.floor(t));\n}',
      checks: ['countdowntext', 'math.max', 'math.floor'],
      height: 150,
      fills: {
        text: 'The countdown never goes below zero because we wrap it in Math.___.',
        answers: ['max']
      },
      quiz: {
        question: 'How does the countdown reach every player screen?',
        options: [
          'We print it in the Output window',
          'We set a shared value the client reads',
          'We change the Lighting properties'
        ],
        correct: 1
      }
    },
    {
      num: 5,
      title: 'Run One Round',
      goal: 'A round function the loop can call, moving players along the course.',
      points: [
        'A start position is set above a start platform',
        'Every player is moved there at the start of a round',
        'Progress climbs from 0 to 1 as the round runs'
      ],
      challenge: 'Write raceProgress() so a player edges along the course, capped at 1:',
      starter: '// How far along the course a player is (0 to 1)\nfunction raceProgress(b, t) {\n  return Math.min(1, b.prog + 0.02);\n}',
      solution: 'function raceProgress(b, t) {\n  return Math.min(1, b.prog + 0.02);\n}',
      checks: ['raceprogress', 'math.min'],
      height: 150,
      fills: {
        text: 'We cap progress at 1 using Math.___ so it never goes past the finish.',
        answers: ['min']
      },
      quiz: {
        question: 'What does a position describe?',
        options: [
          'A colour',
          'A size',
          'A point in the world'
        ],
        correct: 2
      }
    },
    {
      num: 6,
      title: 'Test With Two Players',
      goal: 'Show the live match state so you can watch a full loop.',
      points: [
        'The HUD shows the current phase and round',
        'It shows how many players are still in',
        'Two players is enough to see a full match'
      ],
      challenge: 'Write updateHUD() to show the phase, round and players left:',
      starter: '// Show the match state on screen\nfunction updateHUD() {\n  document.getElementById("phase").textContent = phase;\n  document.getElementById("round").textContent = round;\n}',
      solution: 'function updateHUD() {\n  document.getElementById("phase").textContent = phase;\n  document.getElementById("round").textContent = round;\n  document.getElementById("left").textContent = beans.filter(function(b){return b.alive;}).length;\n}',
      checks: ['updatehud', 'getelementbyid', 'textcontent'],
      height: 190,
      fills: {
        text: 'We update the on-screen text with document.___.',
        answers: ['getElementById']
      },
      quiz: {
        question: 'How many players must be present before the match starts in this episode?',
        options: [
          '2, set by CONFIG.MIN_PLAYERS',
          '8, one for each episode',
          'At least 10'
        ],
        correct: 0
      }
    }
  ]
};
