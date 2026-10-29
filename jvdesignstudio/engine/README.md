# JV-Engine Starter Template

A zero-dependency, serverless game-coding platform starter kit extracted from [JVDesignStudio](https://jvdesignstudio.com).

## What's included

| File | Purpose |
|---|---|
| `engine/state.js` | XP/level/streak/save state (localStorage) |
| `engine/evaluator.js` | Sandboxed Web Worker code runner |
| `engine/skill-tree.js` | Interactive SVG skill tree renderer |
| `engine/fx.js` | Web Audio sound effects + canvas confetti |
| `engine/workspace.html` | 3-pane IDE layout (briefing / editor / console) |
| `engine/index.html` | Dashboard with skill tree and HUD |
| `engine/example-track.json` | Minimal example quest track |

## Requirements

- A modern browser (Chrome 90+, Firefox 88+, Safari 15+)
- A static file server OR any CDN / GitHub Pages
- **No build tools, no npm, no framework**

## Quick start

```bash
# Option A: Python (any OS)
python -m http.server 8080

# Option B: Node
npx serve .

# Option C: VS Code Live Server extension
# Right-click index.html → Open with Live Server
```

Then open `http://localhost:8080/engine/index.html`.

## Adding your own quests

Edit `engine/example-track.json` or create a new track JSON following this schema:

```json
{
  "id": "my-track",
  "title": "My Track",
  "mascot": "Guide",
  "mascotAvatar": "🦊",
  "mascotRole": "Your guide",
  "description": "A short track description.",
  "nodes": [
    {
      "id": "my-node-1",
      "title": "Hello World",
      "briefing": "<p>Write a function that returns 'hello'.</p>",
      "initialCode": "function greet() {\n  // your code here\n}",
      "xp": 50,
      "prerequisites": [],
      "testCases": [
        {
          "description": "greet() returns 'hello'",
          "assertion": "greet() === 'hello'"
        }
      ]
    }
  ]
}
```

Point `engine/index.html`'s `loadJSON` call at your track file to load it.

## Licence

MIT. Built by JVDesignStudio. Use it, fork it, ship it.
