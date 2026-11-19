extends Area3D

@export var open_colour := Color(0.25, 0.8, 0.4)
var closed_colour := Color(0.75, 0.25, 0.25)

func _ready() -> void:
    body_entered.connect(_on_body_entered)
    body_exited.connect(_on_body_exited)
    set_colour(closed_colour)

func _on_body_entered(body: Node3D) -> void:
    if body.name == "Player":
        set_colour(open_colour)

func _on_body_exited(body: Node3D) -> void:
    if body.name == "Player":
        set_colour(closed_colour)

func set_colour(colour: Color) -> void:
    var mat := StandardMaterial3D.new()
    mat.albedo_color = colour
    $Visual.material = mat
