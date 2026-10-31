/*
 * VR.data.upgrades: run upgrades and door reward types as data. Owner: level-builder.
 *
 *   types   reward icon shown on an exit door: { id: { label, color } }
 *   list    [{ id, name, desc, type, apply(p) }]; apply(p) mutates a freshly created player and
 *           is replayed on every room start, so an upgrade lasts the whole run and survives restarts.
 *
 * Player fields used: shellBonus, spreadMul, maxDashCharges, dashDistMul, shield, kickShockwave.
 * Magnitudes live in VR.config.upgrades. Descriptions are static text: update them with the config.
 *
 * VR.config.doors and VR.config.upgrades are created here with defaults because config.js belongs to the
 * feel-tuner; if config.js defines them first, its values win (feel-tuner may move these blocks there).
 */
window.VR = window.VR || {};
window.VR.data = window.VR.data || {};

window.VR.config.doors = Object.assign({
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
}, window.VR.config.doors);

window.VR.config.upgrades = Object.assign({
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
}, window.VR.config.upgrades);

window.VR.data.upgrades = {
  types: {
    offense:  { label: 'ATK', color: '#ff9a3c' },
    mobility: { label: 'MOV', color: '#4fd1ff' },
    defense:  { label: 'DEF', color: '#a8ff6b' },
    extract:  { label: 'END', color: '#ffffff' }
  },
  list: [
    { id: 'extraShell', name: 'Extra Shells', type: 'offense', desc: '+2 shotgun shells every room.',
      apply: function (p) { p.shellBonus = (p.shellBonus || 0) + VR.config.upgrades.shellBonus; } },
    { id: 'wideSpread', name: 'Wide Spread', type: 'offense', desc: 'Shotgun cone is 40% wider.',
      apply: function (p) { p.spreadMul = (p.spreadMul || 1) * VR.config.upgrades.spreadMul; } },
    { id: 'longDash', name: 'Long Dash', type: 'mobility', desc: 'Dash travels 50% further.',
      apply: function (p) { p.dashDistMul *= VR.config.upgrades.dashDistMul; } },
    { id: 'thirdDash', name: 'Third Charge', type: 'mobility', desc: 'A third dash charge.',
      apply: function (p) {
        p.maxDashCharges += VR.config.upgrades.extraDashCharges;
        p.dashCharges = p.maxDashCharges;
      } },
    { id: 'shockwave', name: 'Kick Shockwave', type: 'defense', desc: 'Kicks send a shockwave that knocks and stuns nearby enemies.',
      apply: function (p) { p.kickShockwave = true; } },
    { id: 'shield', name: 'Hull Plating', type: 'defense', desc: 'Survive one extra hit each room.',
      apply: function (p) { p.shield += VR.config.upgrades.shieldHits; } }
  ]
};
