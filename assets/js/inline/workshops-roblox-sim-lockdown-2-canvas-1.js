'use strict';

/* ===================================================
   SIM LOCKDOWN Ep 2: Map Generator canvas
   A top-down course generator simulation. Each template
   runs standalone with its step solution plugged in as u.
   =================================================== */

function wrap(css, html, code) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8">' + css +
    '</head><body>' + html + '<script>' + code + '</script></body></html>';
}

var CSS_SIM2 = '<style>body{display:flex;flex-direction:column;align-items:center;background:#0d1117;padding:8px;margin:0;font-family:system-ui,sans-serif;color:#e8eaf2;gap:6px;overflow:hidden}canvas{background:#0a0e14;border:2px solid #1e2733;border-radius:8px;touch-action:none;max-width:100%}.row{display:flex;gap:12px;align-items:center;font-size:.8rem;flex-wrap:wrap;justify-content:center}#simLog{font-size:.7rem;opacity:.8;min-height:20px}</style>';

var HTML_SIM2 = '<div class="row"><span>Theme: <b id="themeName">-</b></span><span>Builds: <b id="buildCount">0</b></span><span>Seed: <b id="seedNum">-</b></span></div><canvas id="game" width="600" height="400"></canvas><div class="row" id="simLog">Watch a fresh course generate</div>';

var SETUP_SIM2 = [
  'var canvas=document.getElementById("game"),ctx=canvas.getContext("2d");',
  'var W=600,H=400;',
  'var theme=null,nodes=[],obstacles=[],buildCount=0,seedUsed=0,walkerT=0;',
  'function srand(s){return function(){s|=0;s=s+0x6D2B79F5|0;var t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}',
  'function simLog(m){document.getElementById("simLog").textContent=m;}',
  'function drawCourse(){',
  'var g=ctx.createLinearGradient(0,0,0,H);',
  'if(theme){g.addColorStop(0,theme.sky[0]);g.addColorStop(1,theme.sky[1]);}else{g.addColorStop(0,"#1a1c2e");g.addColorStop(1,"#0d0f1a");}',
  'ctx.fillStyle=g;ctx.fillRect(0,0,W,H);',
  'var i,p;',
  'for(i=0;i<nodes.length;i++){p=nodes[i];',
  'ctx.save();ctx.shadowColor=theme?theme.ground:"#63b3ed";ctx.shadowBlur=8;',
  'ctx.fillStyle=theme?theme.ground:"#63b3ed";',
  'if(ctx.roundRect){ctx.beginPath();ctx.roundRect(p.x-32,p.y-6,64,12,4);ctx.fill();}else{ctx.fillRect(p.x-32,p.y-6,64,12);}',
  'ctx.restore();}',
  'for(i=0;i<obstacles.length;i++){p=obstacles[i];',
  'ctx.save();ctx.shadowColor=p.color;ctx.shadowBlur=12;ctx.fillStyle=p.color;',
  'ctx.beginPath();ctx.arc(p.x,p.y,7,0,Math.PI*2);ctx.fill();ctx.restore();}',
  'if(nodes.length){',
  'ctx.fillStyle="#48bb78";ctx.font="bold 10px system-ui";ctx.textAlign="center";',
  'ctx.fillText("START",nodes[0].x,nodes[0].y-14);',
  'var last=nodes[nodes.length-1];',
  'ctx.fillStyle="#ffd166";ctx.fillText("FINISH",last.x,last.y-14);',
  'if(nodes.length>1){walkerT=(walkerT+0.008)%1;',
  'var seg=Math.min(nodes.length-2,Math.floor(walkerT*(nodes.length-1)));',
  'var f=walkerT*(nodes.length-1)-seg;',
  'var wx=nodes[seg].x+(nodes[seg+1].x-nodes[seg].x)*f;',
  'var wy=nodes[seg].y+(nodes[seg+1].y-nodes[seg].y)*f-18;',
  'ctx.fillStyle="#fff";ctx.fillRect(wx-5,wy-8,10,14);}}',
  'document.getElementById("themeName").textContent=theme?theme.name:"-";',
  'document.getElementById("buildCount").textContent=buildCount;',
  'document.getElementById("seedNum").textContent=seedUsed||"-";}'
].join('');

