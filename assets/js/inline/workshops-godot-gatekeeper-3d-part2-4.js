const STEPS = [
  {
    num: "11",
    title: "The Waiting Line (The 3D Queue)",
    goal: "Tell the game how many visitors are waiting in line. When one leaves the gate, spawn the next one.",
    child: {
      intro: "How many people should visit our 3D checkpoint today? 5? 10? You decide! When one visitor walks away, the next one starts down the path toward the gate.",
      items: [
        "Open your <code>game_manager.gd</code> Autoload from Part 1 and add the code below.",
        "Save your Survivor3D scene as <code>survivor_3d.tscn</code> so the game can make copies of it.",
        "In <code>gate_controller.gd</code>, add <code>GameManager.next_visitor()</code> as the last line of <code>_finish_visitor()</code>. Each time a visitor leaves, the next one sets off.",
        "In <code>day_manager.gd</code>, add <code>GameManager.next_visitor()</code> at the end of <code>_ready()</code> so the first visitor appears when the day starts."
      ]
    },
    parent: {
      intro: "The queue manager is the director of traffic. It maintains a count and triggers the spawner when the count is above zero. In multiplayer, run this on the server only, spawned survivors sync through a <code>MultiplayerSpawner</code> node.",
      items: [
        "Add a <code>MultiplayerSpawner</code> to your World scene, set its <strong>Spawn Path</strong> to the World node and add <code>survivor_3d.tscn</code> to its <strong>Auto Spawn List</strong>. Survivors the host creates then appear for everyone.",
        "Randomise <code>hidden_stats</code> on spawn so each day is different: <code>randf_range(96.0, 105.0)</code> for temperature.",
        "Increase <code>visitors_in_line</code> each day: <code>visitors_in_line = 4 + current_day * 2</code>."
      ]
    },
    code: {
      filename: "game_manager.gd (add the queue)",
      body: `<span class="cmt"># Add these to your game_manager.gd Autoload</span>
<span class="kw">var</span> visitors_in_line: <span class="typ">int</span> <span class="op">=</span> <span class="num">5</span>

<span class="kw">func</span> <span class="fn">next_visitor</span>() -&gt; <span class="kw">void</span>:
    <span class="kw">if</span> visitors_in_line <span class="op">&gt;</span> <span class="num">0</span>:
        visitors_in_line <span class="op">-=</span> <span class="num">1</span>
        <span class="fn">spawn_survivor</span>()
    <span class="kw">else</span>:
        <span class="fn">print</span>(<span class="str">"Line is empty, the day is nearly over!"</span>)

<span class="kw">func</span> <span class="fn">spawn_survivor</span>() -&gt; <span class="kw">void</span>:
    <span class="kw">var</span> s <span class="op">=</span> <span class="fn">preload</span>(<span class="str">"res://survivor_3d.tscn"</span>).<span class="fn">instantiate</span>()
    s.position <span class="op">=</span> <span class="typ">Vector3</span>(<span class="num">0</span>, <span class="num">0</span>, <span class="num">15</span>)   <span class="cmt"># far end of the path</span>
    <span class="cmt"># randomise the hidden stats each time</span>
    s.hidden_stats[<span class="str">"temperature"</span>] <span class="op">=</span> <span class="fn">randf_range</span>(<span class="num">96.0</span>, <span class="num">105.0</span>)
    s.hidden_stats[<span class="str">"has_spots"</span>]   <span class="op">=</span> <span class="fn">randf</span>() <span class="op">&gt;</span> <span class="num">0.5</span>
    <span class="fn">get_tree</span>().current_scene.<span class="fn">add_child</span>(s)`
    },
    xp: 70
  },
  {
    num: "12",
    title: "The 3D Clock is Ticking!",
    goal: "Give the booth clock its own script so it flashes red when time is running out.",
    child: {
      intro: "You can't take all day inspecting one person! The clock on the booth wall ticks down, when it hits zero, the day ends whether the line is finished or not!",
      items: [
        "Your <code>ClockLabel</code> from Part 1 already shows the time. Now it gets its own script so it can flash red when time is nearly up!",
        "Open <code>day_manager.gd</code> and delete its <code>_process()</code> function and the <code>clock_lbl</code> line. The clock script takes over that job.",
        "Attach <code>clock_display.gd</code> to ClockLabel. It finds DayTimer by its unique name, just like the day manager did."
      ]
    },
    parent: {
      intro: "The clock reads <code>Timer.time_left</code> each frame and formats it as MM:SS. In multiplayer, only the host's timer is authoritative, clients display it via a synced variable rather than running their own independent timers.",
      items: [
        "To sync the time across players, add <code>@export var synced_time_left: float</code> to <code>day_manager.gd</code> and include it in a <code>MultiplayerSynchronizer</code>.",
        "Set <code>Label3D.font_size</code> large enough to read from a distance, 64 or higher.",
        "Add a colour shift when under 30 seconds: change <code>Label3D.modulate</code> to red via a Tween."
      ]
    },
    code: {
      filename: "clock_display.gd",
      body: `<span class="cmt"># clock_display.gd: Attach to your ClockLabel Label3D</span>
<span class="kw">extends</span> <span class="typ">Label3D</span>

<span class="at">@onready</span> <span class="kw">var</span> day_timer: <span class="typ">Timer</span> <span class="op">=</span> %DayTimer

<span class="kw">func</span> <span class="fn">_process</span>(_delta: <span class="typ">float</span>) -&gt; <span class="kw">void</span>:
    <span class="kw">var</span> s_left <span class="op">:=</span> <span class="typ">int</span>(day_timer.time_left)
    text <span class="op">=</span> <span class="str">"%02d:%02d"</span> <span class="op">%</span> [s_left <span class="op">/</span> <span class="num">60</span>, s_left <span class="op">%</span> <span class="num">60</span>]

    <span class="cmt"># Flash red when under 30 seconds</span>
    <span class="kw">if</span> s_left <span class="op">&lt;</span> <span class="num">30</span>:
        modulate <span class="op">=</span> <span class="typ">Color</span>.RED
    <span class="kw">else</span>:
        modulate <span class="op">=</span> <span class="typ">Color</span>.WHITE`
    },
    xp: 50
  },
  {
    num: "13",
    title: "Shared Piggy Bank (Earning Credits)",
    goal: "Add money when the team stamps correctly, and take money away when they make a mistake.",
    child: {
      intro: "We're setting up your team piggy bank! Every good decision earns +10 coins for everyone. Every bad decision costs the whole team -20 coins. Work together, your coins are shared!",
      items: [
        "Add <code>var shared_credits = 50</code> to your <code>GameManager</code> Autoload.",
        "Add a 3D <code>Label3D</code> inside the base, call it <code>CreditsLabel</code>, and add it to a group called <code>credits_label</code>.",
        "In <code>gate_controller.gd</code>, add <code>else: GameManager.correct_stamp()</code> under each <code>GameManager.mistake_made()</code> check, so right answers earn coins.",
        "Replace your old <code>mistake_made()</code> in game_manager.gd with the new version below. Now mistakes cost coins as well as health."
      ]
    },
    parent: {
      intro: "The economy runs as a shared global state in the GameManager Autoload. In multiplayer, run all credit changes on the server and broadcast the new total via RPC to keep all clients in sync, never trust the client to report its own credits.",
      items: [
        "For the RPC pattern: <code>@rpc(\"authority\", \"call_local\") func sync_credits(val):</code> → set <code>shared_credits = val</code> on all peers.",
        "Prefer the coins on screen instead of on a wall? Put a <code>Label</code> inside a <code>CanvasLayer</code>. It stays pinned to the screen while you walk around.",
        "Cap credits at a maximum if you want a harder challenge: <code>shared_credits = min(shared_credits + 10, 200)</code>."
      ]
    },
    code: {
      filename: "game_manager.gd (update)",
      body: `<span class="cmt"># Add these to your existing game_manager.gd</span>
<span class="kw">var</span> shared_credits: <span class="typ">int</span> <span class="op">=</span> <span class="num">50</span>

<span class="kw">func</span> <span class="fn">correct_stamp</span>() -&gt; <span class="kw">void</span>:
    shared_credits <span class="op">+=</span> <span class="num">10</span>
    <span class="fn">_update_credits_display</span>()
    <span class="fn">print</span>(<span class="str">"✅ +10 coins! Total: %d"</span> <span class="op">%</span> shared_credits)

<span class="cmt"># Replace your old mistake_made() with this version</span>
<span class="kw">func</span> <span class="fn">mistake_made</span>() -&gt; <span class="kw">void</span>:
    shared_credits <span class="op">-=</span> <span class="num">20</span>
    base_health    <span class="op">-=</span> <span class="num">20</span>
    <span class="fn">_update_credits_display</span>()
    <span class="fn">_update_health_display</span>()
    <span class="fn">print</span>(<span class="str">"❌ -20 coins! Total: %d"</span> <span class="op">%</span> shared_credits)
    <span class="kw">if</span> shared_credits <span class="op">&lt;=</span> <span class="num">0</span> <span class="kw">or</span> base_health <span class="op">&lt;=</span> <span class="num">0</span>:
        <span class="fn">game_over</span>()

<span class="kw">func</span> <span class="fn">_update_credits_display</span>() -&gt; <span class="kw">void</span>:
    <span class="kw">var</span> lbl <span class="op">=</span> <span class="fn">get_tree</span>().<span class="fn">get_first_node_in_group</span>(<span class="str">"credits_label"</span>)
    <span class="kw">if</span> lbl:
        lbl.text <span class="op">=</span> <span class="str">"💰 %d coins"</span> <span class="op">%</span> shared_credits`
    },
    xp: 70
  },
  {
    num: "14",
    title: "Paying Base Rent (End of Day Room)",
    goal: "Make an end-of-day screen that subtracts your living and shelter costs. The base costs money to keep running!",
    child: {
      intro: "The day is over, but now the base has bills to pay! 20 coins for Base Rent and 10 coins for Food, every single day. Earn enough to keep the base alive!",
      items: [
        "When the day ends, all players teleport to your safe room (from Part 1 Step 9).",
        "Add a <code>Node3D</code> called <strong>EndOfDayScreen</strong> in the safe room with a <code>Label3D</code> child called <strong>SummaryScreen</strong>, and attach <code>end_of_day.gd</code> to EndOfDayScreen.",
        "Right-click EndOfDayScreen → <strong>Access as Unique Name</strong>. Then in day_manager.gd's <code>end_day()</code>, add <code>%EndOfDayScreen.pay_bills()</code> just above the <code>GameManager.current_day += 1</code> line.",
        "Add a 'Next Day' button players can press to move on when they're ready."
      ]
    },
    parent: {
      intro: "Bill-paying happens once per day-end transition. Track <code>day_earnings</code> during the day so you can show the net gain/loss. If the economy gets too punishing, adjust FOOD_COST and BASE_RENT here, these are the levers that control game difficulty.",
      items: [
        "In multiplayer, trigger <code>pay_bills()</code> via an RPC from the server after all players confirm they've arrived in the safe room.",
        "Show a breakdown: stamped correctly × 10, mistakes × −20, rent −20, food −10. This teaches the child about income vs. expenses.",
        "Consider adding a 'Buy extra time' option for later days, spending 50 coins buys 30 more seconds on the next day's timer."
      ]
    },
    code: {
      filename: "end_of_day.gd",
      body: `<span class="cmt"># end_of_day.gd: Attach to EndOfDayScreen in your safe room</span>
<span class="kw">extends</span> <span class="typ">Node3D</span>

<span class="kw">const</span> BASE_RENT: <span class="typ">int</span> <span class="op">=</span> <span class="num">20</span>
<span class="kw">const</span> FOOD_COST: <span class="typ">int</span> <span class="op">=</span> <span class="num">10</span>

<span class="at">@onready</span> <span class="kw">var</span> summary: <span class="typ">Label3D</span> <span class="op">=</span> $SummaryScreen

<span class="kw">func</span> <span class="fn">pay_bills</span>() -&gt; <span class="kw">void</span>:
    <span class="kw">var</span> before <span class="op">=</span> <span class="typ">GameManager</span>.shared_credits
    <span class="typ">GameManager</span>.shared_credits <span class="op">-=</span> BASE_RENT
    <span class="typ">GameManager</span>.shared_credits <span class="op">-=</span> FOOD_COST
    <span class="typ">GameManager</span>.<span class="fn">_update_credits_display</span>()

    summary.text <span class="op">=</span> (
        <span class="str">"📋 DAY %d COMPLETE\\n"</span>
        <span class="op">+</span> <span class="str">"────────────────\\n"</span>
        <span class="op">+</span> <span class="str">"Coins before bills: %d\\n"</span>
        <span class="op">+</span> <span class="str">"Base Rent:          -%d\\n"</span>
        <span class="op">+</span> <span class="str">"Food:               -%d\\n"</span>
        <span class="op">+</span> <span class="str">"────────────────\\n"</span>
        <span class="op">+</span> <span class="str">"Coins left:         %d"</span>
    ) <span class="op">%</span> [
        <span class="typ">GameManager</span>.current_day,
        before,
        BASE_RENT,
        FOOD_COST,
        <span class="typ">GameManager</span>.shared_credits
    ]`
    },
    xp: 70
  },
  {
    num: "15",
    title: "Day 2 Rules, Escalating Difficulty",
    goal: "Use a match statement to change the game's rules based on what day it is. Each day adds a new challenge!",
    child: {
      intro: "The camp leader is changing the rules! On Day 1, we only checked temperatures. On Day 2, let's add green spots that need a second tool! Each new day makes the game harder, can you keep up?",
      items: [
        "Check that <code>var current_day = 1</code> is in your game_manager.gd. You added it in Part 1!",
        "Your day manager already adds 1 to <code>current_day</code> at the end of each day, so the Next Day button just needs to call <code>start_next_day()</code>.",
        "Save the code below as <code>rule_generator.gd</code> and add it as an Autoload called <strong>RuleGenerator</strong> (Project → Project Settings → Autoloads).",
        "In rulebook.gd, change the inside of <code>update_for_day()</code> to one line: <code>rule_sign.text = RuleGenerator.get_rules(day)</code>.",
        "Rename your rulebook board to <strong>Rulebook</strong>, mark it <strong>Access as Unique Name</strong>, and add <code>%Rulebook.update_for_day(GameManager.current_day)</code> to <code>start_next_day()</code>. Now the sign changes every morning!"
      ]
    },
    parent: {
      intro: "The match statement is GDScript's switch/case, clean and efficient for day-based rule escalation. Add as many cases as you like. In multiplayer, <code>current_day</code> lives in the server-authoritative GameManager and is synced to all clients via RPC or MultiplayerSynchronizer.",
      items: [
        "Keep an authoritative <code>var current_day: int</code> in your GameManager, don't let clients advance it independently.",
        "For an RPC advance: <code>@rpc(\"authority\", \"call_local\") func set_day(d):</code> → <code>current_day = d</code>.",
        "On day change, also reset <code>visitors_in_line</code>, re-randomise survivor stats, and call <code>rulebook.update_for_day(current_day)</code>."
      ]
    },
    code: {
      filename: "rule_generator.gd",
      body: `<span class="cmt"># rule_generator.gd: Register as an Autoload called RuleGenerator</span>
<span class="kw">extends</span> <span class="typ">Node</span>

<span class="kw">func</span> <span class="fn">get_rules</span>(day: <span class="typ">int</span>) -&gt; <span class="typ">String</span>:
    <span class="kw">match</span> day:
        <span class="num">1</span>:
            <span class="kw">return</span> <span class="str">"DO NOT let in anyone\\nwith temp &gt; 100°F!"</span>
        <span class="num">2</span>:
            <span class="kw">return</span> <span class="str">"NO temp &gt; 100°F!\\nNO green spots allowed!"</span>
        <span class="num">3</span>:
            <span class="kw">return</span> <span class="str">"ADMIT District 7 residents.\\nDeny all others with temp &gt; 100°F."</span>
        <span class="num">4</span>:
            <span class="kw">return</span> <span class="str">"DENY anyone with green spots\\nOR temp &gt; 99°F, stricter today!"</span>
        <span class="num">5</span>:
            <span class="kw">return</span> <span class="str">"EMERGENCY LOCKDOWN:\\nOnly pre-approved visitors allowed!"</span>
        _:
            <span class="kw">return</span> <span class="str">"Check ALL previous rules.\\nStay alert, rules are stacking!"</span>`
    },
    xp: 80
  },
  {
    num: "16",
    title: "The Co-op Magnifying Glass",
    goal: "Build a second 3D tool so players can divide the inspection work, one holds the thermometer, one holds the glass!",
    child: {
      intro: "You can't carry everything! Have one friend hold the thermometer and another hold the magnifying glass. Two tools, two players, twice the power!",
      items: [
        "Duplicate your Thermometer scene in the FileSystem, rename the copy <strong>MagnifyingGlass</strong>.",
        "Change the mesh to something flat and round (or use a <code>SphereMesh</code> tinted green).",
        "Rename the script to <code>magnifying_glass.gd</code> and update the code below.",
        "Place the magnifying glass in the scene near the gate for players to pick up.",
        "Teach the gate the new rule! In <code>gate_controller.gd</code>, change the line inside <code>is_safe()</code> to <code>return survivor.hidden_stats[\"temperature\"] &lt;= 100.0 and not survivor.hidden_stats[\"has_spots\"]</code>."
      ]
    },
    parent: {
      intro: "The magnifying glass reads <code>has_spots</code> from <code>hidden_stats</code>, the boolean that <code>spawn_survivor()</code> randomises in Step 11. The tool design pattern mirrors the thermometer exactly, which is intentional: one script template, two tools, different stat keys. More tools for later days are trivial to add.",
      items: [
        "<code>has_spots</code> is already randomised on spawn. Make spots rarer with <code>randf() &gt; 0.7</code>, or more common with <code>randf() &gt; 0.3</code>.",
        "For Day 3+, add <code>has_permit: bool</code> and <code>district: String</code> stats, each new rule pair gets a new tool.",
        "Consider a tool belt system: players can only carry one tool at a time, encouraging coordination."
      ]
    },
    code: {
      filename: "magnifying_glass.gd",
      body: `<span class="cmt"># magnifying_glass.gd: Attach to your MagnifyingGlass Node3D</span>
<span class="kw">extends</span> <span class="typ">Node3D</span>

<span class="at">@onready</span> <span class="kw">var</span> result_label: <span class="typ">Label3D</span> <span class="op">=</span> $ResultLabel

<span class="kw">func</span> <span class="fn">_ready</span>() -> <span class="kw">void</span>:
    result_label.visible <span class="op">=</span> <span class="kw">false</span>

<span class="kw">func</span> <span class="fn">_on_area_3d_body_entered</span>(body: <span class="typ">Node3D</span>) -> <span class="kw">void</span>:
    <span class="kw">if</span> body.<span class="fn">is_in_group</span>(<span class="str">"survivor"</span>):
        <span class="kw">var</span> spots: <span class="typ">bool</span> <span class="op">=</span> body.hidden_stats.<span class="fn">get</span>(<span class="str">"has_spots"</span>, <span class="kw">false</span>)
        <span class="kw">if</span> spots:
            result_label.text    <span class="op">=</span> <span class="str">"🔎 GREEN SPOTS DETECTED!"</span>
            result_label.modulate <span class="op">=</span> <span class="typ">Color</span>.<span class="typ">RED</span>
        <span class="kw">else</span>:
            result_label.text    <span class="op">=</span> <span class="str">"🔎 No spots. Clear."</span>
            result_label.modulate <span class="op">=</span> <span class="typ">Color</span>.<span class="typ">GREEN</span>
        result_label.visible <span class="op">=</span> <span class="kw">true</span>

<span class="kw">func</span> <span class="fn">_on_area_3d_body_exited</span>(body: <span class="typ">Node3D</span>) -> <span class="kw">void</span>:
    <span class="kw">if</span> body.<span class="fn">is_in_group</span>(<span class="str">"survivor"</span>):
        result_label.visible <span class="op">=</span> <span class="kw">false</span>`
    },
    xp: 80
  },
  {
    num: "17",
    title: "Winning and Losing Together!",
    goal: "Check if the team won the 10-day challenge or went bankrupt, every co-op game needs an ending!",
    child: {
      intro: "If your shared piggy bank runs out, GAME OVER for the whole team! But if you survive all 10 days, a giant YOU SURVIVED banner appears with golden fireworks! 🏆",
      items: [
        "Add a <code>Node3D</code> called <strong>WinLoseChecker</strong> to your safe room and attach <code>win_lose_checker.gd</code>.",
        "Give it three children: a <code>Label3D</code> called <strong>ResultBanner</strong>, a <code>GPUParticles3D</code> called <strong>Fireworks</strong> and an <code>AudioStreamPlayer</code> called <strong>VictorySound</strong>.",
        "Mark WinLoseChecker as <strong>Access as Unique Name</strong>, then add <code>%WinLoseChecker.check_game_state()</code> as the very last line of <code>end_day()</code>, after the bills are paid.",
        "The script checks coins and base health. Run out of either and it's game over; get past Day 10 and you win!"
      ]
    },
    parent: {
      intro: "Win/lose is checked once per day transition, after bills are paid. This gives players a chance to see their final stats before the screen changes. In multiplayer, the server broadcasts the result via RPC so all players see the same outcome simultaneously.",
      items: [
        "For an RPC broadcast: <code>@rpc(\"authority\", \"call_local\") func show_result(won: bool)</code> → show the appropriate banner.",
        "Add a GPUParticles3D system for the fireworks, set <code>emitting = true</code> on victory, <code>false</code> on game over.",
        "Record a final score: correct stamps × 10 minus mistakes × 20. Show it on the result screen, gives players a target to beat next run!"
      ]
    },
    code: {
      filename: "win_lose_checker.gd",
      body: `<span class="cmt"># win_lose_checker.gd: Attach to WinLoseChecker in your safe room</span>
<span class="kw">extends</span> <span class="typ">Node3D</span>

<span class="at">@onready</span> <span class="kw">var</span> banner:    <span class="typ">Label3D</span>           <span class="op">=</span> $ResultBanner
<span class="at">@onready</span> <span class="kw">var</span> fireworks: <span class="typ">GPUParticles3D</span>    <span class="op">=</span> $Fireworks
<span class="at">@onready</span> <span class="kw">var</span> sfx:       <span class="typ">AudioStreamPlayer</span> <span class="op">=</span> $VictorySound

<span class="kw">func</span> <span class="fn">check_game_state</span>() -&gt; <span class="kw">void</span>:
    <span class="kw">var</span> credits <span class="op">=</span> <span class="typ">GameManager</span>.shared_credits
    <span class="kw">var</span> health  <span class="op">=</span> <span class="typ">GameManager</span>.base_health
    <span class="kw">var</span> day     <span class="op">=</span> <span class="typ">GameManager</span>.current_day

    <span class="kw">if</span> credits <span class="op">&lt;=</span> <span class="num">0</span> <span class="kw">or</span> health <span class="op">&lt;=</span> <span class="num">0</span>:
        <span class="fn">show_game_over</span>()
    <span class="kw">elif</span> day <span class="op">&gt;</span> <span class="num">10</span>:
        <span class="fn">show_victory</span>()

<span class="kw">func</span> <span class="fn">show_game_over</span>() -&gt; <span class="kw">void</span>:
    banner.text        <span class="op">=</span> <span class="str">"❌ GAME OVER!\\nThe base has fallen."</span>
    banner.modulate    <span class="op">=</span> <span class="typ">Color</span>.RED
    fireworks.emitting <span class="op">=</span> <span class="kw">false</span>

<span class="kw">func</span> <span class="fn">show_victory</span>() -&gt; <span class="kw">void</span>:
    banner.text        <span class="op">=</span> <span class="str">"🏆 YOU SURVIVED!\\n10 DAYS COMPLETE!"</span>
    banner.modulate    <span class="op">=</span> <span class="typ">Color</span>(<span class="num">1.0</span>, <span class="num">0.84</span>, <span class="num">0.0</span>)   <span class="cmt"># gold</span>
    fireworks.emitting <span class="op">=</span> <span class="kw">true</span>
    sfx.<span class="fn">play</span>()`
    },
    xp: 100
  }
];

