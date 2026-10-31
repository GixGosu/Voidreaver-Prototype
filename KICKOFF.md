# Kickoff: building the Voidreaver prototype with Claude Code

## 1. Set up
1. Unzip this kit into an empty folder, e.g. `voidreaver-prototype/`.
2. Optional but recommended: `git init && git add -A && git commit -m "Prototype kit"` so every milestone can be rolled back.
3. Open a terminal in that folder and start Claude Code: `claude`
4. Check the crew is loaded: run `/agents` and confirm these six project agents appear:
   proto-architect, combat-engineer, level-builder, flight-engineer, feel-tuner, playtester.

## 2. Paste this as your first message

```
Read CLAUDE.md and docs/PROTOTYPE_SPEC.md. You are the Director.
Plan milestone M1 only, show me the plan in a few lines, then delegate it to the
proto-architect agent. When it reports back, run the playtester agent for a smoke test,
add a CHANGELOG.md entry, and stop so I can play the build. Tell me exactly what to try.
```

## 3. For each later milestone

```
M<n> feedback: <what felt good, what felt bad, paste telemetry JSON if you have it>.
Address the feedback, then run milestone M<n+1> the same way: delegate to the owning agents
(in parallel where files don't overlap), smoke test with playtester, tuning pass with feel-tuner
if it touches combat or flight, CHANGELOG entry, then stop for me to play.
```

## 4. Playing a build
Double-click `index.html` (Chrome or Firefox). F1 shows the debug overlay, backtick opens the tuning panel,
and "copy stats" exports telemetry to paste back into Claude Code.

## Crew at a glance
| Agent | Model | Builds |
| --- | --- | --- |
| Director (main session) | your default | Plans milestones, routes work, enforces scope |
| proto-architect | opus | Loop, input, iso renderer, camera, scenes, HUD, debug tools, code review |
| combat-engineer | sonnet | Player, shotgun, enemies, one-hit deaths, restart, cover, breach, combo |
| level-builder | sonnet | 5 rooms as ASCII maps, doors, scanner, upgrades, boarding flow |
| flight-engineer | sonnet | Zaxxon flight run with oversized gaps, hand-off to boarding |
| feel-tuner | sonnet | Tunes `src/config.js` toward 2–5 s punchy fights |
| playtester | sonnet | Smoke tests, map validation, checklists, telemetry analysis |

Change any `model:` line in `.claude/agents/*.md` to suit your plan and budget.
