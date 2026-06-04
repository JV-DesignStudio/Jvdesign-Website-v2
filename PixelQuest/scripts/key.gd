extends Area2D

func _on_body_entered(body):
	if body.is_in_group("player"):
		body.has_key = true  # Give the key to the player!
		queue_free()         # Key disappears
