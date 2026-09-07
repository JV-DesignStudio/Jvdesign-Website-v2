-- 06-collect-system.lua — ServerScriptService > Script "CollectSystem"
-- Tag coins with "Coin", relics with "Relic" (Tag Editor)
local CollectionService = game:GetService("CollectionService")
local Players = game:GetService("Players")

local function makeCollectable(tag, value)
	for _, obj in CollectionService:GetTagged(tag) do
		obj.Touched:Connect(function(hit)
			if obj:GetAttribute("Collected") then return end
			local player = Players:GetPlayerFromCharacter(hit.Parent)
			if not player then return end
			obj:SetAttribute("Collected", true)
			player.leaderstats.Coins.Value += value
			-- optional sound: obj:FindFirstChildWhichIsA("Sound"):Play()
			obj.Transparency = 1; obj.CanTouch = false
			task.wait(5)
			obj.Transparency = 0; obj.CanTouch = true; obj:SetAttribute("Collected", false)
		end)
	end
end

makeCollectable("Coin", 1)
makeCollectable("Relic", 5)