// ─── STATE ────────────────────────────────────────────────
const STORAGE_KEY = "jvds-godot-gatekeeper3d-p2-v2";
const WORKSHOP_TOTAL = 7;
let state = {};
const collapsed = new Set();

function totalXp() {
  return state.completed.reduce((sum, idx) => sum + (STEPS[idx] ? STEPS[idx].xp : 0), 0);
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    state = { completed: saved && Array.isArray(saved.completed) ? saved.completed.filter(i => STEPS[i]) : [] };
  } catch { state = { completed: [] }; }
  state.completed.forEach(i => collapsed.add(i));
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ completed: state.completed, total: WORKSHOP_TOTAL, xp: totalXp() }));
  } catch {}
}

function toggleStep(i) {
  if (collapsed.has(i)) collapsed.delete(i); else collapsed.add(i);
  refreshUI();
}

function buildDots() {
  const wrap = document.getElementById("dots-wrap");
  STEPS.forEach((_, i) => {
    const dot = document.createElement("div");
    dot.className = "step-dot";
    dot.id = `dot-${i}`;
    wrap.appendChild(dot);
  });
}

function refreshUI() {
  const totalXP = state.completed.reduce((sum, idx) => sum + STEPS[idx].xp, 0);
  document.getElementById("xp-count").textContent = totalXP;

  STEPS.forEach((_, i) => {
    const card = document.getElementById(`card-${i}`);
    const dot  = document.getElementById(`dot-${i}`);
    const done = state.completed.includes(i);
    const prev = i === 0 || state.completed.includes(i - 1);

    if (done) {
      card.className = "step-card done";
      dot.className  = "step-dot done";
      const btn = card.querySelector(".complete-btn");
      if (btn) btn.textContent = "✓ COMPLETE";
      const badge = card.querySelector(".step-badge");
      if (badge) { badge.className = "step-badge done-badge"; badge.textContent = "DONE ✓"; }
    } else if (prev) {
      card.className = "step-card active";
      const badge = card.querySelector(".step-badge");
      if (badge) { badge.className = "step-badge"; badge.textContent = ""; }
    } else {
      card.className = "step-card locked";
    }
    if (STEPS[i].bonus) card.classList.add("bonus");
    if (collapsed.has(i)) card.classList.add("collapsed");
    card.querySelector(".step-header").setAttribute("aria-expanded", String(!collapsed.has(i)));
  });

  const allDone = STEPS.every((_, i) => state.completed.includes(i));
  document.getElementById("completion-banner").classList.toggle("visible", allDone);
}

