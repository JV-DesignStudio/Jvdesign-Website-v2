

// HELPERS
const SKIN=['#FDDBB4','#F4C28B','#D4956A','#A0614A','#7B4336','#4A2C1A'];
const HAIR=['#1a1a1a','#3d2314','#7b4a1e','#c8860f','#e8c44a','#d4d4d4','#f472b6','#6366f1','#10b981','#ef4444'];
const CLOTH=['#ef4444','#f97316','#f59e0b','#10b981','#3b82f6','#8b5cf6','#f472b6','#1e1e2e','#e5e7eb','#6b7280'];
const EYES=['#1a1a1a','#3b2a1a','#2a4a8a','#1a6a3a','#8a6a2a','#6a2a8a','#2a8a8a'];
const SCALE=['#10b981','#1a6a3a','#2a4a8a','#533483','#7B4336','#6b7280','#ef4444','#f59e0b'];
const WING=['#6b7280','#1a1a1a','#ef4444','#f59e0b','#3b82f6','#8b5cf6','#10b981','#ffffff'];
const BASE=192;
function R(x,y,w,h,r,c,col){c.fillStyle=col;c.beginPath();c.roundRect(x,y,w,h,r||0);c.fill();}
function T(c,x1,y1,x2,y2,x3,y3,col){c.fillStyle=col;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.lineTo(x3,y3);c.closePath();c.fill();}
function lk(h,a){let r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);return'#'+[Math.min(255,r+a),Math.min(255,g+a),Math.min(255,b+a)].map(v=>v.toString(16).padStart(2,'0')).join('');}
function dk(h,a){return lk(h,-a);}

// HUMANOID
function pBody(cx,cy,s,p){const bw=s*32,bh=s*36;let bx=cx-bw/2,by=cy-s*90;if(p==='crouch')by+=s*16;if(p==='jump')by-=s*14;return[bx,by,bw,bh];}
function pH(cx,cy,s,p){let hx=cx,hy=cy-s*110,hr=s*26;if(p==='crouch')hy+=s*22;if(p==='jump')hy-=s*14;if(p==='attack')hx+=s*6;return[hx,hy,hr];}
function pE(cx,cy,s,p){let ex=cx,ey=cy-s*114;if(p==='crouch')ey+=s*22;if(p==='jump')ey-=s*14;if(p==='attack')ex+=s*6;return[ex,ey];}
function pM(cx,cy,s,p){let mx=cx,my=cy-s*96;if(p==='crouch')my+=s*22;if(p==='jump')my-=s*14;if(p==='attack')mx+=s*6;return[mx,my];}

