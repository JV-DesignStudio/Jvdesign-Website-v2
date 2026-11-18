# Growth & Flow Prompt Pack

Written 17 Nov 2026 against the live repo. Every number below was measured from the
files in `Jvdesign-Website-v2/`, not estimated. Each prompt is written to be pasted
straight into an agent (or turned into a board card: the **Done** line is the `done`
field). They follow the house rules: claim before you code, rebuild partials +
`node scripts/csp-hashes.js --apply`, `npm run validate:links`, bot gate, human review.

---

## Part 1 — Where the gaps actually are

The site is not thin. It is 568 content pages, 933 tests, GA4 with Consent Mode v2,
JSON-LD on 381 pages, canonicals on 571. The gaps are not hygiene gaps. They are
**four structural ones**.

### Gap 1 — A third of the site is invisible to search

| Section | Pages | `noindex` | In sitemap |
|---|---|---|---|
| workshops | 382 | 110 | 277 |
| games | 61 | 46 | 15 |
| tools | 74 | 42 | 39 |
| pages | 51 | 17 | — |

`sitemap.xml` has 393 URLs for 568+ content pages. 46 of 61 playable games are
`noindex, follow` — including real destination pages like `games/backpack-quest.html`
and `games/candy_kingdom.html`. Playable browser games are the single most
link-worthy, most shareable asset the studio owns, and most of them cannot be found.
Some of those `noindex` tags are certainly deliberate (embed shells, landing variants,
canvas hosts). Nobody has separated the deliberate ones from the inherited ones.

### Gap 2 — The measurement is half-wired, so the funnel can't be trusted

`pages/funnel-weekly-report.html` defines the right six events (`arrival_hub`,
`play_start`, `first_create_start`, `first_create_complete`, `first_create_share`,
`return_visit`) and the right target (start→complete above 30%). But:

- `analytics-loader.js` is included on 462 pages, not all of them. Coverage by section:
  games **29/61**, workshops **299/382**, tools 64/74, pages 37/51.
- `play_start` is supposed to fire on `/games/` — on pages where half the games have no
  loader at all.
- GA4 only loads **after an explicit cookie accept** (correct for a children's site, but
  it means the funnel sees a minority of real sessions).

So the one number the studio has chosen to steer by is computed from a sample with a
known hole in it, and the hole is biggest exactly where play lives.

### Gap 3 — The growth loop has a manual step in the middle

The loop that should compound is: a learner makes a game → shares a link → their friend
plays it in the browser → their friend opens the maker. Today, `pages/publish.html` asks
the learner to **export two files, fill in a form, attach both, and wait for a human**,
with "ask a grown-up to help with the email". Moderation is right and should stay. The
friction is the attachment-and-email part — the studio already runs `share-worker`
(Cloudflare) for the Game Maker app, so the plumbing for a one-tap shareable link
exists and is not wired into the website gallery.

Supporting symptom: 103 content pages have no `og:image` (81 of them workshops, 9 games).
A shared link with no card is a shared link nobody clicks.

### Gap 4 — No named audience channel

There is excellent *material* for parents and teachers (`teachers.html`, `class.html`,
`parent-guide.html`, `parents.html`, `trust.html`, `child-safety.html`, `press.html`)
and a weekly newsletter promise on every footer. What is missing is a channel: nothing
in the repo decides **who finds JVDS first and from where**. The backlog agrees — A1781
(benchmark eight competitors), A1782 (six-month roadmap), A1784 (content cadence),
A1777 (learner loops), A1778 (safe showcase) are all still in `backlog`. Those five
cards *are* the growth strategy and they have been sitting unclaimed.

**One-line summary:** the studio has built the product and the measurement vocabulary,
but the site cannot be found (Gap 1), cannot be measured honestly (Gap 2), cannot spread
by itself (Gap 3), and has no front door chosen (Gap 4).

---

## Part 2 — The prompts

### A. Make it measurable first (do these before anything else)

Nothing else can be judged until these land.

**A1 — Close the analytics coverage hole**
```text
analytics-loader.js is included on 462 of the ~600 content pages. Coverage by section:
games 29/61, workshops 299/382, tools 64/74, pages 37/51. The funnel in
pages/funnel-weekly-report.html depends on play_start firing on /games/ pages, so the
play step of the funnel is measured on less than half of the games.

Find every page under games/, workshops/, tools/ and pages/ that does not include
analytics-loader.js, add it the same way the existing pages do (same position in head,
same CSP expectations), then rebuild and refresh CSP hashes. Do not add a second inline
gtag snippet anywhere: there are already three pages with their own gtag( call
(games/call-of-the-cards-playtest.html, games/sky_high_with_friends.html,
tools/arcade-game-maker.html) - fold those into the loader instead of leaving two
bootstraps on one page.

Done: every html page under games/, workshops/, tools/, pages/ includes
analytics-loader.js exactly once and no page has a second gtag bootstrap; npm run build
and node scripts/csp-hashes.js --apply run clean; npm run validate:links PASS;
tests/analytics-consent-network.js PASS. Evidence names the before/after counts per
section.
```

