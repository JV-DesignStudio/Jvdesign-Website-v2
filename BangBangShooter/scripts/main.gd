extends Node2D

@export var enemy_scene: PackedScene
var score = 0

func _on_spawn_timer_timeout():
	if not enemy_scene: return
	var enemy = enemy_scene.instantiate()
	# Spawn at a random spot around the edge of the screen
	var angle = randf() * TAU
	enemy.position = get_viewport_rect().size / 2 + Vector2(cos(angle), sin(angle)) * 400
	add_child(enemy)

func add_score(amount):
	score += amount
	$CanvasLayer/ScoreLabel.text = "Score: " + str(score)
