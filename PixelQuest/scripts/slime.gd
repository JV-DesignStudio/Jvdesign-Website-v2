extends CharacterBody2D

# Start moving at an angle so bouncing looks natural
var velocity_dir = Vector2(120, 90)
var health = 2

func _ready():
	add_to_group("enemy")

func _physics_process(delta):
	velocity = velocity_dir
	move_and_slide()

	# Bounce off anything we hit
	for i in get_slide_collision_count():
		var col = get_slide_collision(i)
		velocity_dir = velocity_dir.bounce(col.get_normal())

func take_hit():
	health -= 1
	modulate = Color.RED
	var tween = create_tween()
	tween.tween_property(self, "modulate", Color.WHITE, 0.2)
	if health <= 0:
		queue_free()

# ── Connected to HurtZone body_entered signal ──
func _on_hurt_zone_body_entered(body):
	if body.is_in_group("player"):
		body.take_hit()