**A2 — Write a cookieless baseline so consent-denied sessions are still counted**
```text
GA4 is gated behind explicit cookie accept (correct, keep it). The consequence is that
the visitor-to-maker funnel is computed from accepted sessions only, with no way to know
how large that minority is or whether it behaves like everyone else.

Add one cookieless, no-personal-data pageview beacon that runs regardless of consent
(no cookies, no localStorage ID, no fingerprinting - a single POST of path + referrer
host + viewport bucket to a Cloudflare Worker, modelled on share-worker/). Then report
one number weekly: accepted sessions / all sessions, per section. Document it in
pages/privacy-policy.html and pages/trust.html in the same plain language used for the
rest of the page, and in pages/funnel-weekly-report.html explain that funnel percentages
are of consented sessions and give the coverage ratio next to them.

Done: beacon ships with no cookie and no identifier (prove it with a network test like
tests/analytics-consent-network.js), privacy policy and trust page updated, weekly report
page states the consent coverage ratio; npm run validate:links PASS.
```

**A3 — Turn the weekly report into something generated, not read off GA4 by hand**
```text
pages/funnel-weekly-report.html currently tells a human which GA4 screens to visit each
Monday. That is a chore that will be skipped. Produce the same six numbers as a committed
JSON snapshot plus a rendered page, the way board-data.json and generate-board-data.js
already work: a script that takes the week's figures (pasted or pulled), writes
data/funnel-weekly.json, and renders the trend of the last 12 weeks into the page.

Done: data/funnel-weekly.json exists with at least one real week, the page renders the
trend from it rather than from hard-coded text, running the script twice is idempotent,
node scripts/check-generated-drift.js --quick PASS, npm run validate:links PASS.
```

### B. Make the site findable (Gap 1)

**B1 — Audit every noindex and decide it on purpose**
```text
215 pages carry a noindex: 110 workshops, 46 of 61 games, 42 of 74 tools, 17 pages.
Nobody can currently say which of those are deliberate. Produce an audit table (one row
per noindexed page: path, title, what it is, why it is noindexed, and one of KEEP
NOINDEX / INDEX / REDIRECT / DELETE) and write it to SEO_INDEX_AUDIT.md.

Rules for deciding: a page a learner could legitimately arrive on from a search and
immediately use gets INDEX. An embed shell, a canvas host, a duplicate landing variant
or a tool pane that only makes sense inside another page gets KEEP NOINDEX with the
reason named. A page that duplicates a better page gets REDIRECT to it.

Do not change any page in this card. The audit is the deliverable, so one person can
approve the list before 200 pages change behaviour.

Done: SEO_INDEX_AUDIT.md lists all 215 pages with a disposition and a one-line reason,
counts per disposition are stated, and the games section is fully covered.
```

**B2 — Apply the audit: index the real destination pages and regenerate the sitemap**
```text
Depends on B1 being approved. Apply the INDEX / REDIRECT / DELETE dispositions from
SEO_INDEX_AUDIT.md. For every page that becomes indexable, make sure it is actually
worth landing on first: unique title, meta description, canonical, og:image, a visible
H1, and one obvious next step (play it / open the tool / start the workshop). Then
regenerate the sitemap and the board data.

Done: npm run build:sitemap produces a sitemap whose URL count matches the indexable
page count (state both numbers); every newly indexed page has title + description +
canonical + og:image; node scripts/generate-redirect-stubs.js clean for the REDIRECT
rows; npm run validate:links PASS; node scripts/check-generated-drift.js --quick PASS.
```

**B3 — Fill the 77 missing workshop descriptions with real ones**
```text
305 of 382 workshops have a meta description; 77 do not. Write them - do not generate
them from the title with a template. Each description should say what the learner will
have made by the end, the engine, and the rough age or stage, in the studio's voice,
under 155 characters. Work through them in the order the sitemap lists them so the
highest-value ones land first.

Done: all 382 workshops have a unique meta description under 155 characters; no two
descriptions are identical; node validate-workshops.js PASS; npm run validate:links PASS.
```

