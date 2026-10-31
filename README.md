# Voidreaver prototype

A playable browser prototype of *Voidreaver*: Hotline Miami-style shotgun fights (one hit kills, 2 to 5 second
rooms, instant restarts) inside sealed spaceship compartments, preceded by a short Zaxxon-style flight run.
Plain HTML, JavaScript and Canvas 2D. No framework, no build step. Double-click `index.html` to play.

## The demo: create a prototype game in one hour

This repository is the output of a live demo of agentic game development with Claude Code. The premise was
simple: hand an agent crew a design brief and see how much of a playable prototype comes out in about an hour
of wall-clock time, with the human doing nothing but writing two prompts.

**What the human supplied before the clock started:**

- `CLAUDE.md`: the Director's standing orders (hard constraints, file ownership per agent, how to run milestones).
- `docs/PROTOTYPE_SPEC.md`: scope, controls, starting tuning values, six milestones and acceptance criteria.
- `.claude/agents/*.md`: six specialist agents, each owning a slice of the tree so they never overwrite each other:
  proto-architect, combat-engineer, level-builder, flight-engineer, feel-tuner, playtester.
- `KICKOFF.md`: the suggested first prompt.

**What the human typed during the demo:**

1. "Explain what this project is."
2. "Use a workflow to build this initial prototype with the agent crew."

**What happened next.** The main Claude Code session acted as Director and wrote a Workflow script that ran the
six milestones in order. Each milestone followed the same shape: the owning agents built (in parallel where their
files did not overlap), the playtester ran a headless Playwright smoke test over `file://` and wrote a human
checklist, failing items were routed back to the file owner for a fix round, and the feel-tuner adjusted
`src/config.js` after combat and flight milestones. The Director only intervened once, to fix a flaw in its own
gate logic after milestone 1, then relaunched the remaining milestones in a second run.

| Run | Milestones | Agents | Tool calls | Wall clock |
| --- | --- | --- | --- | --- |
| 1 | M1 skeleton | 10 | 113 | 17 min |
| 2 | M2 to M6 | 34 | 446 | 110 min |

The brief said one hour; the unattended build runs took a little over two. Everything in `src/`, `tests/`,
`docs/playtests/` and `CHANGELOG.md` was written by the agents. The only hand edit by the Director was moving
one hard-coded number into the config file between the two runs.

**What came out:** a 78 second flight run with three altitude bands and oversized gaps, five hand-authored
compartments, six enemy and weapon behaviours, cover, hull breaches, doors with a scanner, a pick-one-of-three
upgrade screen, combo grades, a HUD, a debug overlay, a live tuning panel with 33 sliders, and telemetry export.
Every value lives in `src/config.js`. The headless smoke test plays the whole run, flight plus five rooms, with no
console errors at 60 fps. See `CHANGELOG.md` for one entry per milestone.

The one thing the agents cannot judge is feel. That is why the loop ends with a human playing it and pasting the
telemetry back.

## How to play

Double-click `index.html` (Chrome or Firefox, no install, no server). The run starts with a flight: **A/D** strafe,
**W/S** change altitude band (low/mid/high), hold **left click** to fire, and fly through the gaps in each wall;
one hit destroys the ship and you restart at the last checkpoint. Docking loads the boarding rooms.

In a room, **WASD** moves (W is up the screen), the **mouse** aims, **left click** fires the shotgun, **Space**
dashes (invulnerable, recharging charges), **C** takes or leaves cover, **hold right click** in cover to pop out
and shoot, **F** kicks (doors and enemies), **G** picks up or throws a weapon, and **R** restarts the room (death
restarts it automatically). Clear every enemy to open the exits, pick a door by its reward, choose an upgrade
with **1/2/3**, and finish all five rooms.

**Debug keys:** **F1** toggles the overlay (FPS, hitboxes, line-of-sight rays, enemy states); **backtick (`)**
opens the tuning panel with live sliders; **F2** jumps to the flight, **F4** to room 1, **Digit 1-5** to room N in
boarding; in the flight **N** warps to the next checkpoint and **H** toggles god mode (telemetry flags runs that
used them).

**Sending results back:** after playing, press backtick and click **Copy stats**. This copies per-room JSON
(attempts, time to clear, deaths with cause, grades, and any slider changes) to the clipboard and shows it in the
panel. If the browser blocks the clipboard, select the text box and copy it by hand. **Copy config** exports the
tuned values the same way.

## Layout

```
index.html            entry point, loads scripts in order
src/config.js         every tuning value
src/core/             loop, input, iso math, camera, renderer, world, audio, HUD
src/game/             player, weapons, enemies, cover, breach, doors, upgrades, combo, flight-*
src/scenes/           flight, boarding, scene manager
src/data/             rooms.js (ASCII maps), enemies.js, upgrades.js
src/debug/            overlay, tuning panel, telemetry, clipboard
tests/                smoke test, room validator, config checker
docs/                 spec, playtest checklists, art and audio reference boards
```

## Checks

Playwright is a dev-only dependency for the headless smoke test. The game itself needs nothing.

```
npm install                    # once, for tests/smoke.js
node tests/check-config.js     # no hard-coded gameplay numbers in src/game or src/scenes
node tests/validate-rooms.js   # ASCII room maps are well formed
node tests/smoke.js            # loads index.html over file:// and plays the full run headless
```
