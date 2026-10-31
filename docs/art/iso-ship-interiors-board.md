# Isometric ship interiors reference board
Curated by the human on 2026-10-31 to the four references below.

Date: 2026-10-31   Brief: How cramped iso spaceship compartments can read as industrial while keeping the floor legible for fast one-hit combat.

## Verification status (read first)
My fetch tool returns page text only, so I could not look at any image. Every "Shows" line below is what the page text or caption says, not what I saw.
- **Palettes were not extracted.** Estimating hex values by eye needs the image. Palette lines are marked "not extracted".
- Two entries rest on search summaries or session overviews rather than full pages (the PC Gamer piece, the Heat Signature PC Gamer hands-on, and the GDC Vault talk); their claims are flagged inline.
- Licensing: all sources are copyrighted. Study only; nothing here is asset material.

## Questions this board answers
- How do iso games keep characters visible behind walls without losing the sense of where the walls are?
- What "used future" material and lighting language makes a hull feel real and cramped?
- What did comparable ship-interior games choose to show or hide, and what mechanics make breach and venting legible?
- What is still unanswered and needs a visual pass by a human?

## References

### Alien: Isolation visual approach — Creative Assembly, via Engadget
Source: https://www.engadget.com/2014-10-07-alien-isolation-launch-interview.html
Shows: Interview text with creative lead Alistair Hope. The team filmed UI on VHS and tube TVs, and crushed cables and used magnets for glitches. "Lo-fi didn't necessarily mean crappy"; digital can feel "very cold" versus the film's warmth. Optional film grain.
Lesson: A tactile, 1979-era "used future" is a deliberate rule ("could this have been made in 1979?"). It gives a ready material vocabulary: chunky CRT screens, analog indicators, worn metal. Fits flat-shaded iso if screens and panel lights carry the detail.
Palette: not extracted. The page does not describe lighting or colors.

### Alien: Isolation and Nostromo design lineage — summarized from search results
Source: https://www.pcgamer.com/uk/why-i-love-the-low-fi-tech-of-alien-isolation (page body would not load; claims below come from the search summary only) and https://en.wikipedia.org/wiki/Alien:_Isolation
Shows: Per summaries, the Nostromo's stark, functional design reads closer to an oil rig or submarine than classic sci-fi. The team had access to Giger, Cobb, Giraud and Mollo concept art and aimed for a believable "used future".
Lesson: Functional, industrial and cramped rather than ornamental. Useful phrase for art briefs: "oil rig in space". Needs confirmation from the full article before quoting.
Palette: not extracted

### Dead Space remake lighting — Guillaume Goudreault (Motive), GDC 2023
Source: https://gdcvault.com/play/1029020/-Dead-Space-Harnessing-the
Shows: Session overview only (full talk is behind GDC Vault membership). Topics: a light fixture built to make a seamless USG Ishimura, lighting behavior driven by an "intensity director", color grading and ACES.
Lesson: Lighting on a ship is systematic: shared fixtures with a central intensity control. That maps to a cheap Canvas trick: one global "alert level" value that drives every lamp, tint and glow, which also suits breach and room-clear beats. The talk content itself is unverified.
Palette: not extracted

### Heat Signature — Suspicious Developments (Tom Francis; artist John Roberts)
Source: https://en.wikipedia.org/wiki/Heat_Signature_(video_game)
Shows: Top-down game of boarding procedurally generated ships from a shuttle; artist credited as John Roberts. A PC Gamer hands-on (search summary only; page body did not load) describes crews being sucked out of a cracked hull.
Lesson: The closest mechanical cousin (boarding, breach kills). Its view is top-down, not iso, so use it for how a breach moment reads, not for projection. Art details unverified.
Palette: not extracted

## Direction notes
All four notes follow from the kept references only. Target look: a lo-fi 1979 "used future", functional industrial "oil rig in space", lit systematically from one global value, with breach moments that read instantly.

- **1979 lo-fi material kit** — Flat-shaded worn panels, chunky CRT consoles, analog indicator lamps, stencil marks, optional light grain. Rule of thumb from Alien: Isolation: "could this have been made in 1979?" Risk: detail on the floor plane competes with 20 enemies; confine it to walls, cover and props, and keep grain a cached overlay, not a per-frame pass.
- **"Oil rig in space" structure** — Exposed pipe runs, riveted bulkheads, cramped functional corridors with no ornament, so each compartment reads as a working machine. Risk: this phrase comes from a search summary of the PC Gamer piece; confirm before quoting it in briefs. In iso, pipes and cable runs add draw calls, so bake them into cached wall sprites.
- **One global alert/intensity value** — A single value drives lamp tint, edge glow, console brightness and breach-red, in the Dead Space "intensity director" spirit (design intent only; the talk content is unverified). Risk: Canvas 2D full-screen tint passes are costly; apply the value to a few cached sprites and glow strokes only.
- **Breach as an instant-read event** — Heat Signature shows breach as the payoff moment (crews pulled out of a cracked hull). Voidreaver: a hard flash on the alert value, a short particle streak toward the hole, then a clearly different end state once sealed. Risk: pulled actors, crates and particles together could exceed the 20-enemy frame budget; cap particle counts. Heat Signature is top-down, so the framing needs an iso check.

## Open questions for the human
- Can someone with image access view the sources above and extract palettes? I could not.
