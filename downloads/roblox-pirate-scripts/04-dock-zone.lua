-- 04-dock-zone.lua
-- Level 5, Step 3: "Let Players Dock & Walk Ashore"
-- Put this Script INSIDE a thin, invisible "DockZone" part along your shoreline.

local dockZone = script.Parent

dockZone.Touched:Connect(function(hit)
  local shipModel = hit:FindFirstAncestorOfClass("Model")
  if shipModel and shipModel:FindFirstChild("Health") then
    local hull = shipModel.PrimaryPart
    local bodyVel = hull:FindFirstChild("BodyVelocity")
    if bodyVel then bodyVel.Velocity = Vector3.new(0,0,0) end
  end
end)