function buildCard(step, i) {
  const prevDone = i === 0 || state.completed.includes(i - 1);
  const done = state.completed.includes(i);

  const card = document.createElement("div");
  card.id = `card-${i}`;
  card.className = `step-card${done ? " done" : (prevDone ? " active" : " locked")}`;

  const hdr = document.createElement("div");
  hdr.className = "step-header";
  hdr.innerHTML = `
    <span class="step-num">STEP ${step.num}</span>
    <span class="step-title">${step.title}</span>
    <span class="step-badge${done ? " done-badge" : " lock-badge"}">${done ? "DONE ✓" : (prevDone ? "" : "🔒 LOCKED")}</span>
  `;
  hdr.setAttribute("role", "button");
  hdr.setAttribute("tabindex", "0");
  hdr.addEventListener("click", () => toggleStep(i));
  hdr.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleStep(i); }
  });
  card.appendChild(hdr);

  const body = document.createElement("div");
  body.className = "step-body";

  body.innerHTML += `
    <div class="goal-box">
      <span class="goal-icon">🎯</span>
      <span class="goal-text">${step.goal}</span>
    </div>
  `;

  const childItems  = step.child.items.map((t,n)  => `<li data-n="${n+1}"><span>${t}</span></li>`).join("");
  const parentItems = step.parent.items.map((t,n) => `<li data-n="${n+1}"><span>${t}</span></li>`).join("");

  body.innerHTML += `
    <div class="panels">
      <div class="panel child">
        <div class="panel-head">👶 LITTLE CODER</div>
        <p>${step.child.intro}</p>
        <ul class="step-list" style="margin-top:10px">${childItems}</ul>
      </div>
      <div class="panel parent">
        <div class="panel-head">👨‍👩‍👧 GROWN-UP NOTES</div>
        <p>${step.parent.intro}</p>
        <ul class="step-list" style="margin-top:10px">${parentItems}</ul>
      </div>
    </div>
  `;

  body.innerHTML += `
    <div class="code-wrap">
      <div class="code-topbar">
        <span class="code-filename">${step.code.filename}</span>
        <span class="code-lang">GDScript</span>
      </div>
      <div class="code-block"><pre>${step.code.body}</pre></div>
    </div>
  `;

  const btnRow = document.createElement("div");
  btnRow.style.cssText = "display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;";
  btnRow.innerHTML = `
    <span style="font-family:var(--font-head);font-size:13px;letter-spacing:0.1em;color:var(--amber)">
      +${step.xp} XP ON COMPLETE
    </span>
  `;
  const btn = document.createElement("button");
  btn.className = "complete-btn";
  btn.textContent = done ? "✓ COMPLETE" : "MARK COMPLETE ✓";
  btn.addEventListener("click", () => completeStep(i));
  btnRow.appendChild(btn);
  body.appendChild(btnRow);

  card.appendChild(body);
  return card;
}

