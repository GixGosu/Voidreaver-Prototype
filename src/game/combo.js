/*
 * VR.combo: kill chain and room grade. Owner: combat-engineer.
 *
 *   VR.combo.reset()           new room attempt
 *   VR.combo.onKill()          register a kill; chains if the previous kill was within combat.comboWindow
 *   VR.combo.update(dt)        expires the chain
 *   VR.combo.count / best      current chain length / best chain this attempt
 *   VR.combo.frac()            0..1 of the chain window still open (0 when no chain), for a HUD bar
 *   VR.combo.gradeFor(time, total)   'S' | 'A' | 'B' | 'C' from seconds of active fighting and the best chain.
 *                              total = enemies in the room: the chain a grade asks for is capped at it (a 2-enemy
 *                              room can still be S) and big rooms get combat.gradeExtraPerEnemy s per extra enemy.
 */
(function (VR) {
  'use strict';

  var combo = {
    count: 0,
    best: 0,
    since: 0,

    reset: function () { combo.count = 0; combo.best = 0; combo.since = 0; },

    onKill: function () {
      combo.count = (combo.count > 0 && combo.since <= VR.config.combat.comboWindow) ? combo.count + 1 : 1;
      combo.since = 0;
      if (combo.count > combo.best) combo.best = combo.count;
      return combo.count;
    },

    update: function (dt) {
      if (combo.count === 0) return;
      combo.since += dt;
      if (combo.since > VR.config.combat.comboWindow) combo.count = 0;
    },

    frac: function () {
      if (combo.count === 0) return 0;
      return Math.max(0, 1 - combo.since / VR.config.combat.comboWindow);
    },

    gradeFor: function (time, total) {
      var cc = VR.config.combat, g = cc.grades;
      var extra = Math.max(0, (total || 0) - cc.gradeBaseEnemies) * cc.gradeExtraPerEnemy;
      for (var i = 0; i < g.length; i++) {
        var need = total > 0 ? Math.min(g[i].minCombo, total) : g[i].minCombo;
        if (time <= g[i].maxTime + extra && combo.best >= need) return g[i].grade;
      }
      return 'C';
    }
  };

  VR.combo = combo;
})(window.VR = window.VR || {});
