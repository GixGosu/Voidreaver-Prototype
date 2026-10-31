/*
 * VR.roomState: the combat session of one room. Owner: combat-engineer.
 * Spawns the enemies, runs combat each step, detects the clear, and restores the room to its exact entry state
 * after a death or an R restart (enemy positions and states, crates and their hp, tiles incl. windows and breaches,
 * floor weapons, ammo).
 *
 * Scene contract (boarding.js), in this order:
 *   start():   VR.world.load(room); player = VR.player.create(...); VR.roomState.enter(room, player);
 *   update(dt): [restart check] VR.player.update(player, dt); VR.roomState.update(player, dt);
 *   render(a):  VR.player.render(player, a); VR.roomState.render(player, a);
 *   exit():     VR.roomState.exit();
 * Entering the room already snapshotted counts as a retry and restores the snapshot instead of respawning.
 *
 *   VR.roomState.info        HUD / telemetry record, refreshed every step:
 *                            { roomId, time, kills, total, combo, bestCombo, grade, cleared, deaths, attempts,
 *                              lastCause, clearTime, shells, maxShells, weapon }
 *   VR.hudState              plain readable HUD snapshot, refreshed every step and on room entry (proto-architect reads it):
 *                            { shells, maxShells, weapon, dashCharges (whole charges ready), dashFrac (0..1 of the next),
 *                              maxDashCharges, combo, comboFrac (0..1 window left), bestCombo, time (room timer, s),
 *                              deaths, attempts, kills, total, cleared, grade ('' until cleared), clearTime,
 *                              gradeTime (s of the grade readout still due), alive }
 *   VR.roomState.cleared     true once every enemy is dead (doors listen to this)
 *   VR.roomState.onClear(fn) fn(info) when the room is cleared
 *   VR.roomState.activate()  start the fight clock (first alert, shot or kick)
 *   VR.roomState.restart()   called by the player after the death freeze: records the death, restores the room
 */
