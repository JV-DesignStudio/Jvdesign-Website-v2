-- 10-client-effects.lua — StarterGui > CollapseGui > LocalScript "ClientEffects"
local player = game.Players.LocalPlayer
local label = script.Parent:WaitForChild("TimerLabel")
local bar = script.Parent:WaitForChild("Bar"):WaitForChild("Fill")
local Config = require(game.ReplicatedStorage:WaitForChild("Config"))
local wall = workspace:WaitForChild("Map"):WaitForChild("CollapseWall")

local totalDist = 480 -- your course length
local frozen = false
game.ReplicatedStorage.Remotes:WaitForChild("CollapseWarning").OnClientEvent:Connect(function(isRunning)
	frozen = not isRunning
end)

game:GetService("RunService").RenderStepped:Connect(function()
	local char = player.Character
	if not char or frozen then return end
	local root = char:FindFirstChild("HumanoidRootPart")
	if not root then return end
	local dist = wall.Position.Z - root.Position.Z
	local pct = math.clamp(dist / totalDist, 0, 1)
	bar.Size = UDim2.new(pct, 0, 1, 0)
	local timeLeft = pct * 30
	label.Text = frozen and "❄️ FROZEN!" or ("⏱️ " .. string.format("%.1f", timeLeft))
	label.TextColor3 = timeLeft < 10 and Color3.fromRGB(255,50,50) or Color3.fromRGB(255,255,255)
	if dist < 40 then
		workspace.CurrentCamera.CFrame *= CFrame.new(math.random(-1,1)*0.15, math.random(-1,1)*0.15, 0)
	end
end)