**B4 — Give every shareable page a card image**
```text
103 content pages have no og:image (81 workshops, 9 games, 4 tools, 9 pages). A shared
link with no preview card gets no clicks, so this is a growth bug, not a polish one.

There is no og image generator in scripts/. Write one: render a card per page from the
page's own title, section and character (the existing capture tooling in
scripts/capture-devlog-images.cjs and scripts/capture-arcade-previews.js is the model),
output to og/, and add the og:image + twitter:image tags. Use the real design tokens
from DESIGN_SYSTEM.md so the cards look like the studio and not like a generator.

Done: every indexable page under workshops/, games/, tools/, pages/ has og:image and
twitter:image pointing at a file that exists; the generator is idempotent and documented
in README.md; total added weight stated; npm run validate:links PASS;
node scripts/check-performance.js within budget.
```

**B5 — Build the hub pages search actually wants**
```text
pages/how-to-make-a-game.html, pages/game-design-for-kids.html and
pages/free-game-making-tools.html already prove this pattern works. The studio owns 382
workshops across Scratch, Godot, Unity, Unreal, Roblox, Minecraft, Defold and C++ - that
is enough to own a dozen real queries, each needing an entry page that links 10-30
existing workshops in a sensible order.

Pick the eight highest-intent topics the existing workshops already cover end to end
(one per engine or per outcome, your call, but justify each in a line). For each, build
one hub page: what you will be able to make, who it is for, the ordered list of existing
workshops, the tool that goes with it, and one next step. Link nothing that does not
exist. Add them to the nav where they belong, not as orphans.

Done: eight hub pages exist, each linking only to existing workshops, each with title +
description + canonical + og:image + JSON-LD ItemList; each is reachable from the nav or
a hub in at most two clicks; npm run build:sitemap includes them; npm run validate:links
PASS; tests/nav-routes.js PASS.
```

### C. Make the loop spread by itself (Gap 3)

This is the one with the most upside. A kid-made game that a friend can open in one tap
is the only marketing channel that compounds.

**C1 — One-tap publish to the gallery, still fully moderated**
```text
pages/publish.html currently asks a child to export two files, fill a form, attach both
and ask a grown-up to help with the email. Moderation must stay exactly as strict - what
has to go is the attachment-and-email step.

share-worker/ (Cloudflare Worker) already does game sharing for the Game Maker app. Wire
the website gallery to it: Publish in tools/arcade-game-maker.html uploads the game file
and cover to the worker and returns a short link; the submission lands in a moderation
queue that only a human can release; nothing appears in pages/gallery.html until it is
approved. Keep an offline and consent-denied path: if the worker is unreachable, fall
back to today's file export so a school device never dead-ends.

Done: publishing from the maker produces a shareable link without the learner touching
email or file attachments; nothing reaches pages/gallery.html without a human release
step (prove it with a test); the offline fallback still exports files;
tests/publish-http.js and tests/gallery-http.js PASS; child safety and privacy pages
updated to describe the new path in the same plain language.
```

**C2 — Make a shared game link sell the next game**
```text
When a friend opens a shared game link today, they play and leave. Make that the top of
the funnel instead: the play page for a shared creation should show who made it (first
name only, as the gallery already does), a one-tap "make your own version" that opens the
maker with that genre preloaded, and nothing else competing for the tap. Fire
first_create_start when they take it.

Done: a shared link's play page has exactly one primary action and it opens the maker
with the right genre; the remix path is covered by a test; first_create_start fires on
the remix tap; no personal data beyond a first name is rendered;
tests/arcade-game-maker-deeplink.js PASS.
```

**C3 — Decide the safe showcase shape once (unblocks A1778)**
```text
Board card A1778 - "define a safe community showcase before adding profiles" - is the
gate in front of every community growth idea and it is unclaimed. Decide it: write
COMMUNITY_SHOWCASE.md covering what is shown (first name only? no name?), what is never
shown, how a creation is reported and removed, how fast removal happens, who moderates,
what happens to a creation when a parent asks for it to be deleted, and what the studio
will not build (no accounts, no DMs, no comments, no follower counts - say so explicitly
and say why).

Write it for a cautious parent and a school IT lead to read, not for an engineer. Then
state the three things this unlocks and the three it rules out.

Done: COMMUNITY_SHOWCASE.md exists and is linked from pages/child-safety.html and
pages/trust.html; it names the moderation owner and the removal SLA; it explicitly lists
what will never be built; A1778 can be closed against it.
```

### D. Make the flow obvious (first 15 minutes)

