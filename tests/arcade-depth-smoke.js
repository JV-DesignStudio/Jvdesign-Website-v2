require('./arcade-browser-harness.cjs')([
 {file:'paper-toss-deluxe.html',run:async(p,check,a)=>{
 await check('five wind-lab levels and throw mission',async()=>a.equal(await p.evaluate(()=>document.querySelectorAll('#levelMap button').length===5&&/Score/i.test(document.getElementById('missionTitle').textContent)),true));
 await check('starting level resets throws and ball',async()=>a.equal(await p.evaluate(()=>{startLevel(0);return score===0&&throws===cfg().throws&&!!ball&&playing===true;}),true));
 await check('curve flight path bends sideways with lift',async()=>a.equal(await p.evaluate(()=>{const straight=flightPoint(0.5,0,1),curved=flightPoint(0.5,0.8,1);return Math.abs(curved.wx-straight.wx)>0.02&&curved.h>0;}),true));
 await check('clean hit scores and builds streak',async()=>a.equal(await p.evaluate(()=>{startLevel(0);wind={x:0,y:0,p:0};ball={wx:0,wz:0,h:0,r:44,t:0,duration:.86,reach:1,endX:0,arc:.72,spin:0,bounces:0,curve:false,hit:false,power:1};const before=score;scoreHit();return score>before&&streak===1;}),true));
 await check('trick curve counts toward lab tricks',async()=>a.equal(await p.evaluate(()=>{ball={wx:0,wz:0,h:0,r:44,t:0,duration:.86,reach:1,endX:0,arc:.72,spin:0.8,bounces:0,curve:true,hit:false,power:1};const t=tricks;scoreHit();return tricks===t+1;}),true));
 await check('miss resets streak without ending level',async()=>a.equal(await p.evaluate(()=>{throws=8;score=0;miss();return streak===0&&flying===false;}),true));
 await check('restart resets score and throws',async()=>{await new Promise(r=>setTimeout(r,600));a.equal(await p.evaluate(()=>{startLevel(level);return score===0&&throws===cfg().throws;}),true);});
 }},
 {file:'pastry-match.html',run:async(p,check,a)=>{
 await p.evaluate(()=>startGame());await p.waitForFunction(()=>document.querySelectorAll('#board .tile').length===49);
 await check('one order box with three pastry slots',async()=>a.equal(await p.evaluate(()=>document.querySelectorAll('#board .tile').length===49&&document.querySelectorAll('#orderSlots .slot').length>=3&&document.getElementById('timeHud').textContent==='1/1'),true));
 await check('forced match resolves and scores',async()=>{await p.evaluate(()=>{const needId=Object.keys(order.needs).find(k=>order.needs[k]>0)||'croissant';for(let c=0;c<3;c++)board[0][c]=needId;resolveMatches([{r:0,c:0,id:needId},{r:0,c:1,id:needId},{r:0,c:2,id:needId}]);});await p.waitForFunction(()=>!busy,{timeout:10000});a.equal(await p.evaluate(()=>score>0),true);});
 await check('tray tool reshuffles a full board',async()=>a.equal(await p.evaluate(()=>{const t=tray;useTray();return tray===t-1&&document.querySelectorAll('#board .tile').length===49;}),true));
 await check('serving the box ends the order',async()=>{await p.evaluate(()=>{startGame();endGame();});a.equal(await p.evaluate(()=>document.getElementById('endModal').classList.contains('show')&&document.getElementById('endTitle').textContent==='Order served!'),true);});
 await check('restart resets box and score',async()=>a.equal(await p.evaluate(()=>{startGame();return score===0&&!document.getElementById('endModal').classList.contains('show')&&document.querySelectorAll('#board .tile').length===49;}),true));
 }}
]).catch(e=>{console.error(e);process.exitCode=1;});
