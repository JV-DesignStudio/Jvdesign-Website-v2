extends Area2D

const SPEED = 300
var lifetime = 1.5

func _physics_process(delta):
	# Fly in the direction sparkle is facing
	position += Vector2(SPEED * delta, 0).rotated(rotation)
	lifetime -= delta
	if lifetime <= 0:
		queue_free()

func _on_body_entered(body):
	if body.is_in_group("enemy"):
		body.take_damage(1)
		queue_free()
