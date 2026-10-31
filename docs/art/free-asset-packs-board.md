# Free asset packs board
Date: 2026-10-31   Brief: Free packs that could get the prototype toward the lo-fi 1979 "used future" Alien: Isolation / Dead Space industrial look, so placeholder shapes can be swapped for real-looking placeholder art.

## Verification status (read first)
- Every pack below had its page fetched and its license line read. License text is quoted as the page showed it. Several pages show only a short label (for example "Creative Commons CC0") and no full legal text; that is noted.
- My fetch tool returns text only. I did not see any preview image, so every "fit" note is an inference from titles, tags and descriptions, not from looking at the art. Someone should eyeball the previews before committing.
- All OpenGameArt pages returned HTTP 403 to my fetcher, so no OpenGameArt pack is listed (see "Dropped" at the bottom).
- Studies and prototyping only until the human confirms the license on the download page itself. Always keep a credit file even for CC0.

## Project constraint
The prototype is plain Canvas 2D with no runtime 3D. 3D packs are NOT loaded in the game. They would be rendered offline (Blender or any viewer) to isometric PNG sprites at a fixed camera angle, then drawn as images. This needs an image-loading step the current "colored shapes only" rule does not allow, so adopting any pack needs a human scope decision first (see recommendation).

## Questions this board answers
- Which free, clearly licensed packs exist for sci-fi ship interiors, props and ships?
- Which are isometric-ready or top-down in 2D, and which 3D ones suit offline render-to-sprite?
- Which of them can plausibly stand in for a lo-fi industrial look rather than a bright cartoon one?

## 2D packs

### Kenney Sci-Fi RTS — Kenney
Source: https://kenney.nl/assets/sci-fi-rts
License: "Creative Commons CC0" (page links the CC0 deed; no full text shown). CC0 confirmed by label only.
Contains: 120 files, tagged tile, map, building, rts, future, sci-fi. Page does not list the files.
View: not stated on the page. A search summary said it is aimed at strategy units and terrain and lacks space-station tiles (not verified on a page).
Fit: Clean, bright Kenney style; likely too toy-like for Alien: Isolation grit but usable for unit and cover silhouettes. Recolor needed.

### Kenney Isometric Miniature Dungeon — Kenney
Source: https://kenney.nl/assets/isometric-miniature-dungeon
License: "Creative Commons CC0" (label only, no full text).
Contains: 70 files, version 1.0, 2019, tags isometric, dungeon. No file list on the page. Not sci-fi.
View: isometric (tag and series name).
Fit: Not a ship set. Value is as a reference for wall, floor, door and crate tile proportions in iso, to test the wall-fade and tile-size pipeline before sci-fi art is chosen.

### Kenney Isometric Blocks — Kenney
Source: https://kenney.nl/assets/isometric-blocks
License: "Creative Commons CC0" (label only, no full text).
Contains: 130 files, tags isometric, block; version 1.0, 2016. No description beyond previews.
View: isometric.
Fit: Generic blocks, no sci-fi content. Recolored in dark industrial tones they could act as stand-in walls and floors; no lo-fi detail.

### Kenney Isometric Assets bundle — Kenney
Source: https://kenney.itch.io/kenney-isometric-assets
License: "Creative Commons Zero v1.0 Universal"
Contains: 60 dungeon tiles, 45 prototype tiles, 30 library tiles, 50 farm building tiles, 16 overworld tiles (still in production). No sci-fi.
View: isometric.
Fit: Same value as above, bundled. No ship look.

### Tileset - Sci-fi 03 — Sloppy Joe Studios
Source: https://sloppyjoestudios.itch.io/scifi-03
License: "Creative Commons Zero v1.0 Universal". The creator also asks: "please credit me with "Sloppy Joe Studios"". Price: $1.00 USD or more (not free).
Contains: one 768x768 sheet of 48x48 pixel tiles, tagged 2D, Pixel Art, Sci-fi, Space, Tileset. Text does not describe the tiles. Listed with "No generative AI was used."
View: not stated; likely top-down or side. Not isometric-ready.
Fit: Pixel-art space interior, but it costs $1 and its view is unconfirmed. Treat as a lead.

### Sci-Fi Interior (32x32) — Catter.pxl
Source: https://catterpxl.itch.io/sci-fi-exterior-32x32 (the page I fetched; title on the page is "Sci-Fi Interior (32x32)")
License: Free version: "This asset pack can only be used for non-commercial projects." Licensed version: "This asset pack can be used in both non-commercial and commercial projects." Full version is "$1 USD or more".
Contains: floor and wall tilesets, character designs, decorative accessories, a vent tileset with crawling animation, bridge tiles with pillar variants. 32x32 pixel art for a spaceship interior.
View: top-down (2D).
Fit: The closest content match to ship interiors (walls, floors, vents, characters), but top-down, not iso, and the free tier is non-commercial. Good for a look test only.

### Free Sci-Fi TileSet Space station — Aske4
Source: https://aske4.itch.io/free-space-station
License: UNCLEAR. No formal license on the page. Only a comment by the author: "You can use it for commerce projects". Price: name your own price.
Contains: one 9.8 kB download, "32x32 Sci-Fi TileSet for Space Station".
View: top-down.
Fit: Tiny and top-down; license is a comment, not a license. Low priority.

### Generic Pixel Dropship — Uncl3Pixel
Source: https://uncl3pixel.itch.io/generic-pixel-dropship
License: custom, no named license. Page says: "This is Free content, you are free to use it in any of your projects." and "Not for resale or redistribution without use in another project." Name your own price.
Contains: one pixel-art dropship with black outlines, basic weapons and equipment, and a coloured example (74 kB).
View: isometric-style pixel art, "designed for Lancer but usable in any isometric-ish game".
Fit: A single iso ship sprite; a stand-in for a flight-run craft or boarding shuttle. Not interior art.

