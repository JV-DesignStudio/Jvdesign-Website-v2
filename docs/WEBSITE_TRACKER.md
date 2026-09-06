# Website Tracker

Current working tracker for public website changes that need a durable handoff.

## 2026-09-06 Workshop UX Pass

Status: in progress, broad shared uplift complete with focused Unreal Blueprint polish added.

Scope covered:
- Workshop overview page now has a clear "choose your path" section before the full library.
- Workshop overview filters now announce what they are showing.
- Shared workshop pages now get an automatic learning map: Build, Check, Unlock.
- Standard step-card workshops have clearer active, completed and locked visual states.
- Quiz, code challenge and true/false controls have stronger spacing and mobile touch targets.
- Builder-style workshops, including Unreal Blueprint pages, now get safer responsive layout treatment, sticky step tabs, clearer completed tab dots and mobile canvas constraints.
- Unreal Blueprint workshops now get an automatic "Blueprint build loop" coach panel: read pins, type values and test the preview.
- Both Unreal layout families are detected by the shared workshop script, so newer Blueprint pages and older `.steps-col` pages receive the same learning-map support.
- Blueprint task lists, node canvases, tab buttons and value inputs now have clearer focus, touch and mobile behavior.
- Racing Blueprint duplicate fullscreen joystick handler was removed.
- Racing Blueprint duplicate structured-data object was removed so its bottom JSON-LD block is valid again.
- Shared workshop feedback badges now mask broken legacy icon glyphs with clean OK/! states.

Files changed:
- `pages/workshop.html`
- `style-workshop.css`
- `workshop-enhancements.js`
- `workshops/racing-blueprint.html`

Validation:
- `node validate-workshops.js` passed: 39/39 standard workshops and 22/22 builder-style workshops valid.
- `node validate-links.js` passed: 5228 internal references checked, 0 broken.
- `node validate-css.js` could not run because the local Puppeteer Chrome binary is missing.
- `node validate-js.js` could not run for the same missing Puppeteer Chrome binary.

Remaining follow-up:
- Run browser-based CSS and JS validation after installing or restoring Puppeteer Chrome.
- Do a manual browser visual pass on the Unreal Blueprint pages after local preview tooling is available.
- Review individual workshop copy for any step that is technically passable but not clear enough for a beginner.
- Consider moving the overview inline styles into a dedicated stylesheet when there is room for a cleanup pass.
- Continue replacing legacy encoding artifacts in page-specific prose. Many `??` strings are intentional coding blanks, so this should be handled page-by-page rather than with a global replace.
