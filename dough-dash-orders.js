/* Dough Dash: pantry planning and a six-order bakery shift. */
const DOUGH_ORDERS=[
 {id:'batch',name:'Quick cookie batch',needs:{'🍪':6},moves:2,points:80,note:'A small job for two extra moves. Keep the counter moving.'},
 {id:'cafe',name:'Cafe breakfast',needs:{'🧁':5,'🥐':5},moves:4,points:160,note:'A balanced order. Save leftover pastries for the next ticket.'},
 {id:'party',name:'Celebration box',needs:{'🍰':7,'🍩':7},moves:6,points:300,note:'A bigger commitment, with the strongest move and score reward.'}
];
let doughShift={pantry:{},served:0,stockUsed:0,order:null,finished:false};
function doughOrderReady(){return !!doughShift.order&&Object.entries(doughShift.order.needs).every(([tile,n])=>(doughShift.pantry[tile]||0)>=n);}
function startDoughShift(){MOVES_LIMIT=30;doughShift={pantry:{},served:0,stockUsed:0,order:null,finished:false};showDoughOrders();updateHud();}
function showDoughOrders(){
 state='orders';const box=document.getElementById('doughOrderChoices');box.replaceChildren();
 DOUGH_ORDERS.forEach(base=>{const b=document.createElement('button');b.type='button';b.className='dough-order';b.dataset.order=base.id;
 const title=document.createElement('strong');title.textContent=base.name;
 const desc=document.createElement('span');desc.textContent=Object.entries(base.needs).map(([t,n])=>t+' '+(n+Math.floor(doughShift.served/2))).join(' + ')+' · +'+base.moves+' moves · '+base.points+' points';
 const note=document.createElement('small');note.textContent=base.note;b.append(title,desc,note);b.onclick=()=>chooseDoughOrder(base.id);box.appendChild(b);});
 document.getElementById('orderTitle').textContent=doughShift.served?'Order '+(doughShift.served+1)+' of 6':'What will you bake?';
 document.getElementById('orderModal').classList.add('show');renderDoughTicket();box.querySelector('button').focus();
}
function chooseDoughOrder(id){
 if(state!=='orders')return;const base=DOUGH_ORDERS.find(o=>o.id===id);if(!base)return;
 doughShift.order={...base,needs:Object.fromEntries(Object.entries(base.needs).map(([t,n])=>[t,n+Math.floor(doughShift.served/2)]))};
 document.getElementById('orderModal').classList.remove('show');state='playing';renderDoughTicket();scheduleHint();
}
function stockDoughPantry(cells){
 for(const key of cells){const [r,c]=key.split(',').map(Number),tile=grid[r]?.[c]?.type;if(tile)doughShift.pantry[tile]=(doughShift.pantry[tile]||0)+1;}
 renderDoughTicket();
}
function renderDoughTicket(){
 const o=doughShift.order;document.getElementById('orderTicket').textContent=o?'Order '+(doughShift.served+1)+'/6 · '+o.name:'Choose a ticket for the counter';
 document.getElementById('orderPantry').textContent=o?Object.entries(o.needs).map(([t,n])=>t+' '+(doughShift.pantry[t]||0)+'/'+n).join('   '):TILES.map(t=>t+' '+(doughShift.pantry[t]||0)).join('   ');
 const b=document.getElementById('serveOrder');b.disabled=!doughOrderReady();b.textContent=doughOrderReady()?'Serve order · +'+o.moves+' moves':'Match the pastries on your ticket';
}
function serveDoughOrder(){
 if(state!=='playing'||busy||!doughOrderReady())return;
 const o=doughShift.order;for(const [t,n] of Object.entries(o.needs)){doughShift.pantry[t]-=n;doughShift.stockUsed+=n;}
 doughShift.served++;score+=o.points;MOVES_LIMIT+=o.moves;doughShift.order=null;updateHud();audioEffects.playLevelUp();
 if(doughShift.served===6){endGame();document.getElementById('endTitle').textContent='Counter cleared!';return;}
 showDoughOrders();
}
function finishDoughShift(){
 if(doughShift.finished)return;doughShift.finished=true;
 try{const previous=Number(localStorage.getItem('jvds_dough_best_orders'))||0;localStorage.setItem('jvds_dough_best_orders',String(Math.max(previous,doughShift.served)));}catch{}
}
gameSystem.registerArcadeActions({restart:startGame,help:()=>{document.getElementById('orderTicket').textContent='Choose a ticket, match its pastries, then Serve. Leftovers carry over. Clear six orders to win.';}});
document.getElementById('orderModal').addEventListener('keydown',e=>{if(e.key!=='Tab')return;const b=[...document.querySelectorAll('#doughOrderChoices button')],i=b.indexOf(document.activeElement);e.preventDefault();b[(i+(e.shiftKey?-1:1)+b.length)%b.length].focus();});
function useDoughSpecial(r,c){
 if(state!=='playing'||busy||moves>=MOVES_LIMIT)return;
 const special=grid[r]?.[c];if(!special?.special)return;
 const cells=new Set();
 for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
  if(grid[y][x]&&(special.special==='bomb'?Math.abs(y-r)<=1&&Math.abs(x-c)<=1:grid[y][x].type===special.type))cells.add(y+','+x);
 }
 busy=true;selected=null;moves++;stockDoughPantry(cells);score+=cells.size*15;
 cells.forEach(key=>{const[y,x]=key.split(',').map(Number);grid[y][x]=null;});
 audioEffects.playCombo(4);cascade();renderBoard();updateHud();
 doughLater(()=>{if(!resolveMatches(2)){busy=false;if(moves>=MOVES_LIMIT&&!doughOrderReady())endGame();else{reshuffleIfStuck();scheduleHint();}}},200);
}
