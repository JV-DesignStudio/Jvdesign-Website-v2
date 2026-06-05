extends CharacterBody2D

var base_speed = 275.0
var turn_speed = 3.2

var max_health = 100.0
var health = 100.0
var is_dead = false
var damage_cooldown = 0.0

var waypoints: Array = []
var current_waypoint = 0

var current_checkpoint = 0
var lap = 0
var total_laps = 3
var finished = false

signal health_changed(new_health, max_health)
signal car_exploded
signal lap_completed(lap_num)
signal race_finished

func setup_waypoints(wp: Array):
	waypoints = wp

func _physics_process(delta):
	if is_dead or finished or waypoints.is_empty():
		return

	if damage_cooldown > 0:
		damage_cooldown -= delta

	# Steer toward next waypoint
	var target: Vector2 = waypoints[current_waypoint]
	var to_target = target - global_position

	if to_target.length() < 65:
		current_waypoint = (current_waypoint + 1) % waypoints.size()

	# Smoothly rotate toward target
	var desired_angle = to_target.angle() + PI / 2.0
	var rot_diff = wrapf(desired_angle - rotation, -PI, PI)
	rotation += clamp(rot_diff * 4.0 * delta, -turn_speed * delta, turn_speed * delta) * turn_speed

	velocity = Vector2.UP.rotated(rotation) * get_speed()
	move_and_slide()

	for i in get_slide_collision_count():
		var col = get_slide_collision(i)
		var other = col.get_collider()
		if other is CharacterBody2D and other.has_method("receive_damage"):
			_handle_collision(other)

func get_speed() -> float:
	if health / max_health <= 0.15:
		return base_speed * 0.5
	return base_speed

func _handle_collision(other):
	if damage_cooldown > 0:
		return
	var my_spd = velocity.length()
	var other_spd = other.velocity.length()
	var combined = my_spd + other_spd
	if combined < 50:
		return
	if my_spd < other_spd:
		return
	if my_spd == other_spd and get_instance_id() < other.get_instance_id():
		return
	var base_dmg = combined * 0.06
	var my_ratio = my_spd / combined
	receive_damage(base_dmg * (1.0 - my_ratio))
	other.receive_damage(base_dmg * my_ratio)
	damage_cooldown = 0.5
	other.damage_cooldown = 0.5

func receive_damage(amount: float):
	if is_dead:
		return
	health = max(0.0, health - amount)
	emit_signal("health_changed", health, max_health)
	if health <= 0:
		_explode()

func repair(amount: float):
	if is_dead:
		return
	health = min(max_health, health + amount)

func _explode():
	is_dead = true
	emit_signal("car_exploded")
	$ColorRect.visible = false
	$Explosion.emitting = true
	$CollisionShape2D.set_deferred("disabled", true)
	await get_tree().create_timer(2.5).timeout
	visible = false

func pass_checkpoint(index: int):
	if index == current_checkpoint:
		current_checkpoint += 1

func cross_finish_line():
	if finished or is_dead:
		return
	var needed = get_parent().checkpoints.size()
	if current_checkpoint >= needed:
		current_checkpoint = 0
		lap += 1
		emit_signal("lap_completed", lap)
		if lap >= total_laps:
			finished = true
			emit_signal("race_finished")