const H_BODY=[
  {name:'Normal', fn:(c,col,cx,cy,s,p)=>{const[bx,by,bw,bh]=pBody(cx,cy,s,p);R(bx,by,bw,bh,6,c,col);}},
  {name:'Wide',   fn:(c,col,cx,cy,s,p)=>{const[bx,by,bw,bh]=pBody(cx,cy,s,p);R(bx-s*4,by,bw+s*8,bh,8,c,col);}},
  {name:'Slim',   fn:(c,col,cx,cy,s,p)=>{const[bx,by,bw,bh]=pBody(cx,cy,s,p);R(bx+s*4,by,bw-s*8,bh,6,c,col);}},
  {name:'Armour', fn:(c,col,cx,cy,s,p)=>{const[bx,by,bw,bh]=pBody(cx,cy,s,p);R(bx,by,bw,bh,4,c,col);R(bx+s*4,by+s*4,bw-s*8,s*14,3,c,lk(col,40));R(bx-s*4,by-s*2,s*12,s*10,4,c,lk(col,20));R(bx+bw-s*8,by-s*2,s*12,s*10,4,c,lk(col,20));}},
  {name:'Dress',  fn:(c,col,cx,cy,s,p)=>{const[bx,by,bw,bh]=pBody(cx,cy,s,p);c.fillStyle=col;c.beginPath();c.moveTo(bx,by);c.lineTo(bx+bw,by);c.lineTo(bx+bw+s*10,by+bh);c.lineTo(bx-s*10,by+bh);c.closePath();c.fill();}},
  {name:'Robe',   fn:(c,col,cx,cy,s,p)=>{const[bx,by,bw,bh]=pBody(cx,cy,s,p);R(bx-s*6,by,bw+s*12,bh+s*10,8,c,col);R(cx-s*3,by,s*6,bh+s*10,4,c,lk(col,30));}}
];
const H_LEGS=[
  {name:'Normal', fn:(c,col,cx,cy,s,p)=>{const lw=s*12,lh=s*38,lx=cx-s*16,rx=cx+s*4;let ly=cy-s*54;if(p==='run'){R(lx,ly-s*8,lw,lh*.6,4,c,col);R(rx,ly,lw,lh*.8,4,c,col);}else if(p==='crouch'){R(lx,ly+s*16,lw,lh*.5,4,c,col);R(rx,ly+s*16,lw,lh*.5,4,c,col);}else if(p==='jump'){R(lx,ly+s*6,lw*.9,lh*.7,4,c,col);R(rx+s*4,ly+s*6,lw*.9,lh*.7,4,c,col);}else{R(lx,ly,lw,lh,4,c,col);R(rx,ly,lw,lh,4,c,col);}const d=dk(col,20);R(lx-s*2,cy-s*6,lw+s*4,s*10,5,c,d);R(rx-s*2,cy-s*6,lw+s*4,s*10,5,c,d);}},
  {name:'Wide',   fn:(c,col,cx,cy,s,p)=>{const lw=s*16,lh=s*38,lx=cx-s*19,rx=cx+s*3;let ly=cy-s*54;if(p==='crouch')ly+=s*16;R(lx,ly,lw,lh,5,c,col);R(rx,ly,lw,lh,5,c,col);const d=dk(col,20);R(lx-s*2,cy-s*6,lw+s*4,s*10,5,c,d);R(rx-s*2,cy-s*6,lw+s*4,s*10,5,c,d);}},
  {name:'Skirt',  fn:(c,col,cx,cy,s,p)=>{c.fillStyle=col;c.beginPath();c.moveTo(cx-s*20,cy-s*54);c.lineTo(cx+s*20,cy-s*54);c.lineTo(cx+s*28,cy-s*14);c.lineTo(cx-s*28,cy-s*14);c.closePath();c.fill();const d=dk(col,15);R(cx-s*14,cy-s*14,s*10,s*14,3,c,d);R(cx+s*4,cy-s*14,s*10,s*14,3,c,d);}},
  {name:'Shorts', fn:(c,col,cx,cy,s,p)=>{R(cx-s*18,cy-s*54,s*36,s*18,5,c,col);const d=dk(col,25);R(cx-s*14,cy-s*36,s*10,s*36,4,c,d);R(cx+s*4,cy-s*36,s*10,s*36,4,c,d);}},
  {name:'Armour', fn:(c,col,cx,cy,s,p)=>{R(cx-s*14,cy-s*54,s*12,s*38,4,c,col);R(cx+s*2,cy-s*54,s*12,s*38,4,c,col);const l=lk(col,25);R(cx-s*16,cy-s*42,s*14,s*14,3,c,l);R(cx+s*2,cy-s*42,s*14,s*14,3,c,l);}},
  {name:'None',   fn:()=>{}}
];
const H_HEAD=[
  {name:'Round',  fn:(c,col,cx,cy,s,p)=>{const[hx,hy,hr]=pH(cx,cy,s,p);c.fillStyle=col;c.beginPath();c.arc(hx,hy,hr,0,Math.PI*2);c.fill();}},
  {name:'Square', fn:(c,col,cx,cy,s,p)=>{const[hx,hy,hr]=pH(cx,cy,s,p);R(hx-hr,hy-hr,hr*2,hr*2,8,c,col);}},
  {name:'Oval',   fn:(c,col,cx,cy,s,p)=>{const[hx,hy,hr]=pH(cx,cy,s,p);c.fillStyle=col;c.beginPath();c.ellipse(hx,hy,hr*.8,hr,0,0,Math.PI*2);c.fill();}},
  {name:'Cat',    fn:(c,col,cx,cy,s,p)=>{const[hx,hy,hr]=pH(cx,cy,s,p);c.fillStyle=col;c.beginPath();c.arc(hx,hy,hr,0,Math.PI*2);c.fill();T(c,hx-hr*.5,hy-hr,hx-hr*.8,hy-hr-s*12,hx-hr*.1,hy-hr,col);T(c,hx+hr*.5,hy-hr,hx+hr*.1,hy-hr,hx+hr*.8,hy-hr-s*12,col);const l=lk(col,40);T(c,hx-hr*.55,hy-hr+s*2,hx-hr*.72,hy-hr-s*8,hx-hr*.2,hy-hr+s*2,l);T(c,hx+hr*.55,hy-hr+s*2,hx+hr*.2,hy-hr+s*2,hx+hr*.72,hy-hr-s*8,l);}},
  {name:'Robot',  fn:(c,col,cx,cy,s,p)=>{const[hx,hy,hr]=pH(cx,cy,s,p);R(hx-hr,hy-hr,hr*2,hr*2,4,c,col);R(hx-hr,hy-hr,hr*2,s*6,2,c,dk(col,30));c.fillStyle=lk(col,40);c.fillRect(hx-hr+s*4,hy+s*2,hr*2-s*8,s*4);}},
  {name:'Helmet', fn:(c,col,cx,cy,s,p)=>{const[hx,hy,hr]=pH(cx,cy,s,p);c.fillStyle=col;c.beginPath();c.arc(hx,hy,hr,0,Math.PI*2);c.fill();R(hx-hr,hy,hr*2,hr,0,c,col);R(hx-hr*.5,hy-hr*.7,hr,hr*.5,3,c,lk(col,30));}}
];
const H_EYES=[
  {name:'Dots',   fn:(c,col,cx,cy,s,p)=>{const[ex,ey]=pE(cx,cy,s,p);c.fillStyle=col;c.beginPath();c.arc(ex-s*8,ey,s*4,0,Math.PI*2);c.fill();c.beginPath();c.arc(ex+s*8,ey,s*4,0,Math.PI*2);c.fill();}},
  {name:'Round',  fn:(c,col,cx,cy,s,p)=>{const[ex,ey]=pE(cx,cy,s,p);c.fillStyle='white';c.beginPath();c.arc(ex-s*8,ey,s*7,0,Math.PI*2);c.fill();c.beginPath();c.arc(ex+s*8,ey,s*7,0,Math.PI*2);c.fill();c.fillStyle=col;c.beginPath();c.arc(ex-s*8,ey,s*4,0,Math.PI*2);c.fill();c.beginPath();c.arc(ex+s*8,ey,s*4,0,Math.PI*2);c.fill();}},
  {name:'Angry',  fn:(c,col,cx,cy,s,p)=>{const[ex,ey]=pE(cx,cy,s,p);c.fillStyle=col;c.beginPath();c.arc(ex-s*8,ey,s*5,0,Math.PI*2);c.fill();c.beginPath();c.arc(ex+s*8,ey,s*5,0,Math.PI*2);c.fill();c.strokeStyle=col;c.lineWidth=s*2.5;c.lineCap='round';c.beginPath();c.moveTo(ex-s*16,ey-s*8);c.lineTo(ex-s*2,ey-s*2);c.stroke();c.beginPath();c.moveTo(ex+s*16,ey-s*8);c.lineTo(ex+s*2,ey-s*2);c.stroke();}},
  {name:'Sleepy', fn:(c,col,cx,cy,s,p)=>{const[ex,ey]=pE(cx,cy,s,p);c.strokeStyle=col;c.lineWidth=s*3;c.lineCap='round';c.beginPath();c.arc(ex-s*8,ey+s*2,s*5,Math.PI,0);c.stroke();c.beginPath();c.arc(ex+s*8,ey+s*2,s*5,Math.PI,0);c.stroke();}},
  {name:'Shades', fn:(c,col,cx,cy,s,p)=>{const[ex,ey]=pE(cx,cy,s,p);R(ex-s*16,ey-s*6,s*14,s*10,4,c,col);R(ex+s*2,ey-s*6,s*14,s*10,4,c,col);c.strokeStyle=dk(col,20);c.lineWidth=s*2;c.beginPath();c.moveTo(ex-s*2,ey-s*2);c.lineTo(ex+s*2,ey-s*2);c.stroke();}},
  {name:'Cyclops',fn:(c,col,cx,cy,s,p)=>{const[ex,ey]=pE(cx,cy,s,p);c.fillStyle='white';c.beginPath();c.ellipse(ex,ey,s*12,s*8,0,0,Math.PI*2);c.fill();c.fillStyle=col;c.beginPath();c.arc(ex,ey,s*5,0,Math.PI*2);c.fill();}}
];
const H_MOUTH=[
  {name:'Smile',  fn:(c,col,cx,cy,s,p)=>{const[mx,my]=pM(cx,cy,s,p);c.strokeStyle=col;c.lineWidth=s*2.5;c.lineCap='round';c.beginPath();c.arc(mx,my-s*3,s*8,.2,Math.PI-.2);c.stroke();}},
  {name:'Grin',   fn:(c,col,cx,cy,s,p)=>{const[mx,my]=pM(cx,cy,s,p);c.fillStyle=col;c.beginPath();c.arc(mx,my-s*4,s*10,.1,Math.PI-.1);c.fill();R(mx-s*7,my-s*6,s*14,s*4,2,c,'white');}},
  {name:'Frown',  fn:(c,col,cx,cy,s,p)=>{const[mx,my]=pM(cx,cy,s,p);c.strokeStyle=col;c.lineWidth=s*2.5;c.lineCap='round';c.beginPath();c.arc(mx,my+s*5,s*8,Math.PI+.2,-.2);c.stroke();}},
  {name:'Serious',fn:(c,col,cx,cy,s,p)=>{const[mx,my]=pM(cx,cy,s,p);c.strokeStyle=col;c.lineWidth=s*2.5;c.lineCap='round';c.beginPath();c.moveTo(mx-s*8,my);c.lineTo(mx+s*8,my);c.stroke();}},
  {name:'Open',   fn:(c,col,cx,cy,s,p)=>{const[mx,my]=pM(cx,cy,s,p);c.fillStyle=col;c.beginPath();c.ellipse(mx,my,s*7,s*5,0,0,Math.PI*2);c.fill();R(mx-s*5,my-s*1,s*10,s*3,2,c,'white');}},
  {name:'None',   fn:()=>{}}
];
const H_HAIR=[
  {name:'Short',  fn:(c,col,cx,cy,s,p)=>{const[hx,hy,hr]=pH(cx,cy,s,p);c.fillStyle=col;c.beginPath();c.arc(hx,hy,hr+s*2,Math.PI,0);c.fill();R(hx-hr-s*2,hy,s*10,hr*.7,3,c,col);R(hx+hr-s*8,hy,s*10,hr*.7,3,c,col);}},
  {name:'Long',   fn:(c,col,cx,cy,s,p)=>{const[hx,hy,hr]=pH(cx,cy,s,p);c.fillStyle=col;c.beginPath();c.arc(hx,hy,hr+s*2,Math.PI,0);c.fill();R(hx-hr-s*2,hy,s*12,hr*2,5,c,col);R(hx+hr-s*10,hy,s*12,hr*2,5,c,col);R(hx-hr*.4,hy+hr,hr*.8,hr*1.5,3,c,col);}},
  {name:'Spiky',  fn:(c,col,cx,cy,s,p)=>{const[hx,hy,hr]=pH(cx,cy,s,p);c.fillStyle=col;c.beginPath();c.arc(hx,hy,hr+s*2,Math.PI,0);c.fill();for(let i=0;i<5;i++){const ax=hx-hr+i*(hr*.5);T(c,ax,hy-hr,ax+s*4,hy-hr-s*14-i*s*3,ax+s*8,hy-hr,col);}}},
  {name:'Bun',    fn:(c,col,cx,cy,s,p)=>{const[hx,hy,hr]=pH(cx,cy,s,p);c.fillStyle=col;c.beginPath();c.arc(hx,hy,hr+s*2,Math.PI,0);c.fill();c.beginPath();c.arc(hx,hy-hr-s*8,s*12,0,Math.PI*2);c.fill();}},
  {name:'Mohawk', fn:(c,col,cx,cy,s,p)=>{const[hx,hy,hr]=pH(cx,cy,s,p);c.fillStyle=col;for(let i=0;i<3;i++)R(hx-s*4,hy-hr-i*s*8,s*8,s*12,3,c,col);c.beginPath();c.arc(hx,hy,hr,Math.PI*.6,Math.PI*.4,true);c.fill();}},
  {name:'None',   fn:()=>{}}
];
const H_HAT=[
  {name:'Cap',    fn:(c,col,cx,cy,s,p)=>{const[hx,hy,hr]=pH(cx,cy,s,p);R(hx-hr-s*4,hy-s*4,hr*2+s*8,s*8,3,c,col);R(hx-hr*.7,hy-hr-s*10,hr*1.4,s*20,5,c,col);}},
  {name:'TopHat', fn:(c,col,cx,cy,s,p)=>{const[hx,hy,hr]=pH(cx,cy,s,p);R(hx-hr-s*6,hy-s*4,hr*2+s*12,s*8,2,c,col);R(hx-hr*.6,hy-hr-s*24,hr*1.2,s*28,3,c,col);}},
  {name:'Beanie', fn:(c,col,cx,cy,s,p)=>{const[hx,hy,hr]=pH(cx,cy,s,p);c.fillStyle=col;c.beginPath();c.arc(hx,hy,hr+s*2,Math.PI,0);c.fill();R(hx-hr-s*2,hy-s*4,hr*2+s*4,s*10,3,c,dk(col,20));c.fillStyle=lk(col,20);c.beginPath();c.arc(hx,hy-hr,s*6,0,Math.PI*2);c.fill();}},
  {name:'Crown',  fn:(c,col,cx,cy,s,p)=>{const[hx,hy,hr]=pH(cx,cy,s,p);R(hx-hr*.8,hy-hr-s*4,hr*1.6,s*24,0,c,col);[-.7,-.2,.2,.7].forEach(o=>{const tx=hx+hr*o;T(c,tx,hy-hr-s*4,tx,hy-hr-s*22,tx+s*6,hy-hr-s*4,col);});c.fillStyle='#ef4444';[-s*10,0,s*10].forEach(ox=>{c.beginPath();c.arc(hx+ox,hy-hr-s*16,s*4,0,Math.PI*2);c.fill();});}},
  {name:'Horns',  fn:(c,col,cx,cy,s,p)=>{const[hx,hy,hr]=pH(cx,cy,s,p);T(c,hx-hr*.6,hy-hr,hx-hr*.8,hy-hr-s*22,hx-hr*.2,hy-hr,col);T(c,hx+hr*.6,hy-hr,hx+hr*.2,hy-hr,hx+hr*.8,hy-hr-s*22,col);}},
  {name:'Halo',   fn:(c,col,cx,cy,s,p)=>{const[hx,hy,hr]=pH(cx,cy,s,p);c.strokeStyle=col;c.lineWidth=s*4;c.beginPath();c.ellipse(hx,hy-hr-s*8,hr*.8,s*6,0,0,Math.PI*2);c.stroke();}},
  {name:'None',   fn:()=>{}}
];
const H_WEAPON=[
  {name:'Sword',  fn:(c,col,cx,cy,s,p)=>{c.save();c.translate(cx+s*30,cy-s*80);c.rotate(p==='attack'?-.5:.3);R(-s*3,-s*50,s*6,s*70,2,c,col);R(-s*12,-s*14,s*24,s*6,2,c,dk(col,20));R(-s*4,-s*60,s*8,s*12,4,c,lk(col,30));c.restore();}},
  {name:'Staff',  fn:(c,col,cx,cy,s,p)=>{c.save();c.translate(cx+s*28,cy-s*20);R(-s*3,-s*110,s*6,s*110,3,c,col);c.beginPath();c.arc(0,-s*110,s*10,0,Math.PI*2);c.fillStyle=lk(col,50);c.fill();c.restore();}},
  {name:'Bow',    fn:(c,col,cx,cy,s,p)=>{c.save();c.translate(cx+s*28,cy-s*60);c.strokeStyle=col;c.lineWidth=s*4;c.lineCap='round';c.beginPath();c.arc(0,0,s*28,-.9,.9);c.stroke();c.strokeStyle=lk(col,40);c.lineWidth=s*1.5;c.beginPath();c.moveTo(s*20,-s*26);c.lineTo(s*20,s*26);c.stroke();c.restore();}},
  {name:'Wand',   fn:(c,col,cx,cy,s,p)=>{c.save();c.translate(cx+s*28,cy-s*70);c.rotate(p==='attack'?-.4:.2);R(-s*2.5,-s*50,s*5,s*65,2,c,col);c.fillStyle=lk(col,60);c.beginPath();c.arc(0,-s*52,s*8,0,Math.PI*2);c.fill();c.restore();}},
  {name:'Shield', fn:(c,col,cx,cy,s,p)=>{c.save();c.translate(cx-s*32,cy-s*80);c.fillStyle=col;c.beginPath();c.moveTo(0,-s*28);c.lineTo(s*18,-s*16);c.lineTo(s*18,s*14);c.lineTo(0,s*28);c.lineTo(-s*18,s*14);c.lineTo(-s*18,-s*16);c.closePath();c.fill();c.strokeStyle=dk(col,30);c.lineWidth=s*3;c.beginPath();c.moveTo(0,-s*20);c.lineTo(0,s*20);c.stroke();c.restore();}},
  {name:'Gun',    fn:(c,col,cx,cy,s,p)=>{c.save();c.translate(cx+s*26,cy-s*70);c.rotate(p==='attack'?-.2:0);R(-s*4,-s*8,s*28,s*14,4,c,col);R(s*20,-s*12,s*8,s*8,2,c,dk(col,20));c.restore();}},
  {name:'None',   fn:()=>{}}
];
const HUMANOID_PARTS=[
  {id:'body',  name:'Body',   icon:'&#x1FAB7;',colours:CLOTH,defaultColour:'#3b82f6',defaultVariant:0,variants:H_BODY},
  {id:'legs',  name:'Legs',   icon:'&#x1F9B5;',colours:CLOTH,defaultColour:'#1e1e2e',defaultVariant:0,variants:H_LEGS},
  {id:'head',  name:'Head',   icon:'&#x1F5E3;',colours:SKIN, defaultColour:'#FDDBB4',defaultVariant:0,variants:H_HEAD},
  {id:'eyes',  name:'Eyes',   icon:'&#x1F440;',colours:EYES, defaultColour:'#1a1a1a',defaultVariant:0,variants:H_EYES},
  {id:'mouth', name:'Mouth',  icon:'&#x1F444;',colours:['#cc3333','#ff6b6b','#1a1a1a','#fff','#f59e0b'],defaultColour:'#cc3333',defaultVariant:0,variants:H_MOUTH},
  {id:'hair',  name:'Hair',   icon:'&#x1F487;',colours:HAIR, defaultColour:'#3d2314',defaultVariant:0,variants:H_HAIR},
  {id:'hat',   name:'Hat',    icon:'&#x1F3A9;',colours:CLOTH,defaultColour:'#1e1e2e',defaultVariant:6,variants:H_HAT},
  {id:'weapon',name:'Weapon', icon:'&#x2694;', colours:['#aaaaaa','#c8a850','#cc3333','#3b82f6','#10b981'],defaultColour:'#aaaaaa',defaultVariant:6,variants:H_WEAPON},
];
const HUMANOID_ORDER=['legs','body','weapon','head','eyes','mouth','hair','hat'];
const HUMANOID_POSES=[{id:'idle',label:'&#x1F9CD; Idle'},{id:'jump',label:'&#x1F998; Jump'},{id:'run',label:'&#x1F3C3; Run'},{id:'crouch',label:'&#x1F986; Crouch'},{id:'attack',label:'&#x2694; Attack'}];
const HUMANOID_ARCH=[
  {id:'player',  label:'Player',     icon:'??',parts:{body:{v:0,c:'#3b82f6'},legs:{v:0,c:'#1e1e2e'},head:{v:0,c:'#FDDBB4'},eyes:{v:1,c:'#2a4a8a'},mouth:{v:0,c:'#cc3333'},hair:{v:0,c:'#3d2314'},hat:{v:6,c:'#1e1e2e'},weapon:{v:0,c:'#aaaaaa'}}},
  {id:'ally',    label:'Ally',       icon:'&#x1F91D;',parts:{body:{v:0,c:'#10b981'},legs:{v:0,c:'#1e1e2e'},head:{v:0,c:'#F4C28B'},eyes:{v:1,c:'#1a6a3a'},mouth:{v:0,c:'#cc3333'},hair:{v:0,c:'#c8860f'},hat:{v:6,c:'#1e1e2e'},weapon:{v:3,c:'#10b981'}}},
  {id:'grunt',   label:'Enemy Grunt',icon:'&#x1F4A2;',parts:{body:{v:1,c:'#ef4444'},legs:{v:1,c:'#7B4336'},head:{v:3,c:'#4A2C1A'},eyes:{v:2,c:'#ef4444'},mouth:{v:2,c:'#1a1a1a'},hair:{v:2,c:'#1a1a1a'},hat:{v:4,c:'#ef4444'},weapon:{v:0,c:'#aaaaaa'}}},
  {id:'miniboss',label:'Mini Boss',  icon:'&#x1F9DF;',parts:{body:{v:3,c:'#6b7280'},legs:{v:4,c:'#6b7280'},head:{v:1,c:'#4A2C1A'},eyes:{v:2,c:'#ef4444'},mouth:{v:1,c:'#1a1a1a'},hair:{v:5,c:'#1a1a1a'},hat:{v:3,c:'#c8a850'},weapon:{v:0,c:'#ef4444'}}},
  {id:'finalboss',label:'Final Boss',icon:'&#x1F479;',parts:{body:{v:1,c:'#1e1e2e'},legs:{v:0,c:'#1e1e2e'},head:{v:1,c:'#4A2C1A'},eyes:{v:5,c:'#ef4444'},mouth:{v:1,c:'#1a1a1a'},hair:{v:5,c:'#1a1a1a'},hat:{v:3,c:'#c8a850'},weapon:{v:0,c:'#8b00ff'}}},
  {id:'shop',    label:'Shopkeeper', icon:'&#x1F6CD;',parts:{body:{v:0,c:'#f59e0b'},legs:{v:0,c:'#3b82f6'},head:{v:0,c:'#F4C28B'},eyes:{v:1,c:'#3b2a1a'},mouth:{v:0,c:'#cc3333'},hair:{v:0,c:'#c8860f'},hat:{v:0,c:'#3d2314'},weapon:{v:6,c:'#aaaaaa'}}},
  {id:'quest',   label:'Quest Giver',icon:'&#x2753;', parts:{body:{v:4,c:'#8b5cf6'},legs:{v:2,c:'#2a1a3a'},head:{v:2,c:'#D4956A'},eyes:{v:1,c:'#6a2a8a'},mouth:{v:0,c:'#cc3333'},hair:{v:1,c:'#e8c44a'},hat:{v:5,c:'#e8c44a'},weapon:{v:3,c:'#8b5cf6'}}},
  {id:'villager',label:'Villager',   icon:'&#x1F9D1;',parts:{body:{v:0,c:'#f97316'},legs:{v:3,c:'#7b4a1e'},head:{v:0,c:'#F4C28B'},eyes:{v:0,c:'#3b2a1a'},mouth:{v:0,c:'#cc3333'},hair:{v:0,c:'#7b4a1e'},hat:{v:6,c:'#1e1e2e'},weapon:{v:6,c:'#aaaaaa'}}},
  {id:'warrior', label:'Warrior',    icon:'&#x2694;', parts:{body:{v:3,c:'#3b82f6'},legs:{v:4,c:'#1e1e2e'},head:{v:1,c:'#FDDBB4'},eyes:{v:2,c:'#1a1a1a'},mouth:{v:0,c:'#cc3333'},hair:{v:0,c:'#3d2314'},hat:{v:6,c:'#1e1e2e'},weapon:{v:0,c:'#aaaaaa'}}},
  {id:'mage',    label:'Mage',       icon:'&#x2728;', parts:{body:{v:5,c:'#6366f1'},legs:{v:5,c:'#2a1a3a'},head:{v:0,c:'#D4956A'},eyes:{v:5,c:'#6a2a8a'},mouth:{v:0,c:'#cc3333'},hair:{v:3,c:'#6366f1'},hat:{v:1,c:'#2a1a3a'},weapon:{v:1,c:'#8b5cf6'}}},
  {id:'rogue',   label:'Rogue',      icon:'&#x1F5E1;',parts:{body:{v:2,c:'#1e1e2e'},legs:{v:3,c:'#1e1e2e'},head:{v:0,c:'#A0614A'},eyes:{v:3,c:'#1a1a1a'},mouth:{v:3,c:'#cc3333'},hair:{v:4,c:'#1a1a1a'},hat:{v:0,c:'#1e1e2e'},weapon:{v:3,c:'#c8a850'}}},
  {id:'healer',  label:'Healer',     icon:'&#x1F48A;',parts:{body:{v:4,c:'#ffffff'},legs:{v:0,c:'#e5e7eb'},head:{v:2,c:'#FDDBB4'},eyes:{v:1,c:'#2a8a8a'},mouth:{v:0,c:'#ff6b6b'},hair:{v:1,c:'#e8c44a'},hat:{v:5,c:'#e8c44a'},weapon:{v:3,c:'#10b981'}}},
];