## 3D packs (for offline render-to-isometric-sprite)

### Space Station Kit — Kenney
Source: https://kenney-assets.itch.io/space-station-kit (also https://kenney.nl/assets/space-station-kit)
License: "CC0 1.0 Universal." Page says use in any project including commercial, attribution optional.
Contains: over 80 models for space stations and ships (kenney.nl lists 90 files, tags space, station, sci-fi, interior). OBJ, FBX, glTF.
Render-to-sprite: Yes, strongly. Modular kit, clean low-poly, easy to render at fixed iso angle in Blender.
Fit: Interior-themed and modular, the best direct match for walls, corridors and doors. Kenney's palette is likely cleaner than lo-fi 1979 (inference); needs a dark, worn re-texture or lighting pass.

### Space Kit — Kenney
Source: https://kenney-assets.itch.io/space-kit
License: "CC0 1.0 Universal"
Contains: over 150 low-poly models: modular parts for spaceports and structures, ships, a monorail, turrets, characters, weapons. OBJ, FBX, DAE, STL, glTF. (kenney.nl lists 150 files, tags planet, ship, space.)
Render-to-sprite: Yes. Characters and ships are low-poly and cheap to render. A search summary said the pack also ships isometric renders; the kenney.nl page I fetched does not mention this, so unverified.
Fit: Good for flight-run ships and enemy/player stand-ins; less interior-specific.

### Modular Sci-Fi MegaKit — Quaternius
Source: https://quaternius.itch.io/modular-sci-fi-megakit
License: "Creative Commons Zero v1.0 Universal". Free tier is "Standard" (46 MB, 190 assets), name your own price. Pro ($9.99+, 230+ models) and Source ($14.99+, 270+ models) are paid.
Contains: over 270 grid-fitting modular environment pieces: aliens, props, columns, doors, floors, walls. FBX, OBJ, glTF.
Render-to-sprite: Yes. Grid modules map directly to the ASCII room tiles.
Fit: The strongest match for ship-interior kit parts and the grid-based room data. Detail level and material style are unseen; check whether the Standard tier covers walls, floors and doors.

### Ultimate Space Kit — Quaternius
Source: https://quaternius.com/packs/ultimatespacekit.html
License: "CC0" (label linked to the CC0 dedication; no full text shown).
Contains: 92 models, animated and textured: animated characters, enemies, vegetation, planets. Released March 2023. FBX, OBJ, Blend, glTF.
Render-to-sprite: Yes; animated characters could be rendered into sprite frames for a player and enemy stand-in.
Fit: Character-focused starter set; stylized rather than industrial. Useful for actors, not for the environment.

### LowPoly Spaceships — Quaternius
Source: https://quaternius.itch.io/lowpoly-spaceships
License: "CC0 License", linked to the Creative Commons Zero 1.0 deed. Name your price.
Contains: one archive, "Spaceship Pack - Jan 2018.zip" (852 kB). Model list not on the page. FBX, OBJ, Blend. Page notes a newer spaceship kit on the author's site (not fetched).
Render-to-sprite: Yes. Simple ships suit the flight run.
Fit: Flight-run craft and obstacles. Likely stylized low-poly rather than gritty (inference).

## Recommendation
- **2D pick to try first: Kenney Isometric Miniature Dungeon (CC0).** It is the only fully free, clearly isometric tile pack I found with a license I can cite. It will not look like a spaceship, but it lets the team test wall and floor tile proportions, the outline-only occluder look and 20-enemy draw cost on real art with zero license risk. If a ship look is wanted from 2D right away, Catter.pxl is the best content match but it is top-down and non-commercial on the free tier.
- **3D pick to try first: Quaternius Modular Sci-Fi MegaKit, Standard (free, CC0).** Grid-fitting walls, floors and doors match the ASCII room data one-to-one, and rendering them to iso PNGs in Blender gives a consistent camera and lighting, which is exactly where the Dead Space "one intensity value" idea can be baked (render a lit and a dark variant). Fallback: Kenney Space Station Kit (CC0, interior-themed, 80+ models).
- Caveat: none of this fits the current "placeholder shapes only, no external images" constraint in `CLAUDE.md`. The human should decide first whether a render-to-sprite experiment is allowed.

## Dropped (not listed) and why
- **OpenGameArt packs** ("Free Space Isometric Pixel Art" by Kipperfalcon, "Sci-fi Interior tiles" by Buch, "LowPoly Modular Sci-Fi Environments" and "LowPoly Spaceships Pack" by Quaternius, "Modular Sci-fi Corridor" by shangri-la): every OpenGameArt page returned HTTP 403, so I could not read the license. Search summaries said CC0 for most, but I did not verify. The "Free Space Isometric Pixel Art" pack (isometric, 32x32, 74 props) is worth a manual check since it is the only isometric space pack that surfaced.
- **Space Station Interior Tileset Pack** (Cute SCKR, itch.io): paid ($3.99+), and the license forbids redistributing the original files. Not free.
- **Low Poly Sci fi Corridor and Crates Asset pack 1** (f117lionhart): license is "Creative Commons Attribution v4.0 International" but price is $6.00 minimum, so not free.
- **Modular Sci-Fi Interior & Spaceship Asset Pack** (Penflower Ink): paid, attribution required per search results; page not fetched.
- **Low Poly Sci-Fi Corridor** (redvampire, itch.io): page 404ed, license unread.
- **Kenney Sci-Fi RTS on itch.io, Catter.pxl main listing slug, Poly Pizza**: itch pages 404ed or no Poly Pizza page surfaced; nothing listed from Poly Pizza, Sketchfab or Unity Asset Store free because I did not fetch any such page.
