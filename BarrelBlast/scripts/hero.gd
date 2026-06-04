extends CharacterBody2D

const SPEED      = 200
const JUMP_FORCE = -440
var gravity   = ProjectSettings.get_setting("physics/2d/default_gravity")
var on_ladder = false  # Used in Step 5!
var dead      = false

func _ready():
	add_to_group("player")

func _physics_process(delta):
	# Gravity — skip when climbing a ladder
	if not is_on_floor() and not on_ladder:
		velocity.y += gravity * delta

	# Jump
	if Input.is_action_just_pressed("ui_accept") and is_on_floor():
		velocity.y = JUMP_FORCE

	# Left / right
	var dir = Input.get_axis("ui_left", "ui_right")
	velocity.x = dir * SPEED

	move_and_slide()

func take_hit():
	if dead: return
	dead = true
	# Find and show the Game Over label
	var go_label = get_tree().get_root().find_child("GameOverLabel", true, false)
	if go_label: go_label.visible = true