var COMPLETE_GETTHEME = 'function getTheme(){return{name:"Neon Grid",sky:["#1a1c2e","#0d0f1a"],ground:"#63b3ed",obstacle:"#f56565"}}';

var COMPLETE_MAKENODES = [
  'function makeNodes(seed,count){var r=srand(seed);var pts=[];',
  'for(var i=0;i<count;i++){pts.push({x:40+Math.floor(r()*520),y:60+Math.floor(r()*280)});}',
  'return pts;}'
].join('');

var COMPLETE_ARCHETYPE = [
  'function applyArchetype(nodes,type){var out=[];',
  'for(var i=0;i<nodes.length;i++){var t=nodes.length>1?i/(nodes.length-1):0;',
  'if(type===0)out.push({x:40+t*520,y:200});',
  'else if(type===1)out.push({x:40+t*520,y:(i%2===0?120:280)});',
  'else if(type===2){var a=t*Math.PI*2;out.push({x:300+Math.cos(a)*200*t+40,y:200+Math.sin(a)*120});}',
  'else if(type===3)out.push({x:40+t*520,y:320-t*260});',
  'else{var b=t*Math.PI*2;out.push({x:300+Math.cos(b)*180,y:200+Math.sin(b)*120});}}',
  'return out;}'
].join('');

var COMPLETE_SCATTER = [
  'function scatterObstacles(nodes,theme){var obs=[];',
  'for(var i=2;i<nodes.length;i+=3){obs.push({x:nodes[i].x,y:nodes[i].y-24,color:theme.obstacle});}',
  'return obs;}'
].join('');

var COMPLETE_BUILDCOURSE = [
  'function buildCourse(seed){nodes=[];obstacles=[];theme=getTheme();',
  'var raw=makeNodes(seed,8);nodes=applyArchetype(raw,seed%5);',
  'obstacles=scatterObstacles(nodes,theme);buildCount++;seedUsed=seed;',
  'simLog("Built course #"+buildCount+" from seed "+seed);return nodes.length;}'
].join('');

/* ===================================================
   CW_CONFIG - Sim Lockdown Ep 2 canvas steps + templates
   =================================================== */

