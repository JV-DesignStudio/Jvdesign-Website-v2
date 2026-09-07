-- 07-enemies.lua — Two separate scripts, one per enemy Model
-- 07a — Spinner (inside Spinner Part): rotates and kills on touch
--[[
local spinner = script.Parent
game:GetService("RunService").Heartbeat:Connect(function(dt)
	spinner.CFrame *= CFrame.Angles(0, math.rad(180) * dt, 0)
end)
spinner.Touched:Connect(function(hit)
	local hum = hit.Parent:FindFirstChildWhichIsA("Humanoid")
	if hum then hum.Health = 0 end
end)
]]

-- 07b — Patroller (inside Patroller Part): tweens back and forth, kills on touch
--[[
local plat = script.Parent
local TweenService = game:GetService("TweenService")
local startPos = plat.Position
local endPos = startPos + Vector3.new(12, 0, 0)
local info = TweenInfo.new(1.5, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true)
TweenService:Create(plat, info, {Position = endPos}):Play()
plat.Touched:Connect(function(hit)
	local hum = hit.Parent:FindFirstChildWhichIsA("Humanoid")
	if hum then hum.Health = 0 end
end)
]]
