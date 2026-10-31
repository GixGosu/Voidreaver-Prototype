/*
 * VR.config: every tuning value in the prototype lives here.
 * Owner after M1: feel-tuner. Other files read these values at call time, so live edits
 * (tuning panel, devtools) take effect immediately.
 *
 * Units: world distances are pixels on the flat ground plane, times are seconds, angles are degrees,
 * heights (z) are screen pixels straight up.
 *
 * Tuning log (date, value, old -> new, reason):
 * 2026-10-31  seeded from PROTOTYPE_SPEC "Starting tuning values" (M1)
 * 2026-10-31  reviewed combat-engineer's new player.* keys (cover*, dashSnapDistance, kick*, hitStopDeath, deathShake)
 *             and colours playerDash/playerCover/playerDead: kept all values except the one below
 * 2026-10-31  player.hitStopDeath 0.12 -> 0.08: with combat.deathFreeze 0.4 total death cost is 0.48s, well under 1s,
 *             while the hit-stop still lands the killing blow
 * 2026-10-31  GUARD (M2 fix round 1): death-to-restart measured ~420 ms of the 0.5 s spec limit. Do NOT raise
 *             combat.deathFreeze (0.4) or player.hitStopDeath (0.08); no value changed
 * 2026-10-31  shotgun.knockback 520 -> 640 (M2 tuning pass): bodies fly further and more wall kills connect at mid range
 *             (falloff 0.6 still leaves ~384 px/s at max range, far above wallKillSpeed 110). Dash, reaction delay
 *             (0.35, rusher 0.245), telegraph, and restart (deathFreeze 0.4) left at spec: no playtest ratings yet
 * 2026-10-31  render.colors: removed duplicated playerDash/playerCover/playerDead keys (no value change)
 * 2026-10-31  M4 fix round 1: added doors and upgrades blocks (moved from src/data/upgrades.js, values unchanged)
 * 2026-10-31  M4 tuning pass (no playtest ratings yet, reasoned from spec; MOST IMPORTANT first):
 *             cover.crateHp 20 -> 14: crates fall after ~2 close blasts, so cover stays a split-second tool
 *             enemy.rusher.speed 205 -> 214: rushers close on a player leaving cover (still under player 220, dash escapes)
 *             enemy.gunner.suppressBonus 2 -> 1: pinned burst 6 -> 5 shots, fairer to dodge; suppressRest 0.45 kept so pressure stays
 *             Reaction delay, telegraphs, heavy values, grades left alone: fairness knobs untouched until human ratings arrive
 * 2026-10-31  M5: added flight block (flight-engineer); values are first guesses, untuned
 * 2026-10-31  M5 tuning pass (no playtest ratings yet; MOST IMPORTANT first):
 *             flight.turret.fireMin 400 -> 500: first shot leaves at least ~500 px out, so the orange shot is on screen
 *             and dodgeable for >= 1 s at scroll 180 + shot 230
 *             flight.fighter.fireMin 300 -> 450: same 1 s visibility rule for fighter fire
 *             Kept: flight.speed 180 (walls 2.5-3.5 s apart = 450-630 px, deckAhead 1200 gives 6.7 s sight), gap multipliers
 *             (never shrunk), checkpoints every 20 s, death.restartDelay 0.3
 * 2026-10-31  M6 final pass (no playtest ratings or telemetry yet, so NO values changed; human feel beats guessing):
 *             Restart budget checked: combat.deathFreeze 0.4 + player.hitStopDeath 0.08 = 0.48 s (< 0.5 s limit), flight
 *             death.restartDelay 0.3 + hitStop 0.08 = 0.38 s. Do not raise any of these.
 *             Fairness knobs still at spec: enemy.reactionDelay 0.35 (rusher x0.7 = 0.245, gunner x1.1, heavy x1.4), grunt windup 0.25.
 *             If M6 stats show rooms over 8 s: raise enemy.rusher.speed (cap 218, player is 220) or lower cover.crateHp first.
 *             If deaths feel unfair: raise enemy.reactionDelay toward 0.45 before touching speeds or damage.
 *             Flight: tune flight.speed and wall spacing, never gapMulWidth/gapMulHeight (2.5, oversized by design).
 */
