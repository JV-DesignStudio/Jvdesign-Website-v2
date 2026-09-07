-- 08-powerups.lua — Three separate scripts
-- 08a — BoostPad (inside BoostPad Part)
--[[
script.Parent.Touched:Connect(function(hit)
	local hum = hit.Parent:FindFirstChildWhichIsA("Humanoid")
	if hum and not hit.Parent:GetAttribute("Boosted") then
		hit.Parent:SetAttribute("Boosted", true)
		hum.WalkSpeed = 32
		task.wait(3)
		hum.WalkSpeed = 16
		hit.Parent:SetAttribute("Boosted", false)
	end
end)
]]

-- 08b — Trampoline (inside Trampoline Part) — hero jumps really high
--[[
script.Parent.Touched:Connect(function(hit)
	local root = hit.Parent:FindFirstChild("HumanoidRootPart")
	local hum = hit.Parent:FindFirstChildWhichIsA("Humanoid")
	if root and hum then
		root.Velocity = Vector3.new(0, 90, 0)
	end
end)
]]

-- 08c — PauseController (ServerScriptService > Script "PauseController")
-- Tag pause pickups with "PausePickup"
--[[
local CS = game:GetService("CollectionService")
local Config = require(game.ReplicatedStorage.Config)
local originalSpeed = Config.COLLAPSE_SPEED
for _, pickup in CS:GetTagged("PausePickup") do
	pickup.Touched:Connect(function(hit)
		if pickup:GetAttribute("Used") then return end
		local player = game.Players:GetPlayerFromCharacter(hit.Parent)
		if not player then return end
		pickup:SetAttribute("Used", true)
		pickup.Transparency = 1; pickup.CanTouch = false
		Config.COLLAPSE_SPEED = 0
		game.ReplicatedStorage.Remotes.CollapseWarning:FireAllClients(false)
		task.wait(Config.TIME_FREEZE_DURATION)
		Config.COLLAPSE_SPEED = originalSpeed
		game.ReplicatedStorage.Remotes.CollapseWarning:FireAllClients(true)
		task.wait(10)
		pickup.Transparency = 0; pickup.CanTouch = true; pickup:SetAttribute("Used", false)
	end)
end
]]
