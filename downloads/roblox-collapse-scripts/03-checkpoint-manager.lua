-- 03-checkpoint-manager.lua — ServerScriptService > Script "CheckpointManager"
local Checkpoints = workspace:WaitForChild("Checkpoints")

for _, cp in Checkpoints:GetChildren() do
	cp.Touched:Connect(function(hit)
		local player = game.Players:GetPlayerFromCharacter(hit.Parent)
		if player then
			local num = tonumber(cp.Name:match("%d+"))
			if num and num > (player:GetAttribute("Checkpoint") or 0) then
				player:SetAttribute("Checkpoint", num)
				-- Next death respawns here (if cp is a SpawnLocation). If it's a Part, use this fallback:
				-- player.RespawnLocation = cp
				-- Or store vector: player:SetAttribute("SpawnCFrame", cp.CFrame)
			end
		end
	end)
end
