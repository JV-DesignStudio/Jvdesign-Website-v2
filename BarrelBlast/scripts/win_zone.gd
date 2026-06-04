extends Area2D

func _on_body_entered(body):
	if body.is_in_group("player"):
		var win_label = get_tree().get_root().find_child("WinLabel", true, false)
		if win_label: win_label.visible = true
