/*
 * VR.enemies: enemy entities and their state machines. Owner: combat-engineer.
 *
 * States: idle | patrol -> react (reaction delay, muzzle / lunge telegraph) -> attack (shooter) | charge (melee)
 *         -> search (lost sight) -> patrol/idle.   Any state can become stunned or knocked; knocked into a wall = dead.
 *
 *   VR.enemies.list                      every enemy including corpses (corpses have alive === false)
 *   VR.enemies.spawnFromWorld(p)         create enemies from VR.world.spawns (g, r)
 *   VR.enemies.spawn(id, x, y, faceAngle)   one enemy of a VR.data.enemies type (debug / scripted rooms)
 *   VR.enemies.clear()
 *   VR.enemies.aliveCount()
 *   VR.enemies.damage(e, dx, dy, force, cause)   one hit; kills unless armored hp remains; (dx, dy) is the unit shot direction
 *   VR.enemies.kill(e, dx, dy, force, cause)
 *   VR.enemies.stun(e, seconds)
 *   VR.enemies.knock(e, dx, dy, speed, time, stunAfter)
 *   VR.enemies.alertNear(x, y, radius)   noise: wakes unalerted enemies in range into their reaction delay
 *   VR.enemies.kick(p)                   the player's kick: knock back and stun enemies in front
 *   VR.enemies.stunNear(x, y, radius, seconds, shove)   door kick hook (doors.js): stuns every living enemy within
 *                                        radius px of (x, y) for "seconds"; shove = true also knocks them away from
 *                                        the point (combat.doorStunKnock px/s, so a wall behind them kills).
 *                                        Heavies (def.kickImmune) are shoved only, never stunned. Returns the count hit.
 *
 * Types (VR.data.enemies): grunt, rusher, gunner ('n': rifle bursts, hops between half-cover points, suppresses a
 * player who hides), heavy ('H': several hits to kill, shotgun blast of pellets, wall-kill and stun immune).
 *   VR.enemies.snapshot() / restore(s)   for VR.roomState
 *   VR.enemies.update(dt, p) / render(p, alpha)
 */
