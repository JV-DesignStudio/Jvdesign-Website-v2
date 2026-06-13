-- 02-cannon-fire.lua
-- Level 4, Steps 2, 3 & 5 (+ Level 7 Step 1 sound) — all combined.
-- Put this Script INSIDE your CannonBarrel part.
-- Requires: a ClickDetector inside CannonBarrel, a "Health" NumberValue on each
-- ship Model, and (optionally) a "Smoke" ParticleEmitter and a Sound on the cannon.

local cannon = script.Parent
local click = cannon:WaitForChild("ClickDetector")
local Debris = game:GetService("Debris")
local ship = cannon.Parent

local COOLDOWN = 1.5 -- seconds between shots
local canFire = true

click.MouseClick:Connect(function(player)
  if not canFire then return end
  canFire = false

  local ball = Instance.new("Part")
  ball.Shape = Enum.PartType.Ball
  ball.Size = Vector3.new(1.5,1.5,1.5)
  ball.BrickColor = BrickColor.new("Really black")
  ball.CFrame = cannon.CFrame * CFrame.new(0,0,-3)
  ball.Name = "Cannonball"
  ball.Parent = workspace

  local bodyVel = Instance.new("BodyVelocity")
  bodyVel.MaxForce = Vector3.new(math.huge,math.huge,math.huge)
  bodyVel.Velocity = cannon.CFrame.LookVector * -120
  bodyVel.Parent = ball

  Debris:AddItem(ball, 5) -- auto-delete after 5 seconds

  -- Puff of smoke at the cannon's mouth (Level 4, Step 5)
  local smoke = cannon:FindFirstChild("Smoke")
  if smoke then
    smoke:Emit(20)
  end

  -- Cannon "boom" sound (Level 7, Step 1)
  local sound = cannon:FindFirstChildOfClass("Sound")
  if sound then sound:Play() end

  -- Damage whatever the cannonball touches (Level 4, Step 3)
  ball.Touched:Connect(function(hit)
    local hitModel = hit:FindFirstAncestorOfClass("Model")
    if hitModel and hitModel ~= ship and hitModel:FindFirstChild("Health") then
      local health = hitModel.Health
      health.Value = health.Value - 15

      -- Splash effect where the cannonball lands (Level 4, Step 5)
      local splash = Instance.new("Part")
      splash.Shape = Enum.PartType.Ball
      splash.Anchored = true
      splash.CanCollide = false
      splash.Material = Enum.Material.Water
      splash.BrickColor = BrickColor.new("Cyan")
      splash.Size = Vector3.new(2,2,2)
      splash.Position = ball.Position
      splash.Transparency = 0.3
      splash.Parent = workspace
      Debris:AddItem(splash, 1)

      ball:Destroy() -- ball disappears on impact

      if health.Value <= 0 then
        print(hitModel.Name .. " has been sunk!")
      end
    end
  end)

  task.wait(COOLDOWN)
  canFire = true
end)