// CREATURE
const C_BODY=[
  {name:'Dragon', fn:(c,col,cx,cy,s,p)=>{R(cx-s*22,cy-s*90,s*44,s*46,12,c,col);R(cx-s*16,cy-s*50,s*32,s*16,6,c,dk(col,15));const l=lk(col,25);for(let i=0;i<4;i++)R(cx-s*18+i*s*9,cy-s*82,s*7,s*14,4,c,l);}},
  {name:'Slime',  fn:(c,col,cx,cy,s,p)=>{c.fillStyle=col;c.beginPath();c.ellipse(cx,cy-s*60,s*38,s*48,0,0,Math.PI*2);c.fill();c.fillStyle=lk(col,30);c.beginPath();c.ellipse(cx-s*10,cy-s*80,s*14,s*10,-.3,0,Math.PI*2);c.fill();}},
  {name:'Spider', fn:(c,col,cx,cy,s,p)=>{c.fillStyle=col;c.beginPath();c.ellipse(cx,cy-s*72,s*28,s*22,0,0,Math.PI*2);c.fill();for(let i=0;i<4;i++){c.strokeStyle=col;c.lineWidth=s*3;c.beginPath();c.moveTo(cx,cy-s*68);c.quadraticCurveTo(cx-s*50+i*s*12,cy-s*90,cx-s*60+i*s*18,cy-s*50);c.stroke();c.beginPath();c.moveTo(cx,cy-s*68);c.quadraticCurveTo(cx+s*50-i*s*12,cy-s*90,cx+s*60-i*s*18,cy-s*50);c.stroke();}}},
  {name:'Golem',  fn:(c,col,cx,cy,s,p)=>{R(cx-s*28,cy-s*96,s*56,s*54,4,c,col);R(cx-s*20,cy-s*86,s*40,s*34,3,c,dk(col,20));R(cx-s*8,cy-s*78,s*16,s*18,3,c,lk(col,20));}},
  {name:'Wisp',   fn:(c,col,cx,cy,s,p)=>{c.fillStyle=col;c.beginPath();c.arc(cx,cy-s*80,s*30,0,Math.PI*2);c.fill();const g=c.createRadialGradient(cx,cy-s*80,s*5,cx,cy-s*80,s*38);g.addColorStop(0,lk(col,50)+'cc');g.addColorStop(1,col+'00');c.fillStyle=g;c.beginPath();c.arc(cx,cy-s*80,s*38,0,Math.PI*2);c.fill();}},
  {name:'Mech',   fn:(c,col,cx,cy,s,p)=>{R(cx-s*26,cy-s*96,s*52,s*54,4,c,col);R(cx-s*22,cy-s*90,s*44,s*40,3,c,dk(col,20));R(cx-s*30,cy-s*84,s*14,s*28,4,c,col);R(cx+s*16,cy-s*84,s*14,s*28,4,c,col);R(cx-s*14,cy-s*96,s*28,s*10,2,c,lk(col,20));}}
];
const C_WINGS=[
  {name:'Bat',    fn:(c,col,cx,cy,s,p)=>{c.fillStyle=col;[[1,-1],[-1,1]].forEach(([d])=>{c.beginPath();c.moveTo(cx+d*s*10,cy-s*94);c.quadraticCurveTo(cx+d*s*60,cy-s*130,cx+d*s*72,cy-s*80);c.quadraticCurveTo(cx+d*s*54,cy-s*60,cx+d*s*10,cy-s*80);c.closePath();c.fill();});}},
  {name:'Feather',fn:(c,col,cx,cy,s,p)=>{[[-1],[1]].forEach(([d])=>{c.fillStyle=col;c.beginPath();c.moveTo(cx+d*s*10,cy-s*94);c.quadraticCurveTo(cx+d*s*55,cy-s*140,cx+d*s*65,cy-s*100);c.quadraticCurveTo(cx+d*s*45,cy-s*70,cx+d*s*10,cy-s*80);c.closePath();c.fill();c.strokeStyle=lk(col,20);c.lineWidth=s*1.5;for(let i=0;i<4;i++){c.beginPath();c.moveTo(cx+d*(s*18+i*s*8),cy-s*80-i*s*6);c.lineTo(cx+d*(s*42+i*s*4),cy-s*100-i*s*8);c.stroke();}});}},
  {name:'Dragon', fn:(c,col,cx,cy,s,p)=>{c.fillStyle=col;[[-1],[1]].forEach(([d])=>{c.beginPath();c.moveTo(cx+d*s*10,cy-s*90);c.lineTo(cx+d*s*72,cy-s*130);c.lineTo(cx+d*s*80,cy-s*60);c.lineTo(cx+d*s*55,cy-s*50);c.lineTo(cx+d*s*35,cy-s*90);c.closePath();c.fill();c.strokeStyle=dk(col,20);c.lineWidth=s*1.5;for(let i=1;i<4;i++){c.beginPath();c.moveTo(cx+d*s*10,cy-s*90);c.lineTo(cx+d*(s*72-i*s*15),cy-s*130+i*s*16);c.stroke();}});}},
  {name:'Fin',    fn:(c,col,cx,cy,s,p)=>{c.fillStyle=col;T(c,cx-s*10,cy-s*100,cx-s*50,cy-s*130,cx-s*14,cy-s*72,col);T(c,cx+s*10,cy-s*100,cx+s*50,cy-s*130,cx+s*14,cy-s*72,col);R(cx-s*4,cy-s*50,s*8,s*42,4,c,col);}},
  {name:'Aura',   fn:(c,col,cx,cy,s,p)=>{const g=c.createRadialGradient(cx,cy-s*80,s*10,cx,cy-s*80,s*70);g.addColorStop(0,col+'88');g.addColorStop(1,col+'00');c.fillStyle=g;c.beginPath();c.ellipse(cx,cy-s*80,s*70,s*55,0,0,Math.PI*2);c.fill();}},
  {name:'None',   fn:()=>{}}
];
const C_TAIL=[
  {name:'Spike',   fn:(c,col,cx,cy,s,p)=>{c.strokeStyle=col;c.lineWidth=s*8;c.lineCap='round';c.beginPath();c.moveTo(cx,cy-s*44);c.quadraticCurveTo(cx-s*30,cy-s*20,cx-s*44,cy+s*10);c.stroke();T(c,cx-s*50,cy+s*8,cx-s*40,cy+s*28,cx-s*30,cy+s*4,col);}},
  {name:'Fluffy',  fn:(c,col,cx,cy,s,p)=>{c.strokeStyle=col;c.lineWidth=s*10;c.lineCap='round';c.beginPath();c.moveTo(cx,cy-s*44);c.quadraticCurveTo(cx-s*28,cy-s*20,cx-s*36,cy+s*8);c.stroke();c.fillStyle=lk(col,20);c.beginPath();c.arc(cx-s*38,cy+s*14,s*14,0,Math.PI*2);c.fill();}},
  {name:'Scorpion',fn:(c,col,cx,cy,s,p)=>{c.strokeStyle=col;c.lineWidth=s*6;c.lineCap='round';c.beginPath();c.moveTo(cx,cy-s*44);c.quadraticCurveTo(cx+s*30,cy-s*24,cx+s*44,cy-s*60);c.stroke();T(c,cx+s*40,cy-s*72,cx+s*52,cy-s*58,cx+s*46,cy-s*48,lk(col,20));}},
  {name:'Lizard',  fn:(c,col,cx,cy,s,p)=>{c.strokeStyle=col;c.lineWidth=s*7;c.lineCap='round';c.beginPath();c.moveTo(cx,cy-s*44);c.bezierCurveTo(cx-s*20,cy-s*10,cx-s*40,cy,cx-s*50,cy+s*20);c.stroke();}},
  {name:'None',    fn:()=>{}}
];
const C_CLAWS=[
  {name:'Dragon',  fn:(c,col,cx,cy,s,p)=>{[[cx-s*34,-1],[cx+s*34,1]].forEach(([ax,d])=>{R(ax-s*6,cy-s*72,s*12,s*30,4,c,col);T(c,ax+d*s*2,cy-s*42,ax+d*s*10,cy-s*26,ax-d*s*4,cy-s*44,col);});}},
  {name:'Blades',  fn:(c,col,cx,cy,s,p)=>{[[cx-s*34,-1],[cx+s*34,1]].forEach(([ax,d])=>{R(ax-s*5,cy-s*72,s*10,s*28,3,c,col);for(let i=0;i<3;i++){T(c,ax+d*s*(2+i*4),cy-s*44,ax+d*s*(8+i*4),cy-s*30,ax+d*s*(i*4),cy-s*44,lk(col,20+i*10));}});}},
  {name:'Tentacle',fn:(c,col,cx,cy,s,p)=>{[[cx-s*30,-1],[cx+s*30,1]].forEach(([ax,d])=>{for(let i=0;i<3;i++){c.strokeStyle=col;c.lineWidth=s*(5-i);c.lineCap='round';c.beginPath();c.moveTo(ax,cy-s*66);c.quadraticCurveTo(ax+d*s*(10+i*8),cy-s*(50-i*6),ax+d*s*(20+i*10),cy-s*(36-i*8));c.stroke();}});}},
  {name:'Stumpy',  fn:(c,col,cx,cy,s,p)=>{R(cx-s*42,cy-s*76,s*14,s*22,6,c,col);R(cx+s*28,cy-s*76,s*14,s*22,6,c,col);}},
  {name:'None',    fn:()=>{}}
];
const C_HEAD=[
  {name:'Dragon',  fn:(c,col,cx,cy,s,p)=>{const hy=cy-s*115;c.fillStyle=col;c.beginPath();c.ellipse(cx,hy,s*28,s*22,0,0,Math.PI*2);c.fill();R(cx-s*10,hy+s*8,s*20,s*14,3,c,col);T(c,cx-s*20,hy-s*20,cx-s*26,hy-s*36,cx-s*10,hy-s*18,lk(col,20));T(c,cx+s*20,hy-s*20,cx+s*10,hy-s*18,cx+s*26,hy-s*36,lk(col,20));}},
  {name:'Wolf',    fn:(c,col,cx,cy,s,p)=>{const hy=cy-s*114;c.fillStyle=col;c.beginPath();c.arc(cx,hy,s*26,0,Math.PI*2);c.fill();T(c,cx-s*16,hy-s*22,cx-s*22,hy-s*38,cx-s*6,hy-s*20,col);T(c,cx+s*16,hy-s*22,cx+s*6,hy-s*20,cx+s*22,hy-s*38,col);c.fillStyle=lk(col,30);c.beginPath();c.ellipse(cx,hy+s*6,s*14,s*10,0,0,Math.PI*2);c.fill();}},
  {name:'Skull',   fn:(c,col,cx,cy,s,p)=>{const hy=cy-s*112;c.fillStyle=col;c.beginPath();c.arc(cx,hy,s*26,0,Math.PI*2);c.fill();R(cx-s*26,hy,s*52,s*14,3,c,col);const d=dk(col,40);c.fillStyle=d;c.beginPath();c.ellipse(cx-s*10,hy,s*8,s*10,0,0,Math.PI*2);c.fill();c.beginPath();c.ellipse(cx+s*10,hy,s*8,s*10,0,0,Math.PI*2);c.fill();for(let i=0;i<5;i++)R(cx-s*10+i*s*5,hy+s*12,s*4,s*8,2,c,d);}},
  {name:'Bug',     fn:(c,col,cx,cy,s,p)=>{const hy=cy-s*114;c.fillStyle=col;c.beginPath();c.ellipse(cx,hy,s*20,s*26,0,0,Math.PI*2);c.fill();c.strokeStyle=lk(col,20);c.lineWidth=s*2;for(let i=0;i<3;i++){c.beginPath();c.moveTo(cx-s*8,hy-s*18+i*s*4);c.lineTo(cx-s*28,hy-s*28+i*s*6);c.stroke();c.beginPath();c.moveTo(cx+s*8,hy-s*18+i*s*4);c.lineTo(cx+s*28,hy-s*28+i*s*6);c.stroke();}}},
  {name:'Orb',     fn:(c,col,cx,cy,s,p)=>{const hy=cy-s*112;const g=c.createRadialGradient(cx-s*8,hy-s*8,s*4,cx,hy,s*28);g.addColorStop(0,lk(col,50));g.addColorStop(1,col);c.fillStyle=g;c.beginPath();c.arc(cx,hy,s*28,0,Math.PI*2);c.fill();}},
  {name:'Cyclops', fn:(c,col,cx,cy,s,p)=>{const hy=cy-s*113;c.fillStyle=col;c.beginPath();c.arc(cx,hy,s*26,0,Math.PI*2);c.fill();R(cx-s*10,hy-s*6,s*20,s*12,4,c,'white');c.fillStyle='#ef4444';c.beginPath();c.arc(cx,hy,s*7,0,Math.PI*2);c.fill();c.fillStyle='#1a1a1a';c.beginPath();c.arc(cx,hy,s*4,0,Math.PI*2);c.fill();}}
];
const C_EYES=[
  {name:'Slit',    fn:(c,col,cx,cy,s,p)=>{const ey=cy-s*116;c.fillStyle='#ffe000';c.beginPath();c.ellipse(cx-s*9,ey,s*7,s*5,0,0,Math.PI*2);c.fill();c.beginPath();c.ellipse(cx+s*9,ey,s*7,s*5,0,0,Math.PI*2);c.fill();R(cx-s*11,ey-s*5,s*4,s*10,2,c,col);R(cx+s*7,ey-s*5,s*4,s*10,2,c,col);}},
  {name:'Glow',    fn:(c,col,cx,cy,s,p)=>{const ey=cy-s*116;[cx-s*9,cx+s*9].forEach(ex=>{const g=c.createRadialGradient(ex,ey,s,ex,ey,s*8);g.addColorStop(0,'white');g.addColorStop(.4,col);g.addColorStop(1,col+'00');c.fillStyle=g;c.beginPath();c.arc(ex,ey,s*8,0,Math.PI*2);c.fill();});}},
  {name:'Hollow',  fn:(c,col,cx,cy,s,p)=>{const ey=cy-s*116;c.fillStyle=dk(col,40);c.beginPath();c.ellipse(cx-s*9,ey,s*8,s*6,0,0,Math.PI*2);c.fill();c.beginPath();c.ellipse(cx+s*9,ey,s*8,s*6,0,0,Math.PI*2);c.fill();}},
  {name:'Compound',fn:(c,col,cx,cy,s,p)=>{const ey=cy-s*116;[[cx-s*9],[cx+s*9]].forEach(([ex])=>{R(ex-s*8,ey-s*6,s*16,s*12,3,c,col);for(let dy=0;dy<2;dy++) for(let dx=0;dx<3;dx++)R(ex-s*7+dx*s*5,ey-s*5+dy*s*5,s*4,s*4,1,c,lk(col,30));});}},
  {name:'None',    fn:()=>{}}
];
const C_MOUTH=[
  {name:'Fangs',   fn:(c,col,cx,cy,s,p)=>{const my=cy-s*100;c.fillStyle=col;c.beginPath();c.ellipse(cx,my,s*14,s*8,0,0,Math.PI*2);c.fill();c.fillStyle='white';T(c,cx-s*8,my-s*4,cx-s*4,my+s*6,cx-s*12,my+s*4,'white');T(c,cx+s*4,my+s*6,cx+s*12,my+s*4,cx+s*8,my-s*4,'white');}},
  {name:'Beak',    fn:(c,col,cx,cy,s,p)=>{T(c,cx-s*10,cy-s*100,cx+s*10,cy-s*100,cx,cy-s*86,col);}},
  {name:'Grin',    fn:(c,col,cx,cy,s,p)=>{c.strokeStyle=col;c.lineWidth=s*3;c.lineCap='round';c.beginPath();c.arc(cx,cy-s*104,s*12,.15,Math.PI-.15);c.stroke();}},
  {name:'Snout',   fn:(c,col,cx,cy,s,p)=>{const my=cy-s*100;c.fillStyle=lk(col,20);c.beginPath();c.ellipse(cx,my+s*2,s*12,s*8,0,0,Math.PI*2);c.fill();c.fillStyle=dk(col,20);c.beginPath();c.ellipse(cx-s*4,my,s*3,s*2,0,0,Math.PI*2);c.fill();c.beginPath();c.ellipse(cx+s*4,my,s*3,s*2,0,0,Math.PI*2);c.fill();}},
  {name:'None',    fn:()=>{}}
];
const CREATURE_PARTS=[
  {id:'body',  name:'Body',  icon:'&#x1F432;',colours:SCALE,defaultColour:'#10b981',defaultVariant:0,variants:C_BODY},
  {id:'wings', name:'Wings', icon:'&#x1F985;',colours:WING, defaultColour:'#6b7280',defaultVariant:5,variants:C_WINGS},
  {id:'tail',  name:'Tail',  icon:'&#x1F40D;',colours:SCALE,defaultColour:'#10b981',defaultVariant:0,variants:C_TAIL},
  {id:'claws', name:'Claws', icon:'&#x1F9B5;',colours:SCALE,defaultColour:'#1a6a3a',defaultVariant:0,variants:C_CLAWS},
  {id:'head',  name:'Head',  icon:'&#x1F5E3;',colours:SCALE,defaultColour:'#10b981',defaultVariant:0,variants:C_HEAD},
  {id:'eyes',  name:'Eyes',  icon:'&#x1F440;',colours:['#1a1a1a','#ef4444','#ffe000','#3b82f6','#10b981','#f472b6'],defaultColour:'#1a1a1a',defaultVariant:0,variants:C_EYES},
  {id:'mouth', name:'Mouth', icon:'&#x1F444;',colours:['#1a1a1a','#ef4444','#cc3333','#f59e0b'],defaultColour:'#1a1a1a',defaultVariant:0,variants:C_MOUTH},
];
const CREATURE_ORDER=['tail','body','claws','wings','head','eyes','mouth'];
const CREATURE_POSES=[{id:'idle',label:'&#x1F9CD; Idle'},{id:'attack',label:'&#x2694; Attack'},{id:'fly',label:'&#x1F985; Fly'}];
const CREATURE_ARCH=[
  {id:'dragon',  label:'Dragon',      icon:'&#x1F409;',parts:{body:{v:0,c:'#ef4444'},wings:{v:2,c:'#8b0000'},tail:{v:0,c:'#ef4444'},claws:{v:0,c:'#c8a850'},head:{v:0,c:'#ef4444'},eyes:{v:1,c:'#ffe000'},mouth:{v:0,c:'#1a1a1a'}}},
  {id:'ghost',   label:'Ghost',       icon:'&#x1F47B;',parts:{body:{v:4,c:'#aabbff'},wings:{v:4,c:'#aabbff'},tail:{v:3,c:'#aabbff'},claws:{v:3,c:'#aabbff'},head:{v:4,c:'#c8d8ff'},eyes:{v:3,c:'#1a1a1a'},mouth:{v:2,c:'#1a1a1a'}}},
  {id:'spider',  label:'Spider',      icon:'&#x1F577;',parts:{body:{v:2,c:'#1a1a1a'},wings:{v:5,c:'#1a1a1a'},tail:{v:3,c:'#1a1a1a'},claws:{v:2,c:'#1a1a1a'},head:{v:3,c:'#1a1a1a'},eyes:{v:1,c:'#ef4444'},mouth:{v:0,c:'#ef4444'}}},
  {id:'golem',   label:'Stone Golem', icon:'&#x1FAA8;',parts:{body:{v:3,c:'#6b7280'},wings:{v:5,c:'#6b7280'},tail:{v:3,c:'#6b7280'},claws:{v:0,c:'#4a4a4a'},head:{v:5,c:'#6b7280'},eyes:{v:2,c:'#ef4444'},mouth:{v:3,c:'#1a1a1a'}}},
  {id:'familiar',label:'Familiar',    icon:'&#x1F431;',parts:{body:{v:1,c:'#8b5cf6'},wings:{v:0,c:'#533483'},tail:{v:1,c:'#8b5cf6'},claws:{v:3,c:'#8b5cf6'},head:{v:1,c:'#8b5cf6'},eyes:{v:1,c:'#f472b6'},mouth:{v:2,c:'#8b5cf6'}}},
  {id:'wyrm',    label:'Wyrm',        icon:'&#x1F40D;',parts:{body:{v:1,c:'#10b981'},wings:{v:5,c:'#1a6a3a'},tail:{v:3,c:'#10b981'},claws:{v:3,c:'#1a6a3a'},head:{v:0,c:'#10b981'},eyes:{v:0,c:'#1a1a1a'},mouth:{v:3,c:'#1a6a3a'}}},
  {id:'mech_c',  label:'Mech Beast',  icon:'&#x1F916;',parts:{body:{v:5,c:'#aaaaaa'},wings:{v:5,c:'#6b7280'},tail:{v:0,c:'#aaaaaa'},claws:{v:1,c:'#aaaaaa'},head:{v:5,c:'#aaaaaa'},eyes:{v:1,c:'#3b82f6'},mouth:{v:3,c:'#3b82f6'}}},
  {id:'boss_c',  label:'Boss Monster',icon:'&#x1F47E;',parts:{body:{v:3,c:'#1e1e2e'},wings:{v:2,c:'#8b0000'},tail:{v:2,c:'#1e1e2e'},claws:{v:1,c:'#c8a850'},head:{v:2,c:'#1e1e2e'},eyes:{v:1,c:'#ef4444'},mouth:{v:0,c:'#ef4444'}}},
];

