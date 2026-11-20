extends Node2D

const RUN_TIME := 45.0
const FINISH_BONUS := 500
const BASE_SPEED := 150.0
const SPEED_GAIN := 1.6
const LANES := [214.0, 320.0, 426.0]
const SPAWN_MIN := 0.55
const SPAWN_MAX := 1.1
const CASH_PER_SECOND := 40.0
const PASS_POINTS := 25
const CAR_COLORS := [
	Color(0.86, 0.32, 0.3, 1),
	Color(0.9, 0.66, 0.22, 1),
	Color(0.36, 0.56, 0.86, 1),
	Color(0.72, 0.42, 0.78, 1),
	Color(0.85, 0.85, 0.82, 1)
]

var traffic_scene := preload("res://traffic.tscn")
var rng := RandomNumberGenerator.new()
var time_left := RUN_TIME
var score := 0.0
var spawn_timer := 0.8
var road_speed := BASE_SPEED
var running := true
var last_lane := -1

@onready var player = $Player
@onready var traffic_root: Node2D = $Traffic
@onready var lane_lines: Node2D = $LaneLines
@onready var time_label: Label = $UI/TimeLabel
@onready var score_label: Label = $UI/ScoreLabel
@onready var message_label: Label = $UI/MessageLabel

func _ready() -> void:
	rng.randomize()
	player.hit.connect(_on_player_hit)
	message_label.text = ""
	_update_hud()

func _process(delta: float) -> void:
	if not running:
		_check_restart()
		return

	time_left = maxf(time_left - delta, 0.0)
	score += CASH_PER_SECOND * delta
	road_speed = BASE_SPEED + (RUN_TIME - time_left) * SPEED_GAIN
	_scroll_road(delta)

	if time_left <= 0.0:
		_finish_run()
		return

	spawn_timer -= delta
	if spawn_timer <= 0.0:
		_spawn_traffic()
		spawn_timer = rng.randf_range(SPAWN_MIN, SPAWN_MAX)

	_update_hud()

func _scroll_road(delta: float) -> void:
	var lines: Array = lane_lines.get_children()
	for line in lines:
		var rect := line as ColorRect
		rect.position.y += road_speed * delta
		if rect.position.y > 380.0:
			rect.position.y -= 400.0

func _spawn_traffic() -> void:
	var lane_index := rng.randi_range(0, LANES.size() - 1)
	if lane_index == last_lane and rng.randf() < 0.5:
		lane_index = (lane_index + 1) % LANES.size()
	last_lane = lane_index

	var car = traffic_scene.instantiate()
	car.position = Vector2(LANES[lane_index], -50.0)
	car.speed = rng.randf_range(road_speed * 0.8, road_speed * 1.25)
	car.tint = CAR_COLORS[rng.randi_range(0, CAR_COLORS.size() - 1)]
	car.scored.connect(_on_traffic_passed)
	traffic_root.add_child(car)

func _on_traffic_passed(points: int) -> void:
	score += points

func _on_player_hit() -> void:
	if not running:
		return
	running = false
	player.crash()
	_stop_traffic()
	message_label.text = "CRASH!\nScore " + str(int(score)) + "\nPress R or Enter to try again"
	_update_hud()

func _finish_run() -> void:
	running = false
	score += FINISH_BONUS
	_stop_traffic()
	message_label.text = (
		"YOU MADE IT!\n+"
		+ str(FINISH_BONUS)
		+ " finish bonus\nScore "
		+ str(int(score))
		+ "\nPress R or Enter to play again"
	)
	_update_hud()

func _stop_traffic() -> void:
	var cars: Array = traffic_root.get_children()
	for car in cars:
		car.set_process(false)

func _check_restart() -> void:
	if Input.is_action_just_pressed("ui_accept"):
		get_tree().reload_current_scene()

func _unhandled_input(event: InputEvent) -> void:
	if running:
		return
	if event is InputEventKey:
		var key := event as InputEventKey
		if key.pressed and key.keycode == KEY_R:
			get_tree().reload_current_scene()

func _update_hud() -> void:
	time_label.text = "TIME " + str(snappedf(time_left, 0.1))
	score_label.text = "SCORE " + str(int(score))
