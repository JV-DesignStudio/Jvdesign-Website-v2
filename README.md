# JVDesignStudio Website v2

The source for [jvdesignstudio.co.uk](https://jvdesignstudio.co.uk/) — children's picture books, browser games, tabletop games and free creative downloads, plus a handful of dev tools and workshop pages.

Static HTML/CSS/JS, no framework, no build step required to view pages directly in a browser.

## Structure

```
index.html, books.html, games.html, ...   Site pages (124 top-level .html files)
partials/                                  Shared nav/footer fragments
build.js                                   Syncs partials into every page
manifest.json                              PWA manifest for the main site
sitemap.xml / sitemap.html                 Sitemap (keep in sync when adding pages)
search.html                                Site-wide search (entries defined inline)
```

Image assets live at the project root alongside the pages that use them.

## Build

The nav and footer are defined once in `partials/` and synced into every page via marker comments (`<!-- BUILD:name --> ... <!-- /BUILD:name -->`):

```bash
node build.js
```

Run this after editing any file in `partials/`.

## Adding a new page

When adding a new page, remember to:
1. Add the nav/footer build markers (copy from an existing page).
2. Add an entry to `sitemap.xml` and `sitemap.html`.
3. Add an entry to the search database in `search.html` if it should be discoverable via site search.
4. Link it from the relevant hub page (`games.html`, `freebies.html`, `learn.html`, etc).

---

## Sub-project: QuestLog — RPG Task Tracker

This repo also bundles the source for **QuestLog**, a separate free RPG-style task tracker app, deployed independently to Netlify.

> Turn your projects, tasks, and daily habits into quests. Earn XP, level up, defeat boss quests.

**[▶ Open QuestLog](https://yourquestlog.netlify.app/)** &nbsp;·&nbsp; **[Landing Page](https://yourquestlog.netlify.app/quest-board-page.html)** &nbsp;·&nbsp; **[Privacy Policy](https://yourquestlog.netlify.app/privacy-policy.html)** &nbsp;·&nbsp; **[GitHub](https://github.com/JV-DesignStudio/yourquestlog)**

### Key Files

```
quest-board.html         Public app (setup wizard, clean cards)
quest-board-page.html    Landing page
privacy-policy.html      Privacy policy
manifest.json            PWA manifest
sw.js                     Service worker
make-public.js           Generates public version from private tracker
make-app-bundle.js       Builds deploy bundle for Netlify / Play Store
icons/                   App icons (192px + 512px PNG)
quest-board-deploy/      Ready-to-deploy bundle
```

### Development

No build step, no dependencies. Edit `quest-board.html`, then:

```bash
node make-app-bundle.js   # rebuild deploy bundle
```

Push to GitHub → Netlify auto-deploys.

### Privacy

No personal data collected. All data in browser `localStorage`. See [Privacy Policy](https://yourquestlog.netlify.app/privacy-policy.html).