(function (VR) {
  'use strict';

  var list = [];
  var tmp = { x: 0, y: 0 };

  function types() { return VR.data.enemies.types; }

  function create(id, x, y, faceAngle, index) {
    var def = types()[id], cfg = VR.config.enemy[def.cfg];
    var e = VR.entity.create(id, x, y, cfg.radius, cfg.height);
    e.def = def; e.cfg = cfg;
    e.state = cfg.patrolLeg > 0 ? 'patrol' : 'idle';
    e.t = 0;                      // generic state timer
    e.hp = cfg.hp;
    e.pellets = 0;                // pellets landed by the shot being resolved (weapons.js)
    e.angle = faceAngle;
    e.heading = faceAngle + (cfg.patrolLeg > 0 ? Math.PI * 0.5 : 0);
    e.leg = 0; e.pause = 0;
    e.alerted = false;
    e.react = 0; e.reactTotal = 0;
    e.fresh = true;               // next shot is the first one after reacting
    e.fireTimer = 0; e.windT = 0; e.winding = false;
    e.lastX = x; e.lastY = y; e.lostT = 0;
    e.strafe = index % 2 === 0 ? 1 : -1; e.strafeT = 0;
    e.detourT = 0; e.detourSign = 1;
    e.stun = 0; e.knockT = 0; e.stunAfter = 0;
    e.dropped = false;
    e.prot = false; e.lofCover = null; e.lofNx = 0; e.lofNy = 0;   // protection of the player from this enemy (VR.cover.assess)
    e.gs = 'start'; e.burstLeft = 0; e.moveT = 0; e.tx = x; e.ty = y; e.cp = null;   // gunner: sub-state, burst, move target, cover in use
    e.pullT = 0; e.spaced = false;   // breach: AI frozen while dragged, hidden once spaced
    return e;
  }

  function turnTo(e, target, dt) {
    var d = target - e.angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    var max = VR.config.enemy.turnRate * dt;
    e.angle += d > max ? max : d < -max ? -max : d;
  }

  function canSee(e, p, anyAngle) {
    var c = VR.config.enemy, W = VR.world;
    var dx = p.x - e.x, dy = p.y - e.y, d2 = dx * dx + dy * dy;
    if (d2 > c.sightRange * c.sightRange) return false;
    if (!anyAngle && d2 > c.hearRange * c.hearRange) {
      var diff = Math.atan2(dy, dx) - e.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > c.fovDeg * Math.PI / VR.config.combat.halfTurnDeg * 0.5) return false;
    }
    return !W.raycast(e.x, e.y, p.x, p.y, W.RAY_WALLS | W.RAY_FULL).hit;
  }

  function beginReact(e) {
    e.alerted = true;
    e.state = 'react';
    e.reactTotal = e.t = VR.config.enemy.reactionDelay * e.cfg.reactionMul;
    e.fresh = true;
    e.lostT = 0;
    if (VR.roomState) VR.roomState.activate();
  }

  function muzzlePos(e, out) {
    out.x = e.x + Math.cos(e.angle) * (e.radius + 2);
    out.y = e.y + Math.sin(e.angle) * (e.radius + 2);
    return out;
  }

  // One trigger pull at (tx, ty): a single bullet, or a fan of pellets for shotgun-armed enemies.
  function fire(e, tx, ty) {
    var c = VR.config.enemy, m = muzzlePos(e, tmp), r = Math.PI / VR.config.combat.halfTurnDeg;
    var ang = Math.atan2(ty - m.y, tx - m.x) + (Math.random() - 0.5) * e.cfg.spreadDeg * r;
    var n = e.cfg.pellets || 1;
    if (n === 1) VR.weapons.spawnBullet(e, m.x, m.y, ang, 0, e.cp);
    else {
      var spread = e.cfg.pelletSpreadDeg * r;
      for (var i = 0; i < n; i++) {
        VR.weapons.spawnBullet(e, m.x, m.y, ang - spread * 0.5 + spread * (i + 0.5) / n + (Math.random() - 0.5) * spread / n, e.cfg.bulletRange, null);
      }
    }
    VR.fx.flash(m.x, m.y, e.height * c.muzzleHeight);
    VR.audio.play('shot', VR.config.pistol.shotVolume);
    e.fireTimer = e.cfg.fireInterval;
    e.winding = false;
    e.fresh = false;
  }

  // Walk toward a point; returns true while still further than `stopDist` away.
  function walk(e, tx, ty, speed, dt) {
    var dx = tx - e.x, dy = ty - e.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1) return false;
    var s = Math.min(speed * dt, d);
    VR.world.moveCircle(e, dx / d * s, dy / d * s);
    return true;
  }

  function updateShooter(e, p, dt) {
    var c = e.cfg, los = canSee(e, p, true);
    if (los) { e.lastX = p.x; e.lastY = p.y; e.lostT = 0; } else { e.lostT += dt; }
    if (e.lostT > VR.config.enemy.loseSightTime) { e.state = 'search'; e.t = VR.config.enemy.searchTime; return; }
    turnTo(e, Math.atan2(e.lastY - e.y, e.lastX - e.x), dt);
    var dx = e.lastX - e.x, dy = e.lastY - e.y, dist = Math.sqrt(dx * dx + dy * dy);

    if (!e.winding) {
      if (!los || dist > c.engageRange) {
        walk(e, e.lastX, e.lastY, c.speed, dt);
      } else {
        // Sidestep while shooting so a standing target is never the whole fight.
        // With the player behind cover keep circling one way, faster, to flank for a clear line; a wall flips it.
        var speed = c.strafeSpeed;
        if (e.prot) speed *= VR.config.enemy.flankSpeedMul;
        else {
          e.strafeT -= dt;
          if (e.strafeT <= 0) { e.strafe = -e.strafe; e.strafeT = c.strafeSwitch; }
        }
        if (VR.world.moveCircle(e, -dy / dist * speed * e.strafe * dt, dx / dist * speed * e.strafe * dt) && e.prot) e.strafe = -e.strafe;
      }
    }
    if (!los || !p.alive) { e.winding = false; return; }
    e.fireTimer -= dt;
    if (e.winding) {
      e.windT -= dt;
      if (e.windT <= 0) fire(e, p.x, p.y);
    } else if (e.fireTimer <= 0) {
      if (e.fresh) fire(e, p.x, p.y);          // the reaction delay already was the telegraph
      else { e.winding = true; e.windT = c.windup; }
    }
  }

  // Cover point for a gunner: a free floor tile beside half cover / a crate, on the far side from the player, with a
  // clear line to the player (so it can fire over the cover). Returns true and fills e.tx / e.ty / e.cp.
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  function pickCover(e, p) {
    var W = VR.world, T = W.T, c = e.cfg, best = null, bs = Infinity, covers = W.covers, list = VR.enemies.list;
    for (var i = 0; i < covers.length; i++) {
      var cv = covers[i];
      if (!cv.alive || cv.type === 'full') continue;
      var cx = cv.x - e.x, cy = cv.y - e.y;
      if (cx * cx + cy * cy > c.coverSearch * c.coverSearch) continue;
      for (var k = 0; k < 4; k++) {
        var nx = DIRS[k][0], ny = DIRS[k][1], tx = cv.tx + nx, ty = cv.ty + ny;
        if (W.isSolid(tx, ty)) continue;
        var px = (tx + 0.5) * T, py = (ty + 0.5) * T, vx = p.x - px, vy = p.y - py, vl = Math.sqrt(vx * vx + vy * vy);
        if (vl < c.coverMinPlayerDist || vl > c.engageRange || (-nx * vx - ny * vy) / vl < c.coverDot) continue;
        var dx = px - e.x, dy = py - e.y, score = dx * dx + dy * dy;
        if (score < c.coverArrive * c.coverArrive || score >= bs) continue;
        var taken = false;
        for (var j = 0; j < list.length; j++) {
          var o = list[j];
          if (o !== e && o.alive && o.def.ai === 'burst' && o.tx === px && o.ty === py) { taken = true; break; }
        }
        if (taken || W.raycast(px, py, p.x, p.y, W.RAY_WALLS | W.RAY_FULL).hit) continue;
        bs = score; best = { x: px, y: py, cover: cv };
      }
    }
    if (!best) return false;
    e.tx = best.x; e.ty = best.y; e.cp = best.cover;
    return true;
  }

  function startBurst(e) {
    var c = e.cfg;
    e.gs = 'burst';
    e.burstLeft = c.burstCount + (e.prot ? c.suppressBonus : 0);
    e.fireTimer = 0;
    // The first burst after the reaction delay was already telegraphed; later ones get the flash wind-up.
    e.winding = !e.fresh;
    e.windT = c.windup;
    if (e.cp && (!e.cp.alive || Math.abs(e.cp.x - e.x) + Math.abs(e.cp.y - e.y) > VR.world.T * c.coverReach)) e.cp = null;
  }

  function updateGunner(e, p, dt) {
    var c = e.cfg, los = canSee(e, p, true);
    if (los) { e.lastX = p.x; e.lastY = p.y; e.lostT = 0; } else { e.lostT += dt; }
    if (e.lostT > VR.config.enemy.loseSightTime) { e.state = 'search'; e.t = VR.config.enemy.searchTime; e.gs = 'pick'; e.winding = false; return; }
    turnTo(e, Math.atan2(e.lastY - e.y, e.lastX - e.x), dt);
    var dx = e.lastX - e.x, dy = e.lastY - e.y, dist = Math.sqrt(dx * dx + dy * dy) || 1;

    switch (e.gs) {
      case 'start':
        startBurst(e);
        return;
      case 'pick':
        e.moveT = 0;
        if (!pickCover(e, p)) {
          e.cp = null;
          if (dist > c.engageRange) { e.tx = e.lastX; e.ty = e.lastY; }   // too far to be useful: close in
          else {
            e.strafe = -e.strafe;
            e.tx = e.x - dy / dist * c.hopDist * e.strafe; e.ty = e.y + dx / dist * c.hopDist * e.strafe;
          }
        }
        e.gs = 'move';
        return;
      case 'move':
        e.moveT += dt;
        if (!walk(e, e.tx, e.ty, c.speed, dt) || e.moveT > c.moveMax) startBurst(e);
        return;
      case 'burst':
        if (!p.alive) { e.winding = false; return; }
        if (e.winding) {
          e.windT -= dt;
          if (e.windT > 0) return;
          e.winding = false;
        }
        e.fireTimer -= dt;
        if (e.fireTimer > 0) return;
        // Suppression: with the line blocked it keeps firing at the last place it saw the player.
        fire(e, e.lastX, e.lastY);
        e.fireTimer = c.burstInterval;
        if (--e.burstLeft <= 0) { e.gs = 'rest'; e.t = e.prot ? c.suppressRest : c.restTime; }
        return;
      case 'rest':
        e.t -= dt;
        if (e.t <= 0) e.gs = 'pick';
        return;
    }
  }

  function updateRusher(e, p, dt) {
    var c = e.cfg;
    turnTo(e, Math.atan2(p.y - e.y, p.x - e.x), dt);
    var dx = p.x - e.x, dy = p.y - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / d, uy = dy / d;
    if (e.detourT > 0) {   // sidestep around whatever blocked the straight line
      e.detourT -= dt;
      var sx = -uy * e.detourSign, sy = ux * e.detourSign;
      ux = (ux + sx) * 0.5; uy = (uy + sy) * 0.5;
    }
    var bx = e.x, by = e.y, want = c.speed * dt;
    VR.world.moveCircle(e, ux * want, uy * want);
    var moved = Math.sqrt((e.x - bx) * (e.x - bx) + (e.y - by) * (e.y - by));
    if (moved < want * 0.5 && e.detourT <= 0) {
      e.detourT = c.detourTime;
      e.detourSign = Math.random() < 0.5 ? 1 : -1;
    }
    if (p.alive && d <= e.radius + p.radius + c.meleeRange) VR.player.hit(p, 'rusher');
  }

  function updatePatrol(e, dt) {
    var c = e.cfg;
    if (e.state === 'idle') return;
    if (e.pause > 0) { e.pause -= dt; return; }
    turnTo(e, e.heading, dt);
    var bx = e.x, by = e.y, want = c.patrolSpeed * dt;
    VR.world.moveCircle(e, Math.cos(e.heading) * want, Math.sin(e.heading) * want);
    var moved = Math.sqrt((e.x - bx) * (e.x - bx) + (e.y - by) * (e.y - by));
    e.leg += moved;
    if (moved < want * 0.5 || e.leg >= c.patrolLeg) {
      e.heading += Math.PI;
      e.leg = 0;
      e.pause = c.patrolPause;
    }
  }

  function updateAlive(e, p, dt) {
    var c = VR.config.enemy, sx, sy;
    switch (e.state) {
      case 'knocked': {
        var spd = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
        var hitWall = VR.world.moveCircle(e, e.vx * dt, e.vy * dt);
        if (hitWall && spd > VR.config.combat.wallKillSpeed && !e.def.kickImmune) {
          VR.enemies.kill(e, e.vx / spd, e.vy / spd, spd * 0.5, 'wall');
          return;
        }
        e.knockT -= dt;
        var k = Math.exp(-VR.config.hit.ragdollFriction * dt);
        e.vx *= k; e.vy *= k;
        if (e.knockT <= 0) {
          e.vx = e.vy = 0;
          if (e.stunAfter > 0) { e.state = 'stunned'; e.stun = e.stunAfter; } else e.state = 'search', e.t = c.searchTime;
        }
        return;
      }
      case 'stunned':
        e.stun -= dt;
        if (e.stun <= 0) { e.state = 'search'; e.t = c.searchTime; e.lastX = p.x; e.lastY = p.y; e.alerted = true; }
        return;
      case 'idle':
      case 'patrol':
        updatePatrol(e, dt);
        if (p.alive && canSee(e, p, false)) beginReact(e);
        return;
      case 'react':
        turnTo(e, Math.atan2(p.y - e.y, p.x - e.x), dt);
        e.t -= dt;
        if (e.t <= 0 && p.alive) {
          e.state = e.def.ai === 'melee' ? 'charge' : 'attack';
          e.fireTimer = 0; e.lastX = p.x; e.lastY = p.y; e.gs = 'start';
        } else if (!p.alive) e.t = Math.max(e.t, dt);
        return;
      case 'attack':
        if (e.def.ai === 'burst') updateGunner(e, p, dt); else updateShooter(e, p, dt);
        return;
      case 'charge':
        if (p.alive) updateRusher(e, p, dt);
        return;
      case 'search':
        if (p.alive && canSee(e, p, true)) {
          e.state = e.def.ai === 'melee' ? 'charge' : 'attack';
          e.fireTimer = 0; e.lostT = 0; e.gs = 'pick';
          return;
        }
        sx = e.lastX; sy = e.lastY;
        if (walk(e, sx, sy, e.cfg.speed, dt)) turnTo(e, Math.atan2(sy - e.y, sx - e.x), dt);
        else e.t -= dt;
        if (e.t <= 0) { e.alerted = false; e.state = e.cfg.patrolLeg > 0 ? 'patrol' : 'idle'; e.leg = 0; }
        return;
    }
  }

  // Cover check for every enemy that is coming for the player; rushers are melee, so cover never helps against them.
  function assessCover(e, p) {
    if (!p.alive || !(e.state === 'react' || e.state === 'attack' || e.state === 'charge')) { e.prot = false; e.lofCover = null; return; }
    var a = VR.cover.assess(p, e.x, e.y);
    e.prot = a.protected && e.def.ai !== 'melee';
    e.lofCover = a.cover; e.lofNx = a.nx; e.lofNy = a.ny;
  }

  function updateDead(e, dt) {
    if (e.vx === 0 && e.vy === 0) return;
    VR.world.moveCircle(e, e.vx * dt, e.vy * dt);
    var k = Math.exp(-VR.config.hit.ragdollFriction * dt);
    e.vx *= k; e.vy *= k;
    if (e.vx * e.vx + e.vy * e.vy < VR.config.hit.ragdollStopSpeed * VR.config.hit.ragdollStopSpeed) e.vx = e.vy = 0;
  }

  function separate(dt) {
    var push = VR.config.enemy.separation * dt;
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      if (!a.alive) continue;
      for (var j = i + 1; j < list.length; j++) {
        var b = list[j];
        if (!b.alive) continue;
        var dx = b.x - a.x, dy = b.y - a.y, min = a.radius + b.radius, d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 === 0) continue;
        var d = Math.sqrt(d2);
        VR.world.moveCircle(a, -dx / d * push, -dy / d * push);
        VR.world.moveCircle(b, dx / d * push, dy / d * push);
      }
    }
  }

  function bodyColor(e) {
    var h = VR.config.hit;
    if (!e.alive) return h.corpseColor;
    if (e.def.id === 'heavy' && e.hp < e.cfg.hp && e.state !== 'stunned') return h.heavyHurtColor;
    if (e.state === 'stunned') return Math.sin(VR.loop.time * VR.config.enemy.stunSwing) > 0 ? h.stunColor : h[e.def.color];
    if (e.state === 'react') return e.t * 2 < e.reactTotal ? h.telegraphColor : h[e.def.color];
    return h[e.def.color];
  }

  var enemies = {
    list: list,

    clear: function () { list.length = 0; },

    spawnFromWorld: function (p) {
      list.length = 0;
      var sp = VR.world.spawns, by = VR.data.enemies.byChar, n = 0;
      for (var i = 0; i < sp.length; i++) {
        var id = by[sp[i].ch];
        if (!id) continue;
        // Everyone starts facing the room entry so the first sighting is a fair, readable moment.
        var face = Math.atan2(p.y - sp[i].y, p.x - sp[i].x);
        list.push(create(id, sp[i].x, sp[i].y, face, n++));
      }
    },

    spawn: function (id, x, y, faceAngle) {
      var e = create(id, x, y, faceAngle, list.length);
      list.push(e);
      return e;
    },

    aliveCount: function () {
      var n = 0;
      for (var i = 0; i < list.length; i++) if (list[i].alive) n++;
      return n;
    },

    kill: function (e, dx, dy, force, cause) {
      if (!e.alive) return;
      var h = VR.config.hit;
      e.alive = false;
      e.state = 'dead';
      e.cause = cause;
      e.height = h.corpseHeight;
      e.vx = dx * force; e.vy = dy * force;
      VR.fx.splatter(e.x, e.y, dx, dy, cause === 'wall');
      if (e.def.drops && !e.dropped) {
        e.dropped = true;
        VR.weapons.drop(e.def.drops, VR.config.pistol.ammo, e.x, e.y);
      }
      var n = VR.combo.onKill();
      if (n > 1) VR.fx.text(e.x, e.y, 'x' + n, h.flashColor);
      VR.loop.hitStop(h.killStop);
      VR.camera.shake(h.killShake, h.killShakeDuration);
      VR.audio.play('kill');
    },

    damage: function (e, dx, dy, force, cause) {
      if (!e.alive) return;
      e.hp -= 1;
      if (e.hp <= 0) { enemies.kill(e, dx, dy, force, cause); return; }
      // Armored hit: a short shove, a count of the hits left, and a hit-stop so the blow lands.
      enemies.knock(e, dx, dy, force * e.cfg.knockResist, VR.config.combat.kickKnockTime, 0);
      e.gs = 'pick';
      VR.fx.text(e.x, e.y, String(e.hp), VR.config.hit.flashColor);
      VR.loop.hitStop(VR.config.hit.killStop);
      VR.camera.shake(VR.config.hit.killShake, VR.config.hit.killShakeDuration);
      VR.audio.play('click');
    },

    stun: function (e, seconds) {
      if (!e.alive) return;
      e.state = 'stunned'; e.stun = seconds; e.vx = e.vy = 0; e.winding = false;
    },

    knock: function (e, dx, dy, speed, time, stunAfter) {
      if (!e.alive) return;
      e.state = 'knocked'; e.vx = dx * speed; e.vy = dy * speed; e.knockT = time; e.stunAfter = stunAfter; e.winding = false;
    },

    alertNear: function (x, y, radius) {
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (!e.alive || (e.state !== 'idle' && e.state !== 'patrol')) continue;
        var dx = e.x - x, dy = e.y - y;
        if (dx * dx + dy * dy <= radius * radius) beginReact(e);
      }
    },

    kick: function (p) {
      var c = VR.config.combat, pc = VR.config.player;
      var ax = Math.cos(p.angle), ay = Math.sin(p.angle), hits = 0;
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (!e.alive) continue;
        var dx = e.x - p.x, dy = e.y - p.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (d > pc.kickRange + e.radius || (dx * ax + dy * ay) / d < c.kickCone) continue;
        hits++;
        if (VR.roomState) VR.roomState.activate();
        // Heavies are shoved but never stunned; walls still kill whatever gets knocked into them.
        enemies.knock(e, dx / d, dy / d, c.kickKnockSpeed * e.cfg.knockResist, c.kickKnockTime, e.def.kickImmune ? 0 : c.kickStun);
      }
      return hits;
    },

    stunNear: function (x, y, radius, seconds, shove) {
      var n = 0, k = VR.config.combat.doorStunKnock;
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (!e.alive) continue;
        var dx = e.x - x, dy = e.y - y, d2 = dx * dx + dy * dy;
        if (d2 > (radius + e.radius) * (radius + e.radius)) continue;
        n++;
        if (VR.roomState) VR.roomState.activate();
        var d = Math.sqrt(d2) || 1;
        if (e.def.kickImmune) enemies.knock(e, dx / d, dy / d, k * e.cfg.knockResist, VR.config.combat.kickKnockTime, 0);
        else if (shove) enemies.knock(e, dx / d, dy / d, k, VR.config.combat.kickKnockTime, seconds);
        else enemies.stun(e, seconds);
        e.gs = 'pick';
      }
      return n;
    },

    snapshot: function () {
      return list.map(function (e) { return Object.assign({}, e); });
    },

    restore: function (snap) {
      list.length = 0;
      for (var i = 0; i < snap.length; i++) list.push(Object.assign({}, snap[i]));
    },

    update: function (dt, p) {
      var i, e;
      for (i = 0; i < list.length; i++) {
        e = list[i];
        VR.entity.savePrev(e);
        if (e.spaced) continue;
        if (e.alive && e.pullT > 0) { e.pullT -= dt; e.winding = false; }   // breach drags it; no AI while airborne
        else if (e.alive) updateAlive(e, p, dt);
        else updateDead(e, dt);
        if (e.alive) assessCover(e, p);
      }
      separate(dt);
    },

    render: function (p, alpha) {
      var c = VR.config.enemy, h = VR.config.hit;
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (e.spaced) continue;
        var x = VR.entity.ix(e, alpha), y = VR.entity.iy(e, alpha);
        VR.render.submit({ kind: 'actor', x: x, y: y, z: 0, radius: e.radius, height: e.height, angle: e.angle, color: bodyColor(e) });
        if (!e.alive) continue;
        var ratio;
        if (e.state === 'react') ratio = 1 - e.t / e.reactTotal;
        else if (e.winding) ratio = 1 - e.windT / e.cfg.windup;
        else continue;
        if (ratio < 0) ratio = 0;
        // Telegraph: a charging muzzle flash and a thin line toward the target; rushers get a closing ring.
        if (e.def.ai === 'melee') {
          VR.render.submit({ kind: 'circle', layer: 'floor', x: x, y: y, radius: e.radius * (3 - 2 * ratio), color: h.telegraphColor,
            outline: true, width: 2, alpha: ratio });
        } else {
          muzzlePos(e, tmp);
          VR.render.submit({ kind: 'projectile', layer: 'overlay', x: tmp.x, y: tmp.y, z: e.height * c.muzzleHeight,
            radius: c.windupFlashRadius * ratio, color: ratio > 0.5 ? h.flashColor : h.telegraphColor });
          VR.render.submit({ kind: 'line', layer: 'floor', x: tmp.x, y: tmp.y, x2: p.x, y2: p.y, color: h.telegraphColor,
            width: 1, alpha: ratio * c.telegraphLineAlpha });
        }
      }
    }
  };

  VR.enemies = enemies;
})(window.VR = window.VR || {});
