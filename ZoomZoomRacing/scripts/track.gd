extends Node2D

var elapsed = 0.0
var racing = true
var total_laps = 3

# Populated from scene children
var checkpoints: Array = []

# AI waypoints going clockwise around the loop
var waypoints: Array = [
	Vector2(850, 125),
	Vector2(1007, 125),
	Vector2(1007, 280),
	Vector2(1007, 460),
	Vector2(1007, 523),
	Vector2(750, 523),
	Vector2(500, 523),
	Vector2(145, 523),
	Vector2(145, 400),
	Vector2(145, 220),
	Vector2(145, 125),
	Vector2(300, 125),
	Vector2(500, 125),
]

func _ready():
	# Gather checkpoint nodes (children of Checkpoints node, in order)
	for i in $Checkpoints.get_child_count():
		var cp = $Checkpoints.get_child(i)
		cp.checkpoint_index = i
		checkpoints.append(cp)

	# Give AI its waypoints
	$AICar.setup_waypoints(waypoints)
	$AICar.total_laps = total_laps

	# Finish line
	$FinishLine.body_entered.connect(_on_finish_line)

	# Player signals
	$Car.total_laps = total_laps
	$Car.health_changed.connect(_on_player_health_changed)
	$Car.lap_completed.connect(_on_player_lap)
	$Car.race_finished.connect(_on_player_win)
	$Car.car_exploded.connect(_on_player_exploded)

	# AI signals
	$AICar.race_finished.connect(_on_ai_win)

	# Init HUD
	$CanvasLayer/HealthBar.value = 100
	$CanvasLayer/LapLabel.text = "Lap: 0 / " + str(total_laps)

func _process(delta):
	if racing:
		elapsed += delta
		$CanvasLayer/TimerLabel.text = "Time: " + str(snappedf(elapsed, 0.1))

func _on_finish_line(body):
	if body.has_method("cross_finish_line"):
		body.cross_finish_line()

func _on_player_health_changed(hp, max_hp):
	var pct = (hp / max_hp) * 100.0
	$CanvasLayer/HealthBar.value = pct
	if pct <= 15:
		$CanvasLayer/HealthBar.modulate = Color(1, 0.15, 0.15)
		$CanvasLayer/DamageWarning.visible = true
	elif pct <= 50:
		$CanvasLayer/HealthBar.modulate = Color(1, 0.75, 0.0)
		$CanvasLayer/DamageWarning.visible = false
	else:
		$CanvasLayer/HealthBar.modulate = Color(0.2, 1, 0.3)
		$CanvasLayer/DamageWarning.visible = false

func _on_player_lap(lap_num):
	$CanvasLayer/LapLabel.text = "Lap: " + str(lap_num) + " / " + str(total_laps)

func _on_player_win():
	racing = false
	$CanvasLayer/WinLabel.text = "🏁 YOU WIN!"
	$CanvasLayer/WinLabel.modulate = Color(0.2, 1, 0.3)
	$CanvasLayer/WinLabel.visible = true

func _on_player_exploded():
	if racing:
		racing = false
		$CanvasLayer/WinLabel.text = "💥 YOU CRASHED OUT!"
		$CanvasLayer/WinLabel.modulate = Color(1, 0.3, 0.1)
		$CanvasLayer/WinLabel.visible = true

func _on_ai_win():
	if racing:
		racing = false
		$CanvasLayer/WinLabel.text = "🤖 AI WINS!"
		$CanvasLayer/WinLabel.modulate = Color(1, 0.5, 0.1)
		$CanvasLayer/WinLabel.visible = true
