// ─── STEP DATA ────────────────────────────────────────────
const STEPS = [
  {
    num: "01",
    title: "The 3D Base Environment",
    goal: "Create a 3D scene with a ground floor, walls, and a checkpoint booth, your grey-box base!",
    child: {
      intro: "We're building a giant 3D sandbox! Let's place a big floor block and build walls to protect our base.",
      items: [
        "Open Godot and create a new project called <code>Gatekeeper_3D</code>.",
        "Create a new scene with a <code>Node3D</code> root, name it <strong>World</strong>.",
        "Add a <code>MeshInstance3D</code> child, set its mesh to <strong>PlaneMesh</strong>, and scale it up to make a big floor.",
        "Add a <code>CharacterBody3D</code> for the player, give it a <code>CollisionShape3D</code> and a <code>MeshInstance3D</code> (CapsuleMesh) so you can see your character.",
        "Add a <code>Camera3D</code> attached to the player so you can walk around.",
        "Press <code>Ctrl+S</code> and save as <code>world.tscn</code>."
      ]
    },
    parent: {
      intro: "The grey-box stage keeps collision simple. Godot can build the collision for you: select a mesh, then use <strong>Mesh → Create Trimesh Static Body</strong> in the toolbar above the 3D view. No manual collision shapes needed yet.",
      items: [
        "Select the floor MeshInstance3D, then choose <strong>Mesh → Create Trimesh Static Body</strong> from the 3D view toolbar so the player can stand on it.",
        "For walls, add more <code>MeshInstance3D</code> with <code>BoxMesh</code> shapes and repeat the Trimesh step.",
        "Attach <code>world.gd</code> (see code below) to the World node, it's minimal for now, just confirms the scene loaded."
      ]
    },
    code: {
      filename: "world.gd",
      body: `<span class="cmt"># world.gd: Attach this script to your World Node3D</span>
<span class="kw">extends</span> <span class="typ">Node3D</span>

<span class="kw">func</span> <span class="fn">_ready</span>() -> <span class="kw">void</span>:
    <span class="fn">print</span>(<span class="str">"🛡️ Checkpoint is live, Day 1 begins!"</span>)`
    },
    xp: 40
  },
  {
    num: "02",
    title: "Connecting Together (Local Co-op)",
    goal: "Use Godot's multiplayer tools so players on the same network can join the same 3D checkpoint.",
    child: {
      intro: "No one survives alone! Let's connect players so you and your grown-up can both be inside the base at the same time.",
      items: [
        "Create a new scene called <code>menu.tscn</code> with a <strong>Control</strong> root node.",
        "Add a <code>VBoxContainer</code>, inside it, add two <strong>Button</strong> nodes: one labelled <em>Host Game</em>, one <em>Join Game</em>.",
        "Attach <code>menu.gd</code> to the Control node.",
        "Connect each button's <code>pressed</code> signal to <code>menu.gd</code>."
      ]
    },
    parent: {
      intro: "ENet is Godot's built-in reliable UDP wrapper. The host creates a server on port 7777; the joiner connects to the host's IP. For local testing, <code>127.0.0.1</code> works. On a real LAN, replace with the host computer's local IP. Heads-up: this connects the game, but each player still needs their own character spawned and kept in sync. Godot's <code>MultiplayerSpawner</code> and <code>MultiplayerSynchronizer</code> nodes do that job.",
      items: [
        "Port <strong>7777</strong> must be unblocked in Windows Firewall / macOS firewall for LAN play.",
        "To test on one computer, open <strong>Debug → Customize Run Instances</strong> (Godot 4.3 or newer), tick <em>Enable Multiple Instances</em> and set it to 2. Press Host in one window and Join in the other.",
        "Both players must load from the same <code>world.tscn</code> after connecting, synchronised via <code>get_tree().change_scene_to_file()</code>."
      ]
    },
    code: {
      filename: "menu.gd",
      body: `<span class="cmt"># menu.gd: Attach to your Control root in menu.tscn</span>
<span class="kw">extends</span> <span class="typ">Control</span>

<span class="kw">func</span> <span class="fn">_on_host_pressed</span>() -> <span class="kw">void</span>:
    <span class="kw">var</span> peer <span class="op">=</span> <span class="typ">ENetMultiplayerPeer</span>.<span class="fn">new</span>()
    peer.<span class="fn">create_server</span>(<span class="num">7777</span>, <span class="num">4</span>)   <span class="cmt"># port 7777, max 4 players</span>
    multiplayer.multiplayer_peer <span class="op">=</span> peer
    <span class="fn">get_tree</span>().<span class="fn">change_scene_to_file</span>(<span class="str">"res://world.tscn"</span>)

<span class="kw">func</span> <span class="fn">_on_join_pressed</span>() -> <span class="kw">void</span>:
    <span class="kw">var</span> peer <span class="op">=</span> <span class="typ">ENetMultiplayerPeer</span>.<span class="fn">new</span>()
    peer.<span class="fn">create_client</span>(<span class="str">"127.0.0.1"</span>, <span class="num">7777</span>)  <span class="cmt"># same-machine test</span>
    multiplayer.multiplayer_peer <span class="op">=</span> peer
    <span class="fn">get_tree</span>().<span class="fn">change_scene_to_file</span>(<span class="str">"res://world.tscn"</span>)`
    },
    xp: 60
  },
  {
    num: "03",
    title: "Walking Around the Checkpoint",
    goal: "Write movement code for your 3D character, plus a RayCast3D so players can look at and interact with objects.",
    child: {
      intro: "Time to explore the base! Use the arrow keys on your keyboard to walk forward, backward, and side-to-side. The camera follows your character everywhere.",
      items: [
        "Click on your <code>CharacterBody3D</code> player node.",
        "Choose <strong>Attach Script</strong> and name it <code>player.gd</code>.",
        "Copy in the code below. It handles walking and gravity.",
        "Add a <code>RayCast3D</code> as a child of your Camera3D. This is your player's 'reach' to press buttons.",
        "Put the player in a group: open the <strong>Node</strong> tab (next to the Inspector) → <strong>Groups</strong> → type <code>players</code> → Add. The gate buttons and the day timer use this name to find you."
      ]
    },
    parent: {
      intro: "Standard Godot 4 CharacterBody3D movement. The RayCast3D lets players interact with gate buttons and tools without needing physics collision, <code>get_collider()</code> returns whatever the ray hits.",
      items: [
        "Set <code>RayCast3D.target_position</code> to <code>Vector3(0, 0, -3)</code>, 3 metres ahead of camera.",
        "Enable <code>RayCast3D.enabled = true</code> in the Inspector.",
        "In <code>_input()</code> or <code>_process()</code>, check <code>ray.is_colliding()</code> and call <code>ray.get_collider().interact()</code> when the player presses E/Space.",
        "For multiplayer, mark this node <code>set_multiplayer_authority(id)</code>, only the owner processes its own input.",
        "Want WASD as well? Open <em>Project → Project Settings → Input Map</em>, switch on <em>Show Built-in Actions</em>, and add W, A, S and D to <code>ui_up</code>, <code>ui_left</code>, <code>ui_down</code> and <code>ui_right</code>."
      ]
    },
    code: {
      filename: "player.gd",
      body: `<span class="cmt"># player.gd: Attach to your CharacterBody3D</span>
<span class="kw">extends</span> <span class="typ">CharacterBody3D</span>

<span class="kw">const</span> SPEED <span class="op">=</span> <span class="num">5.0</span>
<span class="kw">var</span> gravity: <span class="typ">float</span> <span class="op">=</span> <span class="typ">ProjectSettings</span>.<span class="fn">get_setting</span>(
    <span class="str">"physics/3d/default_gravity"</span>
)

<span class="kw">func</span> <span class="fn">_physics_process</span>(delta: <span class="typ">float</span>) -> <span class="kw">void</span>:
    <span class="kw">if</span> <span class="kw">not</span> <span class="fn">is_on_floor</span>():
        velocity.y <span class="op">-=</span> gravity <span class="op">*</span> delta

    <span class="kw">var</span> input_dir <span class="op">:=</span> <span class="typ">Input</span>.<span class="fn">get_vector</span>(
        <span class="str">"ui_left"</span>, <span class="str">"ui_right"</span>, <span class="str">"ui_up"</span>, <span class="str">"ui_down"</span>
    )
    <span class="kw">var</span> dir <span class="op">:=</span> (transform.basis <span class="op">*</span> <span class="typ">Vector3</span>(
        input_dir.x, <span class="num">0</span>, input_dir.y
    )).<span class="fn">normalized</span>()

    <span class="kw">if</span> dir:
        velocity.x <span class="op">=</span> dir.x <span class="op">*</span> SPEED
        velocity.z <span class="op">=</span> dir.z <span class="op">*</span> SPEED
    <span class="kw">else</span>:
        velocity.x <span class="op">=</span> <span class="fn">move_toward</span>(velocity.x, <span class="num">0</span>, SPEED)
        velocity.z <span class="op">=</span> <span class="fn">move_toward</span>(velocity.z, <span class="num">0</span>, SPEED)

    <span class="fn">move_and_slide</span>()`
    },
    xp: 80
  },
  {
    num: "04",
    title: "The 3D Survivor Spawner",
    goal: "Spawn 3D survivor blocks at the outer gate that walk up to the checkpoint window and stop.",
    child: {
      intro: "Look! A visitor is walking down the path toward our gate. Let's check who they are! They carry secret stats we need to discover.",
      items: [
        "Create a new scene with a <code>CharacterBody3D</code> root and call it <strong>Survivor3D</strong>.",
        "Add a <code>MeshInstance3D</code> with a tall <code>BoxMesh</code> so you can see the survivor.",
        "Add a <code>CollisionShape3D</code> to match the box size. (The thermometer can only sense physics bodies, which is why the root is a CharacterBody3D.)",
        "Attach <code>survivor_3d.gd</code> and copy in the code below, it holds secret stats and walks toward the gate!",
        "Put the survivor in a group: <strong>Node</strong> tab → <strong>Groups</strong> → type <code>survivor</code> → Add. The tools only scan things in this group."
      ]
    },
    parent: {
      intro: "The <code>hidden_stats</code> dictionary holds the survivor's secret data. The rule-checking logic in Step 7 compares these values against the current day's rulebook, the stats are intentionally invisible to players until they use the scanner tools.",
      items: [
        "The group name must be exactly <code>survivor</code> (singular). The thermometer, magnifying glass and gate all check for it.",
        "Set <code>gate_pos</code> to match the real gate position in your world.",
        "For day-to-day variation, randomise <code>hidden_stats</code> values using <code>randf_range()</code> in <code>_ready()</code>.",
        "In multiplayer, spawn survivors only on the server (<code>if multiplayer.is_server()</code>) then sync via a spawner node."
      ]
    },
    code: {
      filename: "survivor_3d.gd",
      body: `<span class="cmt"># survivor_3d.gd: Attach to your Survivor3D CharacterBody3D root</span>
<span class="kw">extends</span> <span class="typ">CharacterBody3D</span>

<span class="kw">var</span> hidden_stats: <span class="typ">Dictionary</span> <span class="op">=</span> {
    <span class="str">"temperature"</span>: <span class="num">102.0</span>,
    <span class="str">"has_spots"</span>:   <span class="kw">true</span>
}

<span class="kw">var</span> walk_speed: <span class="typ">float</span> <span class="op">=</span> <span class="num">2.0</span>
<span class="kw">var</span> gate_pos: <span class="typ">Vector3</span> <span class="op">=</span> <span class="typ">Vector3</span>(<span class="num">0.0</span>, <span class="num">0.0</span>, <span class="num">2.0</span>)

<span class="kw">func</span> <span class="fn">_process</span>(delta: <span class="typ">float</span>) -&gt; <span class="kw">void</span>:
    <span class="kw">if</span> position.<span class="fn">distance_to</span>(gate_pos) <span class="op">&gt;</span> <span class="num">0.2</span>:
        <span class="kw">var</span> dir <span class="op">:=</span> (gate_pos <span class="op">-</span> position).<span class="fn">normalized</span>()
        position <span class="op">+=</span> dir <span class="op">*</span> walk_speed <span class="op">*</span> delta`
    },
    xp: 80
  },
  {
    num: "05",
    title: "Shared Tools, The 3D Thermometer",
    goal: "Build a 3D thermometer players can pick up and carry. When it touches a survivor, reveal their secret temperature!",
    child: {
      intro: "Grab the 3D thermometer tool, walk over to the visitor, and scan them to find their secret temperature! It will appear floating above their head.",
      items: [
        "Create a small new <code>Node3D</code> scene, call the root <strong>Thermometer</strong>.",
        "Add a <code>MeshInstance3D</code> with a small <code>CylinderMesh</code> (paint it red!).",
        "Add an <code>Area3D</code> with a <code>CollisionShape3D</code>, this detects when the tool touches a survivor.",
        "Connect the <code>Area3D.body_entered</code> signal to <code>thermometer.gd</code>.",
        "Add a <code>Label3D</code> as a child, this shows the temperature float above the survivor's head."
      ]
    },
    parent: {
      intro: "Area3D is ideal here, it triggers overlap events without applying physics. The Label3D floats in 3D world space, always facing camera if you set <code>billboard = BILLBOARD_ENABLED</code> in its properties.",
      items: [
        "To let players pick up the thermometer, use <code>RayCast3D</code> from Step 3: on interact, set <code>thermometer.get_parent().remove_child(thermometer)</code> and <code>$Hand.add_child(thermometer)</code> to attach it to the player's hand bone.",
        "In multiplayer, sync the thermometer's position via <code>@export var held_by: int</code> and an <code>@rpc</code> pickup call.",
        "Set <code>Label3D.pixel_size</code> small (0.005 to 0.01) so text is legible from a normal viewing distance."
      ]
    },
    code: {
      filename: "thermometer.gd",
      body: `<span class="cmt"># thermometer.gd: Attach to your Thermometer Node3D</span>
<span class="kw">extends</span> <span class="typ">Node3D</span>

<span class="at">@onready</span> <span class="kw">var</span> floating_label: <span class="typ">Label3D</span> <span class="op">=</span> $FloatingLabel
<span class="kw">var</span> is_held: <span class="typ">bool</span> <span class="op">=</span> <span class="kw">false</span>

<span class="kw">func</span> <span class="fn">_ready</span>() -> <span class="kw">void</span>:
    floating_label.visible <span class="op">=</span> <span class="kw">false</span>

<span class="kw">func</span> <span class="fn">_on_area_3d_body_entered</span>(body: <span class="typ">Node3D</span>) -> <span class="kw">void</span>:
    <span class="kw">if</span> body.<span class="fn">is_in_group</span>(<span class="str">"survivor"</span>):
        <span class="kw">var</span> temp: <span class="typ">float</span> <span class="op">=</span> body.hidden_stats[<span class="str">"temperature"</span>]
        floating_label.text    <span class="op">=</span> <span class="str">"🌡️ %.1f°F"</span> <span class="op">%</span> temp
        floating_label.visible <span class="op">=</span> <span class="kw">true</span>

<span class="kw">func</span> <span class="fn">_on_area_3d_body_exited</span>(body: <span class="typ">Node3D</span>) -> <span class="kw">void</span>:
    <span class="kw">if</span> body.<span class="fn">is_in_group</span>(<span class="str">"survivor"</span>):
        floating_label.visible <span class="op">=</span> <span class="kw">false</span>`
    },
    xp: 100
  },
  {
    num: "06",
    title: "The Daily Rulebook",
    goal: "Spawn a 3D rulebook board inside the checkpoint booth. Day 1 rule: no one in with a temperature over 100°F!",
    child: {
      intro: "What does the boss say we have to look out for today? The rulebook is right inside the booth, read it carefully before you stamp anyone!",
      items: [
        "Create a flat <code>MeshInstance3D</code> with a <code>BoxMesh</code> inside your booth, this is the rulebook board.",
        "Add a <code>Label3D</code> as a child of it called <strong>RuleSign</strong> and set its text to the Day 1 rule.",
        "Attach <code>rulebook.gd</code> to the board node so the rules can change each day."
      ]
    },
    parent: {
      intro: "The rulebook is a data-driven reference, new entries are added to the <code>daily_rules</code> dictionary as days increase. Label3D's <code>text</code> property wraps automatically; set <code>width</code> in the Inspector if text overflows the board.",
      items: [
        "Call <code>rulebook.update_for_day(current_day)</code> from your DayManager whenever a new day starts.",
        "In multiplayer, the rulebook update should run on all clients, either via an RPC call or by syncing <code>current_day</code> with a <code>MultiplayerSynchronizer</code>.",
        "Set <code>Label3D.billboard = BILLBOARD_DISABLED</code>, the rulebook should face one direction, not track the camera."
      ]
    },
    code: {
      filename: "rulebook.gd",
      body: `<span class="cmt"># rulebook.gd: Attach to your 3D board node inside the booth</span>
<span class="kw">extends</span> <span class="typ">Node3D</span>

<span class="at">@onready</span> <span class="kw">var</span> rule_sign: <span class="typ">Label3D</span> <span class="op">=</span> $RuleSign

<span class="kw">var</span> daily_rules: <span class="typ">Dictionary</span> <span class="op">=</span> {
    <span class="num">1</span>: <span class="str">"DO NOT let anyone in\\nwith temp over 100°F!"</span>,
    <span class="num">2</span>: <span class="str">"DO NOT let anyone in\\nwith green spots!\\nAND: no temp over 100°F!"</span>,
    <span class="num">3</span>: <span class="str">"ADMIT anyone from District 7.\\nDeny all others with temp &gt; 100°F."</span>
}

<span class="kw">func</span> <span class="fn">_ready</span>() -&gt; <span class="kw">void</span>:
    <span class="fn">update_for_day</span>(<span class="typ">GameManager</span>.current_day)

<span class="kw">func</span> <span class="fn">update_for_day</span>(day: <span class="typ">int</span>) -&gt; <span class="kw">void</span>:
    <span class="kw">if</span> day <span class="kw">in</span> daily_rules:
        rule_sign.text <span class="op">=</span> daily_rules[day]
    <span class="kw">else</span>:
        rule_sign.text <span class="op">=</span> <span class="str">"Check ALL rules from previous days!"</span>`
    },
    xp: 60
  },
  {
    num: "07",
    title: "The Co-op Gate Levers!",
    goal: "Create physical green and red buttons that control the 3D gate, check the visitor's stats before opening!",
    child: {
      intro: "Work with your team! Pull the green lever to open the gate for a safe visitor, or hit the red lever to sound the alarm and send them away!",
      items: [
        "Build a 3D gate out of block meshes (<code>BoxMesh</code>), make it wide enough to block the path.",
        "Place a <strong>Green button</strong> mesh and a <strong>Red button</strong> mesh beside the gate.",
        "Give each button an <code>Area3D</code> (with a CollisionShape3D). Walking into it presses the button.",
        "Add one more <code>Area3D</code> right at the gate window called <strong>GateArea</strong>. It notices when a visitor arrives.",
        "Attach <code>gate_controller.gd</code> to a parent node, then connect each Area3D's <code>body_entered</code> signal to the matching function in the code.",
        "Don't worry if Godot underlines <code>GameManager</code> in red. You'll create it in the very next step!"
      ]
    },
    parent: {
      intro: "The gate controller is the rule-checking brain. It reads the current survivor's <code>hidden_stats</code>, compares against the active rulebook, and drives the gate's animation via a Tween. A wrong call either way (letting a sick visitor in, or turning a healthy one away) calls <code>GameManager.mistake_made()</code> to subtract health.",
      items: [
        "The Tween lifts the gate 3 metres, waits 2 seconds, then lowers it again. Change the numbers to make it faster or slower.",
        "For multiplayer, gate state should be an <code>@rpc(\"call_local\")</code> function so all clients see the same gate position.",
        "Store a reference to the <em>current survivor</em> in a variable, the buttons read from it when pressed."
      ]
    },
    code: {
      filename: "gate_controller.gd",
      body: `<span class="cmt"># gate_controller.gd: Attach to a Node3D near the gate</span>
<span class="kw">extends</span> <span class="typ">Node3D</span>

<span class="at">@onready</span> <span class="kw">var</span> gate_mesh:   <span class="typ">MeshInstance3D</span> <span class="op">=</span> $GateMesh
<span class="at">@onready</span> <span class="kw">var</span> alarm_light: <span class="typ">OmniLight3D</span>    <span class="op">=</span> $AlarmLight
<span class="kw">var</span> current_survivor: <span class="typ">Node3D</span> <span class="op">=</span> <span class="kw">null</span>

<span class="cmt"># GateArea: notices when a visitor reaches the window</span>
<span class="kw">func</span> <span class="fn">_on_gate_area_body_entered</span>(body: <span class="typ">Node3D</span>) -&gt; <span class="kw">void</span>:
    <span class="kw">if</span> body.<span class="fn">is_in_group</span>(<span class="str">"survivor"</span>):
        current_survivor <span class="op">=</span> body

<span class="cmt"># The Day 1 rule: safe means 100°F or lower</span>
<span class="kw">func</span> <span class="fn">is_safe</span>(survivor: <span class="typ">Node3D</span>) -&gt; <span class="typ">bool</span>:
    <span class="kw">return</span> survivor.hidden_stats[<span class="str">"temperature"</span>] <span class="op">&lt;=</span> <span class="num">100.0</span>

<span class="cmt"># GREEN button: let the visitor in</span>
<span class="kw">func</span> <span class="fn">_on_green_area_body_entered</span>(body: <span class="typ">Node3D</span>) -&gt; <span class="kw">void</span>:
    <span class="kw">if</span> <span class="kw">not</span> body.<span class="fn">is_in_group</span>(<span class="str">"players"</span>) <span class="kw">or</span> current_survivor <span class="op">==</span> <span class="kw">null</span>:
        <span class="kw">return</span>
    <span class="kw">if</span> <span class="kw">not</span> <span class="fn">is_safe</span>(current_survivor):
        <span class="typ">GameManager</span>.<span class="fn">mistake_made</span>()   <span class="cmt"># ❌ oops, they were sick!</span>
    <span class="kw">var</span> y <span class="op">:=</span> gate_mesh.position.y
    <span class="kw">var</span> tw <span class="op">:=</span> <span class="fn">create_tween</span>()
    tw.<span class="fn">tween_property</span>(gate_mesh, <span class="str">"position:y"</span>, y <span class="op">+</span> <span class="num">3.0</span>, <span class="num">1.0</span>)
    tw.<span class="fn">tween_interval</span>(<span class="num">2.0</span>)
    tw.<span class="fn">tween_property</span>(gate_mesh, <span class="str">"position:y"</span>, y, <span class="num">1.0</span>)
    <span class="fn">_finish_visitor</span>()

<span class="cmt"># RED button: sound the alarm and send them away</span>
<span class="kw">func</span> <span class="fn">_on_red_area_body_entered</span>(body: <span class="typ">Node3D</span>) -&gt; <span class="kw">void</span>:
    <span class="kw">if</span> <span class="kw">not</span> body.<span class="fn">is_in_group</span>(<span class="str">"players"</span>) <span class="kw">or</span> current_survivor <span class="op">==</span> <span class="kw">null</span>:
        <span class="kw">return</span>
    <span class="kw">if</span> <span class="fn">is_safe</span>(current_survivor):
        <span class="typ">GameManager</span>.<span class="fn">mistake_made</span>()   <span class="cmt"># ❌ oops, they were healthy!</span>
    <span class="fn">_finish_visitor</span>()
    alarm_light.visible <span class="op">=</span> <span class="kw">true</span>
    <span class="kw">await</span> <span class="fn">get_tree</span>().<span class="fn">create_timer</span>(<span class="num">2.0</span>).timeout
    alarm_light.visible <span class="op">=</span> <span class="kw">false</span>

<span class="kw">func</span> <span class="fn">_finish_visitor</span>() -&gt; <span class="kw">void</span>:
    current_survivor.<span class="fn">queue_free</span>()   <span class="cmt"># the visitor walks off</span>
    current_survivor <span class="op">=</span> <span class="kw">null</span>`
    },
    xp: 100
  },
  {
    num: "08",
    title: "Base Health & Alarms (Uh Oh!)",
    goal: "Lower shared base health and trigger a flashing red warning light whenever the team makes a mistake.",
    child: {
      intro: "If we let someone sick inside, our base health drops and the alarm sounds! Watch the health meter, if it hits zero, the base is lost!",
      items: [
        "Open your <strong>GameManager</strong> Autoload script (or create one via <em>Project → Autoloads</em>).",
        "Copy in the code below. It adds <code>base_health</code>, <code>current_day</code> and the <code>mistake_made()</code> and <code>game_over()</code> functions.",
        "Add an <code>OmniLight3D</code> to your world called <code>AlarmLight</code>, set its colour to red and <code>visible = false</code> to start.",
        "Add a <code>Label3D</code> on a wall inside the booth to show the base health, and put it in a group called <code>health_label</code>."
      ]
    },
    parent: {
      intro: "GameManager is an Autoload singleton, accessible from any script as <code>GameManager.base_health</code>. Placing the mistake/health logic here keeps the Gate Controller clean. In multiplayer, run this logic server-side only, then broadcast the new health value via RPC.",
      items: [
        "Register the Autoload: <em>Project → Project Settings → Autoloads</em> → add <code>res://game_manager.gd</code>, name it <code>GameManager</code>.",
        "For a flashing alarm, use a looping Tween on <code>AlarmLight.visible</code> with very short on/off intervals, then stop the Tween after ~2 seconds.",
        "Add a <code>game_over.tscn</code> scene now so the function has somewhere to go, even an empty scene with a Label reading 'GAME OVER' works."
      ]
    },
    code: {
      filename: "game_manager.gd",
      body: `<span class="cmt"># game_manager.gd: Register as an Autoload in Project Settings</span>
<span class="kw">extends</span> <span class="typ">Node</span>

<span class="kw">var</span> base_health: <span class="typ">int</span> <span class="op">=</span> <span class="num">100</span>
<span class="kw">var</span> current_day: <span class="typ">int</span> <span class="op">=</span> <span class="num">1</span>

<span class="kw">func</span> <span class="fn">mistake_made</span>() -&gt; <span class="kw">void</span>:
    base_health <span class="op">-=</span> <span class="num">20</span>
    <span class="fn">print</span>(<span class="str">"⚠️ Base Health: %d"</span> <span class="op">%</span> base_health)
    <span class="fn">_update_health_display</span>()
    <span class="kw">if</span> base_health <span class="op">&lt;=</span> <span class="num">0</span>:
        <span class="fn">game_over</span>()

<span class="kw">func</span> <span class="fn">_update_health_display</span>() -&gt; <span class="kw">void</span>:
    <span class="cmt"># Finds the Label3D you put in the "health_label" group</span>
    <span class="kw">var</span> lbl <span class="op">=</span> <span class="fn">get_tree</span>().<span class="fn">get_first_node_in_group</span>(<span class="str">"health_label"</span>)
    <span class="kw">if</span> lbl:
        lbl.text <span class="op">=</span> <span class="str">"🛡️ Base: %d / 100"</span> <span class="op">%</span> base_health

<span class="kw">func</span> <span class="fn">game_over</span>() -&gt; <span class="kw">void</span>:
    <span class="fn">print</span>(<span class="str">"❌ GAME OVER, the base has fallen!"</span>)
    <span class="fn">get_tree</span>().<span class="fn">change_scene_to_file</span>(<span class="str">"res://game_over.tscn"</span>)`
    },
    xp: 80
  },
  {
    num: "09",
    title: "The Day Cycle & Lobby",
    goal: "Add a 2-minute day timer. When time runs out, transport all players to a safe room to review their score.",
    child: {
      intro: "When the line is empty or time runs out, the day ends! Everyone teleports to the safe room where you can see how you did before the next, harder day begins.",
      items: [
        "Add a plain <code>Node</code> to your World scene called <strong>DayManager</strong>, and add a <code>Timer</code> called <strong>DayTimer</strong>.",
        "Add a <code>Label3D</code> called <strong>ClockLabel</strong> on the booth wall. This is your countdown clock.",
        "Create a <strong>safe room</strong> further inside the base (some box meshes forming a room) and put a <code>Marker3D</code> called <strong>SafeRoomMarker</strong> in the middle.",
        "Right-click DayTimer, ClockLabel and SafeRoomMarker in turn and pick <strong>Access as Unique Name</strong>. A % sign appears next to each one.",
        "Attach <code>day_manager.gd</code> to DayManager and connect DayTimer's <code>timeout</code> signal to it."
      ]
    },
    parent: {
      intro: "The day manager runs the game's core loop: timer → end day → teleport → next day. In multiplayer, only the server runs the timer and calls an <code>@rpc(\"call_local\")</code> to teleport all players simultaneously, so no client's timer drift causes desync.",
      items: [
        "Set a <code>Node3D</code> marker at the safe room position, use its <code>global_position</code> as the teleport destination, easier to adjust in the Inspector than hard-coded coordinates.",
        "After teleport, pause <code>_process()</code> on surviving nodes while in the review phase.",
        "Connect a 'Next Day' button in the safe room to <code>day_manager.start_next_day()</code>."
      ]
    },
    code: {
      filename: "day_manager.gd",
      body: `<span class="cmt"># day_manager.gd: Attach to the DayManager node in your World scene</span>
<span class="kw">extends</span> <span class="typ">Node</span>

<span class="cmt"># The % sign finds nodes marked "Access as Unique Name"</span>
<span class="at">@onready</span> <span class="kw">var</span> day_timer: <span class="typ">Timer</span>   <span class="op">=</span> %DayTimer
<span class="at">@onready</span> <span class="kw">var</span> clock_lbl: <span class="typ">Label3D</span> <span class="op">=</span> %ClockLabel
<span class="at">@onready</span> <span class="kw">var</span> safe_room: <span class="typ">Node3D</span>  <span class="op">=</span> %SafeRoomMarker

<span class="kw">func</span> <span class="fn">_ready</span>() -&gt; <span class="kw">void</span>:
    day_timer.wait_time <span class="op">=</span> <span class="num">120.0</span>
    day_timer.one_shot <span class="op">=</span> <span class="kw">true</span>
    day_timer.<span class="fn">start</span>()

<span class="kw">func</span> <span class="fn">_process</span>(_delta: <span class="typ">float</span>) -&gt; <span class="kw">void</span>:
    <span class="kw">var</span> s <span class="op">:=</span> <span class="typ">int</span>(day_timer.time_left)
    clock_lbl.text <span class="op">=</span> <span class="str">"%02d:%02d"</span> <span class="op">%</span> [s <span class="op">/</span> <span class="num">60</span>, s <span class="op">%</span> <span class="num">60</span>]

<span class="kw">func</span> <span class="fn">_on_day_timer_timeout</span>() -&gt; <span class="kw">void</span>:
    <span class="fn">end_day</span>()

<span class="kw">func</span> <span class="fn">end_day</span>() -&gt; <span class="kw">void</span>:
    <span class="kw">for</span> player <span class="kw">in</span> <span class="fn">get_tree</span>().<span class="fn">get_nodes_in_group</span>(<span class="str">"players"</span>):
        player.global_position <span class="op">=</span> safe_room.global_position
    <span class="fn">print</span>(<span class="str">"Day %d complete! Rest up."</span> <span class="op">%</span> <span class="typ">GameManager</span>.current_day)
    <span class="typ">GameManager</span>.current_day <span class="op">+=</span> <span class="num">1</span>

<span class="kw">func</span> <span class="fn">start_next_day</span>() -&gt; <span class="kw">void</span>:
    day_timer.<span class="fn">start</span>()`
    },
    xp: 80
  },
  {
    num: "10",
    title: "From Grey Box to Final Art (Bonus!)",
    goal: "Swap your placeholder 3D blocks for real low-poly models and bring your characters to life!",
    bonus: true,
    child: {
      intro: "Time to trade our plain grey boxes for real 3D characters! Bring Lumo the purple fox, Echo the axolotl, Ember the tiger, or Pip the green turtle into your 3D world!",
      items: [
        "In Godot: drag a <code>.glb</code> or <code>.obj</code> model file into the <strong>FileSystem</strong> panel.",
        "Drag it from the FileSystem into your scene to place it.",
        "In your Survivor3D or Player scene, hide the placeholder <code>MeshInstance3D</code> and show the imported model instead (see code below).",
        "Apply textures: drag an image into FileSystem → assign it as the <code>Albedo</code> in a <code>StandardMaterial3D</code>."
      ]
    },
    parent: {
      intro: "Godot 4 imports .glb (recommended), .fbx, and .obj natively. Low-poly models with fewer than 2000 triangles keep performance smooth with multiple players. Free model sources: Kenney.nl (CC0), itch.io/game-assets (filter: 3D, free).",
      items: [
        "For characters, use the <strong>Skeleton3D</strong> import option to bring in rigs, then add an <code>AnimationPlayer</code> to play idle/walk animations.",
        "Set <code>mesh.surface_get_material(0)</code> to swap textures dynamically (e.g. different survivor 'skins' per day).",
        "If a model is too large, scale via <em>Scene → Import → Root Node Transform</em> instead of scaling the node at runtime."
      ]
    },
    code: {
      filename: "character_swap.gd",
      body: `<span class="cmt"># character_swap.gd: Attach to your Survivor3D or Player root</span>
<span class="kw">extends</span> <span class="typ">Node3D</span>

<span class="cmt"># Drag your imported .glb into the scene, then link it here</span>
<span class="at">@onready</span> <span class="kw">var</span> placeholder: <span class="typ">MeshInstance3D</span> <span class="op">=</span> $PlaceholderBox
<span class="at">@onready</span> <span class="kw">var</span> real_model:  <span class="typ">Node3D</span>         <span class="op">=</span> $LumoFoxModel

<span class="kw">func</span> <span class="fn">_ready</span>() -> <span class="kw">void</span>:
    placeholder.visible <span class="op">=</span> <span class="kw">false</span>   <span class="cmt"># hide grey box</span>
    real_model.visible  <span class="op">=</span> <span class="kw">true</span>    <span class="cmt"># show real character</span>
    <span class="fn">print</span>(<span class="str">"🦊 Lumo is ready at the gate!"</span>)`
    },
    xp: 60
  }
];

