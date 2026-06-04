extends CharacterBody2D

var speed = 60
var health = 2

func _ready():
	add_to_group("enemy")

func _physics_process(delta):
	var players = get_tree().get_nodes_in_group("player")
	if players.size() > 0:
		var dir = (players[0].position - position).normalized()
		velocity = dir * speed
		move_and_slide()
		# Face the direction we're moving
		$Sprite2D.flip_h = velocity.x < 0

func take_damage(amount):
	health -= amount
	if health <= 0:
		# Tell the game manager we died
		var gm = get_tree().get_first_node_in_group("game_manager")
		if gm: gm.on_enemy_died(position)
		queue_free()

# ── Connected to the bug's inner Area2D body_entered ──
func _on_area_2d_body_entered(body):
	if body.is_in_group("player"):
		body.take_hit()
