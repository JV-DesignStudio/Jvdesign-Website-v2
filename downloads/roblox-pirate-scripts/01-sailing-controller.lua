-- 01-sailing-controller.lua
-- Level 3, Step 3: "Script the Steering Controls"
-- Put this Script INSIDE your VehicleSeat.

local seat = script.Parent
local ship = seat.Parent
local hull = ship.PrimaryPart

local FORCE = Vector3.new(0, 0, 4000)  -- forward push strength
local TURN_SPEED = 1.5                 -- how fast it turns

local bodyVel = Instance.new("BodyVelocity")
bodyVel.MaxForce = Vector3.new(4000, 0, 4000)
bodyVel.Velocity = Vector3.new(0,0,0)
bodyVel.Parent = hull

local bodyGyro = Instance.new("BodyAngularVelocity")
bodyGyro.MaxTorque = Vector3.new(0, 40000, 0)
bodyGyro.AngularVelocity = Vector3.new(0,0,0)
bodyGyro.Parent = hull

game:GetService("RunService").Heartbeat:Connect(function()
  local forward = hull.CFrame.LookVector * (seat.Throttle * 50)
  bodyVel.Velocity = forward

  bodyGyro.AngularVelocity = Vector3.new(0, -seat.Steer * TURN_SPEED, 0)
end)