// CHIBI
const CH_BODY=[
  {name:'Round',  fn:(c,col,cx,cy,s,p)=>{R(cx-s*20,cy-s*66,s*40,s*30,10,c,col);}},
  {name:'Chubby', fn:(c,col,cx,cy,s,p)=>{R(cx-s*24,cy-s*66,s*48,s*34,12,c,col);}},
  {name:'Dress',  fn:(c,col,cx,cy,s,p)=>{c.fillStyle=col;c.beginPath();c.moveTo(cx-s*20,cy-s*66);c.lineTo(cx+s*20,cy-s*66);c.lineTo(cx+s*30,cy-s*32);c.lineTo(cx-s*30,cy-s*32);c.closePath();c.fill();}},
  {name:'Armour', fn:(c,col,cx,cy,s,p)=>{R(cx-s*20,cy-s*66,s*40,s*30,8,c,col);R(cx-s*14,cy-s*62,s*28,s*18,5,c,lk(col,30));}},
  {name:'Hoodie', fn:(c,col,cx,cy,s,p)=>{R(cx-s*22,cy-s*68,s*44,s*34,14,c,col);R(cx-s*8,cy-s*74,s*16,s*14,4,c,dk(col,15));}}
];
const CH_LEGS=[
  {name:'Normal', fn:(c,col,cx,cy,s,p)=>{R(cx-s*14,cy-s*36,s*10,s*26,5,c,col);R(cx+s*4,cy-s*36,s*10,s*26,5,c,col);}},
  {name:'Skirt',  fn:(c,col,cx,cy,s,p)=>{c.fillStyle=col;c.beginPath();c.moveTo(cx-s*18,cy-s*36);c.lineTo(cx+s*18,cy-s*36);c.lineTo(cx+s*22,cy-s*16);c.lineTo(cx-s*22,cy-s*16);c.closePath();c.fill();R(cx-s*12,cy-s*16,s*8,s*12,4,c,dk(col,15));R(cx+s*4,cy-s*16,s*8,s*12,4,c,dk(col,15));}},
  {name:'Chubby', fn:(c,col,cx,cy,s,p)=>{R(cx-s*16,cy-s*36,s*13,s*28,6,c,col);R(cx+s*3,cy-s*36,s*13,s*28,6,c,col);}},
  {name:'None',   fn:()=>{}}
];
const CH_HEAD=[
  {name:'Round',  fn:(c,col,cx,cy,s,p)=>{c.fillStyle=col;c.beginPath();c.arc(cx,cy-s*110,s*40,0,Math.PI*2);c.fill();}},
  {name:'Cat',    fn:(c,col,cx,cy,s,p)=>{c.fillStyle=col;c.beginPath();c.arc(cx,cy-s*110,s*40,0,Math.PI*2);c.fill();T(c,cx-s*24,cy-s*146,cx-s*34,cy-s*162,cx-s*10,cy-s*148,col);T(c,cx+s*24,cy-s*146,cx+s*10,cy-s*148,cx+s*34,cy-s*162,col);}},
  {name:'Square', fn:(c,col,cx,cy,s,p)=>{R(cx-s*38,cy-s*148,s*76,s*76,14,c,col);}},
  {name:'Chubby', fn:(c,col,cx,cy,s,p)=>{c.fillStyle=col;c.beginPath();c.ellipse(cx,cy-s*108,s*44,s*38,0,0,Math.PI*2);c.fill();}}
];
const CH_EYES=[
  {name:'Sparkle',fn:(c,col,cx,cy,s,p)=>{const ey=cy-s*112;[[cx-s*14],[cx+s*14]].forEach(([ex])=>{c.fillStyle='white';c.beginPath();c.arc(ex,ey,s*10,0,Math.PI*2);c.fill();c.fillStyle=col;c.beginPath();c.arc(ex,ey,s*6,0,Math.PI*2);c.fill();c.fillStyle='white';c.beginPath();c.arc(ex+s*3,ey-s*3,s*3,0,Math.PI*2);c.fill();});}},
  {name:'X Eyes', fn:(c,col,cx,cy,s,p)=>{const ey=cy-s*112;[[cx-s*14],[cx+s*14]].forEach(([ex])=>{c.strokeStyle=col;c.lineWidth=s*3;c.lineCap='round';c.beginPath();c.moveTo(ex-s*6,ey-s*6);c.lineTo(ex+s*6,ey+s*6);c.stroke();c.beginPath();c.moveTo(ex+s*6,ey-s*6);c.lineTo(ex-s*6,ey+s*6);c.stroke();});}},
  {name:'Dots',   fn:(c,col,cx,cy,s,p)=>{const ey=cy-s*112;c.fillStyle=col;c.beginPath();c.arc(cx-s*14,ey,s*5,0,Math.PI*2);c.fill();c.beginPath();c.arc(cx+s*14,ey,s*5,0,Math.PI*2);c.fill();}},
  {name:'Happy',  fn:(c,col,cx,cy,s,p)=>{const ey=cy-s*112;c.strokeStyle=col;c.lineWidth=s*3;c.lineCap='round';[[cx-s*14],[cx+s*14]].forEach(([ex])=>{c.beginPath();c.arc(ex,ey+s*3,s*7,Math.PI,0);c.stroke();});}}
];
const CH_MOUTH=[
  {name:'Smile',  fn:(c,col,cx,cy,s,p)=>{c.strokeStyle=col;c.lineWidth=s*3;c.lineCap='round';c.beginPath();c.arc(cx,cy-s*90,s*10,.2,Math.PI-.2);c.stroke();}},
  {name:'Uwu',    fn:(c,col,cx,cy,s,p)=>{const my=cy-s*88;c.strokeStyle=col;c.lineWidth=s*3;c.lineCap='round';c.beginPath();c.moveTo(cx-s*8,my);c.quadraticCurveTo(cx-s*5,my+s*5,cx,my);c.stroke();c.beginPath();c.moveTo(cx,my);c.quadraticCurveTo(cx+s*5,my+s*5,cx+s*8,my);c.stroke();}},
  {name:'Open',   fn:(c,col,cx,cy,s,p)=>{c.fillStyle=col;c.beginPath();c.ellipse(cx,cy-s*88,s*8,s*6,0,0,Math.PI*2);c.fill();}},
  {name:'None',   fn:()=>{}}
];
const CH_HAIR=[
  {name:'Fluffy', fn:(c,col,cx,cy,s,p)=>{const hy=cy-s*110;c.fillStyle=col;c.beginPath();c.arc(cx,hy,s*44,Math.PI,0);c.fill();for(let i=0;i<5;i++){c.beginPath();c.arc(cx-s*32+i*s*16,hy-s*38,s*14,0,Math.PI*2);c.fill();}}},
  {name:'Pigtail',fn:(c,col,cx,cy,s,p)=>{const hy=cy-s*110;c.fillStyle=col;c.beginPath();c.arc(cx,hy,s*42,Math.PI,0);c.fill();R(cx-s*48,hy-s*14,s*18,s*28,8,c,col);R(cx+s*30,hy-s*14,s*18,s*28,8,c,col);}},
  {name:'Spiky',  fn:(c,col,cx,cy,s,p)=>{const hy=cy-s*110;c.fillStyle=col;c.beginPath();c.arc(cx,hy,s*42,Math.PI,0);c.fill();for(let i=0;i<5;i++){const ax=cx-s*30+i*s*15;T(c,ax,hy-s*40,ax+s*5,hy-s*60-i*s*4,ax+s*10,hy-s*40,col);}}},
  {name:'Bun',    fn:(c,col,cx,cy,s,p)=>{const hy=cy-s*110;c.fillStyle=col;c.beginPath();c.arc(cx,hy,s*42,Math.PI,0);c.fill();c.beginPath();c.arc(cx,hy-s*44,s*18,0,Math.PI*2);c.fill();}},
  {name:'None',   fn:()=>{}}
];
const CH_HAT=[
  {name:'Party',  fn:(c,col,cx,cy,s,p)=>{const hy=cy-s*148;T(c,cx-s*24,hy,cx+s*24,hy,cx,hy-s*36,col);c.fillStyle=lk(col,40);c.beginPath();c.arc(cx,hy-s*38,s*4,0,Math.PI*2);c.fill();}},
  {name:'Crown',  fn:(c,col,cx,cy,s,p)=>{const hy=cy-s*150;R(cx-s*28,hy,s*56,s*16,2,c,col);[-.6,-.2,.2,.6].forEach(o=>{const tx=cx+s*28*o;T(c,tx,hy,tx,hy-s*18,tx+s*7,hy,col);});c.fillStyle='#ef4444';[-s*14,0,s*14].forEach(ox=>{c.beginPath();c.arc(cx+ox,hy-s*10,s*4,0,Math.PI*2);c.fill();});}},
  {name:'Bow',    fn:(c,col,cx,cy,s,p)=>{const hy=cy-s*152;T(c,cx-s*4,hy,cx-s*24,hy-s*16,cx-s*20,hy+s*4,col);T(c,cx+s*4,hy,cx+s*20,hy-s*16,cx+s*24,hy+s*4,col);R(cx-s*4,hy-s*4,s*8,s*8,4,c,lk(col,20));}},
  {name:'None',   fn:()=>{}}
];
const CHIBI_PARTS=[
  {id:'body',  name:'Body',  icon:'&#x1F423;',colours:CLOTH,defaultColour:'#f472b6',defaultVariant:0,variants:CH_BODY},
  {id:'legs',  name:'Legs',  icon:'&#x1F9B5;',colours:CLOTH,defaultColour:'#3b82f6',defaultVariant:0,variants:CH_LEGS},
  {id:'head',  name:'Head',  icon:'&#x1F5E3;',colours:SKIN, defaultColour:'#FDDBB4',defaultVariant:0,variants:CH_HEAD},
  {id:'eyes',  name:'Eyes',  icon:'&#x1F440;',colours:EYES, defaultColour:'#3b2a1a',defaultVariant:0,variants:CH_EYES},
  {id:'mouth', name:'Mouth', icon:'&#x1F444;',colours:['#cc3333','#ff6b6b','#f472b6'],defaultColour:'#cc3333',defaultVariant:0,variants:CH_MOUTH},
  {id:'hair',  name:'Hair',  icon:'&#x1F487;',colours:HAIR, defaultColour:'#3d2314',defaultVariant:0,variants:CH_HAIR},
  {id:'hat',   name:'Hat',   icon:'&#x1F3A9;',colours:CLOTH,defaultColour:'#f472b6',defaultVariant:3,variants:CH_HAT},
];
const CHIBI_ORDER=['legs','body','head','eyes','mouth','hair','hat'];
const CHIBI_POSES=[{id:'idle',label:'&#x1F600; Happy'},{id:'sad',label:'&#x1F62D; Sad'},{id:'run',label:'&#x1F3C3; Run'}];
const CHIBI_ARCH=[
  {id:'hero_c',   label:'Tiny Hero',  icon:'&#x2764;', parts:{body:{v:0,c:'#3b82f6'},legs:{v:0,c:'#1e1e2e'},head:{v:0,c:'#FDDBB4'},eyes:{v:0,c:'#2a4a8a'},mouth:{v:0,c:'#cc3333'},hair:{v:0,c:'#3d2314'},hat:{v:3,c:'#f472b6'}}},
  {id:'witch_c',  label:'Witch',      icon:'&#x1F9D9;',parts:{body:{v:0,c:'#1e1e2e'},legs:{v:0,c:'#1e1e2e'},head:{v:0,c:'#D4956A'},eyes:{v:0,c:'#6a2a8a'},mouth:{v:0,c:'#cc3333'},hair:{v:0,c:'#1a1a1a'},hat:{v:1,c:'#1e1e2e'}}},
  {id:'cat_c',    label:'Cat Kid',    icon:'&#x1F431;',parts:{body:{v:4,c:'#f59e0b'},legs:{v:0,c:'#f59e0b'},head:{v:1,c:'#F4C28B'},eyes:{v:0,c:'#1a6a3a'},mouth:{v:1,c:'#cc3333'},hair:{v:0,c:'#3d2314'},hat:{v:3,c:'#f472b6'}}},
  {id:'princess', label:'Princess',   icon:'&#x1F478;',parts:{body:{v:2,c:'#f472b6'},legs:{v:1,c:'#f472b6'},head:{v:0,c:'#FDDBB4'},eyes:{v:0,c:'#8b5cf6'},mouth:{v:0,c:'#f472b6'},hair:{v:1,c:'#e8c44a'},hat:{v:1,c:'#c8a850'}}},
  {id:'knight_c', label:'Knight',     icon:'&#x1F6E1;',parts:{body:{v:3,c:'#6b7280'},legs:{v:2,c:'#6b7280'},head:{v:2,c:'#aaaaaa'},eyes:{v:2,c:'#1a1a1a'},mouth:{v:3,c:'#1a1a1a'},hair:{v:4,c:'#1a1a1a'},hat:{v:3,c:'#f472b6'}}},
  {id:'mage_c',   label:'Mage',       icon:'&#x2728;', parts:{body:{v:0,c:'#8b5cf6'},legs:{v:0,c:'#2a1a3a'},head:{v:0,c:'#FDDBB4'},eyes:{v:0,c:'#6a2a8a'},mouth:{v:0,c:'#cc3333'},hair:{v:2,c:'#6366f1'},hat:{v:0,c:'#2a1a3a'}}},
];