**D1 — Walk the first fifteen minutes as a real learner and write what breaks**
```text
The North Star is a learner arriving and making something they are proud of within 15
minutes on a locked-down school computer. Test it honestly rather than assuming it.

Run the journey three times, from a cold profile each time, at 390px and at 1440px, with
no account and cookies refused: (1) from the home page, (2) from a Google-style landing
on a deep workshop page, (3) from a shared gallery game link. Record every step with a
timestamp, every dead end, every moment where the next action was not obvious within
three seconds, and where the 15 minutes actually went. Write FIRST_FIFTEEN_AUDIT.md with
the three timelines and a ranked list of what to fix, worst first.

Do not fix anything in this card. The audit is the deliverable.

Done: FIRST_FIFTEEN_AUDIT.md has three timestamped timelines, states whether 15 minutes
was met in each, and ranks the blockers with the file that owns each one.
```

**D2 — One entry decision on the home page, not five**
```text
index.html currently offers "Find your first step", "Open Pixel Studio", "Find my first
step", "Search and browse", "Continue my course", "See no-install tools", plus four hub
CTAs. That is eleven calls to action above and around the fold, and two of them are the
same sentence twice.

Reduce the home page to one primary action for a first-time visitor and one for a
returning one (the returning path should only appear if there is local evidence of a
return - the my-studio state is already there). Everything else moves below the fold or
into the hubs. Keep arrival_hub firing. Do not redesign the page; cut it.

Done: at most two actions above the fold, no duplicated CTA text anywhere on the page,
returning CTA only renders when local state exists, tests/home-voice-footer.js and
tests/nav-gallery.js PASS, Core Web Vitals in node scripts/check-performance.js no worse
than before (state both).
```

**D3 — Every workshop ends with the next thing**
```text
199 of 382 workshops link to a tool; none has a consistent closing block (grep for a path
block or next-step pattern returns zero). A learner who finishes a workshop currently
falls off the end of the page, which is exactly where the loop should restart
(Improve -> Imagine again).

Define one closing block in WORKSHOP-PATH-BLOCK.md terms - what you just made, the one
tool to take it further, the one workshop that comes next, and the save/export reminder -
and apply it to every workshop. It must be generated from the workshop's own metadata, not
hand-pasted 382 times, and it must degrade gracefully where there is no obvious next
workshop.

Done: all 382 workshops end with the block; the block is generated and regenerating is
idempotent; every link in it resolves (npm run validate:links PASS);
node validate-workshops.js PASS; tests/a11y-learner-journey.js PASS;
first_create_complete still fires where it did before.
```

**D4 — Say what saving means on a school computer**
```text
Board card A1999 is still in backlog and it matters more than it looks: a learner on a
shared school machine does not know whether their work survives. The whole promise of the
first successful creation depends on it.

On every tool and workshop page, state in one plain sentence where the work is kept
(this browser on this computer), what loses it (a different computer, a wiped profile,
private browsing), and the one action that makes it permanent (export/download). Use the
existing storage and backup tooling (tools/backup-restore.html, my-studio-keep.js) rather
than new machinery, and make the export action reachable without hunting.

Done: every tool and workshop page states the storage reality in one sentence and offers
the export action; wording is identical across pages (one partial, not 456 copies);
tests/storage-quota-guard.js PASS; npm run validate:links PASS.
```

### E. Choose a front door (Gap 4)

**E1 — Pick the one audience to win first, with evidence**
```text
The site serves learners, parents, teachers, and the press, and therefore leads with none
of them. Pick one to win first and write the case in AUDIENCE_FOCUS.md.

Use what the repo can actually tell you: which sections exist and are strongest, what the
funnel page says it measures, what the workshops cover, and what the school-computer rule
implies about where JVDS is uniquely better than Scratch's own site, Code.org, Tynker,
CS First and Hour of Code (that is card A1781 - do the benchmark here, eight competitors,
one line each on what they do better and what they cannot do). Recommend one primary
audience and one secondary, name the three pages that must be excellent for them, and
name what the studio stops optimising as a result.

Done: AUDIENCE_FOCUS.md names one primary audience with reasoning tied to evidence in the
repo, benchmarks eight named competitors, lists the three pages to make excellent, and
states explicitly what is deprioritised. A1781 can be closed against it.
```

