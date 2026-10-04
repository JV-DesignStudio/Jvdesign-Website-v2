# First-creation funnel

The one number the studio tracks: the share of sessions where a learner makes
something and saves, exports or shares it.

Events (GA4, consent-gated by `analytics-loader.js`):

- `first_create_start` - the learner started using the surface
- `first_create_complete` - a creation was exported or saved
- `first_create_share` - a creation was shared

Every event carries: `section`, `page_path`, `page_id`, `surface`, `trigger`.
Each event fires at most once per session per surface (sessionStorage guard).

## How it is wired

`jvds-funnel.js` is included on `tools/` and `workshops/` pages and listens for:

- `start` - the first pointer, key or touch on the page
- `complete` - a click on any `a[download]`, or a `jvds:created` event
- `share` - a call to `navigator.share`, or a `jvds:shared` event

Central emitters also forward into it:

- `player-profile.js` on `workshop-completed` (surface `workshop`)
- `game-system.js` on `game_end` and `share_create` (surface `game`)

## The headline number

Count sessions with `first_create_complete` where `surface` is `tools` or
`workshops`. Divide by sessions with a page view on `tools/` or `workshops/`.
Game and workshop sessions are tagged with their own surface, so they can be
read separately and never inflate the creation number.

## Adding a surface

If a tool saves without a download, call it directly:

```js
window.JVDSFunnel.complete({ surface: 'tool' });
window.JVDSFunnel.share({ surface: 'tool' });
```

Or dispatch `jvds:created` / `jvds:shared` on `window`.
