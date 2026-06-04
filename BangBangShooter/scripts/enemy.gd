extends CharacterBody2D

const SPEED = 80
var health = 3

func _ready():
	add_to_group("enemy")

func _physics_process(delta):
	# Find the player and chase them!
	var players = get_tree().get_nodes_in_group("player")
	if players.size() > 0:
		var dir = (players[0].position - position).normalized()
		velocity = dir * SPEED
		move_and_slide()

func take_damage(amount):
	health -= amount
	if health <= 0:
		queue_free()  # Enemy defeated!

func _on_hurt_zone_body_entered(body):
	if body.is_in_group("player"):
		body.take_damage(1)
