  (() => {
    const GAME_ID = 'star-chef';
    window.GAME_ID = GAME_ID;
    const $ = id => document.getElementById(id);
    const stations = [...document.querySelectorAll('.station')];
    const canvas = $('chefCanvas');
    const ctx = canvas.getContext('2d');
    const audio = window.AudioEffects ? new AudioEffects(.45) : null;

    const recipes = [
      { name:'Moon Noodles', icon:'🍜', value:95, steps:['prep','grill','plate'], note:'chop veg, flash fry, sparkle plate' },
      { name:'Comet Curry', icon:'🍛', value:115, steps:['prep','grill','bake','plate'], note:'mix spice, simmer, bake naan, serve' },
      { name:'Star Tart', icon:'🥧', value:105, steps:['prep','bake','plate'], note:'roll pastry, bake golden, dust stars' },
      { name:'Rocket Burger', icon:'🍔', value:125, steps:['prep','grill','plate'], note:'stack, sear, sauce swirl' },
      { name:'Galaxy Bento', icon:'🍱', value:140, steps:['prep','bake','grill','plate'], note:'portion, roast, glaze, arrange' }
    ];
    const moods = ['👽','🧑‍🚀','🤖','🐙','🦊','🐸'];
    const stationEmoji = { prep:'🔪', grill:'🔥', bake:'🥐', plate:'✨' };
    const stationLabel = { prep:'Prep', grill:'Grill', bake:'Bake', plate:'Plate' };
    const pos = { prep:[126,138], grill:[352,104], bake:[584,142], plate:[382,324] };

    let running=false, paused=false, time=120, coins=0, rep=3, combo=1, goal=450, queue=[], active=null, stepIndex=0, chef={x:382,y:324,tx:382,ty:324}, particles=[], cook=null, last=performance.now(), spawnTick=0;

    const storyRun=window.__storyRun=(()=>{try{return new StoryRun({
      id:'star-chef',
      title:'One Tiny Restaurant', character:'Lumo',
      open:'Lumo booked you a tiny restaurant and the first customers are already seated.',
      objective:'Serve the recipe queue in order and build your five-star rating.',
      beats:[{at:0,text:'The first ticket lands on the rail.'},{at:0.45,text:'The queue fills and the combo starts to matter.'},{at:0.8,text:'Last covers, the five-star rating is close.'}],
      cap:300,
      result:{
        success:'The queue empties, the rating is five stars and Lumo books a bigger room.',
        partial:'The shift ends with happy tables and a rating worth building on.',
        fail:'The kitchen wins this round, but Lumo keeps the booking for tomorrow.'
      },
      onFinish:function(){ running=false; paused=true; },
      onRestart:function(){ start(); }
    });}catch(e){return null;}})();
    function storyScore(){ if(storyRun&&storyRun.running) storyRun.setScore(coins); }

    function saveScore(){
      if(window.GameSystem?.saveScore) window.GameSystem.saveScore(GAME_ID, coins, {level: starsEarned(), energy: rep});
    }
    function bestCoins(){ return window.GameSystem ? window.GameSystem.getBestScore(GAME_ID) : 0; }
    function buzz(ms=18){ try{ navigator.vibrate && navigator.vibrate(ms); }catch(e){} }
    function sfx(name){ try{ audio?.[name]?.(); }catch(e){} }
    function toast(msg, good=true){
      const t=$('toast'); t.textContent=msg; t.className='toast show ' + (good?'good':'bad');
      clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove('show'),1100);
    }
    function starsEarned(){ return coins>=900?3:coins>=650?2:coins>=goal?1:0; }
    function setHint(msg){ $('hint').textContent=msg; }

    function makeOrder(){
      const r=recipes[Math.floor(Math.random()*recipes.length)];
      const vip=Math.random()<.18;
      const rush=Math.random()<.20;
      return { id:crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()), recipe:r, face:moods[Math.floor(Math.random()*moods.length)], patience:rush?48:vip?82:68, max:rush?48:vip?82:68, vip, rush, age:0 };
    }
    function fillQueue(){ while(queue.length<4) queue.push(makeOrder()); }

    function render(){
      storyScore();
      $('coins').textContent='£'+coins;
      $('rep').textContent=rep+'★';
      $('combo').textContent='x'+combo;
      $('timer').textContent=Math.max(0, Math.ceil(time));
      $('queueCount').textContent=queue.length+' waiting';
      $('stars').textContent='★★★'.slice(0, starsEarned()) + '☆☆☆'.slice(starsEarned());
      $('goalText').textContent='£'+goal;
      $('shiftText').textContent= running ? (paused?'Paused':'Lunch Rush · '+Math.ceil(time)+'s') : 'Lunch Rush · 120s';
      $('startBtn').textContent = running ? 'Shift running' : 'Start shift';
      $('pauseBtn').textContent = paused ? '▶' : '⏸';
      $('ticketName').textContent = active ? active.recipe.icon+' '+active.recipe.name : 'No ticket selected';
      $('ticketSteps').innerHTML = active ? active.recipe.steps.map((st,i)=>`<span class="${i<stepIndex?'done':i===stepIndex?'now':''}">${stationEmoji[st]} ${stationLabel[st]}</span>`).join('') : '<span>Pick an order</span>';
      $('orders').innerHTML = queue.map(o => {
        const pct=Math.max(0, o.patience/o.max*100);
        return `<button class="order ${active&&active.id===o.id?'selected':''} ${o.vip?'vip':''} ${o.rush?'rush':''}" data-id="${o.id}">
          <span class="face">${o.face}</span><span class="meal"><b>${o.recipe.icon} ${o.recipe.name}</b><small>${o.recipe.note}</small></span>
          <i class="pat"><em style="width:${pct}%"></em></i><strong>£${o.recipe.value}${o.vip?' VIP':''}${o.rush?' RUSH':''}</strong>
        </button>`;
      }).join('');
      document.querySelectorAll('.order').forEach(btn=>btn.onclick=()=>selectOrder(btn.dataset.id));
      stations.forEach(s=>s.classList.toggle('next', active && active.recipe.steps[stepIndex]===s.dataset.station));
    }

    function selectOrder(id){
      if(!running){ start(); }
      const found=queue.find(o=>o.id===id); if(!found) return;
      active=found; stepIndex=0; cook=null; $('cookMeter').hidden=true;
      setHint('Now use '+stationLabel[active.recipe.steps[0]]+' first. Follow the glowing station sequence.');
      sfx('playTap'); render();
    }

    function useStation(st){
      if(!running || paused){ return; }
      if(!active){ setHint('Choose a customer ticket first.'); toast('Pick an order first', false); buzz([12,20,12]); return; }
      const need=active.recipe.steps[stepIndex];
      if(st!==need){
        rep=Math.max(0,rep-1); combo=1; active.patience=Math.max(4,active.patience-10);
        setHint('Wrong station. This recipe needs '+stationLabel[need]+' next.'); toast('Wrong station', false); sfx('playError'); buzz([12,28,12]); render(); return;
      }
      chef.tx=pos[st][0]; chef.ty=pos[st][1];
      if(st==='grill' || st==='bake') startCook(st); else completeStep(1);
      render();
    }

    function startCook(st){
      cook={station:st, needle:0, dir:1, speed: st==='grill'?1.65:1.25};
      $('cookMeter').hidden=false;
      setHint('Stop the timing bar in the green to get a perfect cook bonus.');
    }
    function stopCook(){
      if(!cook) return;
      const n=cook.needle; const perfect=n>=42 && n<=62; const ok=n>=30 && n<=74;
      $('cookMeter').hidden=true; cook=null;
      if(perfect){ completeStep(1.35); toast('Perfect cook +bonus'); }
      else if(ok){ completeStep(1); toast('Good cook'); }
      else { rep=Math.max(0,rep-1); combo=1; active.patience=Math.max(3,active.patience-12); completeStep(.7); toast('Overcooked, still usable', false); }
      render();
    }
    function completeStep(mult){
      sfx('playSuccess'); buzz(12); spawnSpark(chef.tx, chef.ty, stationEmoji[active.recipe.steps[stepIndex]]);
      stepIndex++;
      if(stepIndex>=active.recipe.steps.length) serve(mult); else setHint('Nice. Next station: '+stationLabel[active.recipe.steps[stepIndex]]+'.');
    }
    function serve(mult){
      const patienceBonus=Math.round(active.patience*1.2);
      const vipBonus=active.vip?45:0;
      const earned=Math.round((active.recipe.value + patienceBonus + vipBonus) * combo * mult);
      coins+=earned; combo=Math.min(8,combo+1); rep=Math.min(5,rep+1);
      queue=queue.filter(o=>o.id!==active.id); active=null; stepIndex=0; fillQueue();
      setHint('Served hot for £'+earned+'. Chain another order to grow the combo.'); toast('Served! £'+earned); saveScore(); render();
      if(coins>=goal && time>0) $('stars').classList.add('win');
    }

    function loseOrder(o){
      queue=queue.filter(x=>x.id!==o.id); if(active&&active.id===o.id){active=null;stepIndex=0;$('cookMeter').hidden=true;}
      rep=Math.max(0,rep-1); combo=1; toast('A customer left', false); setHint('Queue pressure matters. Serve rush tickets early.');
      fillQueue(); render();
    }

    function start(){
      running=true; paused=false; if(queue.length===0) fillQueue(); if(storyRun&&!storyRun.running) storyRun.begin(); setHint('Shift started. Pick the most urgent customer and run the recipe steps.'); render();
    }
    function reset(){
      running=false; paused=false; time=120; coins=0; rep=3; combo=1; queue=[]; active=null; stepIndex=0; cook=null; particles=[]; chef={x:382,y:324,tx:382,ty:324}; $('cookMeter').hidden=true; fillQueue(); setHint('Pick a customer order, then tap the station that matches the glowing recipe step.'); render();
    }
    function finish(){
      running=false; paused=true; saveScore();
      const won = coins>=goal;
      const msg = won ? 'Shift complete! Star café saved.' : 'Shift over. Try faster station planning.';
      toast(msg, won); setHint(msg+' Best: £'+bestCoins()); render();
      if(storyRun) storyRun.finish(won?'success':(coins>=goal*0.6?'partial':'fail'), coins);
    }

    function spawnSpark(x,y,icon){ for(let i=0;i<12;i++) particles.push({x,y,vx:(Math.random()-.5)*4,vy:-Math.random()*4-1,life:1,icon}); }
    function drawKitchen(dt){
      const w=canvas.width,h=canvas.height; ctx.clearRect(0,0,w,h);
      ctx.fillStyle='rgba(255,255,255,.10)'; ctx.fillRect(0,0,w,h);
      ctx.strokeStyle='rgba(255,255,255,.16)'; ctx.lineWidth=2;
      for(let x=40;x<w;x+=80){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x-80,h);ctx.stroke();}
      for(const [key,p] of Object.entries(pos)){
        ctx.beginPath(); ctx.arc(p[0],p[1],42,0,Math.PI*2); ctx.fillStyle= active&&active.recipe.steps[stepIndex]===key ? 'rgba(255,255,255,.40)' : 'rgba(255,255,255,.16)'; ctx.fill();
        ctx.fillStyle='#fff'; ctx.font='32px system-ui'; ctx.textAlign='center'; ctx.fillText(stationEmoji[key],p[0],p[1]+10);
      }
      chef.x += (chef.tx-chef.x)*Math.min(1,dt*6); chef.y += (chef.ty-chef.y)*Math.min(1,dt*6);
      ctx.save(); ctx.translate(chef.x,chef.y); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(0,0,30,0,Math.PI*2); ctx.fill(); ctx.font='34px system-ui'; ctx.textAlign='center'; ctx.fillText('🧑‍🍳',0,13); ctx.restore();
      if(active){ ctx.font='30px system-ui'; ctx.fillText(active.recipe.icon,chef.x+34,chef.y-18); }
      particles=particles.filter(p=>p.life>0); particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.08;p.life-=dt*1.8;ctx.globalAlpha=Math.max(0,p.life);ctx.font='22px system-ui';ctx.fillText(p.icon,p.x,p.y);ctx.globalAlpha=1;});
    }
    function tick(now){
      const dt=Math.min(.05,(now-last)/1000); last=now;
      if(running && !paused){
        time-=dt; spawnTick+=dt;
        queue.forEach(o=>{ o.age+=dt; o.patience-=dt*(o.rush?1.4:1); });
        queue.filter(o=>o.patience<=0).forEach(loseOrder);
        if(spawnTick>10){ spawnTick=0; if(queue.length<5) queue.push(makeOrder()); }
        if(time<=0 || rep<=0) finish();
        if(cook){ cook.needle += cook.dir*cook.speed*dt*55; if(cook.needle>100){cook.needle=100;cook.dir=-1;} if(cook.needle<0){cook.needle=0;cook.dir=1;} $('needle').style.left=cook.needle+'%'; }
        render();
      }
      drawKitchen(dt); requestAnimationFrame(tick);
    }

    stations.forEach(s=>s.addEventListener('click',()=>useStation(s.dataset.station)));
    $('stopCook').onclick=stopCook;
    $('startBtn').onclick=start;
    $('resetBtn').onclick=reset;
    $('pauseBtn').onclick=()=>{ if(!running) return; paused=!paused; render(); };
    document.addEventListener('keydown',e=>{
      const map={Digit1:'prep',Digit2:'grill',Digit3:'bake',Digit4:'plate',Space:'stop'};
      if(map[e.code]==='stop') stopCook(); else if(map[e.code]) useStation(map[e.code]);
    });
    reset(); requestAnimationFrame(tick);
  })();
  