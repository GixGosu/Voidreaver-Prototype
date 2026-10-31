# Sound effects sourcing sheet
Date: 2026-10-31   Brief: Short, punchy, retrigger-safe SFX for Voidreaver's combat, environment, flight and UI events, with a lethal-sounding shotgun as the top priority.

Scope notes on method: I fetched each item page below with a web fetch tool and read the license, author, length and format from the page itself. I cannot listen to audio, so "what it is" comes from page text, tags and descriptions, not from my ears. The human must audition everything. Freesound pages were readable; OpenGameArt returned HTTP 403 again (see Unverified). Freesound throttled me (HTTP 429) on several searches, so some categories (UI chimes, laser one-shots, kick/body-thump) are covered by packs rather than single Freesound items. Freesound durations on search listings were unreliable, so every duration below comes from the item page. Freesound is per-file licensing, so every Freesound entry here was checked on its own page and is CC0 unless stated.

## Questions this sheet answers
- Which shotgun blast, pump/rack and pistol samples carry a clean per-item license and can be layered into something that reads as lethal in a small room?
- Which packs (free CC0 first, then cheap paid) cover the rest of the event list in one download: impacts, sci-fi weapons, flight sounds, UI?
- Which environment sounds (hull breach, shutter slam, crate, metal deck footsteps, ship hum) exist as verified CC0 single items?
- How did comparable games (Hotline Miami, Doom 2016, Nuclear Throne, Hardspace: Shipbreaker) get weight, lethality and a sense of sealed space from sound, and what should Voidreaver copy?

## Usable assets

### (A) Core combat

#### Shotgun - Fire.wav — AbuNijmeh / Freesound
Source: https://freesound.org/people/AbuNijmeh/sounds/318973/
What it is: Shotgun blast built from another Freesound recording; the uploader added a sound before the blast and reverb after it. 1.288 s, WAV, stereo, 44.1 kHz.
License: Creative Commons 0 ("You can copy, modify, distribute and perform the sound, even for commercial purposes") | Attribution: none required (credit "AbuNijmeh" as courtesy).
Fits: Shotgun blast, the main candidate. Tag list includes "pump".
Caveat: It is a derivative edit with baked-in reverb; a roomy tail will smear at the 0.45 s pump delay. Probably needs a shorter fade on the tail. 1.3 s is long for a one-shot that retriggers.

