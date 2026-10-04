// achievements.js , canonical source of truth for achievement toast labels (A763).
// Used by the in-run achievement popup and the game-over achievement chips.
// tools/arcade-game-maker.html imports this module and publishes it on window.
// Import: import { ACH_TOAST } from "./achievements.js";

const ACH_TOAST = {
    first_blood:'🎯 First Blood', centurion:'💯 Centurion', high_roller:'💰 High Roller',
    survivor:'⏱ Survivor (60s)', untouchable:'🛡 Untouchable', wave_3:'👾 Wave 3 Clear',
    power_up:'⚡ Power-Up!', speed_demon:'🚀 Speed Demon', goal_reached:'🏁 Goal Reached!',
    // Genre-specific
    snake_long:'🐍 Big Snake (20+)', snake_flawless:'🌟 Flawless Run',
    pong_shutout:'🏓 Shutout!', pong_comeback:'💪 Comeback Win!',
    invaders_perfect:'🛸 Perfect Wave', asteroids_chain:'🌌 3-Wave Chain', asteroids_ace:'⭐ Asteroid Ace (Wave 5)',
    runner_survivor:'⏱ Runner Survivor (100s)', runner_centurion:'💯 Runner 1K',
    plat_clean:'🧹 Flawless Platformer', shooter_combo10:'🔥 10× Combo!',
    rogue_floor3:'⚔️ Floor 3 Reached!',
    race_podium:'🏆 Podium Finish', race_clean:'🌟 Clean Lap (no off-road)', race_nitro3:'⚡ Nitro Triple', race_fast:'🏎️ Under 30s Lap',
    hop_100:'🐸 Height 100!', hop_500:'🌤 Cloud Jumper!'};

export { ACH_TOAST };
