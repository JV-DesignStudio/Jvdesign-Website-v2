-- 09-win-and-leaderboard.lua — Script inside Final Checkpoint (Checkpoint4, the green 12x12 pad)
local finish = script.Parent
local Config = require(game.ReplicatedStorage.Config)
local DataStoreService = game:GetService("DataStoreService")
local store = DataStoreService:GetOrderedDataStore("BestTimes")
local finished = {}

finish.Touched:Connect(function(hit)
	local player = game.Players:GetPlayerFromCharacter(hit.Parent)
	if not player or finished[player.Name] then return end
	finished[player.Name] = true
	Config.COLLAPSE_SPEED = 0 -- STOP the collapse!
	local timeTaken = tick() - (player:GetAttribute("StartTime") or tick())
	if timeTaken < player.leaderstats.BestTime.Value then
		player.leaderstats.BestTime.Value = math.floor(timeTaken*10)/10
		pcall(function() store:SetAsync(tostring(player.UserId), math.floor(timeTaken*10)) end)
	end
	print(player.Name .. " WON in " .. timeTaken .. "s! 🌟")
end)

-- Leaderboard board: add a Part with SurfaceGui > TextLabel, then use:
-- local pages = store:GetSortedAsync(false, 10)
-- for _, entry in pages:GetCurrentPage() do print(entry.key, entry.value/10) end
