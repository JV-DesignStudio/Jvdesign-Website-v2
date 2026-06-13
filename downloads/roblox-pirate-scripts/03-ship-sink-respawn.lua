-- 03-ship-sink-respawn.lua
-- Level 4, Step 4 + Level 6, Step 3 — combined.
-- Put this Script directly INSIDE your PirateShip Model.
-- Requires a "Health" NumberValue (start at 100) on the ship Model.

local ship = script.Parent
local health = ship:WaitForChild("Health")

-- Remember where every part started so we can respawn the ship at its dock
local startCFrames = {}
for _, part in ipairs(ship:GetDescendants()) do
  if part:IsA("BasePart") then
    startCFrames[part] = part.CFrame
  end
end

health.Changed:Connect(function(newValue)
  if newValue <= 0 then
    -- Slowly lower every part of the ship into the water
    for _, part in ipairs(ship:GetDescendants()) do
      if part:IsA("BasePart") then
        local tween = game:GetService("TweenService"):Create(
          part,
          TweenInfo.new(3),
          {Position = part.Position - Vector3.new(0,8,0)}
        )
        tween:Play()
      end
    end

    task.wait(4) -- let it sink first

    -- Teleport every part back to where it started (its dock)
    for part, cframe in pairs(startCFrames) do
      part.CFrame = cframe
    end

    health.Value = 100 -- reset health for next round
  end
end)
