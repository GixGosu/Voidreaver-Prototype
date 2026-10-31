/*
 * VR.doors: entry door, exit doors, door scanner and door kicks of the current room. Owner: level-builder.
 *
 *   VR.doors.enter(room, scan)   read D / 1 / 2 from VR.world.spawns; scan=true shows the enemy scan first
 *   VR.doors.exit()
 *   VR.doors.scanning()          true while the scan plays; the scene freezes player and enemies meanwhile
 *   VR.doors.update(p, dt)       ages the scan and seal flash, unlocks exits once VR.roomState.cleared;
 *                                returns { ch, type } when the player steps into an open exit, else null
 *   VR.doors.render(p, alpha)    reward icons, scan markers, seal flash
 *   VR.doors.kick(p)             player kick hook: a sealed door that is kicked stuns enemies near it, then the
 *                                kick shockwave upgrade (VR.upgrades.onKick) fires
 *
 * The entry door tile stays solid (it sealed behind the player). Exit door tiles are solid until the room is
 * cleared, then become floor so the player walks into the opening.
 */
(function (VR) {
  'use strict';

  var entry = null;
  var exits = [];
  var unlocked = false;
  var scanT = 0;
  var sealT = 0;

  function reset() { entry = null; exits = []; unlocked = false; scanT = 0; sealT = 0; }

  function unlock() {
    unlocked = true;
    for (var i = 0; i < exits.length; i++) VR.world.setTile(exits[i].tx, exits[i].ty, VR.world.TILE.FLOOR);
  }

  function nearDoor(p, d) {
    var reach = VR.config.player.kickRange + VR.config.doors.kickReach;
    var dx = d.x - p.x, dy = d.y - p.y;
    return dx * dx + dy * dy <= reach * reach;
  }

  VR.doors = {
    enter: function (room, scan) {
      reset();
      var sp = VR.world.spawns;
      for (var i = 0; i < sp.length; i++) {
        var s = sp[i];
        if (s.ch === 'D') entry = s;
        else if (s.ch === '1' || s.ch === '2') {
          exits.push({ ch: s.ch, tx: s.tx, ty: s.ty, x: s.x, y: s.y, type: (room.exits && room.exits[s.ch]) || 'extract' });
        }
      }
      var c = VR.config.doors;
      scanT = scan ? c.scanDuration : 0;
      sealT = c.sealFlash;
      if (scan) VR.audio.play('click');
    },

    exit: reset,

    scanning: function () { return scanT > 0; },

    update: function (p, dt) {
      if (scanT > 0) scanT -= dt;
      if (sealT > 0) sealT -= dt;
      if (!unlocked && VR.roomState.cleared && exits.length > 0) unlock();
      if (!unlocked) return null;
      var tx = VR.world.toTile(p.x), ty = VR.world.toTile(p.y);
      for (var i = 0; i < exits.length; i++) {
        if (exits[i].tx === tx && exits[i].ty === ty) return { ch: exits[i].ch, type: exits[i].type };
      }
      return null;
    },

    kick: function (p) {
      var c = VR.config.doors, list = VR.enemies.list, doors = entry ? [entry] : [];
      if (!unlocked) doors = doors.concat(exits);
      for (var d = 0; d < doors.length; d++) {
        if (!nearDoor(p, doors[d])) continue;
        VR.audio.play('kick');
        for (var i = 0; i < list.length; i++) {
          var e = list[i];
          if (!e.alive || e.def.kickImmune) continue;
          var dx = e.x - doors[d].x, dy = e.y - doors[d].y;
          if (dx * dx + dy * dy <= c.slamRadius * c.slamRadius) VR.enemies.stun(e, c.slamStun);
        }
        if (VR.roomState) VR.roomState.activate();
        break;
      }
      if (VR.upgrades) VR.upgrades.onKick(p);
    },

    render: function () {
      var c = VR.config.doors, types = VR.data.upgrades.types, i;
      for (i = 0; i < exits.length; i++) {
        var d = exits[i], t = types[d.type] || types.extract;
        VR.render.submit({ kind: 'circle', layer: 'overlay', x: d.x, y: d.y, z: c.iconHeight, radius: c.iconRadius,
          color: t.color, outline: true, width: 2, alpha: unlocked ? 1 : c.lockedAlpha });
        VR.render.submit({ kind: 'text', layer: 'overlay', x: d.x, y: d.y, z: c.iconHeight, text: t.label,
          size: c.iconTextSize, color: t.color, alpha: unlocked ? 1 : c.lockedAlpha });
        VR.render.submit({ kind: 'text', layer: 'overlay', x: d.x, y: d.y, z: c.labelHeight,
          text: unlocked ? 'OPEN' : 'LOCKED', size: c.iconTextSize, color: unlocked ? c.openColor : c.lockedColor });
        if (unlocked) {
          VR.render.submit({ kind: 'circle', layer: 'floor', x: d.x, y: d.y, z: 0, radius: c.iconRadius, color: c.openColor, alpha: 0.5 });
        }
      }
      if (entry && sealT > 0) {
        VR.render.submit({ kind: 'circle', layer: 'overlay', x: entry.x, y: entry.y, z: 0, radius: c.iconRadius,
          color: c.sealColor, outline: true, width: 3, alpha: sealT / c.sealFlash });
      }
      if (scanT > 0) {
        var pulse = Math.sin(VR.loop.time * c.scanPulseHz * Math.PI * 2) * c.scanRingPulse;
        for (i = 0; i < VR.enemies.list.length; i++) {
          var e = VR.enemies.list[i];
          if (!e.alive || e.spaced) continue;
          VR.render.submit({ kind: 'circle', layer: 'overlay', x: e.x, y: e.y, z: 0, radius: e.radius + c.scanRingPad + pulse,
            color: c.scanColor, outline: true, width: 2 });
          VR.render.submit({ kind: 'marker', layer: 'overlay', x: e.x, y: e.y, z: e.height, size: c.scanRingPad, color: c.scanColor, width: 2 });
        }
      }
    }
  };
})(window.VR = window.VR || {});
