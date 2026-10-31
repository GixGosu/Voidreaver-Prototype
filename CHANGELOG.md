# Changelog

One entry per milestone. Dates are when the milestone passed its playtester smoke test.

## M1 — Skeleton (2026-10-31)

- Fixed-step game loop with interpolated render, pause on tab blur and hit-stop support.
- Exact 2:1 dimetric world/screen conversion (64x32 tiles, 32 world px per tile); aim lands under the cursor.
- Renderer with pooled draw list, depth sorting, extruded walls, cached floor, and wall fade to outlines.
- Camera follow with aim lead and shake; WebAudio blip synth; keyboard and mouse input with edge detection.
- Tile world from an ASCII map: grid raycast, circle movement with sliding collision, cover and spawn lookup.
- One test room, scene manager, boarding stub, F1 overlay with FPS and cursor readout.
- `src/config.js` seeded with every value from the spec, plus a tuning log header.
- Tests: `node --check` sweep, room validator, hard-coded-number checker, Playwright smoke test (60 fps, no console errors).
- Early: the full player controller (dash, cover, pop-out, kick, pickup hooks) landed during the M1 fix round; M2 builds on it.
- Human checklist: `docs/playtests/M1-checklist.md`.

## M2 — Lethal combat (2026-10-31)

- Shotgun with pellet raycasts, spread, range, knockback, pump delay and per-room shells refilled on clear; pistol dropped by grunts.
- Grunt (patrol, alert on sight, 0.35 s telegraph then fire) and rusher (melee sprint). Enemies knocked into walls die.
- One-hit deaths. Death freezes, then the room restores exactly from a snapshot in about 0.43 s. No menu.
- Kick (F) knocks and stuns; throwing an empty weapon (G) stuns 1 s; G swaps weapons on a floor pickup.
- Combo chain within 1.5 s and S/A/B/C room grades from time and combo.
- Hit feel: hit-stop on kills, shake scaled by pellets hit, ragdoll slide, splatter decals, audio blips.
- Feel-tuner: shotgun knockback 520 to 640 so bodies fly into walls more often.
- Smoke test now triggers a real death and measures the reset. 20 enemies hold 60 fps.

## M3 — Cover and breach (2026-10-31)

- Half cover (pop out with held right click to fire), full cover (lean out at the edge), destructible crates with HP.
- Shield icon above the player: green when protected, red when exposed to an alerted enemy. Red glow on threatened cover edges.
- Hull breach: shoot a window, everything in radius is pulled for 2 s and spaced on contact, crates slide, shutter seals after 2.5 s. Windows restore on restart.
- Rooms 1 to 3 (intro, cover, breach) as ASCII maps. Digit keys 1 to 5 jump to a room.

## M4 — Compartment chain (2026-10-31)

- Rooms 4 (rushers) and 5 (elite). Full chain room 1 to 5 with a run-complete state.
- Doors seal on entry and open on clear. Scanner shows enemy positions for 0.75 s before entry. Two exits per room with reward icons.
- Pick-one-of-three upgrade screen (click or 1/2/3): extra shells, wider spread, longer dash, third dash, kick shockwave, one-time shield. Upgrades persist across rooms and deaths.
- Gunner (burst fire, relocates between cover, suppresses) and heavy (3 hits, kick-immune, shotgun).
- Feel-tuner: crate HP 20 to 14, rusher speed 205 to 214, gunner suppress bonus 2 to 1.

## M5 — Flight run (2026-10-31)

- 78 s diagonal isometric scroll with three altitude bands, strafe, forward fire and a drop shadow.
- Course as timed segment data: 10 walls with 2.5x oversized gaps, force-field gates with shootable generators, turret rows, fighters.
- One-hit death, checkpoints every 20 s, restart in about 0.4 s. Docking hands off to room 1.
- Game now boots into the flight. F2 jumps to flight, F4 to room 1. In flight N warps to the next checkpoint and H toggles god mode.
- Feel-tuner: turret and fighter minimum fire distance raised so every shot is visible for at least 1 s.

## M6 — Feel and debug (2026-10-31)

- HUD: room name, timer, deaths, kills, shell and dash pips, combo bar, grade banner.
- F1 overlay: FPS, hitboxes, line-of-sight rays, enemy state labels.
- Backtick tuning panel: 33 live sliders bound to `src/config.js`, Reset, Copy config.
- Telemetry per room (attempts, time to clear, deaths with cause, grade, slider changes) with a Copy stats JSON export.
- README with controls and debug keys. Full headless run flight plus 5 rooms passes with no console errors.
- Known: grade text briefly shows twice after a clear; Firefox untested (Chromium only in headless).
