-- 05-crumble-controller.lua — ServerScriptService > Script "CrumbleController"
-- Tag every course platform (except Safe Zone) with Tag "Crumble" via Tag Editor
local CollectionService = game:GetService("CollectionService")
local TweenService = game:GetService("TweenService")
local wall = workspace.Map:WaitForChild("CollapseWall")
local tweenInfo = TweenInfo.new(0.8, Enum.EasingStyle.Quad, Enum.EasingDirection.In)

for _, plat in CollectionService:GetTagged("Crumble") do
	plat:SetAttribute("Crumbled", false)
end

game:GetService("RunService").Heartbeat:Connect(function()
	for _, plat in CollectionService:GetTagged("Crumble") do
		if plat:GetAttribute("Crumbled") then continue end
		-- wall has passed this platform
		if wall.Position.Z > plat.Position.Z + 4 then
			plat:SetAttribute("Crumbled", true)
			local tw = TweenService:Create(plat, tweenInfo, {Transparency = 1})
			tw:Play()
			tw.Completed:Wait()
			plat.CanCollide = false
			plat.Anchored = false -- now it falls!
		end
	end
end)
