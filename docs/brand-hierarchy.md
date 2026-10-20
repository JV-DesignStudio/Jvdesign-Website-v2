# JVDesignStudio brand hierarchy (A1757)

One page. Use this when adding a nav item, a homepage section, a footer link or a
page title. If a new thing does not fit a door below, it is secondary.

---

## Primary promise

**A free browser studio where young people make games, characters and stories,
learn as they go, and keep what they make.**

Short form for a hero or a card: **Make games, characters and stories.**

The promise is making, not browsing. Learning, playing and reading exist to feed
the next thing the learner makes.

## Audience order

1. **Young creators, roughly 8 to 15.** They are the first reader of every label.
   If a 9 year old cannot predict where a door goes, the label is wrong.
2. **Parents and carers.** They need safety, cost and "where does the work go"
   answered in one place.
3. **Teachers and classrooms.** They need the school-computer rule and a clear
   first lesson.

Grown-up material never takes a learner door. It sits in For Parents, For
Teachers, or the footer.

## The five doors

The doors are jobs, not characters and not content types. One label per job.

| Door | Canonical label | Goes to | Character | Content under it |
|---|---|---|---|---|
| On-ramp | **Start Here** | `/workshops/start-here.html` | Stardust | The first 15 minutes, pick a path |
| Learn | **Learn** | `/workshop` | Lumo | Workshops, beginner guides, cheatsheets |
| Create | **Create** | `/dev-tools` | Ember | Pixel Studio, game makers, design tools |
| Play | **Play** | `/arcade.html` (clean route `/games`) | Pip and Echo | Arcade, browser games, playtests |
| Read | **Read** | `/books` | Stardust | Picture books, stories, activity packs |

Rules:

- Start Here is the on-ramp, not a sixth content type. It is allowed to be the
  first nav item and the first homepage action.
- The nav door labels are the jobs: Learn, Create, Play, Read. The content names
  Workshops, Tools, Games and Books sit inside those doors, for example on a hub
  card or in a page title. A content name never replaces a door label in the nav.
- "Guides" is part of the Learn door. It is not a peer of Workshops.
- "Downloads" and "Freebies" are a keep-your-work utility, not a door.
- Keep the top nav at seven items or fewer. A new door means removing one.

## The five-character loop (emotional model only)

**Imagine (Stardust) -> Learn (Lumo) -> Create (Ember) -> Play (Pip) -> Improve
(Echo) -> Imagine again.**

This is how the studio should feel, not a second menu. Character pages live under
**Meet the characters** in the More menu, with the role in brackets (for example
"Stardust (Imagine)"). Do not put the verbs Imagine, Learn, Create, Play and
Improve in the top nav beside the doors: that is the competing taxonomy this
document exists to stop.

## Secondary, deliberately

These support the doors. They never outrank the learner's first make.

- My Studio (`/me.html`), progress, streaks and keepsakes.
- Pick Your Path, the chooser for a learner who cannot choose a door.
- Community Gallery, Quotes, Meet the Crew.
- Dev Log, Newsletter, Downloads.
- About the Studio, Contact, FAQ, Privacy, Terms, Sitemap, Search.
- Apps, merch, press, commissions. Separate workstreams, not top-level doors.

## Where the hierarchy appears

- **Global nav:** Start Here, Learn, Create, Play, Read, For Parents, For
  Teachers. More holds secondaries and the character loop.
- **Homepage:** the hero promise, the first make, the four-door hub (Learn,
  Create, Play, Read, with Workshops / Tools / Games / Books as the content
  names), beginner guides, gallery, about, newsletter.
- **Footer:** the four doors plus Start Here first in Explore, then the
  secondaries. No character pages as peers of the doors.
- **Page titles:** name the door, then the page. "Workshops: Scratch for kids",
  "Play: Gem Match", "Read: Stardust". Do not invent a new category in a title.

## Check before shipping

1. Does the new label name a job a learner can predict?
2. Is it a door, an on-ramp, a character or a secondary? Only four doors.
3. Does it duplicate an existing label or destination?
4. Does the mobile nav still fit seven top-level items?
5. Would a parent still find safety, cost and saving in one place?

If the answer to 2 is "a new top-level category", stop and fold it into a door.
