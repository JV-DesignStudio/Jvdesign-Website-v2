/* PICO-8 Studio
   Pick a game from the My First Pico-8 Game series, tune it, play it live at
   128x128, then export a real .p8 cartridge. The Lua in the cart is the same
   game logic the preview runs, so what you see is what the cart does.

   This file also exports a small node API (PALETTE, GAMES, buildCart, ...) so
   tests/pico8-studio-http.js can check the carts without a browser. */
(function () {
  'use strict';

  var PALETTE = ['#000000', '#1D2B53', '#7E2553', '#008751', '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8', '#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA'];
  var PAL_NAMES = ['black', 'dark blue', 'dark purple', 'dark green', 'brown', 'dark grey', 'light grey', 'white', 'red', 'orange', 'yellow', 'green', 'blue', 'lavender', 'pink', 'peach'];

  function px(i) { i = i | 0; if (i < 0 || i > 15) i = 0; return PALETTE[i]; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* Field helpers */
  function num(k, label, min, max, def) { return { k: k, label: label, type: 'number', min: min, max: max, def: def }; }
  function col(k, label, def) { return { k: k, label: label, type: 'color', def: def }; }

  /* ============================ Lua cart builders ============================ */
  function pongLua(v) {
    return [
      '-- Pong  (made in PICO-8 Studio)',
      'col_paddle=' + v.col_paddle,
      'col_ball=' + v.col_ball,
      'bg=' + v.bg,
      'ball_spd=' + v.ball_spd,
      'paddle_h=' + v.paddle_h,
      'serve_y=' + ((typeof v.serve_y === 'number') ? v.serve_y : 64),
      'win=' + v.target,
      '',
      'function _init()',
      ' px=6 py=56 ex=118 ey=56 bx=64 by=serve_y',
      ' dx=ball_spd*.7 dy=ball_spd*.5 s1=0 s2=0',
      'end',
      'function _serve(d)',
      ' bx=64 by=serve_y dx=d*ball_spd*.7',
      ' dy=(rnd(2)-1)*ball_spd*.5',
      'end',
      'function _update()',
      ' if btn(2) then py-=2 end',
      ' if btn(3) then py+=2 end',
      ' py=mid(0,py,128-paddle_h)',
      ' if ey+paddle_h/2<by-1 then ey+=1.6 end',
      ' if ey+paddle_h/2>by+1 then ey-=1.6 end',
      ' ey=mid(0,ey,128-paddle_h)',
      ' bx+=dx by+=dy',
      ' if by<2 then dy=abs(dy) by=2 end',
      ' if by>126 then dy=-abs(dy) by=126 end',
      ' if bx<10 and by>py and by<py+paddle_h and dx<0 then dx=abs(dx) end',
      ' if bx>117 and by>ey and by<ey+paddle_h and dx>0 then dx=-abs(dx) end',
      ' if bx<0 then s2+=1 if s2>=win then s2=0 s1=0 else _serve(1) end end',
      ' if bx>128 then s1+=1 if s1>=win then s1=0 s2=0 else _serve(-1) end end',
      'end',
      'function _draw()',
      ' cls(bg)',
      ' rectfill(4,py,6,py+paddle_h,col_paddle)',
      ' rectfill(121,ey,123,ey+paddle_h,col_paddle)',
      ' rectfill(bx-2,by-2,bx+2,by+2,col_ball)',
      ' print(s1.."-"..s2,56,4,7)',
      'end'
    ].join('\n');
  }

  function snakeLua(v) {
    return [
      '-- Snake  (made in PICO-8 Studio)',
      'col_body=' + v.col_snake,
      'col_food=' + v.col_food,
      'bg=' + v.bg,
      'sps=' + v.speed,
      '',
      'function _init()',
      ' dirx=1 diry=0 px=8 py=8 acc=0 len=3',
      ' body={{x=8,y=8}} food={x=4,y=4}',
      'end',
      'function _update()',
      ' if btnp(0) and dirx==0 then dirx=-1 diry=0 end',
      ' if btnp(1) and dirx==0 then dirx=1 diry=0 end',
      ' if btnp(2) and diry==0 then dirx=0 diry=-1 end',
      ' if btnp(3) and diry==0 then dirx=0 diry=1 end',
      ' acc+=1 if acc < 30/sps then return end',
      ' acc=0',
      ' px+=dirx py+=diry',
      ' if px<0 then px=15 end if px>15 then px=0 end',
      ' if py<0 then py=15 end if py>15 then py=0 end',
      ' add(body,{x=px,y=py})',
      ' if px==food.x and py==food.y then',
      '  len+=1 food={x=flr(rnd(16)),y=flr(rnd(16))} sfx(0)',
      ' end',
      ' while #body>len do del(body,body[1]) end',
      ' for i=1,#body-1 do',
      '  if body[i].x==px and body[i].y==py then _init() end',
      ' end',
      'end',
      'function _draw()',
      ' cls(bg)',
      ' rectfill(food.x*8+1,food.y*8+1,food.x*8+6,food.y*8+6,col_food)',
      ' for b in all(body) do rectfill(b.x*8+1,b.y*8+1,b.x*8+6,b.y*8+6,col_body) end',
      ' print("len "..#body,2,2,7)',
      'end'
    ].join('\n');
  }

  function platformerLua(v) {
    return [
      '-- Platformer  (made in PICO-8 Studio)',
      'col_player=' + v.col_player,
      'col_plat=' + v.col_plat,
      'col_goal=' + v.col_goal,
      'bg=' + v.bg,
      'grav=' + v.gravity,
      'jump=' + v.jump,
      'spd=' + v.speed,
      '',
      'function _init()',
      ' px=10 py=100 vy=0 onfloor=true won=false',
      ' plats={{x=0,y=112,w=128,h=16},{x=30,y=92,w=24,h=6},{x=66,y=78,w=24,h=6},{x=96,y=64,w=22,h=6}}',
      ' goal={x=120,y=54}',
      'end',
      'function _update()',
      ' if btn(0) then px-=spd end',
      ' if btn(1) then px+=spd end',
      ' if (btnp(4) or btnp(5)) and onfloor then vy=-jump onfloor=false end',
      ' vy+=grav py+=vy',
      ' onfloor=false',
      ' for p in all(plats) do',
      '  if px>p.x-3 and px<p.x+p.w+3 and py>p.y-8 and py<=p.y+8 then',
      '   py=p.y-8 vy=0 onfloor=true',
      '  end',
      ' end',
      ' if px<2 then px=2 end if px>122 then px=122 end',
      ' if px>goal.x-6 and px<goal.x+6 and py<goal.y+12 and py>goal.y-14 then won=true end',
      'end',
      'function _draw()',
      ' cls(bg)',
      ' for p in all(plats) do rectfill(p.x,p.y,p.x+p.w-1,p.y+p.h-1,col_plat) end',
      ' rectfill(goal.x-1,goal.y-1,goal.x+1,goal.y+11,col_goal)',
      ' rectfill(px-3,py,px+3,py+8,col_player)',
      ' if won then print("you win!",44,60,col_goal)',
      ' else print("reach the flag",26,4,7) end',
      'end'
    ].join('\n');
  }

  function shooterLua(v) {
    return [
      '-- Shooter  (made in PICO-8 Studio)',
      'col_player=' + v.col_player,
      'col_enemy=' + v.col_enemy,
      'col_bullet=' + v.col_bullet,
      'bg=' + v.bg,
      'espd=' + v.enemy_speed,
      'frate=' + v.fire,
      '',
      'function _init()',
      ' px=60 py=112 bx=-1 by=0 cool=0 edir=1 escore=0',
      ' en={} for r=0,2 do for c=0,6 do add(en,{x=18+c*14,y=16+r*12}) end end',
      'end',
      'function _update()',
      ' if btn(0) then px-=2 end',
      ' if btn(1) then px+=2 end',
      ' px=mid(2,px,122)',
      ' cool-=1',
      ' if (btnp(4) or btnp(5)) and cool<=0 then bx=px by=py-4 cool=flr(frate) end',
      ' if bx>=0 then by-=4 if by<0 then bx=-1 end end',
      ' move=true',
      ' for e in all(en) do',
      '  e.x+=espd*edir',
      '  if e.x<8 or e.x>120 then move=false end',
      ' end',
      ' if not move then edir=-edir for e in all(en) do e.y+=4 end end',
      ' if bx>=0 then',
      '  for e in all(en) do',
      '   if bx>e.x-4 and bx<e.x+4 and by<e.y+4 and by>e.y-4 then',
      '    del(en,e) bx=-1 escore+=10 sfx(0) break',
      '   end',
      '  end',
      ' end',
      ' for e in all(en) do if e.y>108 then _init() end end',
      ' if #en==0 then _init() end',
      'end',
      'function _draw()',
      ' cls(bg)',
      ' for e in all(en) do',
      '  line(e.x-3,e.y-3,e.x+3,e.y-3,col_enemy)',
      '  line(e.x-3,e.y-3,e.x,e.y+3,col_enemy)',
      '  line(e.x+3,e.y-3,e.x,e.y+3,col_enemy)',
      ' end',
      ' if bx>=0 then rectfill(bx-1,by-2,bx+1,by+2,col_bullet) end',
      ' rectfill(px-3,py,px+3,py+4,col_player)',
      ' print("score "..escore,2,2,7)',
      'end'
    ].join('\n');
  }

  function dungeonLua(v) {
    return [
      '-- Dungeon  (made in PICO-8 Studio)',
      'col_wall=' + v.col_wall,
      'col_coin=' + v.col_coin,
      'col_hero=' + v.col_hero,
      'col_bad=' + v.col_bad,
      'bg=' + v.bg,
      'cs=14 cw=' + v.cols + ' ch=' + v.cols,
      'turns=' + (v.chaser ? '2' : '0'),
      '',
      'function _init()',
      ' px=1 py=1 got=0 turn=0 target=4',
      ' walls={}',
      ' for x=0,cw-1 do walls[x..",0"]=true walls[x..","..(ch-1)]=true end',
      ' for y=0,ch-1 do walls["0,"..y]=true walls[(cw-1)..","..y]=true end',
      ' walls["3,3"]=true walls["3,4"]=true walls["5,2"]=true',
      ' walls["5,3"]=true walls["2,5"]=true walls["6,5"]=true',
      ' coins={}',
      ' for i=1,target do',
      '  add(coins,{x=flr(rnd(cw-2))+1,y=flr(rnd(ch-2))+1})',
      ' end',
      ' bx=cw-2 by=ch-2',
      'end',
      'function _update()',
      ' mx=0 my=0',
      ' if btnp(0) then mx=-1 end if btnp(1) then mx=1 end',
      ' if btnp(2) then my=-1 end if btnp(3) then my=1 end',
      ' if mx==0 and my==0 then return end',
      ' nx=mid(0,px+mx,cw-1) ny=mid(0,py+my,ch-1)',
      ' if not walls[nx..","..ny] then px=nx py=ny end',
      ' turn+=1',
      ' for c in all(coins) do',
      '  if c.x==px and c.y==py then del(coins,c) got+=1 sfx(0) break end',
      ' end',
      ' if turns>0 and turn%turns==0 then',
      '  if bx<px then bx+=1',
      '  elseif bx>px then bx-=1',
      '  elseif by<py then by+=1',
      '  elseif by>py then by-=1 end',
      ' end',
      ' if bx==px and by==py then _init() end',
      ' if got>=target and px==cw-2 and py==ch-2 then _init() end',
      'end',
      'function _draw()',
      ' cls(bg)',
      ' for x=0,cw-1 do for y=0,ch-1 do',
      '  if walls[x..","..y] then rectfill(x*cs,y*cs,x*cs+cs-1,y*cs+cs-1,col_wall) end',
      ' end end',
      ' rectfill((cw-1)*cs+3,(ch-1)*cs+3,(cw-1)*cs+cs-4,(ch-1)*cs+cs-4,10)',
      ' for c in all(coins) do circfill(c.x*cs+7,c.y*cs+7,2,col_coin) end',
      ' if turns>0 then circfill(bx*cs+7,by*cs+7,3,col_bad) end',
      ' rectfill(px*cs+4,py*cs+4,px*cs+9,py*cs+9,col_hero)',
      ' print("coins "..got.."/"..target,2,2,7)',
      'end'
    ].join('\n');
  }

  function match3Lua(v) {
    return [
      '-- Match 3  (made in PICO-8 Studio)',
      'bg=' + v.bg,
      'npal=' + v.colours,
      'cs=20 o=4 cols=6',
      '',
      'function _init()',
      ' g={} for x=0,cols-1 do g[x]={} for y=0,cols-1 do g[x][y]=flr(rnd(npal)) end end',
      ' cx=0 cy=0 sel=false ex=0 ey=0',
      'end',
      'function _swap(x,y,dx,dy)',
      ' nx=x+dx ny=y+dy',
      ' if nx<0 or nx>=cols or ny<0 or ny>=cols then return end',
      ' g[x][y],g[nx][ny]=g[nx][ny],g[x][y]',
      'end',
      'function _clear()',
      ' for y=0,cols-1 do',
      '  local run=1',
      '  for x=1,cols-1 do',
      '   if g[x][y]==g[x-1][y] then run+=1',
      '   else if run>=3 then for k=0,run-1 do g[x-1-k][y]=-1 end end run=1 end',
      '  end',
      '  if run>=3 then for k=0,run-1 do g[cols-1-k][y]=-1 end end',
      ' end',
      ' for x=0,cols-1 do',
      '  local run=1',
      '  for y=1,cols-1 do',
      '   if g[x][y]==g[x][y-1] then run+=1',
      '   else if run>=3 then for k=0,run-1 do g[x][y-1-k]=-1 end end run=1 end',
      '  end',
      '  if run>=3 then for k=0,run-1 do g[x][cols-1-k]=-1 end end',
      ' end',
      ' for x=0,cols-1 do',
      '  for y=cols-1,0,-1 do',
      '   if g[x][y]==-1 then',
      '    for yy=y,1,-1 do g[x][yy]=g[x][yy-1] end',
      '    g[x][0]=flr(rnd(npal))',
      '   end',
      '  end',
      ' end',
      'end',
      'function _update()',
      ' if btnp(0) and cx>0 then cx-=1 end',
      ' if btnp(1) and cx<cols-1 then cx+=1 end',
      ' if btnp(2) and cy>0 then cy-=1 end',
      ' if btnp(3) and cy<cols-1 then cy+=1 end',
      ' if btnp(4) or btnp(5) then',
      '  if not sel then sel=true ex=cx ey=cy',
      '  else',
      '   if abs(cx-ex)+abs(cy-ey)==1 then _swap(ex,ey,cx-ex,cy-ey) _clear() sfx(0) end',
      '   sel=false',
      '  end',
      ' end',
      'end',
      'function _draw()',
      ' cls(bg)',
      ' for x=0,cols-1 do for y=0,cols-1 do',
      '  local c=g[x][y]',
      '  if c>=0 then rectfill(o+x*cs,o+y*cs,o+x*cs+cs-3,o+y*cs+cs-3,c+8) end',
      ' end end',
      ' rect(o+cx*cs,o+cy*cs,o+cx*cs+cs-3,o+cy*cs+cs-3,7)',
      ' if sel then rect(o+ex*cs,o+ey*cs,o+ex*cs+cs-3,o+ey*cs+cs-3,10) end',
      ' print("Z to pick and swap",2,120,7)',
      'end'
    ].join('\n');
  }

  /* ============================ Games (preview + cart) ============================ */
  var GAMES = {
    pong: {
      emoji: '🏓', name: 'Pong',
      blurb: 'Two paddles and one ball. Keep the ball past the computer paddles. First to the target score wins.',
      controls: 'Up and Down (or W and S) move your paddle on the left. The computer plays on the right.',
      fields: [num('paddle_h', 'Paddle size', 8, 40, 20), num('ball_spd', 'Ball speed', 1, 4, 2), num('target', 'Points to win', 3, 15, 5), num('serve_y', 'Ball serve height', 8, 120, 64), col('col_paddle', 'Paddle colour', 7), col('col_ball', 'Ball colour', 10), col('bg', 'Background', 0)],
      lua: pongLua,
      make: function (v) {
        var s = {};
        function serveY() { var y = (typeof v.serve_y === 'number') ? v.serve_y : 64; return clamp(Math.round(y), 8, 120); }
        function serve(d) { s.bx = 64; s.by = serveY(); s.dx = d * v.ball_spd * 0.7; s.dy = (Math.random() * 2 - 1) * v.ball_spd * 0.5; }
        s.reset = function () { s.px = 6; s.py = 64 - v.paddle_h / 2; s.ex = 118; s.ey = 64 - v.paddle_h / 2; s.s1 = 0; s.s2 = 0; s.over = false; serve(Math.random() < 0.5 ? 1 : -1); };
        s.update = function (k) {
          if (s.over) return;
          if (k.up) s.py -= 2; if (k.down) s.py += 2;
          s.py = clamp(s.py, 0, 128 - v.paddle_h);
          var cy = s.ey + v.paddle_h / 2;
          if (cy < s.by - 1) s.ey += 1.6; else if (cy > s.by + 1) s.ey -= 1.6;
          s.ey = clamp(s.ey, 0, 128 - v.paddle_h);
          s.bx += s.dx; s.by += s.dy;
          if (s.by < 2) { s.by = 2; s.dy = Math.abs(s.dy); }
          if (s.by > 126) { s.by = 126; s.dy = -Math.abs(s.dy); }
          if (s.bx < 10 && s.by > s.py && s.by < s.py + v.paddle_h && s.dx < 0) s.dx = Math.abs(s.dx);
          if (s.bx > 117 && s.by > s.ey && s.by < s.ey + v.paddle_h && s.dx > 0) s.dx = -Math.abs(s.dx);
          if (s.bx < 0) { s.s2++; if (s.s2 >= v.target) s.over = true; else serve(1); }
          else if (s.bx > 128) { s.s1++; if (s.s1 >= v.target) s.over = true; else serve(-1); }
        };
        s.draw = function (g) {
          g.fill(v.bg, 0, 0, 128, 128);
          g.rect(v.col_paddle, 4, s.py, 6, s.py + v.paddle_h);
          g.rect(v.col_paddle, 121, s.ey, 123, s.ey + v.paddle_h);
          g.rect(v.col_ball, s.bx - 2, s.by - 2, s.bx + 2, s.by + 2);
          g.print(s.s1 + '-' + s.s2, 7, 56, 4);
          if (s.over) g.print('GAME OVER', 7, 44, 60);
        };
        s.reset(); return s;
      }
    },

    snake: {
      emoji: '🐍', name: 'Snake',
      blurb: 'Eat the food to grow longer. Do not run into your own tail. Wrap around the edges to the other side.',
      controls: 'Arrows or WASD steer the snake. It moves on its own, so plan your turn early.',
      fields: [num('speed', 'Steps per second', 3, 12, 7), col('col_snake', 'Snake colour', 11), col('col_food', 'Food colour', 8), col('bg', 'Background', 0)],
      lua: snakeLua,
      make: function (v) {
        var s = {};
        s.reset = function () { s.dirx = 1; s.diry = 0; s.px = 8; s.py = 8; s.body = [{ x: 8, y: 8 }]; s.food = { x: 4, y: 4 }; s.acc = 0; s.len = 3; };
        s.update = function (k) {
          if (k.left && s.dirx === 0) { s.dirx = -1; s.diry = 0; }
          else if (k.right && s.dirx === 0) { s.dirx = 1; s.diry = 0; }
          else if (k.up && s.diry === 0) { s.dirx = 0; s.diry = -1; }
          else if (k.down && s.diry === 0) { s.dirx = 0; s.diry = 1; }
          s.acc += 1;
          if (s.acc < 30 / v.speed) return;
          s.acc = 0;
          s.px += s.dirx; s.py += s.diry;
          if (s.px < 0) s.px = 15; if (s.px > 15) s.px = 0;
          if (s.py < 0) s.py = 15; if (s.py > 15) s.py = 0;
          s.body.push({ x: s.px, y: s.py });
          if (s.px === s.food.x && s.py === s.food.y) { s.len += 1; s.food = { x: (Math.random() * 16) | 0, y: (Math.random() * 16) | 0 }; }
          while (s.body.length > s.len) s.body.shift();
          for (var i = 0; i < s.body.length - 1; i++) if (s.body[i].x === s.px && s.body[i].y === s.py) s.reset();
        };
        s.draw = function (g) {
          g.fill(v.bg, 0, 0, 128, 128);
          g.rect(v.col_food, s.food.x * 8 + 1, s.food.y * 8 + 1, s.food.x * 8 + 6, s.food.y * 8 + 6);
          for (var i = 0; i < s.body.length; i++) g.rect(v.col_snake, s.body[i].x * 8 + 1, s.body[i].y * 8 + 1, s.body[i].x * 8 + 6, s.body[i].y * 8 + 6);
          g.print('len ' + s.body.length, 7, 2, 2);
        };
        s.reset(); return s;
      }
    },

    platformer: {
      emoji: '🏃', name: 'Platformer',
      blurb: 'Run and jump between platforms to reach the flag. Change the gravity and jump to make it floaty or snappy.',
      controls: 'Left and Right (or A and D) to run. Z or Space (or the up arrow) to jump.',
      fields: [num('speed', 'Run speed', 0.5, 2.5, 1.4), num('gravity', 'Gravity', 0.2, 1.2, 0.5), num('jump', 'Jump power', 2, 6, 4), col('col_player', 'Player colour', 12), col('col_plat', 'Platform colour', 3), col('col_goal', 'Flag colour', 10), col('bg', 'Background', 1)],
      lua: platformerLua,
      make: function (v) {
        var s = {};
        var plats = [{ x: 0, y: 112, w: 128, h: 16 }, { x: 30, y: 92, w: 24, h: 6 }, { x: 66, y: 78, w: 24, h: 6 }, { x: 96, y: 64, w: 22, h: 6 }];
        s.plats = plats; s.goal = { x: 120, y: 54 };
        s.reset = function () { s.px = 10; s.py = 100; s.vy = 0; s.onfloor = true; s.won = false; };
        s.update = function (k) {
          if (k.left) s.px -= v.speed;
          if (k.right) s.px += v.speed;
          if ((k.action || k.up) && s.onfloor) { s.vy = -v.jump; s.onfloor = false; }
          s.vy += v.gravity; s.py += s.vy;
          s.onfloor = false;
          for (var i = 0; i < plats.length; i++) {
            var p = plats[i];
            if (s.px > p.x - 3 && s.px < p.x + p.w + 3 && s.py > p.y - 8 && s.py <= p.y + 8) { s.py = p.y - 8; s.vy = 0; s.onfloor = true; }
          }
          if (s.px < 2) s.px = 2; if (s.px > 122) s.px = 122;
          if (s.px > s.goal.x - 6 && s.px < s.goal.x + 6 && s.py < s.goal.y + 12 && s.py > s.goal.y - 14) s.won = true;
        };
        s.draw = function (g) {
          g.fill(v.bg, 0, 0, 128, 128);
          for (var i = 0; i < plats.length; i++) { var p = plats[i]; g.rect(v.col_plat, p.x, p.y, p.x + p.w - 1, p.y + p.h - 1); }
          g.rect(v.col_goal, s.goal.x - 1, s.goal.y - 1, s.goal.x + 1, s.goal.y + 11);
          g.rect(v.col_player, s.px - 3, s.py, s.px + 3, s.py + 8);
          if (s.won) g.print('you win!', 10, 44, 60); else g.print('reach the flag', 7, 26, 4);
        };
        s.reset(); return s;
      }
    },

    shooter: {
      emoji: '🚀', name: 'Shooter',
      blurb: 'Move along the bottom and shoot the descending rows of enemies before they reach you. Clear them all to restart.',
      controls: 'Left and Right (or A and D) to move. Z or Space to fire.',
      fields: [num('enemy_speed', 'Enemy speed', 0.1, 1, 0.4), num('fire', 'Frames between shots', 4, 30, 12), col('col_player', 'Ship colour', 11), col('col_enemy', 'Enemy colour', 8), col('col_bullet', 'Bullet colour', 10), col('bg', 'Background', 0)],
      lua: shooterLua,
      make: function (v) {
        var s = {};
        s.reset = function () {
          s.px = 60; s.py = 112; s.bx = -1; s.by = 0; s.cool = 0; s.edir = 1; s.score = 0; s.en = [];
          for (var r = 0; r < 3; r++) for (var c = 0; c < 7; c++) s.en.push({ x: 18 + c * 14, y: 16 + r * 12 });
        };
        s.update = function (k, p) {
          if (k.left) s.px -= 2; if (k.right) s.px += 2;
          s.px = clamp(s.px, 2, 122);
          s.cool -= 1;
          if ((p.action || p.up) && s.cool <= 0) { s.bx = s.px; s.by = s.py - 4; s.cool = Math.round(v.fire); }
          if (s.bx >= 0) { s.by -= 4; if (s.by < 0) s.bx = -1; }
          var move = true;
          for (var i = 0; i < s.en.length; i++) { s.en[i].x += v.enemy_speed * s.edir; if (s.en[i].x < 8 || s.en[i].x > 120) move = false; }
          if (!move) { s.edir = -s.edir; for (var j = 0; j < s.en.length; j++) s.en[j].y += 4; }
          if (s.bx >= 0) {
            for (var m = 0; m < s.en.length; m++) {
              var e = s.en[m];
              if (s.bx > e.x - 4 && s.bx < e.x + 4 && s.by < e.y + 4 && s.by > e.y - 4) { s.en.splice(m, 1); s.bx = -1; s.score += 10; break; }
            }
          }
          for (var n = 0; n < s.en.length; n++) if (s.en[n].y > 108) s.reset();
          if (s.en.length === 0) s.reset();
        };
        s.draw = function (g) {
          g.fill(v.bg, 0, 0, 128, 128);
          for (var i = 0; i < s.en.length; i++) {
            var e = s.en[i];
            g.line(v.col_enemy, e.x - 3, e.y - 3, e.x + 3, e.y - 3);
            g.line(v.col_enemy, e.x - 3, e.y - 3, e.x, e.y + 3);
            g.line(v.col_enemy, e.x + 3, e.y - 3, e.x, e.y + 3);
          }
          if (s.bx >= 0) g.rect(v.col_bullet, s.bx - 1, s.by - 2, s.bx + 1, s.by + 2);
          g.rect(v.col_player, s.px - 3, s.py, s.px + 3, s.py + 4);
          g.print('score ' + s.score, 7, 2, 2);
        };
        s.reset(); return s;
      }
    },

    dungeon: {
      emoji: '🗺️', name: 'Dungeon',
      blurb: 'Explore a small dungeon, collect all four coins, then reach the exit. A monster chases you if you leave it on.',
      controls: 'Arrows or WASD step one square. Collect every coin, then step on the exit tile.',
      fields: [num('cols', 'Grid size', 6, 9, 9), col('col_wall', 'Wall colour', 1), col('col_coin', 'Coin colour', 10), col('col_hero', 'Hero colour', 12), col('col_bad', 'Monster colour', 8), col('bg', 'Background', 0)],
      lua: dungeonLua,
      make: function (v) {
        var s = {};
        var cs = 14, n = Math.round(v.cols);
        s.cs = cs;
        s.reset = function () {
          s.px = 1; s.py = 1; s.got = 0; s.turn = 0; s.target = 4; s.walls = {};
          for (var x = 0; x < n; x++) { s.walls[x + ',0'] = true; s.walls[x + ',' + (n - 1)] = true; }
          for (var y = 0; y < n; y++) { s.walls['0,' + y] = true; s.walls[(n - 1) + ',' + y] = true; }
          s.walls['3,3'] = true; s.walls['3,4'] = true; s.walls['5,2'] = true; s.walls['5,3'] = true; s.walls['2,5'] = true; s.walls['6,5'] = true;
          s.coins = [];
          for (var i = 0; i < s.target; i++) s.coins.push({ x: 1 + ((Math.random() * (n - 2)) | 0), y: 1 + ((Math.random() * (n - 2)) | 0) });
          s.bx = n - 2; s.by = n - 2;
        };
        s.update = function (k, p) {
          var mx = 0, my = 0;
          if (p.left) mx = -1; else if (p.right) mx = 1; else if (p.up) my = -1; else if (p.down) my = 1;
          if (mx === 0 && my === 0) return;
          var nx = clamp(s.px + mx, 0, n - 1), ny = clamp(s.py + my, 0, n - 1);
          if (!s.walls[nx + ',' + ny]) { s.px = nx; s.py = ny; }
          s.turn += 1;
          for (var i = 0; i < s.coins.length; i++) if (s.coins[i].x === s.px && s.coins[i].y === s.py) { s.coins.splice(i, 1); s.got += 1; break; }
          if (v.chaser && s.turn % 2 === 0) {
            if (s.bx < s.px) s.bx += 1; else if (s.bx > s.px) s.bx -= 1;
            else if (s.by < s.py) s.by += 1; else if (s.by > s.py) s.by -= 1;
          }
          if (s.bx === s.px && s.by === s.py) s.reset();
          if (s.got >= s.target && s.px === n - 2 && s.py === n - 2) s.reset();
        };
        s.draw = function (g) {
          g.fill(v.bg, 0, 0, 128, 128);
          for (var key in s.walls) { var pr = key.split(','); g.rect(v.col_wall, pr[0] * cs, pr[1] * cs, pr[0] * cs + cs - 1, pr[1] * cs + cs - 1); }
          g.rect(10, (n - 1) * cs + 3, (n - 1) * cs + 3, (n - 1) * cs + cs - 4, (n - 1) * cs + cs - 4);
          for (var i = 0; i < s.coins.length; i++) g.circ(v.col_coin, s.coins[i].x * cs + 7, s.coins[i].y * cs + 7, 2);
          if (v.chaser) g.circ(v.col_bad, s.bx * cs + 7, s.by * cs + 7, 3);
          g.rect(v.col_hero, s.px * cs + 4, s.py * cs + 4, s.px * cs + 9, s.py * cs + 9);
          g.print('coins ' + s.got + '/' + s.target, 7, 2, 2);
        };
        s.reset(); return s;
      }
    },

    match3: {
      emoji: '💎', name: 'Match 3',
      blurb: 'Swap two neighbouring gems to line up three or more of the same colour. They pop and new gems fall in.',
      controls: 'Arrows or WASD move the cursor. Z or Space picks a gem, move to a neighbour, then Z again to swap.',
      fields: [num('colours', 'Number of colours', 3, 5, 4), col('bg', 'Background', 0)],
      lua: match3Lua,
      make: function (v) {
        var s = {}, cols = 6, cs = 20, o = 4, npal = Math.round(v.colours);
        s.cs = cs; s.o = o; s.cols = cols;
        function rnd() { return (Math.random() * npal) | 0; }
        function clear() {
          for (var y = 0; y < cols; y++) {
            var run = 1;
            for (var x = 1; x < cols; x++) {
              if (s.g[x][y] === s.g[x - 1][y]) run++;
              else { if (run >= 3) for (var k = 0; k < run; k++) s.g[x - 1 - k][y] = -1; run = 1; }
            }
            if (run >= 3) for (var k2 = 0; k2 < run; k2++) s.g[cols - 1 - k2][y] = -1;
          }
          for (var x2 = 0; x2 < cols; x2++) {
            var run2 = 1;
            for (var y2 = 1; y2 < cols; y2++) {
              if (s.g[x2][y2] === s.g[x2][y2 - 1]) run2++;
              else { if (run2 >= 3) for (var k3 = 0; k3 < run2; k3++) s.g[x2][y2 - 1 - k3] = -1; run2 = 1; }
            }
            if (run2 >= 3) for (var k4 = 0; k4 < run2; k4++) s.g[x2][cols - 1 - k4] = -1;
          }
          for (var x3 = 0; x3 < cols; x3++) {
            for (var y3 = cols - 1; y3 >= 0; y3--) {
              if (s.g[x3][y3] === -1) {
                for (var yy = y3; yy > 0; yy--) s.g[x3][yy] = s.g[x3][yy - 1];
                s.g[x3][0] = rnd();
              }
            }
          }
        }
        s.reset = function () {
          s.g = [];
          for (var x = 0; x < cols; x++) { s.g[x] = []; for (var y = 0; y < cols; y++) s.g[x][y] = rnd(); }
          s.cx = 0; s.cy = 0; s.sel = false; s.ex = 0; s.ey = 0;
        };
        s.update = function (k, p) {
          if (p.left && s.cx > 0) s.cx--; else if (p.right && s.cx < cols - 1) s.cx++;
          else if (p.up && s.cy > 0) s.cy--; else if (p.down && s.cy < cols - 1) s.cy++;
          if (p.action || p.fire) {
            if (!s.sel) { s.sel = true; s.ex = s.cx; s.ey = s.cy; }
            else {
              if (Math.abs(s.cx - s.ex) + Math.abs(s.cy - s.ey) === 1) {
                var t = s.g[s.ex][s.ey]; s.g[s.ex][s.ey] = s.g[s.cx][s.cy]; s.g[s.cx][s.cy] = t; clear();
              }
              s.sel = false;
            }
          }
        };
        s.draw = function (g) {
          g.fill(v.bg, 0, 0, 128, 128);
          for (var x = 0; x < cols; x++) for (var y = 0; y < cols; y++) {
            var c = s.g[x][y];
            if (c >= 0) g.rect(c + 8, o + x * cs, o + y * cs, o + x * cs + cs - 3, o + y * cs + cs - 3);
          }
          g.stroke(7, o + s.cx * cs, o + s.cy * cs, o + s.cx * cs + cs - 3, o + s.cy * cs + cs - 3);
          if (s.sel) g.stroke(10, o + s.ex * cs, o + s.ey * cs, o + s.ex * cs + cs - 3, o + s.ey * cs + cs - 3);
          g.print('Z to pick and swap', 7, 2, 120);
        };
        s.reset(); return s;
      }
    }
  };

  /* ============================ Cart + readme ============================ */
  function sanitiseTitle(t) { return String(t || 'my-game').replace(/[^A-Za-z0-9 _-]/g, '').trim().slice(0, 24) || 'my-game'; }
  function buildCart(id, values, title) {
    var g = GAMES[id]; if (!g) return '';
    var header = 'pico-8 cartridge // http://www.pico-8.com\nversion 41\n__lua__\n';
    var footer = '\n__gfx__\n';
    var lua = g.lua(values);
    var label = '-- ' + sanitiseTitle(title) + ' - made in the JVDS PICO-8 Studio';
    return header + label + '\n' + lua + '\n' + footer;
  }
  function buildReadme(id, values, title) {
    var g = GAMES[id]; if (!g) return '';
    return [
      'PICO-8 Studio starter pack',
      '=========================',
      '',
      'Cart: ' + sanitiseTitle(title) + '.p8',
      'Game: ' + g.name,
      'Made in the free JVDesignStudio PICO-8 Studio:',
      'https://jvdesignstudio.co.uk/workshops/pico8-studio.html',
      '',
      'How to open it',
      '--------------',
      '1. Open PICO-8 (Lexaloffle). Use folder then load, and pick this .p8 file.',
      '   Or just drag the file onto the PICO-8 window.',
      '2. No PICO-8? Free fantasy consoles that read .p8 carts work too,',
      '   such as TIC-80 in the browser or on desktop.',
      '3. Press Escape to see the code. The game code is in the __lua__ section.',
      '',
      'The game uses the standard PICO-8 API: _init, _update, _draw, btn, btnp,',
      'rectfill, circfill, line, print, sfx. Change a number and press Ctrl+R to',
      'run it again. Have fun!'
    ].join('\n');
  }

  /* ============================ ZIP (no libraries) ============================ */
  var CRC = (function () { var t = [], n, k, c; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function u16(v) { return [v & 255, (v >> 8) & 255]; }
  function u32(v) { return [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]; }
  function makeZip(files) {
    var enc = new TextEncoder(), chunks = [], central = [], offset = 0;
    files.forEach(function (f) {
      var nb = enc.encode(f.name), data = f.data, crc = crc32(data);
      var local = [].concat(u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(nb.length), u16(0));
      var h = new Uint8Array(local.length + nb.length); h.set(local, 0); h.set(nb, local.length);
      chunks.push(h, data);
      var cd = new Uint8Array([].concat(u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(nb.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset)).concat(Array.prototype.slice.call(nb)));
      central.push(cd); offset += h.length + data.length;
    });
    var cdSize = central.reduce(function (s, c) { return s + c.length; }, 0);
    var eocd = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cdSize), u32(offset), u16(0)));
    var total = chunks.reduce(function (s, c) { return s + c.length; }, 0) + cdSize + eocd.length;
    var out = new Uint8Array(total), p = 0;
    chunks.forEach(function (c) { out.set(c, p); p += c.length; });
    central.forEach(function (c) { out.set(c, p); p += c.length; });
    out.set(eocd, p); return out;
  }

  /* ============================ Helpers ============================ */
  function defaultsFor(id) { var o = {}, g = GAMES[id]; g.fields.forEach(function (f) { o[f.k] = f.def; }); return o; }

  /* ============================ Node export ============================ */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PALETTE: PALETTE, PAL_NAMES: PAL_NAMES, GAMES: GAMES, buildCart: buildCart, buildReadme: buildReadme, defaultsFor: defaultsFor, makeZip: makeZip, crc32: crc32, sanitiseTitle: sanitiseTitle };
    return;
  }

  /* ============================ Browser ============================ */
  function $(id) { return document.getElementById(id); }
  var state = { game: 'pong', values: null };

  function ctxPico(c) {
    return {
      fill: function (col, x, y, w, h) { c.fillStyle = px(col); c.fillRect(x | 0, y | 0, Math.max(0, w | 0), Math.max(0, h | 0)); },
      rect: function (col, x, y, x2, y2) { c.fillStyle = px(col); c.fillRect(x | 0, y | 0, Math.max(1, (x2 - x + 1) | 0), Math.max(1, (y2 - y + 1) | 0)); },
      circ: function (col, x, y, r) { c.fillStyle = px(col); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); },
      line: function (col, x1, y1, x2, y2) { c.strokeStyle = px(col); c.lineWidth = 1; c.beginPath(); c.moveTo(x1 + 0.5, y1 + 0.5); c.lineTo(x2 + 0.5, y2 + 0.5); c.stroke(); },
      stroke: function (col, x1, y1, x2, y2) { c.fillStyle = px(col); c.fillRect(x1 | 0, y1 | 0, 1, Math.max(1, (y2 - y1 + 1) | 0)); c.fillRect(x2 | 0, y1 | 0, 1, Math.max(1, (y2 - y1 + 1) | 0)); c.fillRect(x1 | 0, y1 | 0, Math.max(1, (x2 - x1 + 1) | 0), 1); c.fillRect(x1 | 0, y2 | 0, Math.max(1, (x2 - x1 + 1) | 0), 1); },
      print: function (s, col, x, y) { c.fillStyle = px(col); c.font = '5px monospace'; c.textBaseline = 'top'; c.fillText(String(s), x | 0, y | 0); }
    };
  }

  function readField(f) {
    var el = $('psf_' + f.k); if (!el) return state.values[f.k];
    return f.type === 'number' ? Number(el.value) : (f.type === 'color' ? Number(el.value) : el.value);
  }
  function syncValues() { var g = GAMES[state.game]; g.fields.forEach(function (f) { state.values[f.k] = readField(f); }); }

  function renderInspector() {
    var g = GAMES[state.game], box = $('psInspector'); if (!box) return;
    box.innerHTML = g.fields.map(function (f) {
      if (f.type === 'number') return '<div class="ps-field"><label for="psf_' + f.k + '">' + f.label + '</label><input type="range" id="psf_' + f.k + '" min="' + f.min + '" max="' + f.max + '" step="' + (f.min < 1 ? 0.1 : 1) + '" value="' + state.values[f.k] + '"><span class="ps-val" id="psv_' + f.k + '">' + state.values[f.k] + '</span></div>';
      if (f.type === 'color') return '<div class="ps-field"><label for="psf_' + f.k + '">' + f.label + '</label><select id="psf_' + f.k + '">' + PALETTE.map(function (_, i) { return '<option value="' + i + '"' + (i === state.values[f.k] ? ' selected' : '') + '>' + i + ' - ' + PAL_NAMES[i] + '</option>'; }).join('') + '</select></div>';
      return '<div class="ps-field"><label for="psf_' + f.k + '">' + f.label + '</label><input type="text" id="psf_' + f.k + '" value="' + state.values[f.k] + '"></div>';
    }).join('');
    g.fields.forEach(function (f) {
      var el = $('psf_' + f.k); if (!el) return;
      el.addEventListener('input', function () {
        state.values[f.k] = readField(f);
        var v = $('psv_' + f.k); if (v) v.textContent = state.values[f.k];
        buildSim(); refrescode();
      });
    });
  }

  function renderPalette() {
    var box = $('psPalette'); if (!box) return;
    box.innerHTML = PALETTE.map(function (c, i) { return '<div class="ps-sw"><i style="background:' + c + '"></i>' + i + ' ' + PAL_NAMES[i] + '</div>'; }).join('');
  }

  var sim = null, raf = null, last = 0, acc = 0, cur = {}, prev = {};
  var STEP = 1 / 30;

  function buildSim() { sim = GAMES[state.game].make(state.values); acc = 0; }

  function drawHud() {
    var box = $('psHud'); if (!box) return;
    box.textContent = GAMES[state.game].emoji + ' ' + GAMES[state.game].name;
  }

  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (!last) last = t;
    var dt = Math.min(0.1, (t - last) / 1000); last = t;
    acc += dt;
    var pressed = {};
    ['left', 'right', 'up', 'down', 'action', 'fire'].forEach(function (k) { pressed[k] = cur[k] && !prev[k]; });
    while (acc >= STEP) {
      if (sim) sim.update(cur, pressed);
      ['left', 'right', 'up', 'down', 'action', 'fire'].forEach(function (k) { prev[k] = cur[k]; pressed[k] = false; });
      acc -= STEP;
    }
    var cv = $('psPlay'); if (cv && sim) { var c = cv.getContext('2d'); c.imageSmoothingEnabled = false; sim.draw(ctxPico(c)); }
  }

  function startLoop() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }

  function refrescode() {
    var code = $('psCode'); if (!code) return;
    code.textContent = buildCart(state.game, state.values, ($('psTitle') && $('psTitle').value) || 'my-game');
  }

  function keyMap(e) {
    switch (e.key) {
      case 'ArrowLeft': case 'a': case 'A': return 'left';
      case 'ArrowRight': case 'd': case 'D': return 'right';
      case 'ArrowUp': case 'w': case 'W': return 'up';
      case 'ArrowDown': case 's': case 'S': return 'down';
      case ' ': case 'z': case 'Z': return 'action';
      case 'x': case 'X': return 'fire';
      default: return null;
    }
  }

  function bindHold(id, key) {
    var el = $(id); if (!el) return;
    ['pointerdown', 'touchstart'].forEach(function (ev) { el.addEventListener(ev, function (e) { e.preventDefault(); cur[key] = true; }); });
    ['pointerup', 'pointerleave', 'pointercancel', 'touchend'].forEach(function (ev) { el.addEventListener(ev, function () { cur[key] = false; }); });
  }

  function switchGame(id) {
    if (!GAMES[id]) id = 'pong';
    state.game = id; state.values = defaultsFor(id);
    document.querySelectorAll('.ps-game-btn').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-game') === id); });
    var blurb = $('psBlurb'); if (blurb) blurb.textContent = GAMES[id].blurb;
    var ctl = $('psControls'); if (ctl) ctl.textContent = GAMES[id].controls;
    renderInspector(); buildSim(); drawHud(); refrescode();
    drawWorld(); syncCodeBox();
  }

  /* ---------- drag and drop serve point + live Lua ---------- */
  function currentCart() { return buildCart(state.game, state.values, ($('psTitle') && $('psTitle').value) || 'my-game'); }
  function syncCodeBox() { var ta = $('psCodeEdit'); if (ta) ta.value = currentCart(); }
  function drawWorld() {
    var cv = $('psWorld'); if (!cv) return;
    var c = cv.getContext('2d');
    c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
    c.strokeStyle = 'rgba(255,255,255,.2)'; c.beginPath(); c.moveTo(64, 0); c.lineTo(64, 64); c.stroke();
    var sy = (state.game === 'pong' && typeof state.values.serve_y === 'number') ? state.values.serve_y : 64;
    var py = Math.round((sy / 128) * 64);
    c.fillStyle = '#fff'; c.beginPath(); c.arc(64, py, 5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#83769C'; c.font = '8px monospace'; c.textAlign = 'center'; c.fillText('drag', 64, Math.min(62, py + 14));
    var msg = $('psWorldMsg');
    if (msg) msg.textContent = state.game === 'pong' ? ('Ball serves at height ' + Math.round(sy) + '. Drag it and press Play.') : 'Serve editing is on Pong. The Lua box below works on every cart.';
  }
  function setServeY(sy) {
    sy = clamp(Math.round(sy), 8, 120);
    state.values.serve_y = sy;
    var inp = $('psf_serve_y'); if (inp) { inp.value = sy; var v = $('psv_serve_y'); if (v) v.textContent = sy; }
    buildSim(); refrescode(); drawWorld(); syncCodeBox();
  }
  function initLiveBits() {
    if (!window.JVDSLiveEdit) return;
    var cv = $('psWorld'), pal = $('psWorldPalette');
    if (pal) window.JVDSLiveEdit.armPalette(pal, function () { drawWorld(); });
    if (cv) {
      var dragging = false;
      function syFromEvent(e) {
        var r = cv.getBoundingClientRect();
        return ((e.clientY - r.top) / r.height) * 128;
      }
      cv.addEventListener('pointerdown', function (e) { dragging = true; try { cv.setPointerCapture(e.pointerId); } catch (x) {} if (state.game === 'pong') setServeY(syFromEvent(e)); e.preventDefault(); });
      cv.addEventListener('pointermove', function (e) { if (dragging && state.game === 'pong') setServeY(syFromEvent(e)); });
      ['pointerup', 'pointercancel'].forEach(function (ev) { cv.addEventListener(ev, function () { dragging = false; }); });
      cv.addEventListener('dragover', function (e) { e.preventDefault(); });
      cv.addEventListener('drop', function (e) { e.preventDefault(); if (state.game === 'pong') setServeY(syFromEvent(e)); });
      cv.addEventListener('keydown', function (e) {
        if (state.game !== 'pong') return;
        var sy = (typeof state.values.serve_y === 'number') ? state.values.serve_y : 64, used = true;
        if (e.key === 'ArrowUp') sy -= 8; else if (e.key === 'ArrowDown') sy += 8;
        else if (e.key === 'Home') sy = 8; else if (e.key === 'End') sy = 120; else used = false;
        if (used) { e.preventDefault(); setServeY(sy); }
      });
      drawWorld();
    }
    if ($('psCodeEdit')) {
      syncCodeBox();
      window.JVDSLiveEdit.bindCodeEditor({
        textareaId: 'psCodeEdit', applyId: 'psCodeApply', resetId: 'psCodeReset', statusId: 'psCodeMsg',
        getCode: currentCart,
        getFieldMeta: function () {
          return GAMES[state.game].fields.filter(function (f) { return f.type === 'number'; }).map(function (f) { return { key: f.k, min: f.min, max: f.max }; });
        },
        getValues: function () { return state.values; },
        setValue: function (k, v) {
          var f = null;
          GAMES[state.game].fields.forEach(function (x) { if (x.k === k) f = x; });
          if (f) state.values[k] = v;
        },
        resetValues: function () { state.values = defaultsFor(state.game); renderInspector(); buildSim(); drawWorld(); },
        refresh: function () { renderInspector(); buildSim(); refrescode(); drawWorld(); }
      });
    }
  }

  function boot() {
    state.values = defaultsFor(state.game);
    renderPalette();
    switchGame(state.game);
    try { var want = new URLSearchParams(location.search).get('game'); if (want && GAMES[want]) switchGame(want); } catch (e) {}

    document.querySelectorAll('.ps-game-btn').forEach(function (b) { b.addEventListener('click', function () { switchGame(b.getAttribute('data-game')); }); });

    document.querySelectorAll('.ps-tab').forEach(function (b) {
      b.addEventListener('click', function () {
        var tab = b.getAttribute('data-tab');
        document.querySelectorAll('.ps-tab').forEach(function (x) { x.classList.toggle('is-active', x === b); x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
        document.querySelectorAll('.ps-panel').forEach(function (p) { p.classList.toggle('is-active', p.id === 'panel-' + tab); });
        if (tab === 'export') refrescode();
        if (tab === 'play') startLoop();
      });
    });

    var def = $('psDefaults'); if (def) def.addEventListener('click', function () { state.values = defaultsFor(state.game); renderInspector(); buildSim(); refrescode(); });
    var op = $('psOpenPlay'); if (op) op.addEventListener('click', function () { var b = document.querySelector('.ps-tab[data-tab="play"]'); if (b) b.click(); });
    var rs = $('psReset'); if (rs) rs.addEventListener('click', function () { buildSim(); });

    bindHold('psLeft', 'left'); bindHold('psRight', 'right'); bindHold('psUp', 'up'); bindHold('psDown', 'down'); bindHold('psAction', 'action');
    var tt = $('psTitle'); if (tt) tt.addEventListener('input', refrescode);

    document.addEventListener('keydown', function (e) { var k = keyMap(e); if (k) { cur[k] = true; if (e.key === ' ') e.preventDefault(); } });
    document.addEventListener('keyup', function (e) { var k = keyMap(e); if (k) cur[k] = false; });

    var dl = $('psDownload'), st = $('psStarter'), cp = $('psCopy'), msg = $('psMsg');
    function flash(cls, text) { if (msg) { msg.className = 'ps-msg ' + cls; msg.textContent = text; } }
    function title() { return sanitiseTitle(($('psTitle') && $('psTitle').value) || 'my-game'); }
    if (dl) dl.addEventListener('click', function () {
      try {
        var text = buildCart(state.game, state.values, title());
        var blob = new Blob([text], { type: 'text/plain' }), a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = title() + '.p8';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
        try { var c = parseInt(localStorage.getItem('jvds_tool_export_pico8-studio') || '0', 10) + 1; localStorage.setItem('jvds_tool_export_pico8-studio', String(c)); } catch (e) {}
        flash('ok', 'Downloaded ' + title() + '.p8. Open it in PICO-8 or a free compatible player.');
      } catch (e) { flash('bad', 'Something went wrong building the cart. Try again.'); }
    });
    if (st) st.addEventListener('click', function () {
      try {
        var enc = new TextEncoder();
        var files = [{ name: title() + '.p8', data: enc.encode(buildCart(state.game, state.values, title())) }, { name: 'READ_ME.txt', data: enc.encode(buildReadme(state.game, state.values, title())) }];
        var zip = makeZip(files), blob = new Blob([zip], { type: 'application/zip' }), a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = title() + '-starter-pack.zip';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
        flash('ok', 'Downloaded the starter pack: your cart plus a READ_ME.');
      } catch (e) { flash('bad', 'Something went wrong building the zip. Try again.'); }
    });
    if (cp) cp.addEventListener('click', function () {
      var text = buildCart(state.game, state.values, title());
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { flash('ok', 'Lua code copied. Paste it into PICO-8.'); }, function () { flash('bad', 'Could not copy. Select the code and copy it.'); });
      else flash('ok', 'Select the code above and copy it.');
    });

    startLoop();
    initLiveBits();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
