extends CharacterBody2D

const ROLL_SPEED = 130
var gravity   = ProjectSettings.get_setting("physics/2d/default_gravity")
var direction = 1  # Start rolling right

func _ready():
	add_to_group("barrel")

func _physics_process(delta):
	# Barrels fall too!
	if not is_on_floor():
		velocity.y += gravity * delta

	velocity.x = direction * ROLL_SPEED
	move_and_slide()

	# Roll off the edge / reverse at a wall
	if is_on_wall():
		direction = -direction

	# Clean up if barrel falls off the bottom
	if position.y > 800:
		queue_free()

func _on_hit_box_body_entered(body):
	if body.is_in_group("player"):
		body.take_hit()
