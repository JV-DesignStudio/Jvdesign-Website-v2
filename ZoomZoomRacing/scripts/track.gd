extends Node2D

var elapsed = 0.0
var racing = true   # is the race still going?

func _ready():
	# Connect the finish line signal
	$FinishLine.body_entered.connect(_on_finish)

func _process(delta):
	if racing:
		elapsed += delta
		$CanvasLayer/TimerLabel.text = "Time: " + str(snappedf(elapsed, 0.1))

func _on_finish(body):
	if body.name == "Car":
		racing = false
		$CanvasLayer/WinLabel.visible = true
