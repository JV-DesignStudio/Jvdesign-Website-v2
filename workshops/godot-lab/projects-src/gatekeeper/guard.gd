extends Node3D

@export var distance := 3.0
@export var speed := 1.5
var start_x := 0.0

func _ready() -> void:
    start_x = position.x

func _process(_delta: float) -> void:
    position.x = start_x + sin(Time.get_ticks_msec() / 1000.0 * speed) * distance
