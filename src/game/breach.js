/*
 * VR.breach: shootable windows and the hull breach they open. Owner: combat-engineer.
 *
 * A window tile (W) absorbs config.breach.windowHp pellets, then blows out: the tile becomes an open hole
 * (TILE.VOID) and for config.breach.pullDuration everything within pullRadius with a clear path is dragged toward
 * it: enemies, corpses, the player, loose crates (they slide tile by tile) and floor weapons. Anything that
 * touches the hole is spaced (killed; crates and weapons vanish). After config.breach.shutterDelay an emergency
 * shutter seals the hole (TILE.WALL). Restarting the room reloads the world, which restores the window; call reset().
 *
 *   VR.breach.hitWindow(tx, ty, damage)   a pellet struck the window tile; opens it when hp runs out
 *   VR.breach.open(tx, ty)                blow the window out now
 *   VR.breach.update(dt, p)               pull, spacing, shutter (VR.roomState calls this each step)
 *   VR.breach.render(p, alpha)            wind streaks, pull ring, hole glow, window cracks
 *   VR.breach.reset()                     forget window damage and open breaches (room restart)
 *   VR.breach.active                      open breaches: { tx, ty, x, y, t }
 */
(function (VR) {
  'use strict';

  var active = [];
  var winHp = {};          // tile index -> remaining window hp
  var item = {};
  var pt = { x: 0, y: 0 };

  // Distance from (x, y) to the hole tile's rectangle (0 when inside it).
  function holeDist(b, x, y) {
    var T = VR.world.T, x0 = b.tx * T, y0 = b.ty * T;
    var cx = x < x0 ? x0 : x > x0 + T ? x0 + T : x;
    var cy = y < y0 ? y0 : y > y0 + T ? y0 + T : y;
    var dx = x - cx, dy = y - cy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // True when nothing solid sits between the point and the hole (cover that is walled or full blocks the draft).
  function openPath(b, x, y) {
    var W = VR.world, h = W.raycast(x, y, b.x, b.y, W.RAY_WALLS | W.RAY_FULL);
    return !h.hit || (h.tx === b.tx && h.ty === b.ty);
  }

  function pullSpeed(d) {
    var c = VR.config.breach, k = 1 - d / c.pullRadius;
    return c.pullSpeedMin + (c.pullSpeedMax - c.pullSpeedMin) * (k < 0 ? 0 : k);
  }

  // Drag entity e toward the hole; returns true if it reached it. Gives up (false) when out of range or shielded.
  function drag(b, e, dt) {
    var c = VR.config.breach;
    var dx = b.x - e.x, dy = b.y - e.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d > c.pullRadius || d < 1) return false;
    if (holeDist(b, e.x, e.y) - e.radius <= c.reachSlack) return true;
    if (!openPath(b, e.x, e.y)) return false;
    var s = pullSpeed(d) * dt;
    VR.world.moveCircle(e, dx / d * s, dy / d * s);
    e.pulledNow = true;
    return holeDist(b, e.x, e.y) - e.radius <= c.reachSlack;
  }

  function space(e, b) {
    e.spaced = true;
    e.dropped = true;                       // a spaced grunt takes its pistol with it
    if (e.alive) VR.enemies.kill(e, 0, 0, 0, 'breach');
    e.vx = e.vy = 0;
    // Pin the corpse to the hole so interpolation does not smear it across the room.
    e.x = e.px = b.x; e.y = e.py = b.y;
  }

  function pullCrates(b, dt) {
    var covers = VR.world.covers, W = VR.world, c = VR.config.breach;
    for (var i = covers.length - 1; i >= 0; i--) {
      var cv = covers[i];
      if (!cv.alive || cv.type !== 'crate') continue;
      var dx = b.x - cv.x, dy = b.y - cv.y;
      if (dx * dx + dy * dy > c.pullRadius * c.pullRadius || !openPath(b, cv.x, cv.y)) continue;
      cv.slideT = (cv.slideT || 0) + dt;
      if (cv.slideT < c.crateSlideInterval) continue;
      cv.slideT = 0;
      // Step along the dominant axis first, the other axis if that way is blocked.
      var sx = dx > 0 ? 1 : dx < 0 ? -1 : 0, sy = dy > 0 ? 1 : dy < 0 ? -1 : 0;
      var xFirst = Math.abs(dx) >= Math.abs(dy);
      for (var k = 0; k < 2; k++) {
        var alongX = (k === 0) === xFirst;
        var ntx = cv.tx + (alongX ? sx : 0), nty = cv.ty + (alongX ? 0 : sy);
        if (ntx === cv.tx && nty === cv.ty) continue;
        if (ntx === b.tx && nty === b.ty) {
          W.removeCover(cv);
          VR.fx.debris(b.x, b.y);
          VR.audio.play('kick');
          break;
        }
        if (W.tile(ntx, nty) === W.TILE.FLOOR && !W.coverAt(ntx, nty)) { VR.cover.move(cv, ntx, nty); break; }
      }
    }
  }

  function pullItems(b, dt) {
    var items = VR.weapons.items, c = VR.config.breach;
    for (var i = items.length - 1; i >= 0; i--) {
      var it = items[i];
      var dx = b.x - it.x, dy = b.y - it.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > c.pullRadius || !openPath(b, it.x, it.y)) continue;
      var s = Math.min(pullSpeed(d) * dt, d);
      it.x += dx / d * s; it.y += dy / d * s;
      if (holeDist(b, it.x, it.y) <= c.reachSlack) items.splice(i, 1);
    }
  }

  function pull(b, p, dt) {
    var c = VR.config.breach, list = VR.enemies.list, i, e;
    for (i = 0; i < list.length; i++) {
      e = list[i];
      if (e.spaced) continue;
      e.pulledNow = false;
      if (drag(b, e, dt)) space(e, b);
      else if (e.pulledNow && e.alive) { e.pullT = c.pullGrace; e.winding = false; }
    }
    if (p.alive) {
      p.pulledNow = false;
      if (drag(b, p, dt)) VR.player.hit(p, 'breach');
      else if (p.pulledNow) { p.cover = null; p.popped = false; p.leanOff = 0; }
    }
    pullCrates(b, dt);
    pullItems(b, dt);
  }

  // Contact with the open hole kills even after the pull has faded.
  function touch(b, p) {
    var c = VR.config.breach, list = VR.enemies.list, i, e;
    for (i = 0; i < list.length; i++) {
      e = list[i];
      if (e.alive && holeDist(b, e.x, e.y) - e.radius <= c.reachSlack) space(e, b);
    }
    if (p.alive && holeDist(b, p.x, p.y) - p.radius <= c.reachSlack) VR.player.hit(p, 'breach');
  }

  VR.breach = {
    active: active,

    reset: function () { active.length = 0; winHp = {}; },

    hitWindow: function (tx, ty, damage) {
      var W = VR.world;
      if (W.tile(tx, ty) !== W.TILE.WINDOW) return;
      var i = ty * W.cols + tx;
      var hp = (winHp[i] === undefined ? VR.config.breach.windowHp : winHp[i]) - damage;
      winHp[i] = hp;
      if (hp <= 0) VR.breach.open(tx, ty);
    },

    open: function (tx, ty) {
      var W = VR.world, c = VR.config.breach;
      if (W.tile(tx, ty) !== W.TILE.WINDOW) return;
      W.setTile(tx, ty, W.TILE.VOID);
      active.push({ tx: tx, ty: ty, x: (tx + 0.5) * W.T, y: (ty + 0.5) * W.T, t: 0 });
      delete winHp[ty * W.cols + tx];
      VR.audio.play('breach');
      VR.camera.shake(c.openShake, c.openShakeDuration);
      VR.loop.hitStop(c.openHitStop);
      if (VR.roomState) VR.roomState.activate();
      VR.enemies.alertNear((tx + 0.5) * W.T, (ty + 0.5) * W.T, VR.config.enemy.noiseRadius);
    },

    update: function (dt, p) {
      var c = VR.config.breach;
      for (var i = active.length - 1; i >= 0; i--) {
        var b = active[i];
        b.t += dt;
        if (b.t < c.pullDuration) pull(b, p, dt);
        if (b.t >= c.shutterDelay) {
          VR.world.setTile(b.tx, b.ty, VR.world.TILE.WALL);
          VR.audio.play('click');
          VR.camera.shake(c.sealShake, c.sealShakeDuration);
          active.splice(i, 1);
        } else {
          touch(b, p);
        }
      }
    },

    render: function (p, alpha) {
      var c = VR.config.breach, W = VR.world, i, k;
      // Cracks on damaged windows.
      for (var key in winHp) {
        var idx = +key, hp = winHp[key];
        item.kind = 'marker'; item.layer = 'overlay';
        item.x = (idx % W.cols + 0.5) * W.T; item.y = (Math.floor(idx / W.cols) + 0.5) * W.T;
        item.z = VR.config.render.windowHeight * 0.5;
        item.size = c.crackSize; item.color = c.crackColor; item.width = 1;
        item.alpha = 1 - hp / c.windowHp;
        VR.render.submit(item);
      }
      for (i = 0; i < active.length; i++) {
        var b = active[i];
        item = { kind: 'projectile', layer: 'overlay', x: b.x, y: b.y, z: c.holeHeight, radius: c.holeRadius,
          color: c.holeColor, alpha: 1 };
        VR.render.submit(item);
        if (b.t >= c.pullDuration) continue;
        var fade = 1 - b.t / c.pullDuration;
        VR.render.submit({ kind: 'circle', layer: 'floor', x: b.x, y: b.y, z: 0, radius: c.pullRadius, color: c.ringColor,
          outline: true, width: 2, alpha: c.ringAlpha * fade });
        for (k = 0; k < c.streakCount; k++) {
          // Deterministic spokes so the wind reads as a steady inward flow without per-frame random.
          var ang = (k / c.streakCount) * Math.PI * 2 + k * k * c.streakSpin;
          var ph = (VR.loop.time * c.streakSpeed + k * c.streakStagger) % 1;
          var d0 = c.pullRadius * (1 - ph), d1 = d0 * (1 - c.streakLength);
          var cs = Math.cos(ang), sn = Math.sin(ang);
          pt.x = b.x + cs * d0; pt.y = b.y + sn * d0;
          if (W.isSolid(W.toTile(pt.x), W.toTile(pt.y)) || !openPath(b, pt.x, pt.y)) continue;
          VR.render.submit({ kind: 'line', layer: 'floor', x: pt.x, y: pt.y, z: 0, x2: b.x + cs * d1, y2: b.y + sn * d1,
            color: c.streakColor, width: 2, alpha: ph * fade });
        }
      }
    }
  };
})(window.VR = window.VR || {});
