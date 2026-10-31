# Voidreaver Prototype Spec (Gate 1)

Goal: a playable HTML build, about 5 minutes long, that tests whether the core loop is fun.
One flight run, then a chain of 5 sealed compartments, ending in an elite room.

## In scope

### 1. Isometric rendering (proto-architect)
- Canvas 2D, 2:1 dimetric diamond tiles (64 × 32 px). Walls drawn as extruded blocks with a height.
- Correct depth sorting of floor, walls, cover, actors, projectiles.
- **Wall fade:** walls between the camera and the player draw as outlines only.
- Camera follows the player with a small lead toward the aim direction.
- Rooms are deliberately **roomier than realistic** (wide doors, open floor) so actors and cover stay readable.
- Screen-to-world conversion for mouse aim must be exact (aim lands where the cursor is on the floor).

### 2. Player and controls (combat-engineer)
| Action | Key |
| --- | --- |
| Move | WASD (screen-relative: W is up the screen) |
| Aim | Mouse |
| Fire | Left click |
| Pop out of cover for a shot | Hold right click while in cover, then left click |
| Dash | Space (2 charges, invulnerable during the dash) |
| Take / leave cover | C (auto-snap when dashing into cover) |
| Kick (doors, enemies) | F |
| Pick up / swap weapon | G |
| Restart room | R (also automatic after death) |
| Debug overlay / tuning panel | F1 / backtick |

### 3. Combat rules (combat-engineer)
- **One hit kills** the player and standard enemies. Heavies take 3 shotgun hits.
- **Instant restart:** on death, freeze 0.4 s, then reset the room to its exact starting state.
- **Shotgun (starting weapon):** pellet spread, short range, strong knockback; enemies knocked into walls,
  hazards or breaches die. Limited shells per room (refilled on room clear).
- **Pistol:** dropped by grunts; long range, weak, 1 shot per kill on unarmored.
- Throwing an empty weapon (G with no ammo) stuns for 1 s. Kicking a door open stuns enemies behind it.
- **Enemies** (all use a reaction delay before the first shot, tunable; it is the key fairness knob):
  - *Grunt:* pistol, patrols, alerts on line of sight.
  - *Rusher:* melee, sprints at the player; exists to flush the player out of cover.
  - *Gunner:* rifle burst, moves between cover points, suppresses.
  - *Heavy:* armored (3 hits), slow, shotgun. Kicks don't stun it.
- **Combo:** kills within 1.5 s of each other chain a combo. Each room gets a grade (S/A/B/C) from time and combo.
- Hit feel: hit-stop on kills, screen shake on shotgun fire, knockback, ragdoll slide, splatter decals.
  Simple WebAudio blips for shots, kills, death, room clear.

### 4. Cover (combat-engineer + level-builder)
- **Half cover** (crates, consoles): blocks enemy shots while crouched; popping out lets you fire over it and exposes you.
- **Full cover** (pillars, bulkheads): blocks everything; you fire by popping out at its edge.
- **Destructible:** crates have HP; shotgun blasts break them in 2–3 hits.
- Readability: a small shield icon above the player shows protected / exposed against each alerted enemy;
  cover edges facing an enemy's line of fire glow red.

### 5. Hull breach (combat-engineer)
- Window tiles (`W` in room maps) can be shot out.
- A breach pulls everything within a radius toward the hole for 2 s; actors that reach it are spaced (die).
- Loose crates slide too. An emergency shutter seals the hole after 2.5 s.
- The player is pulled as well, so it's a risk to use near yourself.

### 6. Compartment chain, doors and upgrades (level-builder)
- 5 hand-authored rooms as ASCII maps, each one screen: intro, cover-heavy, breach room, rusher room, elite room.
- Doors seal on entry; open when every enemy is dead. A door scanner shows enemy positions for 0.75 s before you breach.
- After rooms 1–4: 2 exit doors, each showing its reward type; clearing the next room grants it.
- **Upgrades (pick 1 of 3):** extra shell, wider spread, longer dash, third dash charge, kick sends a shockwave,
  one-time extra hit (shield). They last for the rest of the run.

### 7. Flight run (flight-engineer)
- 60–90 s isometric diagonal scroll toward the target ship, ending at its docking port, then the boarding scene loads.
- W/S change altitude between 3 broad bands (low, mid, high); A/D strafe; left click fires.
- Obstacles: walls with **oversized** gaps (2–3× the ship's size) at one band, force-field gates, turret rows, a few fighters.
- Drop shadow under the ship. One hit destroys the ship; restart from the last checkpoint (every ~20 s).

### 8. HUD and debug (proto-architect)
- HUD: shells, dash charges, combo, room timer, deaths this room, grade on clear.
- F1 overlay: FPS, hitboxes, line-of-sight rays, enemy states.
- Backtick tuning panel: live sliders for the most important `config.js` values, with a "copy config" button.
- Telemetry: per room, record attempts, time to clear, deaths and cause of death. "Copy stats" button exports JSON
  so the human can paste results back after a playtest.

## Out of scope (do not build)
Classes beyond the default shotgun loadout, hub, scrap, megastations, bosses, story, real art or music,
saving, controller support, mobile. Put ideas in `docs/ideas.md`.

## Starting tuning values (`src/config.js`)
| Value | Start |
| --- | --- |
| Player speed | 220 px/s |
| Dash distance / duration | 140 px / 0.15 s |
| Dash charge recharge | 1.2 s each |
| Shotgun pellets / spread / range | 8 / 30° / 260 px |
| Shotgun pump delay | 0.45 s |
| Shells per room | 6 |
| Enemy reaction delay | 0.35 s |
| Enemy bullet speed | 520 px/s |
| Breach pull radius / duration | 260 px / 2 s |
| Death freeze before restart | 0.4 s |
| Combo window | 1.5 s |

## Milestones
| # | Milestone | Owner(s) | Done when |
| --- | --- | --- | --- |
| M1 | Skeleton: loop, input, iso renderer, one test room, player moves and aims | proto-architect | Player walks around a room; aim matches cursor; 60 fps |
| M2 | Lethal combat: shotgun, grunt + rusher, one-hit deaths, instant restart, hit feel | combat-engineer | A room with 4 enemies clears in under 5 s when played well |
| M3 | Cover and breach | combat-engineer, level-builder | Half/full/destructible cover and one breach room work |
| M4 | Compartment chain: 5 rooms, doors, scanner, upgrades, gunner + heavy, combo/grades | level-builder, combat-engineer | Full chain playable start to finish |
| M5 | Flight run into boarding | flight-engineer | Flight run plays and hands off to room 1 |
| M6 | Feel pass, debug tools, telemetry | feel-tuner, proto-architect | Tuning panel live; stats export works |

Each milestone ends with a playtester smoke test and a human play session.

## Acceptance criteria (prototype done)
- Opens from `index.html` with no console errors in Chrome and Firefox.
- Full run (flight + 5 rooms) completable; restart after death takes under 0.5 s.
- 60 fps with 20 enemies on screen on a mid-range laptop.
- A skilled run clears most rooms in 2–5 s of active fighting.
- Telemetry export produces valid JSON for every room.
