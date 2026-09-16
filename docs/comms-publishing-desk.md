# Comms Publishing Desk

The private board at `http://localhost:8787/` has a **Comms Publishing Desk** near the top.

Use it for Dev Log, newsletter and social copy approval.

## States

- `pending`: ready for Josh to review.
- `declined`: needs edits before publishing/posting.
- `approved`: copy has been approved.
- `posted`: social or newsletter has been marked posted/sent.

## Actions

- **Open**: read the full card details.
- **Copy Preview**: copy a parent/learner-friendly summary.
- **Copy Newsletter**: copy newsletter text.
- **Copy Social**: copy Instagram/Facebook/X text.
- **Copy Image**: copy the generated image path.
- **Approve + publish**: Dev Log drafts only; publishes into `devlog-data.js`.
- **Approve copy**: social/newsletter drafts; approves for manual posting.
- **Decline**: keeps the draft visible with an edit note.
- **Mark social posted** / **Mark newsletter sent**: records where/when it was posted.

## Commands

- `npm run comms:queue`: refresh draft files, image cards, board cards, publish packs and index.
- `npm run comms:packs`: refresh publish-pack data only.
- `npm run comms:health`: validate the publishing desk data.

## Image rule

Social/newsletter packs should have a 1080x1080 PNG in `social-posts/queue/`. Dev Log drafts get social images after they are approved/published into `devlog-data.js`.
