extends Area2D

# Set this in the scene or from track.gd after instancing
var checkpoint_index: int = 0

func _ready():
	body_entered.connect(_on_body_entered)

func _on_body_entered(body):
	if body.has_method("pass_checkpoint"):
		body.pass_checkpoint(checkpoint_index)
