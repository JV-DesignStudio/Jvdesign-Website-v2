# JVDesignStudio Design System

Components extracted from the home hero and creative-journey sections (A1639).
All classes use `--jv-*` tokens from `assets/css/tokens.css`.
Loaded automatically on every page that includes `style-shared.css`.

---

## Quick start

`assets/css/components.css` is imported by `style-shared.css`. Any page that loads
`style-shared.css` gets all components below. Pages that do not load `style-shared.css`
can `<link rel="stylesheet" href="/assets/css/components.css">` directly (tokens.css must
be loaded first).

---

## Section header

```html
<div class="section-header">
  <span class="section-eyebrow">Four ways in</span>
  <h2 class="section-title">Explore the Studio</h2>
  <p class="section-sub">Everything is free, needs no account and works on school computers.</p>
</div>
```

| Class | Purpose |
|---|---|
| `.section-eyebrow` | Pill-shaped label above the heading. Tints automatically with `data-character`. |
| `.section-title` | Display-font heading. Add `.section-title--on-dark` when the background is dark. |
| `.section-sub` | Muted paragraph below the heading. |
| `.section-header` | Centres the three above, limits width to 760 px. |

---

## Hero

```html
<section>
  <span class="hero-eyebrow">Welcome, creator</span>
  <h1 class="hero-title">Make <span class="accent">games</span></h1>
  <p class="hero-sub">A safe, free studio where young creators can learn and make.</p>
  <div class="hero-buttons">
    <a href="/tools/pixel-studio.html" class="btn-primary">Start making →</a>
    <a href="/workshops/" class="btn-outline">Browse workshops</a>
  </div>
</section>
```

| Class | Purpose |
|---|---|
| `.hero-eyebrow` | Outlined pill label above the h1. |
| `.hero-title` | Large display heading (clamp 2 rem to 3.6 rem). |
| `.hero-sub` | Introductory paragraph below the heading. |
| `.hero-buttons` | Flex row wrapper for CTA buttons. |

---

## CTA buttons

```html
<a href="…" class="btn-primary">Make your first character →</a>
<a href="…" class="btn-outline">Browse workshops</a>
```

| Modifier | Use |
|---|---|
| `.btn-primary` | Filled rose button, 4 px drop shadow. Main call to action. |
| `.btn-outline` | Bordered teal button. Secondary action. |
| `.btn-primary--raised` | Stronger shadow variant for use on dark hero sections. |

---

## Content card

```html
<a class="jv-card" href="/workshops/my-first-scratch-game.html">
  <div class="jv-card-cover">
    <!-- Cover image (optional) -->
    <img src="cover.webp" alt="Scratch catch game screenshot" loading="lazy">
    <!-- Icon shown when no image loads or as placeholder -->
    <span class="jv-card-cover-icon" aria-hidden="true">🎮</span>
  </div>
  <span class="jv-card-eyebrow">Beginner · Scratch</span>
  <h3 class="jv-card-title">Build a Catch Game</h3>
  <p class="jv-card-body">Learn Scratch by building a falling-object catch game. No downloads needed.</p>
  <em class="jv-card-cta">Start workshop →</em>
</a>
```

Place `data-character="lumo"` on a parent element to tint the top stripe with Lumo's colour.
Add `.jv-card--raised` for a heavier shadow on light backgrounds.

| Class | Purpose |
|---|---|
| `.jv-card` | The card shell: flex column, bordered, accent top stripe, hover lift. |
| `.jv-card-cover` | 16:9 cover area at the top. Shows `<img>` if present, otherwise shows icon. |
| `.jv-card-cover-icon` | Emoji or icon shown as placeholder when no `<img>` is inside the cover. |
| `.jv-card-eyebrow` | Small uppercase label below the cover. |
| `.jv-card-title` | Card heading. |
| `.jv-card-body` | Body copy. Grows to fill available space. |
| `.jv-card-cta` | Call-to-action text pinned to the card bottom. |

---

## Badge

```html
<span class="jv-badge jv-badge--lumo">Workshop</span>
<span class="jv-badge jv-badge--ember">Tool</span>
<span class="jv-badge jv-badge--stardust">Story</span>
```

Modifiers: `--stardust`, `--lumo`, `--ember`, `--pip`, `--echo`.
Without a modifier the badge uses `--jv-char-*` tokens, so it inherits the nearest
`data-character` ancestor automatically.

---

## Breadcrumb

```html
<nav aria-label="Breadcrumb" class="jv-breadcrumb">
  <ol>
    <li><a href="/">Home</a></li>
    <li><a href="/workshops/">Workshops</a></li>
    <li><span aria-current="page">Scratch Catch Game</span></li>
  </ol>
</nav>
```

The `aria-current="page"` item is styled as plain (non-linked) text.
Separators are CSS-generated `/` marks so they are hidden from screen readers.

---

## Token reference

Key tokens used by these components. Full list in `assets/css/tokens.css`.

| Token | Value (light) | Purpose |
|---|---|---|
| `--jv-accent` | `#BC4749` | Primary CTA fill |
| `--jv-accent-ink` | `#9B3A3C` | CTA shadow |
| `--jv-teal-dk` | `#4E7D80` | Outline button |
| `--jv-char` | inherits character | Card top stripe |
| `--jv-surface` | `#FFFFFF` | Card background |
| `--jv-line` | `rgba(64,59,51,0.12)` | Card border |
| `--jv-shadow-1` | `0 4px 20px …` | Card shadow |
| `--jv-shadow-2` | `0 14px 36px …` | Card hover shadow |
