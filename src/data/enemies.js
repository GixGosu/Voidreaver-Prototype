/*
 * VR.data.enemies: enemy type definitions. Owner: combat-engineer.
 * Only identity and behaviour flags live here; every number is in VR.config.enemy[cfg] and every colour
 * in VR.config.hit[color], so the tuning panel reaches them.
 *
 *   ai          'shooter' (keeps range, fires) | 'melee' (sprints at the player) | 'burst' (gunner: cover-hopping bursts)
 *   drops       weapon type left on the floor when killed, or ''
 *   kickImmune  true: kicks and door stuns shove but never stun, and walls never kill it (heavies)
 *   byChar      map from a room-map spawn character to a type id
 */
window.VR = window.VR || {};
window.VR.data = window.VR.data || {};

window.VR.data.enemies = {
  types: {
    grunt:  { id: 'grunt',  cfg: 'grunt',  color: 'gruntColor',  ai: 'shooter', drops: 'pistol', kickImmune: false },
    rusher: { id: 'rusher', cfg: 'rusher', color: 'rusherColor', ai: 'melee',   drops: '',       kickImmune: false },
    gunner: { id: 'gunner', cfg: 'gunner', color: 'gunnerColor', ai: 'burst',   drops: '',       kickImmune: false },
    heavy:  { id: 'heavy',  cfg: 'heavy',  color: 'heavyColor',  ai: 'shooter', drops: '',       kickImmune: true }
  },
  byChar: { g: 'grunt', r: 'rusher', n: 'gunner', H: 'heavy' }
};
