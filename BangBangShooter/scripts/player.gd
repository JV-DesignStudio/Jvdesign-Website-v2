extends CharacterBody2D

const SPEED = 200

@export var bullet_scene: PackedScene
@onready var gun_tip = $GunTip

func _ready():
	add_to_group("player")

func _physics_process(delta):
	# Move with arrow keys or WASD
	var direction = Vector2.ZERO
	if Input.is_action_pressed("ui_right"): direction.x += 1
	if Input.is_action_pressed("ui_left"):  direction.x -= 1
	if Input.is_action_pressed("ui_down"):  direction.y += 1
	if Input.is_action_pressed("ui_up"):    direction.y -= 1

	velocity = direction.normalized() * SPEED
	move_and_slide()

	# Aim toward the mouse cursor!
	look_at(get_global_mouse_position())

func _input(event):
	if event.is_action_just_pressed("shoot"):
		shoot()

func shoot():
	if not bullet_scene: return
	var bullet = bullet_scene.instantiate()
	bullet.position = gun_tip.global_position
	bullet.rotation  = rotation
	get_parent().add_child(bullet)

func take_damage(amount):
	# TODO: Add health / lives system here!
	print("Player hit! Add health logic.")
