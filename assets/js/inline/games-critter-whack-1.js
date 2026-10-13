(() => {
 const CRITTERS=[
  {e:'🦊',name:'fox',tags:['fur','land','night']},{e:'🐸',name:'frog',tags:['jump','water','green']},{e:'🐢',name:'turtle',tags:['shell','water','slow']},{e:'🦋',name:'butterfly',tags:['fly','garden','colour']},{e:'🐝',name:'bee',tags:['fly','garden','stripe']},{e:'🦎',name:'lizard',tags:['land','green','sun']},{e:'🦉',name:'owl',tags:['fly','night','feather']},{e:'🐌',name:'snail',tags:['shell','slow','garden']},{e:'🦀',name:'crab',tags:['water','shell','sideways']}
 ];
 const HAZARDS=[{e:'💣',name:'bomb'},{e:'⚡',name:'zap'},{e:'🕳️',name:'trap'}];
 const RULES=[
  {title:'Habitat check',text:'Tap water critters only.',tag:'water',emoji:'💧'},
  {title:'Garden helpers',text:'Tap garden critters only.',tag:'garden',emoji:'🌿'},
  {title:'Night watch',text:'Tap night critters only.',tag:'night',emoji:'🌙'},
  {title:'Shell survey',text:'Tap critters with shells only.',tag:'shell',emoji:'🐚'},
  {title:'Sky patrol',text:'Tap flying critters only.',tag:'fly',emoji:'🪽'},
  {title:'Slow and steady',text:'Tap slow critters only.',tag:'slow',emoji:'🐌'}
 ];
 const board=document.getElementById('board'), scoreEl=document.getElementById('score'), waveEl=document.getElementById('wave'), timeEl=document.getElementById('time'), livesEl=document.getElementById('lives'), bestEl=document.getElementById('best'), feedback=document.getElementById('feedback'), overlay=document.getElementById('overlay');
 let score=0,wave=1,lives=3,time=45,best=(window.GameSystem?window.GameSystem.getBestScore('critter-whack'):0),running=false,rule=RULES[0],timer=0,spawnTimer=0,streak=0,holes=[];
 const storyRun = window.__storyRun || (window.__storyRun = new StoryRun({
  id:'critter-whack', title:'Echo and the Forest Rescue', character:'Echo',
  open:'Echo is sorting the forest rescue and the wrong critter goes to the wrong home.',
  objective:'Read each habitat clue and send every critter home.',
  beats:[{at:0,text:'First clue board is up.'},{at:0.4,text:'New habitats start mixing in.'},{at:0.8,text:'Last wave, read fast.'}],
  cap:300,
  result:{
    success:'Every critter is home, your streak is counted and the forest settles.',
    partial:'Most critters are home, one tricky clue still needs a second look.',
    fail:'The forest is still messy, but Echo knows the clues for the next round.'
  },
  onFinish:function(){ running=false; clearTimeout(timer); },
  onRestart:function(){ start(); }
 }));
 bestEl.textContent=best;
 function setupBoard(){board.innerHTML='';holes=Array.from({length:9},(_,i)=>{const b=document.createElement('button');b.className='hole';b.type='button';b.innerHTML='<span class="critter"></span><span class="label">hole '+(i+1)+'</span>';b.addEventListener('click',()=>tap(i));board.appendChild(b);return {el:b,item:null,up:false,until:0};});}
 function setRule(){rule=RULES[(wave-1)%RULES.length];document.getElementById('ruleTitle').textContent=rule.title;document.getElementById('ruleText').textContent=rule.text;document.getElementById('targetEmoji').textContent=rule.emoji;}
 function hud(){scoreEl.textContent=score;waveEl.textContent=wave;livesEl.textContent=lives;timeEl.textContent=time;storyRun.setScore(score);}
 function pickItem(){if(Math.random()<.18)return {...HAZARDS[Math.floor(Math.random()*HAZARDS.length)],hazard:true};const good=Math.random()<.55;let pool=CRITTERS.filter(c=>good?c.tags.includes(rule.tag):!c.tags.includes(rule.tag));return {...pool[Math.floor(Math.random()*pool.length)],good};}
 function pop(){const free=holes.filter(h=>!h.up);if(!free.length)return;const h=free[Math.floor(Math.random()*free.length)];h.item=pickItem();h.up=true;h.until=performance.now()+Math.max(720,1350-wave*55);h.el.classList.add('up');h.el.classList.toggle('good',!!h.item.good);h.el.classList.toggle('bad',!!h.item.hazard);h.el.querySelector('.critter').textContent=h.item.e;h.el.querySelector('.label').textContent=h.item.hazard?'hazard':h.item.name;}
 function hide(h){h.up=false;h.item=null;h.el.className='hole';h.el.querySelector('.critter').textContent='';h.el.querySelector('.label').textContent='';}
 function tap(i){if(!running)return;const h=holes[i];if(!h.up||!h.item)return;if(h.item.good){streak++;score+=20+streak*5;feedback.textContent='Correct: '+h.item.name+' matches '+rule.text.toLowerCase();window.JVDSAudio&&window.JVDSAudio.success();}else{streak=0;lives--;feedback.textContent=h.item.hazard?'Hazard! Read before tapping.':'Wrong group. '+h.item.name+' does not match this clue.';window.JVDSAudio&&window.JVDSAudio.error();}hide(h);hud();if(lives<=0)end(false);}
 function loop(){if(!running)return;const now=performance.now();holes.forEach(h=>{if(h.up&&now>h.until){if(h.item&&h.item.good){streak=0;feedback.textContent='A matching critter got away.';}hide(h);}});if(now>spawnTimer){pop();spawnTimer=now+Math.max(360,850-wave*38);}requestAnimationFrame(loop);}
 function tick(){if(!running)return;time--;if(time%10===0){wave++;setRule();feedback.textContent='New clue: '+rule.text;}hud();if(time<=0)end(true);else timer=setTimeout(tick,1000);}
 function start(){score=0;wave=1;lives=3;time=45;streak=0;running=true;holes.forEach(hide);setRule();hud();overlay.classList.add('off');feedback.textContent='Find: '+rule.text;if(window.GameSystem){try{window.__cwgs=new GameSystem('critter-whack','Critter Whack: Ranger Sort','pip');window.__cwgs.beginRun();}catch(e){}}storyRun.gameSystem=window.__cwgs;if(!storyRun.running)storyRun.begin();tick();loop();}
 function end(won){running=false;clearTimeout(timer);holes.forEach(hide);best=Math.max(best,score);if(window.GameSystem&&window.GameSystem.saveScore)window.GameSystem.saveScore('critter-whack',best);bestEl.textContent=best;storyRun.finish(won?'success':'fail',score);}
 document.getElementById('startBtn').addEventListener('click',start);setupBoard();setRule();hud();
})();