window.CW_CONFIG = {
  storageKey: 'jvds-sim-lockdown-2-canvas',
  downloadName: 'my-sim-map-generator.html',

  hints: [
    'Describe one theme: name, two sky colours, ground and obstacle colour',
    'Scatter count random nodes from a seed so the same seed repeats',
    'Bend the nodes into 5 shapes: line, zigzag, spiral, climb, rings',
    'Drop an obstacle above every third node in the theme colour',
    'Clear and rebuild everything from a fresh seed, then count it',
    'Build two seeds and return true when the layouts differ'
  ],

  templates: {
    1: function(u) {
      return wrap(CSS_SIM2, HTML_SIM2,
        SETUP_SIM2 +
        'try{' + u + '}catch(e){}' +
        'if(typeof getTheme==="function")theme=getTheme();' +
        'simLog(theme?("Theme ready: "+theme.name):"Define getTheme");' +
        'function loop(){drawCourse();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    2: function(u) {
      return wrap(CSS_SIM2, HTML_SIM2,
        SETUP_SIM2 + COMPLETE_GETTHEME + 'theme=getTheme();' +
        'try{' + u + '}catch(e){}' +
        'if(typeof makeNodes==="function")nodes=makeNodes(7,8);' +
        'simLog(nodes.length+" nodes scattered from seed 7");' +
        'function loop(){drawCourse();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    3: function(u) {
      return wrap(CSS_SIM2, HTML_SIM2,
        SETUP_SIM2 + COMPLETE_GETTHEME + 'theme=getTheme();' + COMPLETE_MAKENODES +
        'try{' + u + '}catch(e){}' +
        'if(typeof applyArchetype==="function")nodes=applyArchetype(makeNodes(7,8),1);' +
        'simLog("Zigzag archetype shaped "+nodes.length+" nodes");' +
        'function loop(){drawCourse();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    4: function(u) {
      return wrap(CSS_SIM2, HTML_SIM2,
        SETUP_SIM2 + COMPLETE_GETTHEME + 'theme=getTheme();' + COMPLETE_MAKENODES + COMPLETE_ARCHETYPE +
        'try{' + u + '}catch(e){}' +
        'nodes=applyArchetype(makeNodes(7,8),1);' +
        'if(typeof scatterObstacles==="function")obstacles=scatterObstacles(nodes,theme);' +
        'simLog(obstacles.length+" obstacles on the course");' +
        'function loop(){drawCourse();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    5: function(u) {
      return wrap(CSS_SIM2, HTML_SIM2,
        SETUP_SIM2 + COMPLETE_GETTHEME + COMPLETE_MAKENODES + COMPLETE_ARCHETYPE + COMPLETE_SCATTER +
        'try{' + u + '}catch(e){}' +
        'var autoSeed=7,lastBuild=0;' +
        'function loop(){if(typeof buildCourse==="function"){if(Date.now()-lastBuild>5000){lastBuild=Date.now();buildCourse(autoSeed);autoSeed++;}}drawCourse();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    },
    6: function(u) {
      return wrap(CSS_SIM2, HTML_SIM2,
        SETUP_SIM2 + COMPLETE_GETTHEME + COMPLETE_MAKENODES + COMPLETE_ARCHETYPE + COMPLETE_SCATTER + COMPLETE_BUILDCOURSE +
        'try{' + u + '}catch(e){}' +
        'if(typeof verifyVariety==="function")verifyVariety();' +
        'function loop(){drawCourse();requestAnimationFrame(loop)}requestAnimationFrame(loop);'
      );
    }
  },

  steps: [
    {
      num: 1,
      title: 'Give Each Map a Theme',
      goal: 'Three themes, each with its own look and its own favourite obstacles.',
      points: [
        'A theme names its sky, ground and obstacle colours',
        'The canvas paints the sky from the theme at once',
        'Later steps read theme.ground and theme.obstacle, never fixed colours'
      ],
      challenge: 'Write the theme table for Neon Grid:',
      starter: '// Colours and mood for one map theme\nfunction getTheme() {\n  return { name: ???, sky: ???, ground: ???, obstacle: ??? };\n}',
      solution: 'function getTheme() {\n  return { name: "Neon Grid", sky: ["#1a1c2e", "#0d0f1a"], ground: "#63b3ed", obstacle: "#f56565" };\n}',
      checks: ['sky', 'ground', 'obstacle'],
      height: 180,
      fills: {
        text: 'The theme table holds the sky, the ___ colour and the obstacle colour.',
        answers: ['ground']
      },
      quiz: {
        question: 'In Roblox Studio, one table per theme beats scattered values because:',
        options: [
          'Tables run faster',
          'Every colour lives in one place, so a new theme is one new table',
          'Roblox requires tables'
        ],
        correct: 1
      }
    },
    {
      num: 2,
      title: 'A Path of Nodes',
      goal: 'Turn a random list of positions into a walkable course.',
      points: [
        'A seeded random keeps the same seed giving the same nodes',
        'Each node becomes one platform on screen',
        'Eight nodes make a full course across the canvas'
      ],
      challenge: 'Write the node scatter from a seed:',
      starter: '// Scatter count random nodes from a seed\nfunction makeNodes(seed, count) {\n  var r = srand(seed);\n  var pts = [];\n  for (var i = 0; i < count; i++) {\n    pts.push({ x: ???, y: ??? });\n  }\n  return pts;\n}',
      solution: 'function makeNodes(seed, count) {\n  var r = srand(seed);\n  var pts = [];\n  for (var i = 0; i < count; i++) {\n    pts.push({ x: 40 + Math.floor(r() * 520), y: 60 + Math.floor(r() * 280) });\n  }\n  return pts;\n}',
      checks: ['srand', 'pts.push', 'return pts'],
      height: 220,
      fills: {
        text: 'A seeded random means seed 7 builds the same nodes every ___.',
        answers: ['time']
      },
      quiz: {
        question: 'Why seed the random generator instead of pure randomness?',
        options: [
          'Seeds are faster',
          'The same seed replays the same course, so bugs can be reproduced',
          'Roblox only allows seeded random'
        ],
        correct: 1
      }
    },
    {
      num: 3,
      title: 'Layout Archetypes',
      goal: 'Make the course come out in completely different shapes, not just dots.',
      points: [
        'Five shapes: line, zigzag, spiral, climb and rings',
        'The archetype number picks the shape, seed % 5 chooses it',
        'Math.cos and Math.sin bend straight lists into curves'
      ],
      challenge: 'Write the shaper for all five archetypes:',
      starter: '// Bend nodes into the picked archetype shape\nfunction applyArchetype(nodes, type) {\n  var out = [];\n  for (var i = 0; i < nodes.length; i++) {\n    var t = nodes.length > 1 ? i / (nodes.length - 1) : 0;\n    if (type === 0) out.push({ x: 40 + t * 520, y: 200 });\n    else if (type === 1) out.push({ x: 40 + t * 520, y: ??? });\n    else if (type === 2) { var a = t * Math.PI * 2; out.push({ x: 300 + Math.cos(a) * 200 * t + 40, y: ??? }); }\n    else if (type === 3) out.push({ x: 40 + t * 520, y: 320 - t * 260 });\n    else { var b = t * Math.PI * 2; out.push({ x: ???, y: 200 + Math.sin(b) * 120 }); }\n  }\n  return out;\n}',
      solution: 'function applyArchetype(nodes, type) {\n  var out = [];\n  for (var i = 0; i < nodes.length; i++) {\n    var t = nodes.length > 1 ? i / (nodes.length - 1) : 0;\n    if (type === 0) out.push({ x: 40 + t * 520, y: 200 });\n    else if (type === 1) out.push({ x: 40 + t * 520, y: (i % 2 === 0 ? 120 : 280) });\n    else if (type === 2) { var a = t * Math.PI * 2; out.push({ x: 300 + Math.cos(a) * 200 * t + 40, y: 200 + Math.sin(a) * 120 }); }\n    else if (type === 3) out.push({ x: 40 + t * 520, y: 320 - t * 260 });\n    else { var b = t * Math.PI * 2; out.push({ x: 300 + Math.cos(b) * 180, y: 200 + Math.sin(b) * 120 }); }\n  }\n  return out;\n}',
      checks: ['math.cos', 'math.sin', 'return out'],
      height: 300,
      fills: {
        text: 'Five ___ shapes from one list: the seed picks, the shaper bends.',
        answers: ['archetype']
      },
      quiz: {
        question: 'Cosine and sine turn a straight list into curves because:',
        options: [
          'They draw circles on their own',
          'They swing smoothly between -1 and 1 as the angle grows',
          'They only work on round numbers'
        ],
        correct: 1
      }
    },
    {
      num: 4,
      title: 'Mood and Obstacles',
      goal: 'Two maps of the same theme should still feel different, because obstacles land by weight.',
      points: [
        'An obstacle floats above every third node',
        'Its colour comes from the theme, so themes stay consistent',
        'Weights per theme decide which obstacle shows up most'
      ],
      challenge: 'Write the obstacle scatter:',
      starter: '// Drop an obstacle above every third node\nfunction scatterObstacles(nodes, theme) {\n  var obs = [];\n  for (var i = 2; i < nodes.length; i += 3) {\n    obs.push({ x: ???, y: ???, color: ??? });\n  }\n  return obs;\n}',
      solution: 'function scatterObstacles(nodes, theme) {\n  var obs = [];\n  for (var i = 2; i < nodes.length; i += 3) {\n    obs.push({ x: nodes[i].x, y: nodes[i].y - 24, color: theme.obstacle });\n  }\n  return obs;\n}',
      checks: ['obs.push', 'theme.obstacle', 'return obs'],
      height: 200,
      fills: {
        text: 'Obstacles borrow their colour from theme.___ so every theme keeps its mood.',
        answers: ['obstacle']
      },
      quiz: {
        question: 'Scattering by weight (favourite obstacles appear more) matters because:',
        options: [
          'Weight makes the code shorter',
          'Each theme gets a personality instead of pure chaos',
          'Roblox counts weights for XP'
        ],
        correct: 1
      }
    },
    {
      num: 5,
      title: 'A Fresh Map Every Round',
      goal: 'Hook the generator into the match loop so every round gets a new course.',
      points: [
        'Clear nodes and obstacles before rebuilding, or courses pile up',
        'Theme, nodes, shape and obstacles build in that order',
        'The build counter proves a new course arrived'
      ],
      challenge: 'Write the full rebuild from a fresh seed:',
      starter: '// Wipe and rebuild the whole course from seed\nfunction buildCourse(seed) {\n  nodes = [];\n  obstacles = [];\n  theme = getTheme();\n  var raw = makeNodes(seed, 8);\n  nodes = applyArchetype(raw, ???);\n  obstacles = scatterObstacles(nodes, theme);\n  buildCount++;\n  seedUsed = seed;\n  return ???;\n}',
      solution: 'function buildCourse(seed) {\n  nodes = [];\n  obstacles = [];\n  theme = getTheme();\n  var raw = makeNodes(seed, 8);\n  nodes = applyArchetype(raw, seed % 5);\n  obstacles = scatterObstacles(nodes, theme);\n  buildCount++;\n  seedUsed = seed;\n  return nodes.length;\n}',
      checks: ['buildcount', 'applyarchetype', 'scatterobstacles'],
      height: 260,
      fills: {
        text: 'Rebuilds start by ___ the old lists, or two courses stack on top of each other.',
        answers: ['clearing']
      },
      quiz: {
        question: 'Why does the archetype come from seed % 5?',
        options: [
          'Five is the fastest number',
          'It turns any seed into a valid pick from 0 to 4',
          'Roblox needs remainders'
        ],
        correct: 1
      }
    },
    {
      num: 6,
      title: 'Play It Twice',
      goal: 'Run the game a few times and watch a different course appear each time.',
      points: [
        'Build from seed 7, snapshot the layout as text',
        'Build from seed 8 and compare the two snapshots',
        'Different text proves a different course, same code'
      ],
      challenge: 'Write the variety check across two seeds:',
      starter: '// Prove two seeds give two different courses\nfunction verifyVariety() {\n  buildCourse(7);\n  var a = JSON.stringify(nodes);\n  buildCourse(8);\n  var b = JSON.stringify(nodes);\n  var different = (a !== b);\n  simLog(???);\n  return different;\n}',
      solution: 'function verifyVariety() {\n  buildCourse(7);\n  var a = JSON.stringify(nodes);\n  buildCourse(8);\n  var b = JSON.stringify(nodes);\n  var different = (a !== b);\n  simLog("Maps differ: " + different);\n  return different;\n}',
      checks: ['json.stringify', 'different', 'simlog'],
      height: 220,
      fills: {
        text: 'Two seeds, two snapshots: when the text ___, the courses are truly different.',
        answers: ['differs']
      },
      quiz: {
        question: 'Comparing JSON snapshots of two builds proves variety because:',
        options: [
          'JSON is always different',
          'Identical layouts would snapshot identically, so a mismatch means a new course',
          'Snapshots make the game faster'
        ],
        correct: 1
      }
    }
  ]
};
