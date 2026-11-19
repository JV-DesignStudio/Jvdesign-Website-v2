pico-8 cartridge // http://www.pico-8.com
version 42
__lua__
-- star catcher starter
score=0
bx=60
sx=60
sy=0

function _init()
 score=0
 bx=60
 sx=60
 sy=0
end

function _update()
 -- Step 2: move bx with btn(0) and btn(1)
 -- Step 3: sy += 1 and respawn at the top when it leaves the screen
 -- Step 4: catch check
end

function _draw()
 cls(1)
 rectfill(bx, 116, bx + 16, 120, 12)
 circfill(sx, sy, 3, 10)
 print("score " .. score, 2, 2, 7)
end
__gfx__
