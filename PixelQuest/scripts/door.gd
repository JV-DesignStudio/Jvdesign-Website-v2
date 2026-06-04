extends StaticBody2D

var is_open = false

# ── Connected to the DetectZone Area2D body_entered signal ──
func _on_detect_zone_body_entered(body):
	if body.is_in_group("player") and body.has_key and not is_open:
		is_open = true
		# Reveal the exit and hide the door!
		visible            = false
		$DetectZone.monitoring = false
		set_collision_layer_value(1, false)
		# Find and show the exit
		var exit = get_tree().get_root().find_child("Exit", true, false)
		if exit: exit.visible = true
