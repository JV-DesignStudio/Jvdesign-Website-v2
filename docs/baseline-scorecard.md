# JVDesignStudio baseline scorecard (A1754)

Scored: 20 October 2026  
Scorer: claude-code (A1754)  
Method: automated test output + page inspection + validate runs

---

## Scores at a glance

| # | Category | Score /10 | Potential | Status |
|---|---|---|---|---|
| 1 | Branding | 7 | 9 | Board card A1757 done |
| 2 | UI | 6 | 8 | CSS tokens partial; A1637-A1640 open |
| 3 | UX | 6 | 8 | Onboarding good; return loop missing |
| 4 | Navigation | 7 | 9 | A1757+A1760 just shipped |
| 5 | Accessibility | 6 | 8 | No hard fails; 150 heading-skip advisories |
| 6 | Mobile | 7 | 9 | Tools all pass; homepage LCP 3.1 s on phone |
| 7 | Performance | 8 | 9 | All budgets pass; phone LCP near ceiling |
| 8 | SEO | 9 | 9 | 408 pages: titles/descriptions/canonicals/og:image all pass |
| 9 | Games | 6 | 8 | 12 browser games; 1 flagship; 22-genre arcade maker |
| 10 | Learning | 7 | 8 | 344 workshops; all have progress saves |
| 11 | Gamification | 5 | 8 | XP/streak/quests exist but not surfaced on return |
| 12 | Content | 6 | 8 | 344 workshops + 5 books + 71 tools; ends weak |
| 13 | Retention | 4 | 7 | No return hook; A1776 (continue loop) open |
| 14 | Trust | 7 | 9 | A1759 shipped; parents panel live |
| 15 | Technical quality | 8 | 9 | 0 broken links; CSP 611 pages; 608 JS clean |
| 16 | Originality | 7 | 8 | Five-character loop is distinct; arcade maker unique |
| 17 | Professionalism | 6 | 8 | Clean but visual design system incomplete |
| 18 | Overall | **6.5** | **8.5** | â€” |

---

## Evidence per category

### 1 Â· Branding (7/10)
Primary promise defined: "A free browser studio where young people make games, characters and stories."  
Five-door hierarchy (Start Here / Learn / Create / Play / Read) written in `docs/brand-hierarchy.md`.  
Nav labels aligned: Learn/Create/Play/Read. Five-character loop is emotional model only.  
Gap: brand doc is internal; public pages do not yet consistently use "Make games, characters and stories" as hero copy. Homepage hero still leads with a tagline that varies.  
_Potential 9: once homepage hero and page-title pattern fully match the doc._

### 2 Â· UI (6/10)
`tokens.css` exists but CSS design-token wiring is partial (A1637/A1638 open).  
120 WCAG AA contrast pairs pass (`test:tokens-contrast`).  
Light + dark + five character themes all pass contrast.  
Gap: component set not yet built (A1639); page-level spacing/type still ad-hoc.  
`validate:js`: 608 pages, 0 dead JS, 1 non-fatal console error.  
_Potential 8: after Phase 1 component set ships._

### 3 Â· UX (6/10)
First-15-minutes path: `test:build-a-game-15-min` PASS, first-mission flow PASS.  
Pick-your-path chooser exists. Start Here route works.  
Workshop filtering: hub covers all 344, 21 engines, difficulty/age filters pass `test:workshop-hub-qa`.  
Gap: no "continue where you left off" on return visit (A1776 open). My Studio exists (XP/streak/quests) but is not surfaced from the homepage for returning visitors.  
_Potential 8: after A1776 lands._

### 4 Â· Navigation (7/10)
`tests/nav-routes.js`, `nav-loop-links.js`, `nav-gallery.js`, `nav-mobile.js` all PASS (A1757).  
Canonical destinations: Learn â†’ /workshop, Create â†’ /dev-tools, Play â†’ /arcade.html, Read â†’ /books.  
games/index.html redirect in place (A1760). Footer deduped.  
Gap: `test:security-headers` FAIL â€” `games/index.html` missing meta CSP (created as redirect by A1760). Linked card needed.  
_Potential 9: after CSP gap fixed._

### 5 Â· Accessibility (6/10)
`validate:a11y`: no blocking issues across 557 pages.  
150 advisory heading-skip issues (h1â†’h3 in voxel-studio, world-builder-3d, unreal-studio).  
Contrast: all 120 pairs WCAG AA (`test:tokens-contrast`).  
Gap: heading skips advisory only but will become failures under WCAG 2.1 AA in strict mode. No full ARIA audit done.  
_Potential 8: after heading hierarchy fixed across those 3 workshops._

### 6 Â· Mobile (7/10)
71 tools responsive at 390/1440: `test:responsive` PASS.  
28 tools Ã -  3 devices touch: `test:mobile-touch` PASS (9 advisory drag-delta misses, not failures).  
Homepage phone LCP 3 148 ms vs 6 000 ms budget â€” passes but near 50% of ceiling. CLS 0.005.  
Pixel Studio phone finish-screen issue open (A1790, P2).  
_Potential 9: after phone LCP tightened and A1790 fixed._

### 7 Â· Performance (8/10)
`check:performance`: 12 measurements across 6 pages, 0 over budget.  
Worst: homepage phone LCP 3 148 ms (budget 6 000); dev-tools 1440 CLS 0.199 (budget 0.3).  
CSP sync: 611 pages match shared policy.  
Transfer sizes well under budget on all measured pages.  
_Potential 9: minor LCP and CLS headroom to tighten._