**E2 — Make the teacher pack a thing a teacher can use on Monday**
```text
Schools are the only channel where one adult brings thirty learners, and the
school-computer rule is already the studio's unfair advantage there. The material exists
(teachers.html, class.html, parent-guide.html, trust.html, child-safety.html) but there is
no pack a teacher can act on in one lesson.

Build one: a single page plus a printable PDF for one 50-minute lesson with zero installs
and no accounts - what the class will make, the exact URL to open, the three things that
go wrong on locked-down machines and the fix for each, what to do with the 20% who finish
early, what evidence the learner leaves with (the certificate tool already exists), and a
one-paragraph note the teacher can forward to IT about what the site needs (and does not
need) to work.

Done: the lesson pack page exists, links a real workshop and a real tool, the printable
renders correctly at A4, the IT paragraph names the actual domains and storage the site
uses, it is reachable from teachers.html and class.html in one click, npm run
validate:links PASS.
```

**E3 — Set a cadence you can keep alone (closes A1784)**
```text
Dev Log posts run in clusters (five on 11-12 Nov, then gaps of a fortnight). That is a
one-person studio shipping in bursts, which is fine for code and fatal for an audience.

Write CONTENT_CADENCE.md: the smallest weekly commitment that can be kept in a bad week
(one devlog post with one image, as tests/devlog-media.js already requires), what goes
out monthly, what goes out only when there is something real, and which of those are
written by hand for learners and parents (per the machinery rules, all social and devlog
copy is hand-written - say so in the doc). Include a four-week worked example using work
that already shipped, and the one metric that says the cadence is working.

Done: CONTENT_CADENCE.md states a weekly minimum, a monthly item, the hand-written rule,
a four-week worked example from real shipped work, and one success metric. A1784 can be
closed against it.
```

**E4 — Give the newsletter a reason to exist**
```text
Every footer promises "one email a week, no spam". The newsletter page collects addresses
through Formspree with no stated content plan, which means the promise is currently
unbacked - and an unsent newsletter costs more trust than no newsletter.

Decide and document the format in one page of NEWSLETTER_PLAN.md: who it is for (learner
or grown-up - pick one), the four recurring blocks, the single thing a reader can do after
each issue, and how a learner's creation gets featured (via the moderated gallery only).
Then write issue one from work that has actually shipped, and update newsletter.html so
the sign-up promises exactly what will be sent.

Done: NEWSLETTER_PLAN.md defines audience, format, and the feature path; issue one is
drafted from real shipped work; newsletter.html's promise matches the plan word for word;
the devlog <-> newsletter cross-check in the --sync guard still passes.
```

### F. Stop the site growing faster than one person can keep it

**F1 — Find what to retire**
```text
568 content pages, 933 test files and a 278-card backlog, maintained by one person. Board
card A1812 ("maintenance burden is growing faster than the product") is still in backlog,
which is itself the evidence.

Produce RETIREMENT_CANDIDATES.md: pages with no inbound internal links, tools that
duplicate another tool's job, workshops for engine versions that have moved on, and tests
that assert something no longer true. For each, one of MERGE / REDIRECT / RETIRE / KEEP
with a reason, and the three-line argument for the ten biggest wins. Change nothing.

Done: the doc lists every orphan page (no internal inbound link) with a disposition, names
duplicate tool pairs, and ranks the ten biggest maintenance wins with reasons. A1812 can
be closed against it.
```

**F2 — Make one connected creator journey across the tools (A1968)**
```text
74 tools exist and each is good on its own. A1968 asks for one connected journey and is
still unclaimed. The concrete version: a learner who makes a sprite in Pixel Studio should
be able to carry it into the level designer, into the Arcade Game Maker, and into an
export, without re-making it or knowing which file format matters.

Trace what actually passes between tools today (PROJECT_FILE_FORMAT.md is the starting
point), write down every place the chain breaks, then make the two most valuable hops work
end to end. Two working hops beat seven half-hops.

Done: the handoff map is written, the two chosen hops work end to end with a test each
(tests/arcade-game-maker-handoff.js is the pattern), the carried asset survives export,
and each hop is discoverable from inside the first tool rather than documented elsewhere.
```

---

## Suggested order

The dependencies are real, so order matters more than enthusiasm:

1. **A1, A2** — fix measurement, or nothing after this can be judged.
2. **D1, B1** — two audits, no code: what breaks in the first fifteen minutes, and which
   200 pages are hidden on purpose. Both need one human decision before work starts.
3. **E1** — pick the audience. It changes what "better" means for everything below.
4. **B2, B3, B4** — apply the index decision, then descriptions and cards. This is where
   traffic comes from.
5. **C1, C2** — the loop. This is where traffic compounds instead of arriving once.
6. **D2, D3, D4** — flow, informed by D1's ranked list.
7. **E2, E3, E4, B5** — the channel, once there is something worth arriving at.
8. **F1, F2** — before the surface area grows again.

A1, A2, D1, B1 and E1 are the five that unblock the rest. If only one week is available,
do A1 and D1.
