-- Simulator Lockdown Episode 3: Glitch Gauntlet starter
-- Paste this into ServerScriptService in Roblox Studio, then work through the canvas steps.

local Gauntlet = {}

local rings = 4
local shrinkEvery = 20

function Gauntlet.give(player)
    -- Step 1: give every player the Glitch Gauntlet tool at round start.
end

function Gauntlet.shove(player, direction)
    -- Step 2: find players in a cone in front of the player and launch them away.
end

function Gauntlet.rank(players)
    -- Step 3: sort the players and cut the last one.
end

function Gauntlet.buildArena()
    -- Step 4: build a circular-looking platform from square tiles, each tagged with its ring.
end

function Gauntlet.shrink()
    -- Step 5: delete the outermost ring on a timer and crown the last player standing.
end

function Gauntlet.champion(player)
    -- Step 6: celebrate the winner and publish the game.
end

return Gauntlet
