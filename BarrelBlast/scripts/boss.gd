extends Node2D

@export var barrel_scene: PackedScene

# ── Connected to the Boss's Timer node "timeout" signal ──
func _on_timer_timeout():
	if not barrel_scene: return
	var barrel = barrel_scene.instantiate()
	# Spawn barrel at the boss's feet
	barrel.position = global_position + Vector2(0, 40)
	get_parent().add_child(barrel)
