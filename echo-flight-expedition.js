/* Echo's Flight: equipment changes movement, routes change risk, discoveries persist. */
const FLIGHT_ROUTES = {
  reef: {name:'Sunlit Reef',speed:0.92,gap:1.13,loot:1,colors:['#082e43','#126e79','#36ad9c'],gift:'guard',title:'Sheltered reef',text:'Wider gaps and a fresh bubble shield. A forgiving route to rebuild your rhythm.'},
  storm: {name:'Thunder Current',speed:1.14,gap:0.94,loot:2,colors:['#171e4a','#49386f','#bc6d86'],gift:'salvage',title:'Thunder current',text:'Faster, tighter gates. Fish are worth double; every fifth fish grants slow motion.'},
  deep: {name:'Moonlit Trench',speed:1,gap:1,loot:1,colors:['#070d2b','#19375f','#526a9a'],gift:'magnet',title:'Moonlit trench',text:'Take the balanced route and gain a pearl magnet. Gather fish without hugging the walls.'}
};
const FLIGHT_KITS = {
  glider:{name:'Reef glider',text:'Softer lift and slower falling. More time to read the next gap.',kit:{glide:true}},
  guard:{name:'Bubble scout',text:'One collision shield. Every eight perfect gates restores it.',kit:{guard:true}},
  salvage:{name:'Current chaser',text:'Every fifth fish triggers slow motion. Reach for rewards, then ride the calm.',kit:{salvage:true}}
};
const FLIGHT_SAVE='jvds_echo_expeditions_v1';
function loadFlightJournal(){
  try{const p=JSON.parse(localStorage.getItem(FLIGHT_SAVE))||{};return {bestGates:Number.isFinite(p.bestGates)?Math.max(0,p.bestGates):0,fish:Number.isFinite(p.fish)?Math.max(0,p.fish):0,routes:Array.isArray(p.routes)?p.routes.filter(x=>FLIGHT_ROUTES[x]):[],kit:FLIGHT_KITS[p.kit]?p.kit:'glider'};}catch{return {bestGates:0,fish:0,routes:[],kit:'glider'};}
}
let flightJournal=loadFlightJournal();
function saveFlightJournal(){try{localStorage.setItem(FLIGHT_SAVE,JSON.stringify(flightJournal));}catch{}}
function renderFlightHangar(){
  const box=document.getElementById('flightLoadouts');box.replaceChildren();
  Object.entries(FLIGHT_KITS).forEach(([id,kit])=>{
    const b=document.createElement('button');b.type='button';b.className='flight-option';b.dataset.kit=id;b.setAttribute('aria-pressed',String(flightJournal.kit===id));
    const title=document.createElement('strong');title.textContent=kit.name;
    const text=document.createElement('span');text.textContent=kit.text;b.append(title,text);
    b.onclick=()=>{flightJournal.kit=id;saveFlightJournal();renderFlightHangar();document.querySelector('[data-kit="'+id+'"]').focus();};box.appendChild(b);
  });
  document.getElementById('flightJournal').textContent=flightJournal.bestGates?'Flight log: '+flightJournal.bestGates+' gates · '+flightJournal.routes.length+'/3 currents discovered · '+flightJournal.fish+' fish rescued':'Your flight log fills as you explore. All three equipment choices are available now.';
}
function beginExpedition(){
  flight={gates:0,fish:0,perfect:0,checkpoint:0,route:'reef',kit:{...FLIGHT_KITS[flightJournal.kit].kit},shield:flightJournal.kit==='guard'?1:0,invulnerable:0,shieldTime:0,slowTime:0,banked:false};
  document.getElementById('routeModal').classList.remove('show');
  updateFlightStrip();
}
function updateFlightStrip(){
  if(!flight)return;
  document.getElementById('flightRoute').textContent=FLIGHT_ROUTES[flight.route].name;
  document.getElementById('flightLeg').textContent='Gate '+flight.gates+' · next rest '+(8-flight.gates%8);
  const kit=[];if(flight.kit.glide)kit.push('Glider');if(flight.kit.guard)kit.push('Shield '+flight.shield);if(flight.kit.salvage)kit.push('Current chaser');if(flight.kit.magnet)kit.push('Magnet');
  document.getElementById('flightBuild').textContent=kit.join(' / ');
}
function tickExpedition(dt){
  flight.invulnerable=Math.max(0,flight.invulnerable-dt);
  flight.shieldTime=Math.max(0,flight.shieldTime-dt);flight.slowTime=Math.max(0,flight.slowTime-dt);
  activePowers.shield=flight.shieldTime>0;activePowers.slowmo=flight.slowTime>0;
}
function recordFlightGate(perfect){
  flight.gates++;
  if(perfect){flight.perfect++;if(flight.kit.guard&&flight.perfect%8===0){flight.shield=1;audioEffects.playPowerup();}}
  updateFlightStrip();
}
function absorbFlightHit(){
  if(flight.invulnerable>0)return true;
  if(!flight.shield&&!activePowers.shield)return false;
  if(activePowers.shield){activePowers.shield=false;flight.shieldTime=0;}else flight.shield--;
  flight.invulnerable=1.3;flashT=.12;shakeT=.18;shakeMag=4;audioEffects.playPowerup();updateFlightStrip();return true;
}
function openFlightRoutes(){
  if(state!=='playing')return;
  flight.checkpoint=flight.gates;state='route';
  const box=document.getElementById('routeOptions');box.replaceChildren();
  Object.entries(FLIGHT_ROUTES).forEach(([id,r])=>{
    const b=document.createElement('button');b.className='flight-option';b.dataset.route=id;b.type='button';
    const title=document.createElement('strong');title.textContent=r.title;
    const text=document.createElement('span');text.textContent=r.text;b.append(title,text);b.onclick=()=>chooseFlightRoute(id);box.appendChild(b);
  });
  document.getElementById('routeModal').classList.add('show');box.querySelector('button').focus();
}
function chooseFlightRoute(id){
  if(state!=='route'||!FLIGHT_ROUTES[id])return;
  flight.route=id;flight.kit[FLIGHT_ROUTES[id].gift]=true;
  if(id==='reef')flight.shield=1;
  if(!flightJournal.routes.includes(id))flightJournal.routes.push(id);
  flightJournal.bestGates=Math.max(flightJournal.bestGates,flight.gates);saveFlightJournal();
  // Start the new sector from a readable position with no leftover obstacles.
  pipes=[];collectibles=[];powerUps=[];distSinceSpawn=0;bird.y=H*.42;bird.vy=FLAP_V*.45;
  document.getElementById('routeModal').classList.remove('show');state='playing';last=performance.now();
  document.activeElement?.blur();canvas.focus();updateFlightStrip();
}
function finishExpedition(){
  if(!flight||flight.banked)return;flight.banked=true;
  flightJournal.bestGates=Math.max(flightJournal.bestGates,flight.gates);flightJournal.fish+=flight.fish;
  if(!flightJournal.routes.includes('reef'))flightJournal.routes.push('reef');saveFlightJournal();
  const next=flight.gates<8?'Reach eight gates to discover your first route choice.':flight.perfect<flight.gates/2?'Aim through the middle of the gates to build your perfect-pass streak.':'Try the thunder current with a magnet: reach its richer fish with less risk.';
  document.getElementById('flightDebrief').textContent=flight.gates+' gates · '+flight.perfect+' perfect passes · '+flight.fish+' fish. '+next;
}
function showFlightHangar(){
  clearTimeout(flightEndTimer);state='idle';document.getElementById('overModal').classList.remove('show');document.getElementById('routeModal').classList.remove('show');
  renderFlightHangar();document.getElementById('startModal').classList.add('show');
}
function drawFlightEquipment(){
  if(!flight)return;
  if(flight.shield||activePowers.shield||flight.invulnerable>0){ctx.save();ctx.strokeStyle=flight.invulnerable>0?'#fff':'#91fff2';ctx.lineWidth=2;ctx.shadowColor='#72e5db';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(bird.x,bird.y,birdR+8,0,Math.PI*2);ctx.stroke();ctx.restore();}
  if(flight.kit.magnet){ctx.save();ctx.strokeStyle='rgba(185,181,255,.35)';ctx.setLineDash([3,8]);ctx.beginPath();ctx.arc(bird.x,bird.y,birdR+17,0,Math.PI*2);ctx.stroke();ctx.restore();}
}
const flightPause=GameUI.autoPause({pause:()=>{if(state!=='playing')return false;state='paused';return true;},resume:()=>{if(state==='paused'){state='playing';last=performance.now();}}});
gameSystem.registerArcadeActions({restart:startGame,pause:()=>flightPause.toggle(),help:()=>{flightPause.pause();const hint=document.getElementById('tapHint');hint.textContent='Tap / Space: rise · P: pause · 8 gates: choose a route';hint.classList.add('show');}});
canvas.tabIndex=0;canvas.setAttribute('aria-label','Echo flight play area. Tap or press Space to rise; P pauses.');
// Route selection is a real pause; keyboard navigation must stay inside its choices.
document.getElementById('routeModal').addEventListener('keydown',e=>{if(e.key!=='Tab')return;const buttons=[...document.querySelectorAll('#routeOptions button')];const i=buttons.indexOf(document.activeElement);e.preventDefault();buttons[(i+(e.shiftKey?-1:1)+buttons.length)%buttons.length].focus();});
renderFlightHangar();