// TOP-DOWN
const TD_BODY=[
  {name:'Circle',   fn:(c,col,cx,cy,s,p)=>{c.fillStyle=col;c.beginPath();c.arc(cx,cy-s*20,s*36,0,Math.PI*2);c.fill();c.fillStyle=dk(col,25);c.beginPath();c.arc(cx,cy-s*20,s*28,0,Math.PI*2);c.fill();}},
  {name:'Square',   fn:(c,col,cx,cy,s,p)=>{R(cx-s*34,cy-s*52,s*68,s*64,8,c,col);R(cx-s*26,cy-s*44,s*52,s*48,6,c,dk(col,25));}},
  {name:'Armoured', fn:(c,col,cx,cy,s,p)=>{c.fillStyle=col;c.beginPath();c.arc(cx,cy-s*20,s*36,0,Math.PI*2);c.fill();const l=lk(col,20);R(cx-s*24,cy-s*38,s*48,s*14,4,c,l);R(cx-s*28,cy-s*26,s*14,s*24,4,c,l);R(cx+s*14,cy-s*26,s*14,s*24,4,c,l);}},
  {name:'Robe',     fn:(c,col,cx,cy,s,p)=>{c.fillStyle=col;c.beginPath();c.ellipse(cx,cy-s*20,s*40,s*38,0,0,Math.PI*2);c.fill();c.fillStyle=lk(col,20);c.beginPath();c.moveTo(cx,cy-s*20);c.lineTo(cx-s*8,cy-s*54);c.lineTo(cx+s*8,cy-s*54);c.closePath();c.fill();}},
  {name:'Mech',     fn:(c,col,cx,cy,s,p)=>{R(cx-s*32,cy-s*52,s*64,s*64,6,c,col);R(cx-s*24,cy-s*44,s*48,s*48,4,c,dk(col,20));R(cx-s*8,cy-s*48,s*16,s*10,3,c,lk(col,30));}}
];
const TD_HEAD=[
  {name:'Helmet', fn:(c,col,cx,cy,s,p)=>{c.fillStyle=col;c.beginPath();c.arc(cx,cy-s*66,s*24,0,Math.PI*2);c.fill();R(cx-s*24,cy-s*74,s*48,s*8,3,c,dk(col,20));c.fillStyle=lk(col,20);c.beginPath();c.arc(cx,cy-s*66,s*14,0,Math.PI*2);c.fill();}},
  {name:'Hood',   fn:(c,col,cx,cy,s,p)=>{c.fillStyle=col;c.beginPath();c.arc(cx,cy-s*66,s*26,0,Math.PI*2);c.fill();c.fillStyle=dk(col,30);c.beginPath();c.ellipse(cx,cy-s*66,s*16,s*20,0,0,Math.PI*2);c.fill();}},
  {name:'Crown',  fn:(c,col,cx,cy,s,p)=>{c.fillStyle=col;c.beginPath();c.arc(cx,cy-s*66,s*24,0,Math.PI*2);c.fill();[0,1,2,3,4].forEach(i=>{const a=i/5*Math.PI*2-Math.PI/2;c.fillStyle='#f59e0b';c.beginPath();c.arc(cx+Math.cos(a)*s*22,cy-s*66+Math.sin(a)*s*22,s*4,0,Math.PI*2);c.fill();});}},
  {name:'Hair',   fn:(c,col,cx,cy,s,p)=>{c.fillStyle=col;c.beginPath();c.arc(cx,cy-s*66,s*26,0,Math.PI*2);c.fill();c.fillStyle=lk(col,20);c.beginPath();c.arc(cx,cy-s*74,s*20,Math.PI,0);c.fill();}},
  {name:'Bare',   fn:(c,col,cx,cy,s,p)=>{c.fillStyle=col;c.beginPath();c.arc(cx,cy-s*66,s*22,0,Math.PI*2);c.fill();}}
];
const TD_SHADOW=[
  {name:'Round',  fn:(c,col,cx,cy,s,p)=>{c.fillStyle='rgba(0,0,0,0.25)';c.beginPath();c.ellipse(cx,cy,s*32,s*14,0,0,Math.PI*2);c.fill();}},
  {name:'Square', fn:(c,col,cx,cy,s,p)=>{R(cx-s*30,cy-s*8,s*60,s*20,6,c,'rgba(0,0,0,0.2)');}},
  {name:'None',   fn:()=>{}}
];
const TD_WEAPON=[
  {name:'Sword',  fn:(c,col,cx,cy,s,p)=>{c.save();c.translate(cx+s*28,cy-s*40);c.rotate(p==='attack'?-.8:-.4);R(-s*2,-s*38,s*5,s*50,2,c,col);R(-s*8,-s*10,s*18,s*5,2,c,dk(col,20));c.restore();}},
  {name:'Staff',  fn:(c,col,cx,cy,s,p)=>{c.save();c.translate(cx+s*28,cy-s*30);c.rotate(-.3);R(-s*2,-s*54,s*5,s*60,3,c,col);c.fillStyle=lk(col,40);c.beginPath();c.arc(0,-s*54,s*7,0,Math.PI*2);c.fill();c.restore();}},
  {name:'Gun',    fn:(c,col,cx,cy,s,p)=>{c.save();c.translate(cx+s*26,cy-s*44);c.rotate(p==='attack'?-.2:.1);R(-s*2,-s*6,s*22,s*10,3,c,col);R(s*18,-s*10,s*6,s*6,2,c,dk(col,20));c.restore();}},
  {name:'Bow',    fn:(c,col,cx,cy,s,p)=>{c.save();c.translate(cx+s*26,cy-s*44);c.strokeStyle=col;c.lineWidth=s*3;c.lineCap='round';c.beginPath();c.arc(0,0,s*20,-.8,.8);c.stroke();c.restore();}},
  {name:'None',   fn:()=>{}}
];
const TD_INDICATOR=[
  {name:'Arrow',  fn:(c,col,cx,cy,s,p)=>{c.fillStyle=col;T(c,cx,cy-s*52,cx-s*8,cy-s*38,cx+s*8,cy-s*38,col);}},
  {name:'Dot',    fn:(c,col,cx,cy,s,p)=>{c.fillStyle=col;c.beginPath();c.arc(cx,cy-s*52,s*5,0,Math.PI*2);c.fill();}},
  {name:'None',   fn:()=>{}}
];
const TOPDOWN_PARTS=[
  {id:'shadow',   name:'Shadow',   icon:'&#x26AB;',colours:['#000000','#333333'],defaultColour:'#000000',defaultVariant:0,variants:TD_SHADOW},
  {id:'body',     name:'Body',     icon:'&#x1F4F9;',colours:CLOTH,defaultColour:'#3b82f6',defaultVariant:0,variants:TD_BODY},
  {id:'head',     name:'Head',     icon:'&#x1F5E3;',colours:CLOTH,defaultColour:'#6b7280',defaultVariant:0,variants:TD_HEAD},
  {id:'weapon',   name:'Weapon',   icon:'&#x2694;', colours:['#aaaaaa','#c8a850','#3b82f6','#10b981'],defaultColour:'#aaaaaa',defaultVariant:4,variants:TD_WEAPON},
  {id:'indicator',name:'Direction',icon:'&#x2B06;', colours:['#ef4444','#f59e0b','#10b981','#3b82f6','#ffffff'],defaultColour:'#ffffff',defaultVariant:0,variants:TD_INDICATOR},
];
const TOPDOWN_ORDER=['shadow','body','weapon','head','indicator'];
const TOPDOWN_POSES=[{id:'idle',label:'&#x2B06; North'},{id:'south',label:'&#x2B07; South'},{id:'east',label:'&#x27A1; East'},{id:'attack',label:'&#x2694; Attack'}];
const TOPDOWN_ARCH=[
  {id:'td_player',label:'Player',  icon:'??',parts:{shadow:{v:0,c:'#000000'},body:{v:0,c:'#3b82f6'},head:{v:0,c:'#6b7280'},weapon:{v:0,c:'#aaaaaa'},indicator:{v:0,c:'#ffffff'}}},
  {id:'td_grunt', label:'Enemy',   icon:'&#x1F4A2;',parts:{shadow:{v:0,c:'#000000'},body:{v:0,c:'#ef4444'},head:{v:1,c:'#1e1e2e'},weapon:{v:4,c:'#aaaaaa'},indicator:{v:1,c:'#ef4444'}}},
  {id:'td_boss',  label:'Boss',    icon:'&#x1F479;',parts:{shadow:{v:1,c:'#000000'},body:{v:2,c:'#1e1e2e'},head:{v:2,c:'#c8a850'},weapon:{v:0,c:'#ef4444'},indicator:{v:1,c:'#ef4444'}}},
  {id:'td_mage',  label:'Mage',    icon:'&#x2728;', parts:{shadow:{v:0,c:'#000000'},body:{v:3,c:'#8b5cf6'},head:{v:1,c:'#2a1a3a'},weapon:{v:1,c:'#8b5cf6'},indicator:{v:0,c:'#f472b6'}}},
  {id:'td_npc',   label:'NPC',     icon:'&#x1F6CD;',parts:{shadow:{v:0,c:'#000000'},body:{v:0,c:'#f59e0b'},head:{v:4,c:'#F4C28B'},weapon:{v:4,c:'#aaaaaa'},indicator:{v:1,c:'#f59e0b'}}},
  {id:'td_mech',  label:'Mech',    icon:'&#x1F916;',parts:{shadow:{v:1,c:'#000000'},body:{v:4,c:'#aaaaaa'},head:{v:0,c:'#6b7280'},weapon:{v:2,c:'#3b82f6'},indicator:{v:1,c:'#3b82f6'}}},
];