#### Shotgun hit — lumikon / Freesound
Source: https://freesound.org/people/lumikon/sounds/564483/
What it is: 0.488 s WAV, 16-bit, stereo, 48 kHz. Part of lumikon's "Shotgun SFX" pack made entirely from non-weapon recordings. Page calls it a hit, not a clear gunshot.
License: Creative Commons 0 | Attribution: none required.
Fits: Impact/transient layer on top of a blast, or enemy hit confirmation. Sits at the right length for a punchy layer.
Caveat: Non-weapon source, so it may sound synthetic or thin alone. Treat as a layer. The sibling "Shotgun reload sfx" (https://freesound.org/people/lumikon/sounds/564482/) is from the same pack but I did not fetch its page, so its license is Unverified here.

#### Shotgun 02.wav — Clueless79 / Freesound
Source: https://freesound.org/people/Clueless79/sounds/544676/
What it is: "A shotgun sound with some echo." 4.184 s, WAV, stereo, 44.1 kHz. Tags: Boom, Gun, Loud, Shot, Shotgun.
License: Creative Commons 0 | Attribution: none required.
Fits: Source for the body and tail layer of a blast.
Caveat: 4.2 s with echo; must be trimmed (human task) to about 0.5-0.8 s or it will pile up under 20 enemies.

#### Shotgun Rack Sample.wav — Krovi / Freesound
Source: https://freesound.org/people/Krovi/sounds/613801/
What it is: "Real pump-action shotgun racking sound." 0.845 s, WAV, mono, 48 kHz.
License: Creative Commons 0 | Attribution: none required.
Fits: Pump/rack played at the end of the 0.45 s pump delay. Length fits the delay window closely.
Caveat: 0.845 s exceeds the 0.45 s cooldown, so the human should trim the lead-in or play it from the shot. Mono is a plus for file size.

#### Pump Action Shotgun Cycle — Zott820 / Freesound
Source: https://freesound.org/people/Zott820/sounds/370344/
What it is: Cycling a pump action. 11.141 s, WAV, stereo, 48 kHz, 16-bit. Page says it is generic enough to use for a pistol action cycle.
License: Creative Commons 0 (attribution appreciated, not required) | Attribution: none required.
Fits: Alternate pump/rack source; also usable as shell-refill or reload.
Caveat: 11 s of source, so a lot of trimming. Recorded on a Blue Yeti mic, so likely less crisp than Krovi.

#### Pistol Shot — LeMudCrab / Freesound
Source: https://freesound.org/people/LeMudCrab/sounds/163456/
What it is: Recording of a 1911 Colt .45, "used in a flash game as SFX." 0.460 s, WAV, mono, 44.1 kHz.
License: Creative Commons 0 | Attribution: none required.
Fits: Pistol shot; also a rifle-burst building block when pitched down and stacked three times.
Caveat: Real-gun recording, so period-realistic rather than sci-fi. Plays well under 0.5 s.

#### handgun-one-shot.wav — DeltaCode (Joseph King) / Freesound
Source: https://freesound.org/people/DeltaCode/sounds/668348/
What it is: "Computer-generated handgun/pistol discharge one-shot." 0.455 s, WAV, mono, 44.1 kHz.
License: Creative Commons 0 | Attribution: none required.
Fits: Gunner rifle burst (repeat with pitch jitter) or pistol.
Caveat: Page says computer-generated (not AI music; I read this as synthesized). If the studio standard is no AI-assisted audio, confirm with the author what "computer-generated" means.

#### Gun (Pistol) Shot — synth2 / Freesound
Source: https://freesound.org/people/synth2/sounds/844540/
What it is: 0.745 s, MP3 195 kbps, stereo, 44.1 kHz.
License: Page text: "You can copy, modify, distribute and perform the sound, even for commercial purposes" and no permission needed (the page's license badge name was not shown in the fetch; the wording is CC0's) | Attribution: none required by that wording. Treat as Likely CC0, confirm the badge.
Fits: Pistol alternate.
Caveat: MP3 source, so it will degrade on re-encode. Prefer LeMudCrab.

#### 9mmFiringEmptyChamber.wav — shelbyshark / Freesound
Source: https://freesound.org/people/shelbyshark/sounds/508247/
What it is: An empty 9mm being fired, a "dramatic click." 17.815 s, WAV, stereo, 44.1 kHz. Tags: empty, chamber, click.
License: Creative Commons 0 | Attribution: none required.
Fits: Empty weapon click.
Caveat: 17.8 s source with a long description; the click itself is likely a fraction of that. Needs cutting. Another candidate from the same search (klangfabrik, https://freesound.org/people/klangfabrik/sounds/232867/) was seen in a listing only, license Unverified.

#### Impact Sounds (130 files) — Kenney
Source: https://kenney.nl/assets/impact-sounds
What it is: 130 files tagged impact and foley, version 1.0, released 2019. Format and per-file list not stated on the page.
License: Creative Commons CC0 (page links the CC0 1.0 deed) | Attribution: none required.
Fits: Kick on enemy, kick on door, thrown weapon stun impact, body hitting wall, crate hits, bullets on metal. The widest single CC0 download for group A and B.
Caveat: Page has no description or sound list, so I cannot confirm there is a heavy metal clang or splat; the human must audition. Impact foley is typically short, which is good.

#### Hard impact hit.wav — npeng / Freesound
Source: https://freesound.org/people/npeng/sounds/482267/
What it is: "Large impacts against pillow. Can be used for punches, hits, or falls." 9.054 s, WAV, mono, 48 kHz.
License: Creative Commons 0 | Attribution: none required.
Fits: Body-hits-wall thud, kick-on-enemy low end.
Caveat: Soft-source (pillow), so it is a thump rather than a crack; pair with Kenney impacts. 9 s of source with several hits to cut apart.

#### Interface Sounds (100 files) — Kenney
Source: https://kenney.nl/assets/interface-sounds
What it is: 100 files tagged interface, click, button; version 1.0, 2020. Format not stated.
License: Creative Commons CC0 | Attribution: none required.
Fits: Menu confirm/cancel, upgrade pick, combo chain tick, door-scanner blip (a short bleep).
Caveat: Page has no sound list, so grade stingers (S/A/B/C) and chimes are not confirmed; audition.

### (B) Environment

#### Décompression-1.wav — davidou / Freesound
Source: https://freesound.org/people/davidou/sounds/88494/
What it is: "Air tank decompression." 0.441 s, WAV, mono, 44.1 kHz. Tags: air, gas, decompression, tank.
License: Creative Commons 0 | Attribution: none required.
Fits: Transient/burst layer for the hull breach hit (the first 0.4 s).
Caveat: Only 0.44 s, so it is the opening pop, not the 2 s roar. A sibling "Décompression.wav" (https://freesound.org/people/davidou/sounds/88495/) appeared in the search; I did not fetch it, so license Unverified.

#### Dull Decompression Punch Impact Explodes 96kHz — qubodup / Freesound
Source: https://freesound.org/people/qubodup/sounds/71274/
What it is: A pre-mixed bread dough package being opened (the page says so), short punchy burst. 0.756 s, FLAC, stereo, 96 kHz / 24-bit.
License: Creative Commons 0; also "released into the public domain or released under cc0 and wtfpl - your choice" | Attribution: none required.
Fits: Breach pop, crate burst, or a low layer for the shotgun transient.
Caveat: FLAC at 96 kHz; the human must down-convert. Clever lethality layer, but the source is bread dough, so test whether it sounds like air release.

#### Door Metal Slam 01 — jemaillard / Freesound
Source: https://freesound.org/people/jemaillard/sounds/724095/
What it is: "Short sound of a metal door closed." 1.237 s, WAV, stereo, 44.1 kHz. Tags: door, closing, impact, metal, slam.
License: Creative Commons 0 | Attribution: none required.
Fits: Emergency shutter slamming shut, sealed door lock thunk, door kick.
Caveat: Real door; may read as domestic-industrial rather than spaceship. Layer with a Kenney sci-fi sound for the lock.

#### Metal Door Slamming 1.wav — rdneubauer / Freesound
Source: https://freesound.org/people/rdneubauer/sounds/93781/
What it is: Metal fireplace door slamming, three microphones (3000B, SM57, SM58). 15.444 s, WAV, stereo, 44.1 kHz.
License: Creative Commons 0 | Attribution: none required.
Fits: Shutter slam source with multiple slams to choose from.
Caveat: 15 s source; metal fireplace door is small, so pitch down for a bulkhead.

#### Crate Break 4.wav — kevinkace / Freesound
Source: https://freesound.org/people/kevinkace/sounds/66780/
What it is: "Breaking open a wooden crate." 1.200 s, WAV, 16-bit, mono, 44.1 kHz.
License: Creative Commons 0 | Attribution: none required.
Fits: Final crate break (third hit).
Caveat: Wood, not sci-fi cargo. Fine for placeholder crates.

#### wooden-crate-break1.wav — DeltaCode (Joseph King) / Freesound
Source: https://freesound.org/people/DeltaCode/sounds/667653/
What it is: "Wooden Crate Break (ver. 1)." 0.660 s, WAV, mono, 44.1 kHz. Tags: break, crate, impact, wood.
License: Creative Commons 0 | Attribution: none required.
Fits: Crate break (short, retrigger-safe). The same author has sibling files (break2 /667652, impact1 /667655, impact2 /667654) that I saw in search only, so their licenses are Unverified until opened. If they match, they cover the 2-3 hit crate sequence.
Caveat: See above.

#### Footsteps on Metal — IENBA / Freesound
Source: https://freesound.org/people/IENBA/sounds/698697/
What it is: "Variations of footsteps recorded on metal stairs," cleaned for game assets with tails emphasized. 10.305 s, WAV, 16-bit, stereo, 44.1 kHz. Page says it is not a natural walk recording; made as individual game assets.
License: Creative Commons 0 | Attribution: none required.
Fits: Footsteps on metal deck; individual steps are meant to be cut apart.
Caveat: Stairs, not flat deck; the page admits tails are emphasized, so trim for a fast walk speed.

#### snd_footsteps_metal_floor_inside.wav — gristi / Freesound
Source: https://freesound.org/people/gristi/sounds/562195/
What it is: "Tough, reverberating footsteps, as if boots striking a metallic floor in a building." 3.103 s, WAV, stereo, 48 kHz.
License: Creative Commons 0 | Attribution: none required.
Fits: Footsteps on metal deck; industrial tags.
Caveat: Reverberating, so heavy tails; will mask other sounds if played per step.

#### ambient spacecraft hum — AlaskaRobotics / Freesound
Source: https://freesound.org/people/AlaskaRobotics/sounds/221570/
What it is: Looping, bass-heavy ambient hum with subtle layers "to add tension to a dramatic spaceship scene." 17.818 s, WAV, stereo, 48 kHz.
License: Creative Commons 0 | Attribution: none required.
Fits: Low ship ambience hum bed under combat and room-clear.
Caveat: Stereo WAV 17.8 s is about 3 MB uncompressed, and bass-heavy content will fight the shotgun low end; high-pass it.

#### Retro 1930 Space Ship Engine Loop 2 — qubodup / Freesound
Source: https://freesound.org/people/qubodup/sounds/861970/
What it is: A seamless loop of a vintage-style spaceship engine idling, built from a CC0 fan recording by SieuAmThanh using MubLoop. 5.110 s, WAV, mono, 48 kHz. Tags include gapless, seamless, loop.
License: Creative Commons 0 | Attribution: none required.
Fits: Flight run engine loop; also usable as a quiet ship hum.
Caveat: "Retro 1930s" character, so a toy-like fan sound. Mono, 5 s, small file. Loop 1 (https://freesound.org/people/qubodup/sounds/861969/) is a sibling not fetched, license Unverified.

#### Soft Subtle Sci-Fi Hovercraft Engine Humm — qubodup / Freesound
Source: https://freesound.org/people/qubodup/sounds/861960/
What it is: A 2.4 s looping hover-vehicle hum trimmed from a CC0 aircraft sample (Modern Rogue's Dry Ice pack). 2.392 s, FLAC, mono, 48 kHz, 37.7 KB. The author says the loop point is a manual cut without fades.
License: Creative Commons 0 | Attribution: none required.
Fits: Ambience under sealed rooms or engine bed for flight. Tiny.
Caveat: Author admits a hand-cut loop point; test the seam. FLAC must be converted.

### (C) Flight run

#### Sci-fi Sounds (70 files) — Kenney
Source: https://kenney.nl/assets/sci-fi-sounds
What it is: 70 files, tags sci-fi, space, engine; version 1.0, 2020. Format and list not stated on the page.
License: Creative Commons CC0 | Attribution: none required.
Fits: Laser shot, turret fire, force-field hum/pass, engine loop; candidate for the scanner blip and upgrade pick.
Caveat: No sound list; the "engine" tag suggests engine sounds but I cannot confirm loops. Audition for an actual force-field sound.

#### Digital Audio (60 files) — Kenney
Source: https://kenney.nl/assets/digital-audio
What it is: 60 files, tags space and laser; version 1.0, released 2012. Format not stated.
License: Creative Commons CC0 | Attribution: none required.
Fits: Laser shots, pickup bleeps, checkpoint chime candidates.
Caveat: Likely retro/arcade-bleepy, which matches the WebAudio blip tone more than a new sound. Low production value is not confirmed or denied by the page.

#### Sci-Fi Weapon Shots SFX [Free/CC0] — lentikula / itch.io
Source: https://lentikula.itch.io/sci-fi-weapon-shots-sfx-freecc0
What it is: 15 sounds (5 laser rifle, 5 laser pistol, 5 laser beam), 48 kHz / 24-bit WAV, 13 MB .7z download. Name your own price (free).
License: Page text: "I release this pack under a CC0 license, so you can use it in whatever project without attribution" | Attribution: none required (optional credit "lentikula").
Fits: Flight laser shots, gunner rifle-burst alternate (sci-fi), turret fire.
Caveat: 24-bit/48 kHz needs down-conversion. Five variants per type helps randomisation.

#### Deep Boom — Za-Games / Freesound
Source: https://freesound.org/people/Za-Games/sounds/539968/
What it is: "A low, sustained explosion sound." 3.186 s, WAV, mono, 16-bit, 22.05 kHz. Tags: boom, explosion, rumble.
License: Creative Commons 0 | Attribution: none required.
Fits: Ship explosion in flight; low layer for breach.
Caveat: 22.05 kHz limits highs, so it will sound dull; fine for a boom layer.

#### Large explosion — SamsterBirdies / Freesound
Source: https://freesound.org/people/SamsterBirdies/sounds/592000/
What it is: Deep large explosion "for big bombs or cannons," made from a firecracker, pitched down, layered and lengthened. 11.317 s, FLAC, stereo, 44.1 kHz.
License: Creative Commons 0 | Attribution: none required.
Fits: Ship explosion.
Caveat: 11 s is far too long as is; trim to about 2 s with a fade. Small gain from the beginning transient.

### (D) UI
Covered by Kenney's Interface Sounds (above) and Digital Audio. No separate item verified for grade stingers or checkpoint chime; I did not find a verified single stinger item in this pass.

### Packs and paid options

#### Sonniss GameAudioGDC bundles — Sonniss (aggregate of vendors)
Source: https://sonniss.com/gameaudiogdc/ and license https://sonniss.com/gdc-bundle-license/
What it is: Free yearly bundles, 2015 to 2024 listed (9.0 GB to 48.2 GB each); 2026 has its own page that I did not fetch. Professional libraries (explosions, weapons, doors, ambiences) from many vendors.
License: Page states "royalty free and commercially usable" and "No attribution is required." License text: may use and modify in finished projects "shared, published and sold in the normal way"; may not sell or redistribute sounds as sound effects; may not modify with intent to claim authorship; AI/ML training is prohibited | Attribution: none required.
Fits: The best source of professional shotgun, breach, door and ambience layers if the team accepts a huge download and a browse through thousands of files.
Caveat: Not CC0 and not redistributable as raw sounds. Shipping the game as a folder with the files inside is use "in a finished project"; posting the raw audio folder separately is not allowed. Bundle size is 10-50 GB, so the human picks a handful of files. I could not confirm a per-file list.

#### Sci-Fi Guns — Gravity Sound / itch.io (paid)
Source: https://gravity-sound.itch.io/sci-fi-guns
What it is: 180 sound effects, WAV 44.1 kHz / 16-bit. Page contents: rifle, pistol, shotgun, grenade, plus turret and charging effects.
License: **Unverified.** The page states no license; only "No generative AI was used." | Attribution: unknown.
Fits: Sci-fi shotgun, pistol, rifle burst, flight turret fire in one pack. Price band: $9.99 list, $4.99 minimum at the 50% sale I saw (bundle price shown separately, $500 for 295 assets).
Caveat: Get terms in writing before shipping. The sale price is promotional.

#### Sci-Fi Weapons One — Sound Works 12 / itch.io (paid)
Source: https://sound-works-12.itch.io/sci-fi-weapons-one
What it is: 231 sounds (125 weapon, 106 Source Kit), 44.1 kHz/16-bit and 96 kHz/24-bit. Shotgun contents: Shotgun Hit (11), Shotgun Shot (14), Shotgun Reload (2); Source Kit: Shotgun Kick (11), Shotgun Shot (13), Shotgun Reload (10).
License: **Unverified.** No license on the page; "No generative AI was used." | Attribution: unknown.
Fits: The deepest shotgun content seen, including separate hit and reload sets and source kits for layering. Price band: listed $20, $4.00 minimum at the 80% sale.
Caveat: Get terms before use. Source Kit stems are what a layered shotgun needs.

#### Sci-Fi Weapon Sound FX — MGW Sound Design / itch.io (paid)
Source: https://mgw-sound-design.itch.io/sci-fi-weapon-sound-fx
What it is: Categories Grenade 10, Gun 44, Laser 44, Pistol 44, Rifle 44, Shotgun 45, Shell 1; each has Full, Mono, Short, Short Mono, Reload and Shutter sets. 38 MB zip.
License: **Unverified.** No license on the page; "No generative AI was used." | Attribution: unknown.
Fits: Mono and Short variants are designed for small files; one Shell sound could cover shell pickup. Price band: listed $10, $2.00 minimum at the 80% sale.
Caveat: Terms unknown. The Short Mono sets suit a 20-simultaneous-voices budget.

#### Ultimate Sci-Fi Game Sound Pack — tekisolves / itch.io (paid)
Source: https://tekisolves.itch.io/ultimate-sci-fi-game-sound-pack-ambience-alien-creatures-futuristic-fx
What it is: 47 sounds described as "royalty-free CC0 sounds": alien calls, space station ambiences, weapon blasts, robotic machinery, interface beeps. Single 311 MB zip; formats not listed.
License: Page says "royalty-free CC0 sounds" (no license text beyond that) | Attribution: none required if the CC0 claim holds.
Fits: Space station ambience and machinery for sealed-room bed.
Caveat: 19 EUR minimum; 311 MB for 47 files means very long ambiences, bad for file size over file://. The CC0 claim is a store description only.

#### Superior Sound FX: Lasers and Explosions — SoireeGames / itch.io
Source: https://soireegames.itch.io/superior-sound-fx-vol-i
What it is: 26 sounds (explosions, gunshots, laser blasts, assorted sci-fi), WAV 44.1 kHz/16-bit, 6.2 MB. Name your own price.
License: Page text: "These sounds are free to use in all projects with no cost." No named license | Attribution: `Soiree Games (soiree.info)` (page asks for it).
Fits: Ship explosion, flight lasers, shotgun alternate.
Caveat: **Page tags it "AI Assisted"**; same decision as the music sheet for the human. Informal terms.

### Unverified candidates (do not ship without checking)
- **OpenGameArt** (all fetches HTTP 403): "63 digital sound effects lasers phasers space etc" https://opengameart.org/content/63-digital-sound-effects-lasers-phasers-space-etc (appears to be Kenney's Digital Audio, license unread there); "Sci-Fi Sound Effects Library" https://opengameart.org/content/sci-fi-sound-effects-library (search snippet said CC BY 3.0, unverified).
- **Freesound items seen in search listings but not opened**: Marregheriti "shotgun.wav" https://freesound.org/people/Marregheriti/sounds/266105/; AbuNijmeh "Shotgun - Pump.wav" https://freesound.org/people/AbuNijmeh/sounds/318972/; DeltaCode crate siblings; IENBA second footstep set /834029; gristi and Kodack "Wet Metal Footsteps" /253735; qubodup engine loop 1; Hugofski "massive explosion" /177556; unfa "Big Far Explosion" /156500. One search snippet also said some shotgun items on Freesound are CC BY (Shotgun Shoot and Reload by PieTheAnimator45, ermfilm "Shotgun_RELOAD") and not CC0; do not use those without attribution.
- **Sci-Fi Arcade Sound Effects** (Ghostly Guru Studios, $2 minimum) https://ghostlygurustudios.itch.io/sci-fiarcade-sound-effects and **Sci-Fi Weapons 3** (rawambience, $11.99) https://rawambience.itch.io/sci-fi-weapons-3-sound-effects-pack: seen in search results only, not fetched.
- **Sci-fi retro pack** (towball) https://towball.itch.io/retro-sci-fi: a search snippet said CC BY 4.0; **Sci-Fi Space Sound Effects** (mattflat) https://mattflat.itch.io/sci-fi-space-sound-effects-asset-pack: snippet said CC BY-ND 3.0, which forbids edits. Neither fetched; avoid.
- **Sonniss GDC 2026** page not fetched. A search report says it draws on 17 vendors; sizes unknown.

## Reference material (study only)

### Doom (2016) weapon audio — Chad Mossholder, Ben Carney, Chris Hite (id Software); Mick Gordon (music)
Source: https://www.adsrsounds.com/news/the-sound-design-of-doom-exclusive-qa/
Shows: Per the Q&A, audio director Chris Hite decided early that guns should lead the mix, and weapon sounds were never lowered for other audio, including voice-over. Mossholder built the armor pickup from "large metal impact sounds, that I slightly distorted and layered." For the Gauss Rifle he started from .50 cal sniper recordings and blended energy and mechanical sounds, with a brief initial impulse that cuts to silence just before the main blast so it feels like it pulls air out of the room.
Lesson: Weapon audio sits at the top of the mix; give the shotgun priority and duck everything else for a few frames. A tiny silence before the blast is a known trick; with Voidreaver's retriggers it must stay within a few milliseconds.

### Nuclear Throne gun feel — Vlambeer (SFX by Joonas Turner per Wikipedia)
Source: https://killscreen.com/nuclear-throne-is-hotter-than-a-smoking-gun
Shows: The article credits an "entire recipe of tiny effects stacked up" rather than one component, with each weapon having a distinct cue (the revolver has "an oversized boom"), oversized bullets and corpses flying.
Lesson: Lethal reads from stacked, small effects; the shotgun should have a signature sound distinct from the pistol so players hear which enemy shot at them. Companion talk: Jan Willem Nijman, "The Art of Screenshake" (I could not fetch a transcript; the page I tried did not contain it).

### Hotline Miami (2012) audio flow — Dennaton Games
Source: https://en.wikipedia.org/wiki/Hotline_Miami
Shows: A single attack can kill player or enemy and the stage restarts quickly. The upbeat soundtrack raises focus; at level end it gives way to ambient sound as the player walks out past the bodies. The page does not discuss SFX design.
Lesson: Sound design for instant restarts means no long death tail; the clear moment uses silence and ambience as the reward, which matches Voidreaver's door unseal. This is a music-side lesson; the page contains nothing specific about gun sounds.

### "Breaking the Silence: The Sound of Hardspace: Shipbreaker" — Ben McCullough, Blackbird Interactive (GDC 2021)
Source: https://www.gdcvault.com/play/1027227/Breaking-the-Silence-The-Sound
Shows: The session summary says the team started from the premise that sound cannot travel through a vacuum and set strict rules for how sound transfers, tied to world physics, implemented in Wwise and Pure Data. Page does not describe decompression itself.
Lesson: The closest verified reference for sealed compartment vs vacuum audio. For a hull breach, a simple model is: sounds inside the room continue, a breach adds a roar, and when the room empties the high end drops out. I could not verify Hardspace's specifics beyond the abstract.

### Dead Space sound design — Don Veca and team (Visceral)
Source: https://designingsound.org/2009/06/all-about-the-sound-of-dead-space/
Shows: The team recorded its own source audio, used Foley "to a lesser extent," ran everything through "boutique audio processing plugins," said they "really didn't use much in the way of sound libraries," and used analog synths for futuristic sounds. The page says nothing about decompression or vacuum.
Lesson: Custom-processed recordings, not library one-shots, make a ship sound like a specific place. For Voidreaver this means the team may want to pitch/layer free library samples so they do not sound like stock. I found no verified Dead Space decompression breakdown in this pass.

## Direction notes
Notes marked (engineering) are my own judgment, not read from a page.

- **Layer the shotgun: transient + body + tail** (engineering, informed by Doom and Nuclear Throne above). Combine a short hit (lumikon "Shotgun hit", 0.49 s) on top of a blast body (AbuNijmeh "Shotgun - Fire" or a trimmed Clueless79) and a short air/decompression pop (davidou, 0.44 s) played together, with the rack (Krovi) triggered at the end of the 0.45 s pump delay. Total about 0.5-0.7 s of audio. Risk: three BufferSources per shot means 60 sources in a 20-enemy melee; render the layered result once to a single file offline (human task) or limit layers to two. A single sample is cheaper but sounds thinner.
- **Randomise pitch and volume per trigger** (engineering). Set `playbackRate` within roughly +/-5 to 8 percent and gain within +/-2 dB so 20 simultaneous shots do not phase together or sound like a machine gun of identical samples. For a gunner's burst, pitch each bullet differently. Risk: pitch shift changes length and tone; keep tails short so a lowered rate does not run long.
- **Voice limiting for 20 enemies** (engineering). Cap simultaneous voices per sound category (for example 4 gunshots, 3 footsteps, 2 impacts), drop or steal the quietest voice, and never play a footstep for enemies off-screen. Risk: aggressive caps make distant fights silent; distance-based gain is cheaper than stopping voices. This is a code change for proto-architect.
- **Keep the SFX budget small for file://** (engineering). Mono 44.1 kHz WAV is about 5 MB per minute; 40 trimmed one-shots averaging 0.5 s are about 3 MB as WAV and under 1 MB as OGG. Avoid shipping the 17.8 s AlaskaRobotics hum stereo; trim to a seamless 4-6 s mono loop. Risk: the Kenney packs have 60-130 files each, so the human should pick 10-20 and not copy whole packs into the repo.
- **Treat music and ambience as separate buses with ducking** (from Doom and Hotline Miami above). Duck music and the hum for 80-150 ms after each shotgun blast so the weapon reads at the top of the mix. Risk: pumping music against 20 enemies' shots can sound seasick; limit ducking to the player's own blast and to breach.
- **file:// fetch caveat** (see the proto-architect request in the music sheet, not repeated here). Chrome blocks `fetch`/XHR on `file://`, so `decodeAudioData` on loaded files will not work from a double-clicked `index.html` without the embedding approach already raised. SFX are small enough that base64-embedded data in a classic script is realistic (about 33% larger), unlike the music.
- **Hull breach as a synthesized-plus-sampled hybrid** (engineering). A trimmed davidou decompression pop plus a filtered noise sweep generated in WebAudio for the 2 s pull, with a low-pass closing as the room empties (Hardspace idea). Risk: noise generation is code work for proto-architect; a sampled roar from Sonniss would avoid code at the cost of size.
