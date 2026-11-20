extends Area2D

signal scored(points: int)

var speed := 160.0
var tint := Color(0.86, 0.32, 0.3, 1)
var passed := false

@onready var body_visual: Polygon2D = $Body

func _ready() -> void:
	body_visual.color = tint
	body_entered.connect(_on_body_entered)

func _process(delta: float) -> void:
	position.y += speed * delta
	if position.y > 410.0:
		if not passed:
			passed = true
			scored.emit(25)
		queue_free()

func _on_body_entered(body: Node2D) -> void:
	if body.is_in_group("player"):
		body.emit_signal("hit")
		queue_free()
