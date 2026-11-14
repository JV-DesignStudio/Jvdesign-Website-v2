# The .jvds project file

A `.jvds` file is one project you can keep, move and open again. It is a plain
text file (JSON) made in the browser, so it needs no account, no install and no
special software.

## What it can hold

- **Art** from Pixel Studio or Sprite Animator: a PNG sprite sheet with frame size and count.
- **Sound** from Arcade Game Maker: your music track and any custom sound effects.
- **Level** from Level Designer: the tile map and the coins, enemies, spawn and goal.
- **Game data** from Arcade Game Maker: title, genre, settings, story, cutscenes, achievements and your code editor text.
- **The tool's own project** so the file reopens exactly where it was made.

You do not need every part. A Pixel Studio file usually carries art only.

## How to make one

- Pixel Studio: Save, then **Download project (.jvds)**.
- Sprite Animator: **Download project (.jvds)**.
- Arcade Game Maker: **Project file**.

## How to open one

Open the same tool and choose **Open project** (or drag the file into the file
picker). A file made in another studio still opens: Game Maker takes its art,
sound and level, and Pixel Studio takes the art.

## Format

```json
{
  "app": "jvds-tool-bundle",
  "v": 2,
  "tool": "pixel-studio | sprite-animator | arcade-game-maker",
  "name": "My project",
  "createdAt": "2026-11-14T10:00:00.000Z",
  "project": { "native project data for that tool" },
  "sprite": { "dataUrl": "data:image/png;base64,...", "frameW": 16, "frameH": 16, "frameCount": 4 },
  "sound": { "name": "My track", "music": "data:audio/wav;base64,...", "buffers": {}, "sounds": {} },
  "level": { "map": [0, 1, 2], "entities": { "coins": [], "enemies": [], "spawn": null, "goal": null } },
  "preview": "data:image/png;base64,..."
}
```

- `sprite`, `sound`, `level` and `preview` may be `null`.
- `project` is what the tool needs to reopen the file exactly.
- Version 1 files still open. They are upgraded on load with empty `sound` and `level`.

## Limits and safety

- The file is read in the browser. Nothing is uploaded.
- Images and sound are embedded, so very large projects make a large file.
- Only open a `.jvds` file from someone you trust. Imported text is cleaned before
  it reaches the page, and imported code never runs until you click **Apply & Run**.
