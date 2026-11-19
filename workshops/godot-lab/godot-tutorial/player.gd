extends CharacterBody2D

@export var speed := 180.0
@export var player_colour := Color(0.376, 0.647, 0.98)
@export var game_name := "Star Collector"

var score := 0
var total_coins := 8
var trail_points: Array[Vector2] = []

@onready var trail: Line2D = $Trail
@onready var score_label: Label = get_node("../UI/Score")
@onready var win_label: Label = get_node("../UI/Win")

func _ready() -> void:
    $Body.color = player_colour
    trail.default_color = Color(player_colour.r, player_colour.g, player_colour.b, 0.55)
    score_label.text = game_name + "  Coins: 0 / " + str(total_coins)
    win_label.visible = false

func _physics_process(_delta: float) -> void:
    var direction := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
    velocity = direction * speed
    move_and_slide()

    position.x = clampf(position.x, 16.0, 384.0)
    position.y = clampf(position.y, 16.0, 384.0)

    if direction.length() > 0.1:
        rotation = direction.angle()

    trail_points.push_front(position)
    if trail_points.size() > 20:
        trail_points.pop_back()
    trail.points = PackedVector2Array(trail_points)

func add_coin() -> void:
    score += 1
    score_label.text = game_name + "  Coins: " + str(score) + " / " + str(total_coins)
    if score >= total_coins:
        win_label.text = game_name + " complete!\nYou collected all " + str(total_coins) + " coins."
        win_label.visible = true
