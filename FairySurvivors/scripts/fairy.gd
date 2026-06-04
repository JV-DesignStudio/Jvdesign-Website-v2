extends CharacterBody2D

const SPEED = 150

@export var sparkle_scene: PackedScene
var last_direction = Vector2.RIGHT  # Default fire direction
var health = 5

func _ready():
	add_to_group("player")

func _physics_process(delta):
	var direction = Vector2.ZERO
	if Input.is_action_pressed("ui_right"): direction.x += 1
	if Input.is_action_pressed("ui_left"):  direction.x -= 1
	if Input.is_action_pressed("ui_down"):  direction.y += 1
	if Input.is_action_pressed("ui_up"):    direction.y -= 1

	if direction != Vector2.ZERO:
		last_direction = direction.normalized()

	velocity = direction.normalized() * SPEED
	move_and_slide()

	# Flip the sprite to face the direction we're moving
	if direction.x != 0:
		$Sprite2D.flip_h = direction.x < 0

# ── Connected to SpellTimer timeout signal ──
func _on_spell_timer_timeout():
	fire_fairy_dust()

func fire_fairy_dust():
	if not sparkle_scene: return
	var s = sparkle_scene.instantiate()
	s.position = global_position
	s.rotation  = last_direction.angle()
	get_parent().add_child(s)

func take_hit():
	health -= 1
	# Flash red
	modulate = Color.RED
	var tween = create_tween()
	tween.tween_property(self, "modulate", Color.WHITE, 0.3)
	# Update hearts display
	var gm = get_tree().get_first_node_in_group("game_manager")
	if gm: gm.update_health_display(health)
	if health <= 0:
		print("Game Over! Add restart logic here.")
