-- Simulator Lockdown Episode 2: Map Generator starter
-- Paste this into ServerScriptService in Roblox Studio, then work through the canvas steps.

local Config = {
    nodeCount = 12,
    themes = {
        { name = "Neon",  colour = Color3.fromRGB(80, 220, 255), obstacle = "laser" },
        { name = "Rust",  colour = Color3.fromRGB(190, 110, 60), obstacle = "crate" },
        { name = "Frost", colour = Color3.fromRGB(200, 240, 255), obstacle = "ice" },
    },
}

-- Step 1: give each map a theme.
-- Step 2: turn a random list of positions into a walkable course.
-- Step 3: choose a layout archetype so courses come out in different shapes.
-- Step 4: place obstacles by weight so two maps of the same theme still differ.
-- Step 5: call the generator at the start of every round.
-- Step 6: play twice and compare the courses.

return Config