(function (VR) {
  'use strict';

  var snap = null;        // entry snapshot of the current room
  var room = null;
  var player = null;
  var clearFns = [];
  var gradeLeft = 0;

  var info = {
    roomId: '', time: 0, kills: 0, total: 0, combo: 0, bestCombo: 0, grade: '', cleared: false,
    deaths: 0, attempts: 0, lastCause: '', clearTime: 0, shells: 0, maxShells: 0, weapon: 'none'
  };

  var hud = {
    shells: 0, maxShells: 0, weapon: 'none', dashCharges: 0, dashFrac: 0, maxDashCharges: 0,
    combo: 0, comboFrac: 0, bestCombo: 0, time: 0, deaths: 0, attempts: 0, kills: 0, total: 0,
    cleared: false, grade: '', clearTime: 0, gradeTime: 0, alive: true
  };
  VR.hudState = hud;

  function takeSnapshot() {
    var covers = VR.world.covers.map(function (c) {
      return { tx: c.tx, ty: c.ty, alive: c.alive, hp: VR.cover.hpOf(c) };
    });
    snap = {
      roomId: room.id,
      tiles: new Uint8Array(VR.world.tiles),
      covers: covers,
      enemies: VR.enemies.snapshot(),
      items: VR.weapons.snapshot()
    };
  }

  // Put tiles and cover back; reload the world first when something was destroyed after the snapshot.
  function restoreWorld(reload) {
    var W = VR.world, i;
    if (reload) W.load(room);
    for (i = 0; i < snap.tiles.length; i++) {
      if (W.tiles[i] !== snap.tiles[i]) W.setTile(i % W.cols, Math.floor(i / W.cols), snap.tiles[i]);
    }
    for (i = 0; i < snap.covers.length; i++) {
      var s = snap.covers[i], c = W.coverAt(s.tx, s.ty);
      if (c && s.alive) VR.cover.setHp(c, s.hp);
    }
  }

  function resetRun() {
    VR.fx.reset();
    VR.combo.reset();
    if (VR.breach) VR.breach.reset();   // windows come back with the world reload; this drops damage and open holes
    info.time = 0; info.kills = 0; info.grade = ''; info.cleared = false; info.clearTime = 0;
    gradeLeft = 0;
    roomState.cleared = false;
    roomState.running = false;
  }

  function refreshInfo(p) {
    info.total = VR.enemies.list.length;
    info.kills = info.total - VR.enemies.aliveCount();
    info.combo = VR.combo.count;
    info.bestCombo = VR.combo.best;
    info.shells = p.weapon && p.weapon.type === 'shotgun' ? p.weapon.ammo : 0;
    info.maxShells = VR.weapons.maxShells(p);
    info.weapon = p.weapon ? p.weapon.type : 'none';

    var whole = Math.floor(p.dashCharges);
    hud.shells = info.shells; hud.maxShells = info.maxShells; hud.weapon = info.weapon;
    hud.dashCharges = whole; hud.dashFrac = p.dashCharges - whole; hud.maxDashCharges = p.maxDashCharges;
    hud.combo = info.combo; hud.comboFrac = VR.combo.frac(); hud.bestCombo = info.bestCombo;
    hud.time = info.time; hud.deaths = info.deaths; hud.attempts = info.attempts;
    hud.kills = info.kills; hud.total = info.total;
    hud.cleared = info.cleared; hud.grade = info.grade; hud.clearTime = info.clearTime;
    hud.gradeTime = gradeLeft > 0 ? gradeLeft : 0; hud.alive = p.alive;
  }

  function clearRoom(p) {
    roomState.cleared = info.cleared = true;
    info.clearTime = info.time;
    info.grade = VR.combo.gradeFor(info.time, info.total);
    VR.weapons.bullets.length = 0; // a stray bullet must not kill the player during the reward delay
    VR.weapons.refill(p);
    VR.audio.play('clear');
    gradeLeft = VR.config.combat.gradeShowTime;
    for (var i = 0; i < clearFns.length; i++) clearFns[i](info);
  }

  var roomState = {
    info: info,
    player: null,         // the player entity of the current attempt (debug / telemetry)
    cleared: false,
    running: false,

    onClear: function (fn) { clearFns.push(fn); },

    activate: function () { roomState.running = true; },

    enter: function (r, p) {
      var retry = snap !== null && snap.roomId === r.id;
      room = r;
      player = roomState.player = p;
      if (!retry) { info.deaths = 0; info.attempts = 0; info.lastCause = ''; }
      info.attempts++;
      info.roomId = r.id;
      resetRun();
      VR.weapons.reset();
      VR.weapons.equip(p, 'shotgun', VR.weapons.maxShells(p));
      if (retry) {
        restoreWorld(false);
        VR.enemies.restore(snap.enemies);
        VR.weapons.restore(snap.items);
      } else {
        VR.enemies.spawnFromWorld(p);
        takeSnapshot();
      }
      if (snap.enemies.length === 0) { roomState.cleared = info.cleared = true; }
      refreshInfo(p);
    },

    exit: function () { snap = null; room = null; player = roomState.player = null; },

    // Death bookkeeping plus an immediate restore, so the room is already reset the moment the scene restarts.
    restart: function () {
      if (!snap || !player) return;
      info.deaths++;
      info.lastCause = player.cause;
      resetRun();
      VR.weapons.reset();
      restoreWorld(true);
      VR.enemies.restore(snap.enemies);
      VR.weapons.restore(snap.items);
    },

    update: function (p, dt) {
      if (!p.alive) return;   // death freeze: nothing moves, the player is about to restart the room
      if (VR.breach) VR.breach.update(dt, p);
      VR.weapons.update(dt, p);
      VR.enemies.update(dt, p);
      VR.combo.update(dt);
      VR.fx.update(dt);
      if (roomState.running && !roomState.cleared) info.time += dt;
      if (gradeLeft > 0) gradeLeft -= dt;
      if (!roomState.cleared && VR.enemies.aliveCount() === 0) clearRoom(p);
      refreshInfo(p);
    },

    render: function (p, alpha) {
      VR.fx.render();
      VR.enemies.render(p, alpha);
      VR.weapons.render(p, alpha);
      VR.cover.render(p, alpha);
      if (VR.breach) VR.breach.render(p, alpha);
      if (gradeLeft > 0 && info.cleared) {
        // Stopgap grade readout until the HUD owns it.
        var h = VR.config.hit;
        VR.render.submit({ kind: 'text', layer: 'overlay', x: VR.entity.ix(p, alpha), y: VR.entity.iy(p, alpha),
          z: p.height + h.comboPopHeight * 2, text: info.grade + '  ' + info.clearTime.toFixed(1) + 's',
          size: h.textSize * 2, color: h.flashColor });
      }
    }
  };

  VR.roomState = roomState;
})(window.VR = window.VR || {});
