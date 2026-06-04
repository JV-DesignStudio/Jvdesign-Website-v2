extends Node2D

@export var bug_scene: PackedScene
var survival_time  = 0.0
var score          = 0
var bug_speed      = 60
var difficulty_timer = 0.0

func _ready():
	add_to_group("game_manager")

func _process(delta):
	survival_time    += delta
	difficulty_timer += delta
	$CanvasLayer/TimeLabel.text = "Time: " + str(int(survival_time)) + "s"

	# Every 10 seconds, bugs get faster
	if difficulty_timer >= 10.0:
		difficulty_timer = 0.0
		bug_speed += 10

func _on_spawn_timer_timeout():
	if not bug_scene: return
	var bug = bug_scene.instantiate()
	var angle = randf() * TAU
	bug.position = get_viewport_rect().size / 2 + Vector2(cos(angle), sin(angle)) * 350
	bug.speed    = bug_speed
	add_child(bug)

func on_enemy_died(pos):
	score += 1
	$CanvasLayer/ScoreLabel.text = "Score: " + str(score)

func update_health_display(hp):
	var hearts = ""
	for i in range(hp): hearts += "❤️"
	$CanvasLayer/HeartsLabel.text = hearts
