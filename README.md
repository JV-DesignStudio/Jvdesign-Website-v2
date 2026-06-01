# Jvdesign Website v2

---

# ⚔️ QuestLog — RPG Task Tracker

> Turn your projects, tasks, and daily habits into quests. Earn XP, level up, defeat boss quests.

**[▶ Open QuestLog](https://yourquestlog.netlify.app/)** &nbsp;·&nbsp; **[Landing Page](https://yourquestlog.netlify.app/quest-board-page.html)** &nbsp;·&nbsp; **[Privacy Policy](https://yourquestlog.netlify.app/privacy-policy.html)** &nbsp;·&nbsp; **[GitHub](https://github.com/JV-DesignStudio/yourquestlog)**

---

## What is it?

QuestLog is a free, browser-based RPG productivity app. Works on any device, no account needed, stores everything locally. Installs as a PWA on Android and iOS.

## Features

| Category | Features |
|---|---|
| **Quests** | Kanban board, boss quests with HP bars, smart keyword routing, recurring quests |
| **RPG System** | XP & levelling, streak multipliers, combos, loot drops, 20 achievements, class evolution |
| **Dashboard** | Today/Week view, daily bounties, Top 3, Rival system, weekly boss events |
| **Focus Mode** | Full-screen Pomodoro (25/5), interactive checklists, swipe-to-complete |
| **Notes** | Searchable notes linked to quests, Markdown rendering |
| **Calendar** | Monthly view, .ics import (Google Calendar, Apple, Outlook) |
| **Daily Life** | Self-care tracking, medicine reminders, morning check-in with XP buffs |
| **Market** | Consumables, mystery crates, permanent upgrades, 3 unlockable themes |
| **Sync** | GitHub Gist cloud backup, JSON export/import |
| **PWA** | Installs as native app, works fully offline |

## Key Files

```
quest-board.html         Public app (setup wizard, clean cards)
quest-board-page.html    Landing page
privacy-policy.html      Privacy policy
manifest.json            PWA manifest
sw.js                    Service worker
make-public.js           Generates public version from private tracker
make-app-bundle.js       Builds deploy bundle for Netlify / Play Store
icons/                   App icons (192px + 512px PNG)
quest-board-deploy/      Ready-to-deploy bundle
```

## Development

No build step, no dependencies. Edit `quest-board.html`, then:

```bash
node make-app-bundle.js   # rebuild deploy bundle
```

Push to GitHub → Netlify auto-deploys.

## Deployment

Hosted on **Netlify**: [yourquestlog.netlify.app](https://yourquestlog.netlify.app/)  
Google Play: submit via [PWABuilder](https://pwabuilder.com) using the Netlify URL.

## Privacy

No personal data collected. All data in browser `localStorage`. See [Privacy Policy](https://yourquestlog.netlify.app/privacy-policy.html).

## Credits

Built by [JVDesignStudio](https://jvdesignstudio.com) · [Buy Me a Coffee](https://buymeacoffee.com/jv_designstudio)

*Free forever. No account. Your data stays on your device.*

