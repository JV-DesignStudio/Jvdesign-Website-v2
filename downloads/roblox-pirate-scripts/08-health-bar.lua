-- 08-health-bar.lua
-- Level 7, Step 2: "Add a Health Bar to the Screen"
-- Put this LocalScript INSIDE a ScreenGui in StarterGui.
-- Requires: ScreenGui > Frame (background) > Frame named "Fill" (green, full size).

local fill = script.Parent.Frame.Fill
local player = game.Players.LocalPlayer

task.spawn(function()
  while true do
    local character = player.Character
    if character then
      local seat = character:FindFirstChildOfClass("VehicleSeat")
      if seat and seat.Parent and seat.Parent:FindFirstChild("Health") then
        local pct = seat.Parent.Health.Value / 100
        fill.Size = UDim2.new(pct, 0, 1, 0)
      end
    end
    task.wait(0.2)
  end
end)
