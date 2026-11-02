# Workshop path block (A2193)

One shared before/during/after/next block for project pages. The block is built
once and filled from a small data object, so a page never hand-writes four
sections again.

## Files

| File | Job |
|---|---|
| `partials/workshop-path.html` | The shared markup and the two script tags |
| `assets/js/workshop-path.js` | Reads the data object and renders the four steps |
| `assets/js/workshop-path-data.js` | The content, keyed by page slug |
| `style-shared.css` | `.ws-path` styles, matching the `.ws-outcome` tone and spacing |

## Add it to a page

1. Add the shared markers where the block should sit:

   ```html
   <!-- BUILD:workshop-path -->
   <!-- /BUILD:workshop-path -->
   ```

2. Add one entry to `window.JVDS_WORKSHOP_PATHS` in
   `assets/js/workshop-path-data.js`. The key defaults to the page filename
   without `.html`, or you can set `data-workshop-path="your-key"` on the
   section if the filename is not unique.

3. Rebuild the partials, then refresh the CSP hashes:

   ```bash
   npm run build
   node scripts/csp-hashes.js --apply
   ```

The four slots are `before`, `during`, `after` and `next`. Each accepts
`label`, `title`, `text`, `href` and `linkLabel`. Missing slots are skipped.

## Worked character-design example

This example is for a character-design workshop page. It shows all four slots
and links to the Character Designer tool, the Sprite Animator, and a game that
uses the finished character. The same entry ships in
`assets/js/workshop-path-data.js` under the `character-design` key, so the
example is runnable when A2194 adds the block to that page. Links are absolute
so the block works on any page, not only inside `workshops/`.

```js
{
  "character-design": {
    "before": {
      "label": "Before",
      "title": "Draw one simple character",
      "text": "Start with a shape you can repeat: a fox, a robot or a cat. You only need a pencil and paper.",
      "href": "/workshops/start-here.html",
      "linkLabel": "See the starting guide"
    },
    "during": {
      "label": "During",
      "title": "Build the character in Character Designer",
      "text": "Use the body, eyes and colour controls to turn your sketch into a sprite.",
      "href": "/tools/character-designer.html",
      "linkLabel": "Open Character Designer"
    },
    "after": {
      "label": "After",
      "title": "Give the character a walk cycle",
      "text": "Open the Sprite Animator and make two frames. Small changes are enough to make the character feel alive.",
      "href": "/tools/sprite-animator.html",
      "linkLabel": "Open the Sprite Animator"
    },
    "next": {
      "label": "Next",
      "title": "Put the character in a game",
      "text": "Use the sprite in Cozy Creatures, or start a new game and add your character as the player.",
      "href": "/games/cozy_creatures.html",
      "linkLabel": "Play Cozy Creatures"
    }
  }
}
```

## Reference page

`workshops/my-first-browser-game.html` is the first consumer. It renders the
block at 390px and 1440px. The existing `.next-route` at the bottom of the page
is unchanged and still provides the end-of-page next step.
