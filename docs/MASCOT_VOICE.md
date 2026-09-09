# Mascot Voice — JVDesignStudio Crew

Single source for how each guide speaks. Keep to 1 sentence + 3 words. Enforces `assets/mascots/barnaby-sheet.html` DO/DON'T.

| Mascot | Pillar | Voice (1 line) | 3 Words | Never |
|---|---|---|---|---|
| **Lumo** `#7C6CF0` purple fox, hooded, 30cm | Learn | “Psst — let’s try it together, one tiny step.” Curious, whispers, points. | curious · kind · step-by-step | Never scolds, never rushes, never says “easy”. Uses `eye line` + `pointing` pose. |
| **Barnaby** `#F8F0E6` arctic fox, long nose, 22 whiskers | Books (The Fox Who Forgot How to Play) | “I forgot how — will you show me?” Earnest, forgetful, learns by feeling. | earnest · wobbly · re-joyful | Never purple, never hooded, never Lumo’s cloak. Snow-tipped tail only. |
| **Ember** `#F2637A` pink tiger, cape, wand | Create | “Your idea + this knob = magic. Make it yours!” Energetic, tinkers, celebrates happy accidents. | make · tweak · wow | Never says “wrong”, never perfect-first-time. Uses `pounce` pose. |
| **Echo** `#2EB5A5` pink axolotl, compass, gills | Play (explorer) | “I found a secret — wanna see?” Brave, loud, learns to listen. | brave · echo · listen | Never whispers first; must learn to. Compass always visible. |
| **Pip** `#7AC74F` green turtle, cape, slow | Play (steady) | “Slow and steady — we’ve got this.” Gentle, waddles fast when excited. | steady · cozy · hugging | Never rushes, never beak/claws. Keeps shell pattern. |
| **Stardust** `#FFD23C` gold wisp, dreams+stars | Read + Spirit | “Wherever someone needs hope… I appear ✨” Soft, glows, floats, sparkles trail. | soft · glowing · hopeful | Never legs/fingers/nose/eyebrows, never fire-look. `Tiny sparkles orbit` always. |

**Keeper** (The Keeper of Lost Things) — patchwork coat, lantern, `You gather us to make us whole…` — adult, patient, mends. Voice: “Rest here, we’ll mend it with gold.” For that book only, not nav.

**Rules from sheets:**
- Keep shapes rounded + soft (Lumo sheet 11 DO)
- Tail larger than body (Lumo)
- Cloak flows naturally (Lumo) — Barnaby has NO cloak
- Stardust: flame-shaped head, no legs, warm golden, `soft grainy + sparkles + edge glow`

**Usage:**
- Nav badge = `*-badge.webp` 22px. Hero = `*-hero.webp` 112px. Never link `*sheet.png` (2.8MB) on site.
- Speech: `data-mascot-bubble="lumo"` randoms from `MASCOT_LINES` — must match this voice doc.
- Quiz `jvds_guide` maps directly to this table; `personalizeHome()` highlights path in guide’s color.

**Enforcement:** Any new copy must pass “would this mascot say it in this voice?” If not, rewrite. Track `guide_choose` in GA4 to see if voices land.
