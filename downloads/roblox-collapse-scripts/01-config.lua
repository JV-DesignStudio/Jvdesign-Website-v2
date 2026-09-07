-- 01-config.lua — Put in ReplicatedStorage as ModuleScript named "Config"
-- Central tuning — change here, all scripts update
local Config = {
	COLLAPSE_SPEED = 16,  -- studs/sec -> 480 studs / 30s = 16 (11 = easy ~45s, 18 = hardcore)
	COLLAPSE_DELAY = 3,   -- grace time in Safe Zone before wall starts
	TIME_FREEZE_DURATION = 4, -- seconds Pause Time freezes the wall
	COIN_VALUE = 1,
	RELIC_VALUE = 5,
}

return Config
