/*
 * VR.player: the player entity (shared shape from src/core/entity.js).
 * Owner: combat-engineer.
 *
 *   VR.player.create(x, y)        -> entity { kind: 'player', aimX, aimY, dashCharges, cover, popped, ... }
 *   VR.player.update(p, dt)       fixed step: movement, aim, dash, cover, kick, pickup/throw, fire
 *   VR.player.render(p, alpha)    submit draw items (body, aim line, reticle) and set the wall-fade focus
 *   VR.player.hit(p, cause)       lethal hit; false if dodged (dash i-frames) or absorbed (p.shield > 0)
 *   VR.player.isProtectedFrom(p, sx, sy)   true if cover shields p from a shooter at (sx, sy) (see VR.cover.assess)
 *
 * Other owners plug in through optional hooks, each skipped when absent so this file runs standalone:
 *   VR.weapons.tryFire(p)  VR.weapons.pickupOrThrow(p)  VR.enemies.kick(p)  VR.doors.kick(p)
 * After death the player waits config.combat.deathFreeze, then sets p.restartRequested = true and calls
 * VR.roomState.restart() if it exists. The scene owning the player restarts the room on either signal.
 */
(function (VR) {
  'use strict';

  var dir = { x: 0, y: 0 };
  var item = {};   // reused submit record

  function setItem(kind, layer) {
    for (var k in item) delete item[k];
    item.kind = kind;
    item.layer = layer;
    return item;
  }

  // Unit world-space move direction from WASD (screen-relative) into `dir`; false when no key is held.
  function readMove() {
    var keys = VR.config.keys, input = VR.input;
    var sx = (input.down(keys.right) ? 1 : 0) - (input.down(keys.left) ? 1 : 0);
    var sy = (input.down(keys.down) ? 1 : 0) - (input.down(keys.up) ? 1 : 0);
    if (sx === 0 && sy === 0) return false;
    VR.iso.dirToWorld(sx, sy, dir);
    var len = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
    dir.x /= len; dir.y /= len;
    return true;
  }

  function clampAlong(center, offset, T) {
    var h = T / 2;
    return center + (offset < -h ? -h : offset > h ? h : offset);
  }

  function enterCover(p, cover) {
    var T = VR.world.T, off = T / 2 + p.radius + 1;
    var dx = p.x - cover.x, dy = p.y - cover.y;
    // Snap to the face the player is nearest to, so cover has a definite facing.
    if (Math.abs(dx) >= Math.abs(dy)) { p.coverNx = dx >= 0 ? 1 : -1; p.coverNy = 0; }
    else { p.coverNx = 0; p.coverNy = dy >= 0 ? 1 : -1; }
    p.cover = cover;
    p.leanOff = 0;
    // Flush against the chosen face; along the face keep the position, clamped to the block's width.
    p.x = p.coverNx !== 0 ? cover.x + p.coverNx * off : clampAlong(cover.x, dx, T);
    p.y = p.coverNy !== 0 ? cover.y + p.coverNy * off : clampAlong(cover.y, dy, T);
  }

  function leaveCover(p) { p.cover = null; p.popped = false; p.leanOff = 0; }

  function startDash(p) {
    var c = VR.config.player;
    if (!readMove()) {
      var ax = p.aimX - p.x, ay = p.aimY - p.y, al = Math.sqrt(ax * ax + ay * ay) || 1;
      dir.x = ax / al; dir.y = ay / al;
    }
    p.dashDx = dir.x; p.dashDy = dir.y;
    p.dashLeft = c.dashDistance * p.dashDistMul;
    p.dashTime = c.dashDuration;
    p.dashCharges -= 1;
    leaveCover(p);
    VR.audio.play('dash');
  }

  function updateDash(p, dt) {
    var c = VR.config.player;
    var step = Math.min(p.dashLeft, (c.dashDistance * p.dashDistMul / c.dashDuration) * dt);
    VR.world.moveCircle(p, p.dashDx * step, p.dashDy * step);
    p.dashLeft -= step;
    p.dashTime -= dt;
    if (p.dashTime <= 0 || p.dashLeft <= 0.001) {
      p.dashTime = 0;
      // Dashing into cover snaps the player behind it.
      var cv = VR.world.nearestCover(p.x, p.y, c.dashSnapDistance);
      if (cv) enterCover(p, cv);
    }
  }

  function updateMove(p, dt) {
    var c = VR.config.player;
    var moving = readMove();
    p.vx = p.vy = 0;
    if (p.cover) {
      if (!p.cover.alive) { leaveCover(p); }
      else if (!moving || (p.popped && p.cover.type === 'full')) { return; }   // leaning out of full cover is an aiming stance
      else if (dir.x * p.coverNx + dir.y * p.coverNy >= c.coverExitDot) { leaveCover(p); }   // pushing away: step out
      else {
        // Slide along the cover face; the tangent is the normal rotated 90 degrees.
        var tx = -p.coverNy, ty = p.coverNx;
        var s = (dir.x * tx + dir.y * ty) * c.speed * c.coverSpeedScale;
        VR.world.moveCircle(p, tx * s * dt, ty * s * dt);
        p.vx = tx * s; p.vy = ty * s;
        // Stay flush with the block and within its width.
        var T = VR.world.T, cv = p.cover;
        if (p.coverNx === 0) p.x = clampAlong(cv.x, p.x - cv.x, T);
        else p.y = clampAlong(cv.y, p.y - cv.y, T);
        return;
      }
    }
    if (moving) {
      p.vx = dir.x * c.speed; p.vy = dir.y * c.speed;
      VR.world.moveCircle(p, p.vx * dt, p.vy * dt);
    }
  }

  // Leaning out of full cover: slide along the face to its edge on the side being aimed at, and back when released.
  // Blocked by a neighbouring tile the lean stops short, so a wall of pillars gives no firing position.
  function updateLean(p, dt) {
    var c = VR.config.player, cc = VR.config.cover;
    p.leanReady = true;
    if (!p.cover || p.cover.type !== 'full') { p.leanOff = 0; return; }
    var tx = -p.coverNy, ty = p.coverNx;
    var target = 0;
    if (p.popped) {
      var side = (p.aimX - p.x) * tx + (p.aimY - p.y) * ty;
      if (side > cc.leanDeadzone) p.leanSign = 1; else if (side < -cc.leanDeadzone) p.leanSign = -1;
      target = p.leanSign * (VR.world.T / 2 + p.radius + cc.leanDistance);
    }
    var d = target - p.leanOff, step = cc.leanSpeed * dt;
    d = d > step ? step : d < -step ? -step : d;
    if (d === 0) return;
    var bx = p.x, by = p.y;
    VR.world.moveCircle(p, tx * d, ty * d);
    var moved = (p.x - bx) * tx + (p.y - by) * ty;
    p.leanOff += moved;
    // Ready to shoot once at the edge, or once a neighbour blocks the lean (then the shot hits the pillar: no position).
    p.leanReady = !p.popped || Math.abs(target - p.leanOff) < cc.leanReadyDist || Math.abs(moved) < Math.abs(d) * 0.5;
  }

  function kill(p, cause) {
    p.alive = false;
    p.cause = cause || 'unknown';
    // The killing-blow hit-stop counts toward the freeze so death-to-restart totals combat.deathFreeze.
    p.deathTimer = Math.max(0, VR.config.combat.deathFreeze - VR.config.player.hitStopDeath);
    p.vx = p.vy = 0;
    leaveCover(p);
    VR.loop.hitStop(VR.config.player.hitStopDeath);
    VR.camera.shake(VR.config.player.deathShake, VR.config.player.deathShakeDuration);
    VR.audio.play('death');
  }

  VR.player = {
    create: function (x, y) {
      var c = VR.config.player;
      var p = VR.entity.create('player', x, y, c.radius, c.height);
      p.aimX = x; p.aimY = y;
      p.dashCharges = c.dashCharges;
      p.maxDashCharges = c.dashCharges;   // upgrades raise this and dashDistMul
      p.dashDistMul = 1;
      p.dashTime = 0; p.dashLeft = 0; p.dashDx = 0; p.dashDy = 0;
      p.shield = 0;                        // extra hits absorbed (upgrade)
      p.cover = null; p.coverNx = 0; p.coverNy = 0; p.popped = false;
      p.leanOff = 0; p.leanSign = 1; p.leanReady = true;     // lean out of full cover: offset along the face and chosen side
      p.kickTime = 0; p.kickCooldown = 0;
      p.deathTimer = 0; p.cause = ''; p.restartRequested = false;
      return p;
    },

    update: function (p, dt) {
      var c = VR.config.player, keys = VR.config.keys, input = VR.input;
      VR.entity.savePrev(p);

      p.aimX = input.mouse.wx;
      p.aimY = input.mouse.wy;
      p.angle = Math.atan2(p.aimY - p.y, p.aimX - p.x);

      if (!p.alive) {
        // Frozen: wait out the death freeze, then ask for the instant restart.
        if (!p.restartRequested) {
          p.deathTimer -= dt;
          if (p.deathTimer <= 0) {
            p.restartRequested = true;
            if (VR.roomState && VR.roomState.restart) VR.roomState.restart();
          }
        }
        return;
      }

      // Dash charges refill continuously, one charge per dashRecharge seconds.
      if (p.dashCharges < p.maxDashCharges) {
        p.dashCharges = Math.min(p.maxDashCharges, p.dashCharges + dt / c.dashRecharge);
      }
      if (p.kickCooldown > 0) p.kickCooldown -= dt;
      if (p.kickTime > 0) p.kickTime -= dt;

      if (p.dashTime <= 0 && input.pressed(keys.dash) && p.dashCharges >= 1) startDash(p);
      if (p.dashTime > 0) {
        updateDash(p, dt);
      } else {
        if (input.pressed(keys.cover)) {
          if (p.cover) leaveCover(p);
          else {
            var cv = VR.world.nearestCover(p.x, p.y, c.coverEnterDistance);
            if (cv) enterCover(p, cv);
          }
        }
        updateMove(p, dt);
      }

      // Holding right click while in cover pops out: exposed, but allowed to shoot.
      p.popped = !!p.cover && input.mouseDown(2);
      updateLean(p, dt);

      if (input.pressed(keys.kick) && p.kickCooldown <= 0) {
        p.kickTime = c.kickDuration;
        p.kickCooldown = c.kickCooldown;
        VR.audio.play('kick');
        if (VR.enemies && VR.enemies.kick) VR.enemies.kick(p);
        if (VR.doors && VR.doors.kick) VR.doors.kick(p);
      }
      if (input.pressed(keys.pickup) && VR.weapons && VR.weapons.pickupOrThrow) VR.weapons.pickupOrThrow(p);

      // Dashing is a committed move; crouched cover needs a pop-out before the gun comes up.
      var canShoot = p.dashTime <= 0 && (!p.cover || (p.popped && p.leanReady));
      if (canShoot && input.mouseDown(0) && VR.weapons && VR.weapons.tryFire) VR.weapons.tryFire(p);
    },

    // True when cover shields the player from a shooter at (sx, sy) right now.
    isProtectedFrom: function (p, sx, sy) { return VR.cover.isProtected(p, sx, sy); },

    // Lethal hit. Returns true if the player died.
    hit: function (p, cause) {
      if (!p.alive || p.dashTime > 0) return false;   // dash i-frames
      if (p.shield > 0) { p.shield--; VR.audio.play('click'); return false; }
      kill(p, cause);
      return true;
    },

    render: function (p, alpha) {
      var colors = VR.config.render.colors, rc = VR.config.render;
      var x = VR.entity.ix(p, alpha), y = VR.entity.iy(p, alpha);
      // Aim uses the cursor as of this frame so the line ends exactly under it.
      var ax = VR.input.mouse.wx, ay = VR.input.mouse.wy;
      var angle = Math.atan2(ay - y, ax - x);

      var it;
      if (p.alive) {
        it = setItem('line', 'floor');
        it.x = x; it.y = y; it.x2 = ax; it.y2 = ay; it.color = colors.aimLine; it.width = rc.aimLineWidth;
        VR.render.submit(it);
      }

      it = setItem('actor', 'world');
      it.x = x; it.y = y; it.z = 0; it.radius = p.radius; it.height = p.height;
      it.angle = angle;
      it.color = !p.alive ? colors.playerDead : p.dashTime > 0 ? colors.playerDash
        : p.cover && !p.popped ? colors.playerCover : colors.player;
      VR.render.submit(it);

      it = setItem('marker', 'overlay');
      it.x = ax; it.y = ay; it.size = rc.reticleSize; it.color = colors.reticle; it.width = 1;
      VR.render.submit(it);

      VR.render.setFocus(x, y, p.radius, p.height);
    }
  };
})(window.VR = window.VR || {});
