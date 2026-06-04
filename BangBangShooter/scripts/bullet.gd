extends Area2D

const SPEED = 500
var lifetime = 2.0

func _physics_process(delta):
	# Fly forward in the direction the bullet is facing
	position += Vector2(SPEED * delta, 0).rotated(rotation)
	lifetime -= delta
	if lifetime <= 0:
		queue_free()  # Disappear after 2 seconds

func _on_body_entered(body):
	if body.is_in_group("enemy"):
		body.take_damage(1)
	queue_free()  # Disappear when hitting something
