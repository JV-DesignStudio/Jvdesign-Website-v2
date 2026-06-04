extends CharacterBody2D

const SPEED = 90
var gravity = ProjectSettings.get_setting("physics/2d/default_gravity")
var direction = 1  # Start walking right

func _ready():
	add_to_group("enemy")

func _physics_process(delta):
	# Gravity — enemy falls too!
	if not is_on_floor():
		velocity.y += gravity * delta

	velocity.x = direction * SPEED
	move_and_slide()

	# Reverse direction when hitting a wall
	if is_on_wall():
		direction = -direction

# ── Called when StompBox (Area2D on TOP of enemy) detects the player ──
func _on_stomp_box_body_entered(body):
	if body.is_in_group("player"):
		queue_free()  # Enemy gets stomped! 🦶

# ── Called when SideArea (Area2D on the SIDES) detects the player ──
func _on_side_area_body_entered(body):
	if body.is_in_group("player"):
		body.take_hit()  # Player gets hurt!