### 8 Â· SEO (9/10)
408 indexable pages scanned: titles unique, descriptions unique, canonicals unique + matching, og:image present + files resolve, sitemap coverage complete.  
Validate-links: 41 218 refs, 0 broken.  
Gap: 10-page intent/keyword plan not yet shipped (A1770 open).  
_Potential 9: already strong; A1770 could push to 10._

### 9 Â· Games (6/10)
52 game HTML files; 12 in the curated arcade; 1 flagship (Arcane Citadel).  
22-genre arcade game maker: quality labels PASS, distinctness PASS, thumbnails PASS.  
Thumbnails and meta pills all render.  
Gap: only 12 playable browser games in the arcade; depth behind the 22 genres is thin. Engine contract test gates quality but most genres are BETA/EXPERIMENT.  
_Potential 8: as arcade game depth grows and more genres reach READY._

### 10 Â· Learning (7/10)
344 workshops; all have progress indicators and save explanations (`test:progress-save` PASS).  
Workshop hub: all 344 indexed, 21 engines, filter by difficulty/age/engine all pass.  
Key coverage: 213 keys, 171 series keys, all mapped.  
Canvas workshops and canvas-preview runtime PASS.  
Gap: workshops don't consistently end with a keepable artifact (A1766, P2 open).  
_Potential 8: after A1766 ships._

### 11 Â· Gamification (5/10)
System exists: XP, streak, level (shown in nav as "Lv 1 Â· 0 day streak"), quests, achievements, certificates.  
`validate:quests` PASS: 25 workshop refs, 12 game refs all resolve.  
Gap: gamification is invisible to a first-time visitor; no streak/XP prompt on homepage; My Studio is a secondary nav item not a call-to-action. Return visitors land with no signal about their progress. A1776 (continue loop) would help here.  
_Potential 8: with a return hook and homepage progress nudge._

### 12 Â· Content (6/10)
344 workshops, 71 tools, 12 games (curated), 5 books (4 published + 1 preview).  
Stats display: "180+" workshops, "35+" tools, 12 games, 5 books â€” conservative claims match `validate:stats`.  
Content is wide but endings are weak: workshops close with a final paragraph rather than a keepable artifact (A1766 open).  
Dev Log exists; newsletter cross-linked.  
_Potential 8: after artifact endings and 10 planned SEO pages (A1770)._

### 13 Â· Retention (4/10)
Progress saves to localStorage and is explained.  
My Studio profile holds XP/streak/quests/backup.  
Service worker offline: PASS.  
Gap: no "continue where you left off" surface anywhere on the homepage or nav for a return visitor. A1776 open, A1775 (My Studio as portfolio/return point) open. Both P2. This is the clearest below-6 score.  
_Potential 7: after A1776 and A1775 ship._

### 14 Â· Trust (7/10)
A1759 shipped: 8-question parent trust panel live at `/parents#trust`.  
Linked from homepage about-strip and footer.  
Privacy policy present and claims in the trust panel verified against it.  
Contact, FAQ, Terms all present.  
Gap: no third-party trust marks (not in scope for this site but noted).  
_Potential 9: already solid for a solo indie site._

### 15 Â· Technical quality (8/10)
Validate-links: 41 218 refs, 0 broken.  
CSP: 611 pages match shared policy (`check:csp-sync` PASS).  
validate:public PASS. validate:workshops PASS. validate:quests PASS.  
608 pages, 0 dead JS.  
Security headers FAIL: `games/index.html` missing meta CSP (1 file, A1760 side-effect). Needs a board card.  
_Potential 9: one CSP fix._

### 16 Â· Originality (7/10)
Five-character emotional loop (Stardust/Lumo/Ember/Pip/Echo) is distinctive and consistent.  
22-genre arcade game maker with distinctness test is unusual for a free learner site.  
Pixel Studio with first-mission flow.  
Free, no-account, school-computer rule clearly stated.  
Gap: visual design feels generic; character artwork not yet prominent in the UI.  
_Potential 8: as character art and the maker identity strengthen._

### 17 Â· Professionalism (6/10)
All pages have canonical, og:image, description.  
Responsive, no overflow, no broken links.  
CSP on all but 1 page.  
Gap: CSS design system incomplete (A1637-A1640); some pages have inconsistent spacing/heading hierarchy. visual regression test exists but not gating CI.  
_Potential 8: after Phase 1 component set and heading fixes._

### 18 Â· Overall (6.5/10)
Strong technical hygiene, excellent SEO, good learning depth.  
Core weakness: retention and return loop. A visitor who makes something has no obvious reason to come back the next day.  
Second weakness: gamification is invisible until you already know it's there.  
Realistic potential 8.5 with A1776 (return loop), A1775 (My Studio), A1766 (artifact endings), A1637-A1640 (design system).

---

## Scores below 6 and their board cards

| Category | Score | Board card |
|---|---|---|
| Retention | 4 | A1776 (continue loop, P2 backlog), A1775 (My Studio, P2 backlog) |
| Gamification | 5 | No dedicated card yet â€” recommend creating one |

## Issues found during audit

| Issue | Severity | Recommended action |
|---|---|---|
| `games/index.html` missing meta CSP | Medium | Create board card; add CSP to file |
| 150 heading-skip advisories (3 workshop pages) | Low | Fix h1â†’h3 skips in voxel-studio, world-builder-3d, unreal-studio |
| Gamification invisible on homepage/return | Medium | Create gamification-surface board card |
| Workshop endings have no keepable artifact | Medium | A1766 open (P2) |
| Return loop absent | High | A1776 open (P2) |

