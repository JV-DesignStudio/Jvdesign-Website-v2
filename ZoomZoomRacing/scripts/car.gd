extends CharacterBody2D

# How fast the car goes
var speed = 300

# How fast the car turns
var turn_speed = 3.0

func _physics_process(delta):
	# Check if up/down arrow keys are pressed
	var drive = Input.get_axis("ui_down", "ui_up")

	# Check if left/right arrow keys are pressed
	var steer = Input.get_axis("ui_left", "ui_right")

	# Turn the car (only when moving)
	if drive != 0:
		rotation += steer * turn_speed * delta

	# Move the car forward/backward in the direction it faces
	velocity = Vector2.UP.rotated(rotation) * drive * speed

	# Actually move it!
	move_and_slide()
