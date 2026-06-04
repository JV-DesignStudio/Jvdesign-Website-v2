extends CharacterBody2D

const SPEED      = 220
const JUMP_FORCE = -480  # Negative = upward in Godot!
var gravity = ProjectSettings.get_setting("physics/2d/default_gravity")

func _ready():
	add_to_group("player")

func _physics_process(delta):
	# Pull the player down with gravity
	if not is_on_floor():
		velocity.y += gravity * delta

	# Jump when Space/Up is pressed — only when on the ground!
	if Input.is_action_just_pressed("ui_accept") and is_on_floor():
		velocity.y = JUMP_FORCE

	# Left / right movement
	var direction = Input.get_axis("ui_left", "ui_right")
	velocity.x = direction * SPEED

	move_and_slide()

func take_hit():
	# Called by an enemy when it touches the player from the side
	# TODO Step 6: add lives, flash, or game over!
	print("Ouch! Add lives here.")
