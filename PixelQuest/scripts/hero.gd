extends CharacterBody2D

const SPEED = 180

var has_key   = false  # Does the hero have the key?
var attacking = false

func _ready():
	add_to_group("player")
	$Sword.visible    = false
	$Sword.monitoring = false

func _physics_process(delta):
	# get_vector gives us left/right/up/down as one Vector2
	var dir = Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
	velocity = dir * SPEED
	move_and_slide()

func _input(event):
	if event.is_action_just_pressed("ui_accept") and not attacking:
		_swing_sword()

func _swing_sword():
	attacking         = true
	$Sword.visible    = true
	$Sword.monitoring = true
	await get_tree().create_timer(0.3).timeout
	$Sword.visible    = false
	$Sword.monitoring = false
	attacking         = false

# ── Connected to Sword's body_entered signal ──
func _on_sword_body_entered(body):
	if body.is_in_group("enemy"):
		body.take_hit()

func take_hit():
	# TODO: Add health / hearts system here (Step 5)!
	modulate = Color.RED
	var tween = create_tween()
	tween.tween_property(self, "modulate", Color.WHITE, 0.4)