function completeStep(i) {
  if (state.completed.includes(i)) return;
  state.completed.push(i);
  collapsed.add(i);
  collapsed.delete(i + 1);
  saveState();
  refreshUI();

  const allDone = STEPS.every((_, idx) => state.completed.includes(idx));
  if (allDone) {
    launchConfetti();
  } else {
    const nextCard = document.getElementById(`card-${i + 1}`);
    if (nextCard) setTimeout(() => nextCard.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }
}

function launchConfetti() {
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.getElementById("confetti-canvas");
  const ctx = canvas.getContext("2d");
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ["#e8a838", "#BC4749", "#4caf78", "#70A3A7", "#fff", "#ffd700"];
  const particles = Array.from({ length: 220 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * -200,
    r: Math.random() * 9 + 4,
    c: colors[Math.floor(Math.random() * colors.length)],
    vx: Math.random() * 4 - 2,
    vy: Math.random() * 5 + 2,
    angle: Math.random() * Math.PI * 2,
    va: Math.random() * 0.25 - 0.12
  }));

  let alive = true;
  setTimeout(() => { alive = false; ctx.clearRect(0,0,canvas.width,canvas.height); }, 5000);

  function draw() {
    if (!alive) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.angle += p.va;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.r/2, -p.r/2, p.r, p.r * 0.5);
      ctx.restore();
    });
    requestAnimationFrame(draw);
  }
  draw();
}

loadState();
buildDots();

const stepsList = document.getElementById("steps-list");
STEPS.forEach((step, i) => stepsList.appendChild(buildCard(step, i)));

refreshUI();

// Keep the XP bar just under the sticky site header
function syncStickyTop() {
  const h = document.getElementById("siteHeader");
  const bar = document.getElementById("progress-bar");
  if (!h || !bar) return;
  bar.style.top = h.getBoundingClientRect().height + "px";
  document.documentElement.style.setProperty("--gk-sticky", Math.round(h.getBoundingClientRect().height + bar.getBoundingClientRect().height + 12) + "px");
}
syncStickyTop();
window.addEventListener("resize", syncStickyTop);
window.addEventListener("load", syncStickyTop);
