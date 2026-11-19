# Biscuit Tycoon starter (Godot 4)

This is the exact project used by the Biscuit Tycoon workshop.

1. Unzip the folder.
2. Open Godot 4 and choose Import.
3. Pick `project.godot` and press Import and Edit.
4. Press F5 to play. The tin, labels, shop buttons and golden timer are already wired.
5. Open `bakery.gd` and follow `STEPS.md` (or the In Godot panel on the workshop page). Each step names the function to change.

Do not rename the node paths or the functions. The scene connects to:

- `on_tap` from the TAP THE TIN button
- `buy_auto_tapper` from the AUTO TAPPER button
- `buy_faster_tapper` from the FASTER TAPPER button
- `on_golden_timer_timeout` and `on_golden_pressed` for the golden biscuit

The workshop canvas and this project use the same variable names and the same function bodies, so each step can be copied straight in.
