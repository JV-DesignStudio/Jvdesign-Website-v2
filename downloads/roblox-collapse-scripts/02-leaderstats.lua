-- 02-leaderstats.lua — Place in ServerScriptService as Script named "Leaderstats"
game.Players.PlayerAdded:Connect(function(plr)
	local ls = Instance.new("Folder"); ls.Name = "leaderstats"; ls.Parent = plr
	local c = Instance.new("IntValue"); c.Name = "Coins"; c.Value = 0; c.Parent = ls
	local t = Instance.new("NumberValue"); t.Name = "BestTime"; t.Value = 999; t.Parent = ls
end)