// ─── STATE ────────────────────────────────────────────────
const STORAGE_KEY = "jvds-godot-gatekeeper3d-p1-v2";
const WORKSHOP_TOTAL = 10;
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

// ─── REFRESH UI ───────────────────────────────────────────
function refreshUI() {
  const totalXP = state.completed.reduce((sum, idx) => sum + STEPS[idx].xp, 0);
  document.getElementById("xp-count").textContent = totalXP;

  STEPS.forEach((step, i) => {
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
      card.querySelector(".step-badge").className = "step-badge";
      card.querySelector(".step-badge").textContent = "";
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

// ─── BUILD STEP CARD ──────────────────────────────────────
function buildCard(step, i) {
  const isFirst = i === 0;
  const prevDone = i === 0 || state.completed.includes(i - 1);
  const done = state.completed.includes(i);
  const lockText = done ? "" : (prevDone ? "" : "🔒 LOCKED");

  const card = document.createElement("div");
  card.id = `card-${i}`;
  card.className = `step-card${step.bonus ? " bonus" : ""}${done ? " done" : (prevDone ? " active" : " locked")}`;

  // Header
  const hdr = document.createElement("div");
  hdr.className = "step-header";
  hdr.innerHTML = `
    <span class="step-num">STEP ${step.num}</span>
    <span class="step-title">${step.title}</span>
    <span class="step-badge${done ? " done-badge" : " lock-badge"}">${done ? "DONE ✓" : lockText}</span>
  `;
  hdr.setAttribute("role", "button");
  hdr.setAttribute("tabindex", "0");
  hdr.addEventListener("click", () => toggleStep(i));
  hdr.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleStep(i); }
  });
  card.appendChild(hdr);

  // Body
  const body = document.createElement("div");
  body.className = "step-body";

  // Goal
  body.innerHTML += `
    <div class="goal-box">
      <span class="goal-icon">🎯</span>
      <span class="goal-text">${step.goal}</span>
    </div>
  `;

  // Audience panels
  const childItems = step.child.items.map((t, n) =>
    `<li data-n="${n+1}"><span>${t}</span></li>`).join("");
  const parentItems = step.parent.items.map((t, n) =>
    `<li data-n="${n+1}"><span>${t}</span></li>`).join("");

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

  // Code block
  body.innerHTML += `
    <div class="code-wrap">
      <div class="code-topbar">
        <span class="code-filename">${step.code.filename}</span>
        <span class="code-lang">GDScript</span>
      </div>
      <div class="code-block"><pre>${step.code.body}</pre></div>
    </div>
  `;

  // XP + Complete button row
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

// ─── COMPLETE STEP ────────────────────────────────────────
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
    // Scroll to next card
    const nextCard = document.getElementById(`card-${i + 1}`);
    if (nextCard) {
      setTimeout(() => nextCard.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }
}

// ─── CONFETTI ─────────────────────────────────────────────
function launchConfetti() {
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.getElementById("confetti-canvas");
  const ctx = canvas.getContext("2d");
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ["#70A3A7", "#BC4749", "#4caf78", "#e8a838", "#fff"];
  const particles = Array.from({ length: 160 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * -100,
    r: Math.random() * 8 + 4,
    c: colors[Math.floor(Math.random() * colors.length)],
    vx: Math.random() * 4 - 2,
    vy: Math.random() * 4 + 2,
    angle: Math.random() * Math.PI * 2,
    va: Math.random() * 0.2 - 0.1
  }));

  let alive = true;
  setTimeout(() => { alive = false; ctx.clearRect(0,0,canvas.width,canvas.height); }, 4000);

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

// ─── INIT ─────────────────────────────────────────────────
loadState();
buildDots();

const stepsList = document.getElementById("steps-list");
STEPS.forEach((step, i) => {
  stepsList.appendChild(buildCard(step, i));
});

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
