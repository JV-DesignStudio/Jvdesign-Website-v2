extends CharacterBody2D

signal hit

const SPEED := 280.0
const MIN_X := 192.0
const MAX_X := 448.0

var crashed := false

@onready var body_visual: Polygon2D = $Body

func _ready() -> void:
	add_to_group("player")

func _physics_process(_delta: float) -> void:
	if crashed:
		return

	var direction := Input.get_axis("ui_left", "ui_right")
	if Input.is_key_pressed(KEY_A):
		direction -= 1.0
	if Input.is_key_pressed(KEY_D):
		direction += 1.0
	direction = clampf(direction, -1.0, 1.0)

	velocity.x = direction * SPEED
	velocity.y = 0.0
	move_and_slide()
	position.x = clampf(position.x, MIN_X, MAX_X)

func crash() -> void:
	crashed = true
	body_visual.color = Color(0.35, 0.3, 0.3, 1)
	var cabin := $Cabin as Polygon2D
	var stripe := $Stripe as Polygon2D
	cabin.color = Color(0.25, 0.22, 0.22, 1)
	stripe.color = Color(0.3, 0.26, 0.24, 1)
