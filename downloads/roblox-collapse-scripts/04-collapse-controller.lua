-- 04-collapse-controller.lua — ServerScriptService > Script "CollapseController"
local Config = require(game.ReplicatedStorage:WaitForChild("Config"))
local wall = workspace.Map:WaitForChild("CollapseWall")
local RunService = game:GetService("RunService")

local running = false

-- Start when any player leaves Safe Zone (touches Checkpoint1)
workspace.Checkpoints:WaitForChild("Checkpoint1").Touched:Connect(function(hit)
	if running then return end
	local plr = game.Players:GetPlayerFromCharacter(hit.Parent)
	if plr then
		running = true
		plr:SetAttribute("StartTime", tick())
		game.ReplicatedStorage.Remotes:WaitForChild("CollapseWarning"):FireAllClients(true)
	end
end)

RunService.Heartbeat:Connect(function(dt)
	if not running then return end
	wall.Position += Vector3.new(0, 0, Config.COLLAPSE_SPEED * dt)
end)

wall.Touched:Connect(function(hit)
	local player = game.Players:GetPlayerFromCharacter(hit.Parent)
	if player and player.Character then
		local hum = hit.Parent:FindFirstChildWhichIsA("Humanoid")
		if hum then hum.Health = 0 end
	end
end)
