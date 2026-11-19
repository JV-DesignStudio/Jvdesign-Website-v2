# Star Collector - the finished Godot project

This is the real Godot version of the browser build in the Godot Basics lesson.

## Open it

1. Download `godot-tutorial.zip` from the lesson.
2. Unzip it.
3. In Godot 4, choose **Import**, pick `project.godot`, and open it.
4. Press **Play** (F5). Use the arrow keys to move and collect all 8 coins.

## What is in the scene

- `Main` (Node2D)
  - `Background`
  - `Coins` with eight `Area2D` coins
  - `Player` (CharacterBody2D) with `Body`, `Eye`, `Trail` and a collision shape
  - `UI` with `Score`, `Win` and `Hint` labels

## Follow the same seven steps

The browser lesson has seven steps. In this project they map to:

1. **Your first scene**: the `Main` tree and the eight coins.
2. **Input and movement**: `Input.get_vector()` and `move_and_slide()` in `player.gd`.
3. **Rotation**: `rotation = direction.angle()`.
4. **Motion trail**: the `Trail` Line2D and `trail_points`.
5. **Collectibles**: `coin.gd` calls `add_coin()` on the player.
6. **Win condition**: `score >= total_coins` shows the `Win` label.
7. **Take it home**: change `player_colour` or `game_name` in the Inspector.

## Make it yours

Select `Player` in the Scene panel. In the Inspector, change `Speed`, `Player Colour` or `Game Name`. The HUD and trail update when you run the scene.
