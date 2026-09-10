require('./arcade-browser-harness.cjs')([
 {file:'paper-toss-deluxe.html',run:async(p,check,a)=>{
 await check('bank contract changes real wall physics',async()=>a.equal(await p.evaluate(()=>{startGame();selectTossContract('bank');state='flying';paper={x:W-4,y:H*.4,vx:180,vy:-60,rot:0,spin:0};update(.02);return paper.banked&&paper.vx<0;}),true));
 await check('banked hit doubles reward and recovers a life',async()=>a.equal(await p.evaluate(()=>{lives=2;scoreHit();return score===200&&lives===3&&bankShots===1;}),true));
 await check('direct shot does not satisfy a bank contract',async()=>a.equal(await p.evaluate(()=>{state='flying';paper={banked:false};const before=hits;scoreHit();return hits===before&&lives===2;}),true));
 await check('fifteen baskets complete and save a tour',async()=>a.equal(await p.evaluate(()=>{state='ready';selectTossContract('direct');hits=14;state='flying';paper={};scoreHit();return state==='dead'&&document.getElementById('overTitle').textContent==='Office tour complete!'&&Number(localStorage.getItem('jvds_toss_tours'))===1;}),true));
 await check('restart cancels delayed end screen',async()=>{await p.evaluate(()=>startGame());await new Promise(r=>setTimeout(r,550));a.equal(await p.evaluate(()=>document.getElementById('overModal').classList.contains('show')),false);});
 }},
 {file:'pastry-match.html',run:async(p,check,a)=>{
 await p.evaluate(()=>startGame());await p.waitForFunction(()=>state==='playing');
 await check('pinning costs focus and remembers a missed card',async()=>a.equal(await p.evaluate(()=>{flipCard(0);notePastry();const other=cards.findIndex(c=>c.emoji!==cards[0].emoji);flipCard(other);pastryTimers.forEach(clearTimeout);pastryTimers.clear();checkMatch();return pastryFocus===2&&cards[0].state==='hidden'&&cards[0].noted&&cardEls[0].textContent.includes('📌');}),true));
 await check('cannot buy a glance without three focus',async()=>a.equal(await p.evaluate(()=>{glancePastries();return state==='playing'&&pastryFocus===2;}),true));
 await check('glance reveals then hides unpinned cards',async()=>{await p.evaluate(()=>{pastryFocus=3;glancePastries();});a.equal(await p.evaluate(()=>state==='glance'),true);await p.waitForFunction(()=>state==='playing');a.equal(await p.evaluate(()=>pastryFocus===0&&cards.filter(c=>!c.noted).every(c=>c.state==='hidden')),true);});
 await check('two matched pairs replenish focus',async()=>a.equal(await p.evaluate(()=>{for(let n=0;n<2;n++){const x=cards.findIndex(c=>c.state==='hidden');const y=cards.findIndex((c,i)=>i!==x&&c.state==='hidden'&&c.emoji===cards[x].emoji);flipCard(x);flipCard(y);pastryTimers.forEach(clearTimeout);pastryTimers.clear();checkMatch();}return pastryFocus===1&&matched===2;}),true));
 await check('restart resets tools and notes',async()=>a.equal(await p.evaluate(()=>{startGame();return pastryFocus===3&&cards.every(c=>!c.noted);}),true));
 }}
]).catch(e=>{console.error(e);process.exitCode=1;});
