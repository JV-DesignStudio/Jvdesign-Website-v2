-- 05-treasure-chest.lua
-- Level 5, Step 4: "Add a Treasure Chest"
-- Put this Script INSIDE a "TreasureChest" part that has a ProximityPrompt.
-- Requires the leaderstats setup from 06-leaderboard-setup.lua.

local chest = script.Parent
local prompt = chest:WaitForChild("ProximityPrompt")

prompt.Triggered:Connect(function(player)
  local leaderstats = player:FindFirstChild("leaderstats")
  if leaderstats and leaderstats:FindFirstChild("Gold") then
    leaderstats.Gold.Value = leaderstats.Gold.Value + 25
  end
  chest:Destroy() -- chest disappears once looted
end)
