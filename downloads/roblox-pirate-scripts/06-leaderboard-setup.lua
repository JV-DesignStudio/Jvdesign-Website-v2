-- 06-leaderboard-setup.lua
-- Level 6, Step 4: "Build a Leaderboard"
-- Put this Script INSIDE ServerScriptService.

game.Players.PlayerAdded:Connect(function(player)
  local leaderstats = Instance.new("Folder")
  leaderstats.Name = "leaderstats"
  leaderstats.Parent = player

  local gold = Instance.new("IntValue")
  gold.Name = "Gold"
  gold.Value = 0
  gold.Parent = leaderstats

  local sunk = Instance.new("IntValue")
  sunk.Name = "ShipsSunk"
  sunk.Value = 0
  sunk.Parent = leaderstats
end)
