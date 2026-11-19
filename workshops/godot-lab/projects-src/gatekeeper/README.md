# Who Goes There? 3D starter

This is the starter project for the 3D gatekeeper workshops.

## Open it

1. Download the project from the Godot Lab.
2. Unzip it.
3. In Godot 4, choose Import, pick `project.godot`, and open it.
4. Press Play. Use WASD or the arrow keys, and Space to jump.

## What is in the scene

- `Main` (Node3D)
  - `Camera3D` looking down at the floor
  - `Sun` directional light with shadows
  - `Floor` with a box collision
  - `Player` (CharacterBody3D) with a sphere body
  - `Gate` (Area3D) that turns green when the player reaches it
  - `Guard` (Node3D) pacing across the floor
  - `UI` with the control hint

## Follow the workshop

Part 1 builds the checkpoint room: player movement, the gate, the guard and the
first rule. Part 2 adds the shared coin bank, daily rent, the 10-day challenge
and the win or lose ending.

## Make it yours

Select `Player` and change `Speed` in the Inspector. Select `Guard` and change
`Distance` or `Speed`. Change the gate colours in `gate.gd`.
