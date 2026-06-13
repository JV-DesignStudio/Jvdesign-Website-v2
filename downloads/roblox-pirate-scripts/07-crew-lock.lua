-- 07-crew-lock.lua
-- Level 6, Step 5: "Lock Each Ship to Its Crew" (optional)
-- Put this Script INSIDE the VehicleSeat of each ship.
-- Requires a "Crew" StringValue on the ship Model (e.g. "Red Crew" / "Blue Crew")
-- matching the Team names from Level 6, Step 1.

local seat = script.Parent
local ship = seat.Parent
local crewName = ship:WaitForChild("Crew").Value

seat:GetPropertyChangedSignal("Occupant"):Connect(function()
  local occupant = seat.Occupant
  if occupant then
    local player = game.Players:GetPlayerFromCharacter(occupant.Parent)
    if player and player.Team and player.Team.Name ~= crewName then
      seat:Sit(nil) -- kick them back out
    end
  end
end)
