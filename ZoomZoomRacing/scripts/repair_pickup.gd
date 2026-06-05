extends Area2D

var heal_amount = 35.0
var respawn_time = 10.0
var active = true

func _ready():
	body_entered.connect(_on_body_entered)

func _on_body_entered(body):
	if not active:
		return
	if body.has_method("repair"):
		body.repair(heal_amount)
		_deactivate()

func _deactivate():
	active = false
	visible = false
	await get_tree().create_timer(respawn_time).timeout
	active = true
	visible = true
