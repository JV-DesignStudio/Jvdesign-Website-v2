# ============================================
# PLAYER SCRIPT - Godot 4 Starter
# ============================================
# Attach this to a CharacterBody2D node.
# Handles left/right movement and jumping.
# ============================================

extends CharacterBody2D

# -------------------------------------------
# EXPORTED VARIABLES
# -------------------------------------------
# These appear in the Inspector panel so you
# can tweak them without editing code.

## Movement speed in pixels per second.
@export var speed: float = 300.0

## Upward force when jumping.
@export var jump_force: float = -500.0

## Gravity strength (positive = downward).
@export var gravity: float = 980.0

# -------------------------------------------
# READY
# -------------------------------------------
# Runs once when the node enters the scene tree.
func _ready():
	print("Player ready!")

# -------------------------------------------
# PHYSICS PROCESS
# -------------------------------------------
# Runs every physics frame (default 60 times/sec).
# All physics logic goes here.
func _physics_process(delta: float) -> void:
	# --- Apply Gravity ---
	# If the player is not on the floor, pull them down.
	if not is_on_floor():
		velocity.y += gravity * delta

	# --- Handle Jump ---
	# If on the floor and jump was just pressed, launch upward.
	if is_on_floor() and Input.is_action_just_pressed("jump"):
		velocity.y = jump_force

	# --- Horizontal Movement ---
	# Get input direction: -1 (left), 0 (none), +1 (right).
	var direction := Input.get_axis("move_left", "move_right")

	# Apply horizontal velocity with smoothing.
	velocity.x = direction * speed

	# --- Move the Character ---
	# move_and_slide() handles collisions automatically.
	move_and_slide()