window.VR = window.VR || {};

window.VR.config = {
  iso: {
    tileW: 64,          // screen width of a floor diamond
    tileH: 32,          // screen height of a floor diamond (2:1 dimetric)
    tileWorld: 32       // world pixels per tile edge; 1 world px along x moves (1, 0.5) on screen
  },

  loop: {
    step: 1 / 60,       // fixed update step
    maxFrame: 0.25,     // clamp long frames so a stall cannot cause a catch-up spiral
    maxStepsPerFrame: 8
  },

  camera: {
    followSharpness: 10, // exponential follow rate (1/s); higher = tighter
    leadFactor: 0.22,    // fraction of the player->cursor vector the camera leans toward
    leadMax: 110,        // cap on lead, world px
    shakeMax: 24         // cap on shake offset, screen px
  },

  render: {
    wallHeight: 56,
    windowHeight: 56,
    doorHeight: 56,
    halfCoverHeight: 18,
    fullCoverHeight: 56,
    crateHeight: 22,
    coverInset: 3,      // world px each cover block is shrunk inside its tile
    fadeMargin: 10,     // screen px added around the player when testing which walls to fade
    reticleSize: 7,
    aimLineWidth: 1.5,
    colors: {
      background: '#07080c',
      floorA: '#1d2230',
      floorB: '#20263a',
      floorGrid: 'rgba(120,140,190,0.10)',
      wallTop: '#5a6378',
      wallLeft: '#3a4152',
      wallRight: '#2b3140',
      wallOutline: 'rgba(170,190,230,0.55)',
      windowTop: '#5fa8d8',
      windowLeft: '#2f6f99',
      windowRight: '#245677',
      doorTop: '#b48a3c',
      doorLeft: '#7c5d25',
      doorRight: '#5f461b',
      halfTop: '#6f7c64',
      halfLeft: '#4a5443',
      halfRight: '#3a4235',
      fullTop: '#7b6f8f',
      fullLeft: '#544c63',
      fullRight: '#423b4e',
      crateTop: '#9a7446',
      crateLeft: '#6e5232',
      crateRight: '#563f26',
      shadow: 'rgba(0,0,0,0.35)',
      player: '#4fd1c5',
      playerDash: '#d9fffb',
      playerCover: '#2a8f87',
      playerDead: '#8a2b3a',
      aimLine: 'rgba(255,255,255,0.35)',
      reticle: '#ffffff'
    }
  },

  player: {
    speed: 220,
    radius: 10,
    height: 30,
    dashDistance: 140,
    dashDuration: 0.15,
    dashCharges: 2,
    dashRecharge: 1.2,
    // Added by combat-engineer (M2 player):
    dashSnapDistance: 40,    // a dash ending within this of cover auto-enters it (world px)
    coverEnterDistance: 44,  // C enters cover whose tile centre is within this (world px)
    coverSpeedScale: 0.5,    // sliding along cover edge moves at this fraction of speed
    coverExitDot: 0.5,       // pushing away from cover with at least this alignment leaves it
    kickDuration: 0.25,      // seconds the kick is active (hook window for enemies/doors)
    kickRange: 40,           // reach of the kick, world px
    kickCooldown: 0.5,
    hitStopDeath: 0.08,     // freeze on the killing blow, before the restart freeze
    deathShake: 14,          // camera shake strength on player death
    deathShakeDuration: 0.3  // seconds of camera shake on player death
  },

  // M2 keys below were added by combat-engineer (combat, hit feel, enemies).
  shotgun: {
    pellets: 8,
    spreadDeg: 30,
    range: 260,
    pumpDelay: 0.45,
    shellsPerRoom: 6,
    knockback: 640,         // corpse launch speed at point blank, px/s (falls off with distance)
    knockbackFalloff: 0.6,  // fraction of knockback lost at max range
    pelletJitter: 0.8,      // 0 = evenly fanned pellets, 1 = fully random inside each slice
    pelletSlop: 3,          // extra px added to an enemy's radius when testing pellet hits
    crateDamage: 1,         // crate hp removed per pellet that hits it
    muzzleOffset: 12,       // px from player centre to the muzzle
    fireBuffer: 0.15,       // a click this long before the pump finishes still fires
    shakeBase: 3,           // camera shake strength with zero pellets hitting
    shakePerPellet: 1.6,    // extra shake per pellet that hit an enemy
    shakeDuration: 0.15,
    flashLife: 0.06,        // seconds the muzzle flash / pellet tracers stay visible
    tracerWidth: 1.5,
    flashRadius: 9
  },

  pistol: {
    range: 560,
    delay: 0.3,
    ammo: 8,              // rounds in a pistol dropped by a grunt
    knockback: 220,
    spreadDeg: 1.5,
    shake: 1.5,
    shakeDuration: 0.08,
    muzzleOffset: 12,
    shotVolume: 0.6         // audio scale for pistol shots (quieter than the shotgun)
  },

  enemy: {
    reactionDelay: 0.35,    // seconds between spotting the player and the first shot (the fairness knob)
    bulletSpeed: 520,
    heavyHits: 3,
    bulletRadius: 3,        // px, bullet vs player hit test
    bulletMaxDist: 900,     // bullets expire after travelling this far
    sightRange: 380,
    fovDeg: 150,            // total viewing cone of an unalerted enemy
    hearRange: 60,          // anything this close is noticed regardless of facing
    noiseRadius: 340,       // shotgun blasts alert unalerted enemies within this
    loseSightTime: 1.5,     // seconds without line of sight before an alerted enemy gives up and searches
    searchTime: 2,          // seconds spent at the last known position before returning to patrol
    flankSpeedMul: 2,       // shooters sidestep this many times faster while the player is behind cover
    separation: 40,         // px/s push applied when two enemies overlap
    turnRate: 14,           // rad/s facing turn speed
    muzzleHeight: 0.6,      // fraction of body height where the muzzle sits
    windupFlashRadius: 7,   // px, size of the muzzle flash at the end of the wind-up
    telegraphLineAlpha: 0.5,
    stunSwing: 8,           // rad/s colour wobble for stunned enemies
    grunt: {
      radius: 10, height: 28, hp: 1,
      speed: 95,            // advance speed while alerted
      patrolSpeed: 55,
      patrolLeg: 110,       // px walked before turning around
      patrolPause: 0.7,     // seconds standing at the end of a leg
      reactionMul: 1,       // multiplies enemy.reactionDelay
      fireInterval: 1.1,    // seconds between shots after the first
      windup: 0.25,         // flash wind-up before every shot after the first
      spreadDeg: 5,
      engageRange: 300,     // advances until closer than this with line of sight
      strafeSpeed: 40,
      strafeSwitch: 1.2,    // seconds between strafe direction changes
      knockResist: 1
    },
    rusher: {
      radius: 10, height: 28, hp: 1,
      speed: 214,           // sprint speed, just under the player's 220
      patrolSpeed: 0,
      patrolLeg: 0,
      patrolPause: 0,
      reactionMul: 0.7,
      meleeRange: 12,       // px beyond touching at which the strike lands
      detourTime: 0.4,      // seconds to hold a sidestep after being blocked
      knockResist: 1
    },
    // M4 gunner: fires rifle bursts from half-cover points, relocates between bursts, suppresses a player in cover.
    gunner: {
      radius: 10, height: 30, hp: 1,
      speed: 125,           // run speed between cover points
      patrolSpeed: 0,
      patrolLeg: 0,
      patrolPause: 0,
      reactionMul: 1.1,
      windup: 0.3,          // muzzle flash wind-up before every burst after the first
      burstCount: 4,        // shots per burst
      burstInterval: 0.11,  // seconds between shots inside a burst
      restTime: 0.9,        // seconds spent in cover between bursts
      spreadDeg: 4,
      engageRange: 340,
      knockResist: 1,
      coverSearch: 260,     // px radius around the gunner searched for a cover point
      coverMinPlayerDist: 110, // cover points closer than this to the player are ignored
      coverDot: 0.5,        // min alignment of (point -> cover) with (point -> player): the cover must face the player
      coverArrive: 6,       // a cover point nearer than this to the gunner is not worth moving to
      coverReach: 1.5,      // tiles: cover further than this from the gunner is no longer its own when firing
      moveMax: 2,           // seconds before a stuck relocation gives up and fires from where it stands
      hopDist: 80,          // px sidestep hop when no cover point exists
      suppressBonus: 1,     // extra shots per burst while the player is protected
      suppressRest: 0.45    // rest time between bursts while the player is protected
    },
    // M4 heavy: armored (hp hits), slow, shotgun blast; kicks shove it but never stun it or kill it against walls.
    heavy: {
      radius: 14, height: 38, hp: 3,
      speed: 55,
      patrolSpeed: 35,
      patrolLeg: 90,
      patrolPause: 1,
      reactionMul: 1.4,
      fireInterval: 1.9,
      windup: 0.45,
      spreadDeg: 2,         // aim error of the blast centre
      pellets: 5,           // pellets per blast
      pelletSpreadDeg: 26,
      bulletRange: 240,     // pellets expire after this distance
      engageRange: 230,
      strafeSpeed: 20,
      strafeSwitch: 2,
      knockResist: 0.35     // fraction of knockback applied to it
    }
  },

  combat: {
    deathFreeze: 0.4,
    comboWindow: 1.5,
    throwStun: 1,
    halfTurnDeg: 180,       // degrees in half a turn, for deg to rad conversion
    throwSpeed: 560,
    throwRange: 320,
    throwRadius: 6,         // px, thrown-weapon hit radius against enemies
    pickupRange: 30,
    pickupSwapOffset: 14,   // px a dropped weapon lands from the player
    wallKillSpeed: 110,     // a knocked enemy hitting a wall faster than this dies
    kickStun: 1.2,
    kickKnockSpeed: 380,
    kickKnockTime: 0.35,
    kickCone: 0.3,          // min dot(aim, direction to enemy) for a kick to connect
    stunnedKnockback: 1,
    // Room grade: first row whose maxTime (s of active fighting) and minCombo are both met; otherwise C.
    grades: [
      { grade: 'S', maxTime: 3.5, minCombo: 4 },
      { grade: 'A', maxTime: 5.5, minCombo: 3 },
      { grade: 'B', maxTime: 9, minCombo: 2 }
    ],
    gradeBaseEnemies: 4,    // rooms with more enemies than this get extra time per additional enemy
    gradeExtraPerEnemy: 0.8, // seconds added to every grade time limit per enemy beyond gradeBaseEnemies
    doorStunKnock: 220,     // px/s shove given by VR.enemies.stunNear when a caller asks for knockback
    gradeShowTime: 4        // seconds the grade text floats over the player
  },

  hit: {
    killStop: 0.06,         // hit-stop on every kill
    killShake: 3,
    killShakeDuration: 0.1,
    ragdollFriction: 5,     // exponential speed decay per second
    ragdollStopSpeed: 8,
    corpseHeight: 6,
    decalMax: 140,
    splatterCount: 8,
    splatterSpread: 26,     // px radius splatter droplets land in
    splatterMin: 2,
    splatterMax: 6,
    pool: 10,               // px radius of the main pool under a corpse
    bigPoolScale: 1.4,      // wall kills leave a bigger pool
    poolAlpha: 0.85,
    dropAlpha: 0.9,
    textLife: 0.9,          // seconds floating text lives
    tracerHeight: 16,       // screen px above the floor where tracers are drawn
    textSize: 14,
    pickupW: 14, pickupD: 6, pickupH: 3,   // floor weapon marker size, px
    comboPopHeight: 40,     // px above the head for floating text
    bloodColor: '#a3162a',
    bloodDark: '#6e0f1d',
    flashColor: '#ffe9a0',
    tracerColor: '#fff2c0',
    telegraphColor: '#ff5a3c',
    stunColor: '#f2d15b',
    corpseColor: '#4a2530',
    pickupColor: '#d9c46a',
    gruntColor: '#d9694f',
    rusherColor: '#e0a030',
    gunnerColor: '#8f5fd9',
    heavyColor: '#b8442f',
    heavyHurtColor: '#f08a3a'   // heavy after taking a hit
  },

  cover: {
    crateHp: 14,            // pellets a destructible crate absorbs (about 2 close shotgun blasts)
    bulletDamage: 2,        // crate hp removed by each enemy bullet that hits it
    debrisCount: 6,
    debrisSpread: 20,
    breakShake: 4,          // camera shake when a crate breaks
    breakShakeDuration: 0.12,
    crackColor: '#1a0f08',  // damage outline drawn over wounded crates (alpha grows as hp falls)
    leanDistance: 12,       // extra px past the block edge the player leans out of full cover when popping out
    leanReadyDist: 4,       // px short of the full lean at which the gun is considered up
    leanSpeed: 420,         // px/s the player slides to and from the lean position
    leanDeadzone: 6,        // px of aim offset along the cover face before the lean side switches
    // Readability: shield pips above the player (one per alerted enemy) and red glow on cover in the line of fire.
    iconMax: 5,
    iconLift: 40,           // px above the head where the shield row floats
    iconGap: 16,            // screen px between shield icons
    shieldW: 6, shieldH: 10, shieldTaper: 0.45,   // shield outline half-width, height and shoulder ratio, screen px
    iconLineWidth: 2,
    iconFillWidth: 1.5,     // fill strokes of a protected shield are this many times thicker
    safeColor: '#53e08a',
    exposedColor: '#ff4a3a',
    glowColor: '#ff3b2f',
    glowWidth: 3,
    glowBase: 0.45,         // minimum glow alpha at the low point of the pulse
    glowPulse: 9            // rad/s of the glow pulse
  },

  breach: {
    pullRadius: 260,
    pullDuration: 2,
    shutterDelay: 2.5,
    windowHp: 3,            // pellets (or pistol rounds) a window absorbs before it blows out
    hitDamage: 1,           // window hp removed per pellet that hits it
    pullSpeedMin: 70,       // px/s pull at the edge of the radius (below player speed: you can walk out)
    pullSpeedMax: 340,      // px/s pull right at the hole (above player speed: no escape up close)
    reachSlack: 3,          // px past touching the hole at which an actor is spaced
    pullGrace: 0.1,         // seconds an enemy's AI stays frozen after each pull step
    crateSlideInterval: 0.2, // seconds a loose crate takes to slide one tile toward the hole
    openShake: 10, openShakeDuration: 0.5,
    sealShake: 4, sealShakeDuration: 0.15,
    openHitStop: 0.08,
    streakCount: 16,        // wind streaks drawn while the pull lasts
    streakSpeed: 1.6,       // cycles per second
    streakLength: 0.14,     // fraction of the distance to the hole each streak spans
    streakSpin: 0.37,       // radians of extra spoke angle per streak index squared (scatters the spokes)
    streakStagger: 0.618,   // phase offset between neighbouring streaks (golden ratio spreads them evenly)
    streakColor: '#bfe8ff',
    ringColor: '#5fa8d8',
    ringAlpha: 0.35,
    holeColor: '#e8f6ff',
    holeRadius: 14,         // px, glow at the hole
    holeHeight: 24,         // px above the floor the hole glow sits
    crackColor: '#e8f6ff',
    crackSize: 6
  },

  // M4 door and scan tuning, moved here from src/data/upgrades.js (values unchanged).
  doors: {
    scanDuration: 0.75,       // seconds enemy positions are shown on entering a new room (world frozen)
    scanPulseHz: 6,           // ring pulse rate while scanning
    scanRingPad: 8,           // px added to an enemy's radius for its scan ring
    scanRingPulse: 4,         // px the ring grows and shrinks
    scanColor: '#ff5577',
    sealFlash: 0.6,           // seconds the entry door flashes red after it seals
    sealColor: '#ff3b3b',
    lockedColor: '#8a8f99',
    lockedAlpha: 0.55,        // reward icon opacity while the door is sealed
    openColor: '#5dffa0',
    iconHeight: 64,           // px above the floor the reward icon floats
    iconRadius: 14,           // world px radius of the icon ring
    iconTextSize: 12,
    labelHeight: 84,          // px above the floor of the door state label
    rewardDelay: 0.6,         // seconds between the room clear and the pick-one-of-three screen
    slamRadius: 96,           // kicking a sealed door stuns non-immune enemies within this of the door (world px)
    slamStun: 1.2,            // seconds
    kickReach: 28             // extra px beyond the player kick range at which a door tile counts as kicked
  },

  // M4 upgrade magnitudes. Upgrade descriptions in src/data/upgrades.js are static text: update them with these.
  upgrades: {
    shellBonus: 2,            // extra shotgun shells per room
    spreadMul: 1.4,           // shotgun cone multiplier
    dashDistMul: 1.5,         // dash distance multiplier
    extraDashCharges: 1,      // added to maxDashCharges
    shieldHits: 1,            // extra hits absorbed, restored every room attempt
    shockwaveRadius: 110,     // kick shockwave radius (world px)
    shockwaveKnockSpeed: 420,
    shockwaveKnockTime: 0.35,
    shockwaveStun: 1.2,
    shockwaveRingLife: 0.25,  // seconds the shockwave ring is drawn
    cardWidth: 230            // px, pick screen card width
  },

  // M5 flight run (flight-engineer). World axes: the run scrolls along -x (up-left on screen); lateral y > 0 is
  // screen-left; z is altitude in screen px. Course data lives in src/game/flight-course.js.
  flight: {
    speed: 180,              // constant scroll speed, world px/s
    laneHalf: 220,           // strafe box half width (world y)
    wallOverhang: 40,        // walls extend this far past the lane so there is no way around
    bandZ: [30, 90, 150],    // ship altitude for low / mid / high
    wallTop: 210,
    wallThickness: 24,
    wallCell: 48,            // max chunk width of a wall (finer depth sorting against the ship)
    gapMulWidth: 2.5,        // gap width  = ship width  x this  (design rule: 2-3x)
    gapMulHeight: 2.5,       // gap height = ship height x this; keep ship.height x this = band spacing
    shadowSlope: 0.6,        // floor shadow offset (world px in +x) per px of altitude
    nextRoom: 'room1-intro', // boarding room loaded after docking
    cameraAhead: 160,        // camera leads the ship by this much so the player sees further ahead
    ship: {
      length: 40, width: 36, height: 24,   // hitbox; gaps are sized from width and height
      strafeSpeed: 320, strafeSmooth: 14,  // strafe top speed and response rate (1/s)
      bandTime: 0.18,                      // seconds for an altitude change
      startBand: 1,
      wingLength: 24, wingThick: 6, bodyWidth: 12, bodyThick: 14, bodyShift: 4,
      shadowAlpha: 0.5
    },
    fire: { interval: 0.16, speed: 720, range: 900, volume: 0.3, radius: 3, trail: 0.04, muzzleLead: 4 },
    field: {
      thickness: 10, fadeTime: 0.25, genHitHalf: 30, genHalfX: 14, genInset: 30, pylonSize: 26,
      alpha: 0.35, pulseHz: 8, pulseAmt: 0.15, ringRadius: 36, markerSize: 10, markerLift: 24
    },
    turret: {
      rowStep: 150, offset: 40,            // spacing along the run; distance outside the lane edge
      hp: 2, hitHalf: 16, towerHalf: 14, headLift: 8, headHeight: 16, headHalf: 11, hitAbove: 15,
      fireInterval: 1.8, stagger: 0.45, fireMin: 500, fireMax: 650, flashTime: 0.4,
      shotSpeed: 230, shotRadius: 7, cullBehind: 200, cullSide: 400, screenMargin: 20
    },
    fighter: {
      speed: 120, spawnDist: 900, hp: 1, length: 40, width: 36, height: 20,
      weaveAmp: 110, weaveRate: 2.2, diveStart: 1.6, diveTime: 1.2, crossSpeed: 160,
      fireInterval: 1.6, fireMin: 450, fireMax: 650, cullBehind: 400, wingThick: 6, bodyWidth: 12, bodyThick: 12
    },
    bullets: { hitMargin: 6, sparkLife: 0.2, sparkSize: 14 },
    death: { hitStop: 0.08, restartDelay: 0.3, shake: 14, shakeTime: 0.3, debris: 10, debrisSpeed: 160, debrisLife: 0.5, ring: 60 },
    checkpoint: { bannerTime: 1.5 },
    dock: { depth: 160, widthMul: 4, hullHalf: 520, hullTop: 320, delay: 0.7 },
    draw: {
      deckAhead: 1200, deckBehind: 500, deckEdge: 40, gridStep: 64, cullAhead: 1100, cullBehind: 500,
      frameWidth: 3, hintTime: 3.5, hintY: 90, hudMargin: 40, progressWidth: 220, gaugeStep: 18, gaugeLen: 24,
      textSize: 16, bannerSize: 24, trailSeconds: 0.05,
      wallShadowAlpha: 0.35, dropLineAlpha: 0.45, wingFrac: 0.6, gaugeDim: 0.5
    },
    colors: {
      deck: '#1b2230', deckGrid: '#2c3850', rail: '#4a6a9a',
      wallTop: '#6b7690', wallLeft: '#4a5470', wallRight: '#394058',
      hullTop: '#80728a', hullLeft: '#5b4f66', hullRight: '#443a4e',
      shadow: '#000000',
      bands: ['#4ade80', '#fbbf24', '#f472b6'],   // low, mid, high frame colours (also on the HUD gauge)
      field: '#38e1ff', pylon: '#566079', generator: '#ff9a2e',
      ship: '#7fd6ff', shipBody: '#e8f6ff',
      bullet: '#aef6ff', enemyShot: '#ff5a3c', turret: '#8a5a5a', turretHead: '#ff6b4a', turretFlash: '#fff1a8',
      fighter: '#d9534f', fighterBody: '#ffb3a8',
      spark: '#ffe08a', debris: '#ffd0a0',
      hud: '#e8f0ff', hudDim: '#7f8aa6', checkpoint: '#7dffa8', warn: '#ff9a9a'
    },
    keys: { toFlight: 'F2', toBoarding: 'F4', restart: 'KeyR', nextCheckpoint: 'KeyN', god: 'KeyH', up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' }
  },

  audio: {
    volume: 0.25,
    // Blip presets: wave is an OscillatorType or 'noise'; freq slides to freqEnd over duration.
    sounds: {
      shot:  { wave: 'noise',    freq: 900,  freqEnd: 200, duration: 0.18, volume: 0.9 },
      kill:  { wave: 'square',   freq: 220,  freqEnd: 60,  duration: 0.16, volume: 0.6 },
      death: { wave: 'sawtooth', freq: 300,  freqEnd: 40,  duration: 0.45, volume: 0.7 },
      clear: { wave: 'triangle', freq: 440,  freqEnd: 880, duration: 0.30, volume: 0.6 },
      dash:  { wave: 'sine',     freq: 500,  freqEnd: 900, duration: 0.08, volume: 0.4 },
      click: { wave: 'square',   freq: 1200, freqEnd: 1200, duration: 0.03, volume: 0.3 },
      kick:  { wave: 'noise',    freq: 300,  freqEnd: 80,  duration: 0.10, volume: 0.7 },
      breach:{ wave: 'noise',    freq: 150,  freqEnd: 40,  duration: 0.9,  volume: 0.8 }
    }
  },

  debug: {
    fpsSmoothing: 0.1   // EMA weight for the overlay's FPS readout
  },

  // Key bindings use KeyboardEvent.code so they are layout independent.
  keys: {
    up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD',
    dash: 'Space', cover: 'KeyC', kick: 'KeyF', pickup: 'KeyG', restart: 'KeyR',
    debug: 'F1', tuning: 'Backquote'
  }
};
