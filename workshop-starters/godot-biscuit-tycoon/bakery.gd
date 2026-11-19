extends Control

# The scene and every button are already wired.
# Follow the workshop steps and change one function at a time.

var biscuits = 0.0
var click_power = 1
var auto_tappers = 0
var auto_power = 1
var auto_cost = 50
var faster_cost = 250
var golden_active = false

@onready var biscuits_label = $BiscuitsLabel
@onready var cps_label = $CpsLabel
@onready var auto_button = $AutoButton
@onready var faster_button = $FasterButton
@onready var golden_button = $GoldenButton
@onready var golden_timer = $GoldenTimer

func _ready():
	golden_timer.start()
	update_hud()

func _process(delta):
	auto_tick(delta)
	update_hud()

func on_tap():
	pass

func biscuits_per_second():
	return 0.0

func auto_tick(delta):
	pass

func buy_auto_tapper():
	pass

func buy_faster_tapper():
	pass

func golden_bonus():
	pass

func on_golden_timer_timeout():
	golden_active = true
	golden_button.visible = true

func on_golden_pressed():
	if golden_active:
		golden_bonus()
		golden_active = false
		golden_button.visible = false

func update_hud():
	biscuits_label.text = str(int(biscuits)) + " biscuits"
	cps_label.text = str(snappedf(biscuits_per_second(), 0.1)) + " / sec"
	auto_button.text = "AUTO TAPPER\nCost: " + str(auto_cost)
	faster_button.text = "FASTER TAPPER\nCost: " + str(faster_cost)
