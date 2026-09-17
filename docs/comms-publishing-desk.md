# Comms Publishing Desk

The private board at `http://localhost:8787/` has a **Publishing Calendar** and **Comms Publishing Desk** near the top.

Use it for Dev Log, newsletter and social copy approval. The active queue should stay small: if an item has no board task or no next action, archive it.

## States

- `pending`: ready for Josh to review.
- `declined`: needs edits before publishing/posting.
- `approved`: copy has been approved and is ready to publish, post or send.
- `posted`: social or newsletter has been marked posted/sent.

## Folders

- `social-posts/queue/`: active review work only. Every draft here should have a linked board task and a next action.
- `social-posts/ready/`: approved copy that is waiting to be posted or sent.
- `social-posts/posted/`: copy that has already been posted or sent, with evidence recorded on the board.
- `social-posts/archive/`: old, declined, duplicate, replaced or unlinked drafts.
- `social-posts/archive/unlinked/`: drafts generated from dev log entries that do not currently have a linked board task.

## Actions

- **Open**: read the full card details.
- **Copy Preview**: copy a parent/learner-friendly summary.
- **Copy Newsletter**: copy newsletter text.
- **Copy Social**: copy Instagram/Facebook/X text.
- **Copy Image**: copy the generated image path.
- **Approve + publish**: Dev Log drafts only; publishes into `devlog-data.js`.
- **Approve copy**: social/newsletter drafts; approves for manual posting.
- **Decline**: keeps the draft visible with an edit note.
- **Preview**: opens the branded `preview.html` posting sheet with image preview, copy boxes, platform chips and quality checklist.
- **Ready pack**: opens the local pack folder with captions, link, image and platform checklist.
- **Instagram / Facebook / X / Threads / YouTube / Newsletter**: opens the manual posting destination in a new tab.
- **Mark social posted** / **Mark newsletter sent**: records where/when it was posted.

## Commands

- `npm run comms:queue`: refresh draft files, image cards, board cards, publish packs and index.
- `npm run comms:organize`: keep `queue/` clean by archiving drafts with no linked board task.
- `npm run comms:ready-packs`: build copy/paste packs in `social-posts/ready/` for approved comms, including Reels/Shorts script prompts.\n- `npm run newsletter:friday`: build `social-posts/ready/FRIDAY_NEWSLETTER.md` from approved comms.\n- `npm run comms:audit-ready`: score ready packs for missing copy, technical wording, broken links and missing visuals; writes `social-posts/ready/QUALITY_REPORT.md`.
- `npm run board:publishing-calendar`: add the weekly Publishing Calendar and scheduling reminders to the private board.\n- `npm run board:comms-buttons`: add platform buttons to the private Comms cards.
- `npm run comms:refresh`: refresh comms, organize the queue, build ready packs, validate health and reapply Today's Tasks plus platform buttons.
- `npm run comms:packs`: refresh publish-pack data only.
- `npm run comms:health`: validate the publishing desk data.

## Image rule

Social/newsletter packs should have a 1080x1080 PNG beside their draft while active. If an approved ready pack has no image, `npm run comms:ready-packs` creates a branded JVDesignStudio fallback card so the post still has a usable visual. Dev Log drafts can still get custom social images after they are approved/published into `devlog-data.js`.

## Today dashboard rule

The private board Today view is capped at three items per lane:

- Must Do Today
- Ready To Approve
- Comms To Post
- App Audit Next

Every Today card should answer two questions: **Next** (the action to take) and **Why today** (why it deserves attention now). If an item has no clear next action, archive it, rewrite it, or leave it in the wider board instead of putting it in Today.

## Ready-to-post packs

Approved comms generate a local folder in `social-posts/ready/` with:

- `caption-instagram-facebook.txt`
- `caption-x-threads.txt`
- `newsletter-blurb.txt`
- `link.txt`
- `platforms.txt`
- `README.md`
- copied image file when one exists, or a generated `jvds-social-card.png` fallback

Use the board's platform buttons to open the destination, then copy from the ready pack. After posting, record the URL or note with **Mark social posted** or **Mark newsletter sent**.

## Character visual mapping

Ready-pack previews and private board comms cards use the JVDS loop as subtle visual identity:

- Stardust: Imagine, ideas and announcements
- Lumo: Learn, workshops and education
- Ember: Create, tools and maker posts
- Pip: Play, games and arcade posts
- Echo: Improve, fixes, audits and dev log updates

This is visual guidance only. The post still needs a human read before publishing.


## Publishing Calendar

The Publishing Calendar turns approved comms into upload reminders:

- **Dev Logs**: approved or pending Dev Log items that need review or publishing.
- **Friday Newsletter**: approved items ready to prepare for the Friday send.
- **Social Schedule**: approved social posts waiting to schedule or post.
- **Reels / Video**: video-friendly candidates for future Reels, YouTube Shorts or workshop clips. Ready packs include `reels-script.txt`.

Use **Schedule** to set a date and simple slot such as `morning`, `lunch`, `evening` or `19:00`. After the post is scheduled or live, use the existing posted/sent buttons on the card.

## Next Publishing Additions

- Scheduled today and missed upload counts sit at the top of the Publishing Calendar.
- Missed Uploads shows anything scheduled before today that has not been marked posted/sent.
- Schedule presets are available for Mon/Wed/Fri social, Friday newsletter and Weekend Reel slots.
- The Friday newsletter builder creates a weekly draft from approved comms.