const CHARACTER_TEMPLATES={
  humanoid:{parts:HUMANOID_PARTS,order:HUMANOID_ORDER,poses:HUMANOID_POSES,arch:HUMANOID_ARCH,label:'Humanoid Preview'},
  creature:{parts:CREATURE_PARTS,order:CREATURE_ORDER,poses:CREATURE_POSES,arch:CREATURE_ARCH,label:'Creature Preview'},
  chibi:   {parts:CHIBI_PARTS,   order:CHIBI_ORDER,   poses:CHIBI_POSES,   arch:CHIBI_ARCH,   label:'Chibi Preview'},
  topdown: {parts:TOPDOWN_PARTS, order:TOPDOWN_ORDER, poses:TOPDOWN_POSES, arch:TOPDOWN_ARCH, label:'Top-Down Preview'},
};

// STATE
let currentTemplate='humanoid';
let charState={},currentPart=null,currentPose='idle',charBg='transparent',activeArchetype=null;
let charCanvasUnified,cctxUnified,saveSlots=JSON.parse(localStorage.getItem('jvds_chars')||'[]');
const BG_OPTIONS=[
  {val:'transparent',style:'repeating-conic-gradient(#333 0% 25%,#222 0% 50%) 0 0/12px 12px'},
  {val:'#1a2a4a',style:'#1a2a4a'},{val:'#1a3a2a',style:'#1a3a2a'},{val:'#2a1a3a',style:'#2a1a3a'},
  {val:'#ffffff',style:'#ffffff'},{val:'#111',style:'#111'},
];
function tpl(){return CHARACTER_TEMPLATES[currentTemplate];}
function normalizeState(st){const ns={};tpl().parts.forEach(p=>{const s=st?st[p.id]:null;const v=(s&&Number.isInteger(s.variant)&&s.variant>=0&&s.variant<p.variants.length)?s.variant:p.defaultVariant;const c=(s&&typeof s.colour==='string'&&/^#[0-9a-fA-F]{6}$/.test(s.colour))?s.colour:p.defaultColour;ns[p.id]={variant:v,colour:c};});return ns;}
function initCharState(){charState=normalizeState(null);currentPart=tpl().parts[0].id;currentPose=tpl().poses[0].id;activeArchetype=null;}
function switchTemplate(id,btn){currentTemplate=id;document.querySelectorAll('.tpl-btn').forEach(b=>b.classList.remove('on'));btn.classList.add('on');document.getElementById('tplLabel').innerHTML=tpl().label;initCharState();buildAll();renderCharacter();showToast('Switched to '+tpl().label);}
function renderCharacter(){
  cctxUnified.clearRect(0,0,BASE,BASE);
  if(charBg!=='transparent'){cctxUnified.fillStyle=charBg;cctxUnified.fillRect(0,0,BASE,BASE);}
  const cx=BASE/2,cy=BASE-10,s=1;
  tpl().order.forEach(pid=>{const part=tpl().parts.find(p=>p.id===pid);if(!part) return;const ps=charState[pid];if(!ps) return;const v=part.variants[ps.variant];if(v&&v.fn) v.fn(cctxUnified,ps.colour,cx,cy,s,currentPose);});
}
function buildAll(){buildArchetypes();buildPartTabs();buildPoseRow();const part=tpl().parts.find(p=>p.id===currentPart)||tpl().parts[0];currentPart=part.id;document.getElementById('variantTitle').textContent=part.name;buildVariants(part);buildColours(part);}
function buildArchetypes(){const g=document.getElementById('archetypeGridUnified');g.innerHTML='';tpl().arch.forEach(a=>{const btn=document.createElement('button');btn.className='arch-btn'+(activeArchetype===a.id?' on':'');btn.innerHTML='<span class="arch-icon">'+a.icon+'</span><span>'+a.label+'</span>';btn.addEventListener('click',()=>applyArchetype(a));g.appendChild(btn);});}
function applyArchetype(a){activeArchetype=a.id;tpl().parts.forEach(part=>{const p=a.parts[part.id];if(p){charState[part.id].variant=p.v;charState[part.id].colour=p.c;}});renderCharacter();buildArchetypes();buildPartTabs();const part=tpl().parts.find(p=>p.id===currentPart);buildVariants(part);buildColours(part);showToast(a.icon+' '+a.label+' loaded!');}
function buildPartTabs(){const tabs=document.getElementById('partsUnified');tabs.innerHTML='';tpl().parts.forEach(part=>{const ps=charState[part.id],vn=part.variants[ps.variant].name;const tab=document.createElement('div');tab.className='part-tab'+(part.id===currentPart?' on':'');tab.id='ptab-'+part.id;tab.innerHTML='<span class="pt-icon">'+part.icon+'</span><div style="flex:1"><div class="pt-name">'+part.name+'</div><div class="pt-val">'+vn+'</div></div><div class="pt-dot" style="background:'+ps.colour+'"></div>';tab.addEventListener('click',()=>selectPart(part.id));tabs.appendChild(tab);});}
function updatePartTab(pid){const part=tpl().parts.find(p=>p.id===pid),ps=charState[pid],tab=document.getElementById('ptab-'+pid);if(!tab) return;tab.querySelector('.pt-val').textContent=part.variants[ps.variant].name;tab.querySelector('.pt-dot').style.background=ps.colour;}
function selectPart(pid){currentPart=pid;document.querySelectorAll('.part-tab').forEach(t=>t.classList.toggle('on',t.id==='ptab-'+pid));const part=tpl().parts.find(p=>p.id===pid);document.getElementById('variantTitle').textContent=part.name;buildVariants(part);buildColours(part);}
function buildVariants(part){const g=document.getElementById('variantUnified');g.innerHTML='';part.variants.forEach((v,i)=>{const btn=document.createElement('div');btn.className='var-btn'+(i===charState[part.id].variant?' on':'');btn.textContent=v.name;btn.addEventListener('click',()=>{charState[part.id].variant=i;renderCharacter();buildVariants(part);updatePartTab(part.id);activeArchetype=null;buildArchetypes();});g.appendChild(btn);});}
function buildColours(part){const c=document.getElementById('colourSwatches');c.innerHTML='';part.colours.forEach(col=>{const sw=document.createElement('div');sw.className='csw'+(col===charState[part.id].colour?' on':'');sw.style.background=col;sw.dataset.col=col;sw.addEventListener('click',()=>setPartColour(col));c.appendChild(sw);});document.getElementById('customColour').value=charState[part.id].colour;}
function setPartColour(col){charState[currentPart].colour=col;document.getElementById('customColour').value=col;document.querySelectorAll('.csw').forEach(s=>s.classList.toggle('on',s.dataset.col===col));renderCharacter();updatePartTab(currentPart);activeArchetype=null;buildArchetypes();}
function buildPoseRow(){const row=document.getElementById('poseRowUnified');row.innerHTML='';tpl().poses.forEach(p=>{const btn=document.createElement('button');btn.className='pose-btn'+(p.id===currentPose?' on':'');btn.innerHTML=p.label;btn.addEventListener('click',()=>{currentPose=p.id;document.querySelectorAll('.pose-btn').forEach(b=>b.classList.toggle('on',b===btn));renderCharacter();});row.appendChild(btn);});}
function buildBgRow(){const row=document.getElementById('bgOpts');row.innerHTML='';BG_OPTIONS.forEach(bg=>{const opt=document.createElement('div');opt.className='bg-opt'+(bg.val===charBg?' on':'');opt.style.background=bg.style;opt.addEventListener('click',()=>{charBg=bg.val;charCanvasUnified.style.background=bg.style;document.querySelectorAll('.bg-opt').forEach(o=>o.classList.toggle('on',o===opt));renderCharacter();queueAutosave();});row.appendChild(opt);});}
function randomCharacter(){tpl().parts.forEach(p=>{charState[p.id]={variant:Math.floor(Math.random()*p.variants.length),colour:p.colours[Math.floor(Math.random()*p.colours.length)]};});activeArchetype=null;renderCharacter();buildAll();}
function resetCharacter(){initCharState();renderCharacter();buildAll();}
function sendToGameMaker(){
  try{
    const dataUrl=charCanvasUnified.toDataURL('image/png');
    localStorage.setItem('jvds_sprite_player',dataUrl);
    showToast('Sent to Game Maker. Open Arcade Game Maker > Assets > Import from Character Designer');
  }catch(e){showToast('Export failed');}
}
function saveCharacter(){const name=document.getElementById('charName').value.trim()||'Character';const thumb=document.createElement('canvas');thumb.width=BASE;thumb.height=BASE;thumb.getContext('2d').drawImage(charCanvasUnified,0,0);while(saveSlots.length<4) saveSlots.push(null);let slot=saveSlots.findIndex(s=>!s);const replaced=slot<0;if(slot<0) slot=0;saveSlots[slot]={name,template:currentTemplate,state:normalizeState(charState),thumb:thumb.toDataURL(),pose:currentPose};localStorage.setItem('jvds_chars',JSON.stringify(saveSlots));renderSaveSlots();showToast(replaced?'Slots full - replaced slot 1':'Saved to slot '+(slot+1)+'!');}
function escapeHtml(str){return String(str).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function renderSaveSlots(){const c=document.getElementById('saveSlots');c.innerHTML='';for(let i=0;i<4;i++){const slot=saveSlots[i],el=document.createElement('div');el.className='save-slot'+(slot?' filled':'');if(slot){const safeName=escapeHtml(slot.name||'Character');el.innerHTML='<img loading="lazy" src="'+slot.thumb+'" alt="Character thumbnail" class="ss-thumb"><div class="ss-name">'+safeName+'</div>';el.addEventListener('click',()=>{if(slot.template&&slot.template!==currentTemplate){const btn=document.querySelector('.tpl-'+slot.template);if(btn) switchTemplate(slot.template,btn);}charState=normalizeState(slot.state);currentPose=slot.pose||'idle';document.getElementById('charName').value=slot.name;renderCharacter();buildAll();showToast('Loaded: '+(slot.name||'Character'));});}else el.innerHTML='<span class="ss-empty">Slot '+(i+1)+'</span>';c.appendChild(el);}}
function smartRandomize(){const parts=tpl().parts,colorHarmony={primary:['#3b82f6','#6366f1','#8b5cf6','#f472b6','#ef4444','#f59e0b','#10b981'],secondary:[]};const primary=colorHarmony.primary[Math.floor(Math.random()*colorHarmony.primary.length)];const hsl=h=>parseInt(h.slice(1,3),16);const harmony=[primary,lk(primary,30),dk(primary,30),lk(primary,60),dk(primary,60)];let colorScheme=harmony;parts.forEach(p=>{charState[p.id]={variant:Math.floor(Math.random()*p.variants.length),colour:Math.random()<0.6?colorScheme[Math.floor(Math.random()*colorScheme.length)]:p.colours[Math.floor(Math.random()*p.colours.length)]};});activeArchetype=null;renderCharacter();buildAll();}
function exportCharJSON(){const data={name:document.getElementById('charName').value||'Character',template:currentTemplate,state:charState,pose:currentPose};const json=JSON.stringify(data,null,2);const blob=new Blob([json],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=data.name.replace(/\s+/g,'_')+'.json';a.click();URL.revokeObjectURL(url);showToast('Character exported as JSON!');}
function importCharJSON(){const inp=document.createElement('input');inp.type='file';inp.accept='.json';inp.onchange=e=>{const f=e.target.files[0];if(!f) return;const r=new FileReader();r.onload=ev=>{try{const data=JSON.parse(ev.target.result);if(!data.state){showToast('Invalid character file');return;}if(data.template&&CHARACTER_TEMPLATES[data.template]){currentTemplate=data.template;const btn=document.querySelector('.tpl-'+data.template);if(btn) switchTemplate(data.template,btn);}charState=normalizeState(data.state);currentPose=data.pose||'idle';document.getElementById('charName').value=data.name||'Character';renderCharacter();buildAll();showToast('Imported: '+(data.name||'character'));}catch(err){showToast('Import failed');}};r.readAsText(f);};inp.click();}
function batchGenerate(){document.getElementById('genModal').classList.add('open');}
function runBatchGenerate(){closeModal('genModal');let count=Math.max(1,Math.min(10,parseInt(document.getElementById('genCount').value)||4));while(saveSlots.length<4) saveSlots.push(null);const empties=[];for(let i=0;i<4;i++) if(!saveSlots[i]) empties.push(i);if(!empties.length){showToast('Save slots full - overwrite a slot first');return;}count=Math.min(count,empties.length);empties.slice(0,count).forEach((slot,i)=>{smartRandomize();document.getElementById('charName').value='Random_'+(i+1);const th=document.createElement('canvas');th.width=BASE;th.height=BASE;th.getContext('2d').drawImage(charCanvasUnified,0,0);saveSlots[slot]={name:'Random_'+(i+1),template:currentTemplate,state:normalizeState(charState),thumb:th.toDataURL(),pose:currentPose};});localStorage.setItem('jvds_chars',JSON.stringify(saveSlots));renderSaveSlots();showToast('Generated '+count+' characters!');}

// STAMP
function updateStampBtn(){const el=document.getElementById('stampFrameNum');if(el) el.textContent=currentFrame+1;}
function stampToCanvas(fi){
  const frameIdx=(fi!==undefined)?fi:currentFrame;
  while(frames.length<=frameIdx) frames.push(layers.map(()=>null));
  if(!frames[frameIdx][0]) frames[frameIdx][0]=new ImageData(cW,cH);
  pushUndo();
  const tmp=document.createElement('canvas');tmp.width=BASE;tmp.height=BASE;
  const tctx=tmp.getContext('2d');tctx.imageSmoothingEnabled=false;tctx.drawImage(charCanvasUnified,0,0);
  const src=tctx.getImageData(0,0,BASE,BASE).data;
  const dst=frames[frameIdx][0];
  const rx=BASE/cW,ry=BASE/cH;
  for(let y=0;y<cH;y++){const syi=Math.min(BASE-1,(y*ry)|0)*BASE;
    for(let x=0;x<cW;x++){const sxi=Math.min(BASE-1,(x*rx)|0);const si=(syi+sxi)*4,di=(y*cW+x)*4;
      dst.data[di]=src[si];dst.data[di+1]=src[si+1];dst.data[di+2]=src[si+2];dst.data[di+3]=src[si+3];}}
  if(fi===undefined){if(layers.length<2) addLayer();currentLayer=1;renderLayerList();renderFrameList();renderAll();showToast('Stamped to frame '+(frameIdx+1)+'!');}
  else renderAll();
}
function stampAllPoses(){
  if(window.ToolAnalytics)ToolAnalytics.event('stamp_all_poses');const poses=tpl().poses;if(layers.length<2) addLayer();while(frames.length<poses.length) addFrame();const sp=currentPose;poses.forEach((p,i)=>{currentPose=p.id;renderCharacter();stampToCanvas(i);});currentPose=sp;renderCharacter();currentFrame=0;currentLayer=1;renderLayerList();renderFrameList();renderAll();showToast('All '+poses.length+' poses stamped!');}
