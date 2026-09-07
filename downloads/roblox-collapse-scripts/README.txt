World Collapse! — Roblox Copy-Paste Scripts
=========================================
How to use:
1. Open Roblox Studio → Baseplate
2. Create folders/objects exactly as Steps 1-2 say (Map, Checkpoints, ReplicatedStorage/Config, Remotes)
3. Open each .lua file, Select All (Ctrl+A), Copy (Ctrl+C), then in Studio right-click target > Insert Object > Script/ModuleScript/LocalScript and Paste (Ctrl+V)
4. File mapping:
   01-config.lua          -> ReplicatedStorage > ModuleScript "Config"
   02-leaderstats.lua     -> ServerScriptService > Script "Leaderstats"
   03-checkpoint-manager  -> ServerScriptService > Script "CheckpointManager"
   04-collapse-controller -> ServerScriptService > Script "CollapseController"
   05-crumble-controller  -> ServerScriptService > Script "CrumbleController"
   06-collect-system      -> ServerScriptService > Script "CollectSystem"
   07-enemies.lua         -> See inside: 07a Spinner inside Spinner Part, 07b Patroller inside Patroller Part
   08-powerups.lua        -> 08a BoostPad / 08b Trampoline / 08c PauseController (ServerScriptService)
   09-win-and-leaderboard -> Inside final Checkpoint4 green pad
   10-client-effects      -> StarterGui > CollapseGui > LocalScript "ClientEffects"

Also need in ReplicatedStorage > Remotes: RemoteEvent "CollapseWarning"
Enable Game Settings > Security > Enable Studio Access to API Services for BestTime saving.
Full step-by-step: https://jvdesignstudio.co.uk/workshops/roblox-collapse-obby-workshop.html
