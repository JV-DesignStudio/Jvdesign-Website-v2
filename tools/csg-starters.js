/* JVDS Code Snippet Generator - starter libraries (A2772)
   Foundational snippets seeded into IndexedDB and merged into the generator. */
(function (root) {
  'use strict';

  var starters = [
    {
      id: 'starter-godot-controller',
      cat: 'Movement',
      lang: 'gdscript',
      title: 'Godot 4: 2D Character Controller',
      desc: 'A clean CharacterBody2D controller with gravity, jumping and left/right input.',
      code: 'extends CharacterBody2D\n\nconst SPEED = 220.0\nconst JUMP_VELOCITY = -420.0\nvar gravity = ProjectSettings.get_setting("physics/2d/default_gravity")\n\nfunc _physics_process(delta):\n    if not is_on_floor():\n        velocity.y += gravity * delta\n    if Input.is_action_just_pressed("ui_accept") and is_on_floor():\n        velocity.y = JUMP_VELOCITY\n    var direction = Input.get_axis("ui_left", "ui_right")\n    velocity.x = direction * SPEED\n    move_and_slide()\n'
    },
    {
      id: 'starter-godot-signals',
      cat: 'Pattern',
      lang: 'gdscript',
      title: 'Godot 4: Signal Connections',
      desc: 'Define a signal, connect it to a function and emit it when something happens.',
      code: 'extends Node\n\nsignal picked_up(points)\n\nfunc _ready():\n    picked_up.connect(_on_picked_up)\n\nfunc collect(points):\n    picked_up.emit(points)\n\nfunc _on_picked_up(points):\n    print("Picked up ", points, " points")\n'
    },
    {
      id: 'starter-phaser-scene',
      cat: 'Pattern',
      lang: 'phaser',
      title: 'Phaser 3: Scene Setup',
      desc: 'A minimal Phaser scene with preload, create and a physics sprite.',
      code: "class PlayScene extends Phaser.Scene {\n  constructor() {\n    super('play');\n  }\n  preload() {\n    this.load.image('player', 'player.png');\n  }\n  create() {\n    this.player = this.physics.add.sprite(100, 100, 'player');\n  }\n}\n"
    },
    {
      id: 'starter-phaser-physics',
      cat: 'Physics',
      lang: 'phaser',
      title: 'Phaser 3: Arcade Physics Config',
      desc: 'Turn on arcade physics with gravity for a platform or falling game.',
      code: "const config = {\n  type: Phaser.AUTO,\n  width: 800,\n  height: 600,\n  physics: {\n    default: 'arcade',\n    arcade: { gravity: { y: 600 }, debug: false }\n  },\n  scene: [PlayScene]\n};\n\nnew Phaser.Game(config);\n"
    },
    {
      id: 'starter-phaser-anim',
      cat: 'Animation',
      lang: 'phaser',
      title: 'Phaser 3: Animation Mapping',
      desc: 'Create a run animation from a sprite sheet and play it on the player.',
      code: "this.anims.create({\n  key: 'run',\n  frames: this.anims.generateFrameNumbers('player', { start: 0, end: 5 }),\n  frameRate: 10,\n  repeat: -1\n});\n\nthis.player.anims.play('run', true);\n"
    },
    {
      id: 'starter-python-discord',
      cat: 'Pattern',
      lang: 'py',
      title: 'Python: Discord Bot Commands',
      desc: 'A tiny Discord bot with a ping command, ready for your own token.',
      code: 'import discord\nfrom discord.ext import commands\n\nbot = commands.Bot(command_prefix="!")\n\n@bot.command()\nasync def ping(ctx):\n    await ctx.send("Pong!")\n\nbot.run("YOUR_TOKEN_HERE")\n'
    },
    {
      id: 'starter-python-adventure',
      cat: 'Pattern',
      lang: 'py',
      title: 'Python: Text Adventure Loop',
      desc: 'A simple room map with movement, so you can build a text adventure.',
      code: 'rooms = {\n    "hall": {"desc": "A dusty hall.", "north": "library"},\n    "library": {"desc": "Shelves of books.", "south": "hall"}\n}\nplace = "hall"\n\nwhile True:\n    room = rooms[place]\n    print(room["desc"])\n    move = input("Go which way? ").lower()\n    if move == "quit":\n        break\n    place = room.get(move, place)\n'
    }
  ];

  var api = { starters: starters };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root = root || (typeof self !== 'undefined' ? self : this);
  root.CSG_STARTERS = starters;
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : this));
