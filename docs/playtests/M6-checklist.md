# M6 playtest checklist (feel pass, debug tools, telemetry)

Open `index.html`. Keys: F1 debug overlay, backtick (`) tuning panel, R restart, N (flight) next checkpoint, Digit1-5 jump to a room.
If anything looks broken, open the console (F12) and paste red errors back first.
Rate each item 1 (bad) to 5 (great).

1. **HUD at a glance.** In room 1, without reading docs: can you tell shells left, dash charges (and recharge), combo, room timer and deaths this room? Is anything too small, too far from the action, or hidden under the tuning panel?
   Rating: _/5   Notes:
2. **Grade banner.** Clear two rooms quickly and one slowly. Does the S/A/B/C grade appear long enough to read, and does it feel earned (time and combo)?
   Rating: _/5   Notes: grades seen =
3. **F1 overlay.** Toggle it in a boarding room and in flight. Do FPS, hitboxes, line-of-sight rays and enemy states help you judge a death? Any clutter or crash in either scene?
   Rating: _/5   Notes: fps in the busiest room =
4. **Tuning panel, live.** Open with backtick. Drag enemy.reactionDelay, player.speed and shotgun.spreadDeg while playing. Does each change show up on the next frame? Do keys typed in a number box leave the player alone? Does "Reset values" restore everything?
   Rating: _/5   Notes: values you ended up preferring =
5. **Copy config.** After changing 2-3 sliders press "Copy config" and paste it somewhere. Are your changes listed (yellow rows) and is the text usable to update `src/config.js`?
   Rating: _/5   Notes:
6. **Die 5 times in a row** in room 2 or 3. Does restart ever feel slow (target under 0.5 s)? Does the HUD deaths counter match?
   Rating: _/5   Notes:
7. **Room clear times.** Play each room as well as you can. Do most clear in 2-5 s of active fighting? Which rooms feel too long or too easy?
   Rating: _/5   Notes: room : seconds =
8. **Full run, flight + 5 rooms,** no debug keys. Is it completable, and how long did it take? Anything that felt unfair, unclear or boring?
   Rating: _/5   Notes: total time = , deaths =
9. **Copy stats.** After the full run open the panel and click "Copy stats". Does the status line say copied (or show the text to copy by hand)? Paste it into a text editor: does it look like JSON with one entry per room (flight + 5)?
   Rating: _/5   Notes:
10. **Frame rate.** With F1 on, play room 5 and the busiest flight section. Does it hold 60 fps?
    Rating: _/5   Notes: fps =

When done, paste back your notes **and the Copy stats JSON**. The playtester will write `M6-report.md` from it (per room: attempts, median clear time, deaths, top cause; rooms over 8 s or 6 attempts get flagged).
