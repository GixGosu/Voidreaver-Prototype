/*
 * VR.weapons: shotgun, pistol, enemy bullets, floor pickups and thrown weapons. Owner: combat-engineer.
 *
 *   VR.weapons.equip(p, type, ammo)    type 'shotgun' | 'pistol' | 'none'; sets p.weapon
 *   VR.weapons.tryFire(p)              called by the player while left click is held
 *   VR.weapons.pickupOrThrow(p)        G: swap with a weapon on the floor, else throw an empty one
 *   VR.weapons.spawnBullet(owner, x, y, angle, maxDist, ownCover)   enemy bullet (travels at enemy.bulletSpeed);
 *                                      maxDist 0 = enemy.bulletMaxDist; ownCover is the shooter's own cover, fired over
 *   VR.weapons.refill(p)               full shells (room clear)
 *   VR.weapons.maxShells(p)            shellsPerRoom + p.shellBonus (optional upgrade hook)
 *   VR.weapons.drop(type, ammo, x, y)  leave a weapon on the floor
 *   VR.weapons.snapshot() / restore(s) / reset()   floor items for VR.roomState
 *   VR.weapons.update(dt, p) / render(p, alpha)
 *
 * Optional upgrade hooks read from the player: p.shellBonus (extra shells), p.spreadMul (spread multiplier).
 * Pellets and pistol rounds are hitscan raycasts: nearest of walls/full cover (windows take breach damage), half cover (crates take damage,
 * the shooter's own cover is ignored because you fire over it) and living enemies.
 */
(function (VR) {
  'use strict';

  var items = [];     // { type, ammo, x, y, vx, vy, flying, travelled }
  var bullets = [];   // enemy bullets
  var out = { dist: 0, enemy: null, crate: null, win: false, wtx: 0, wty: 0, ex: 0, ey: 0 };
  var touched = [];
  var mz = { x: 0, y: 0 };

  function rad() { return Math.PI / VR.config.combat.halfTurnDeg; }

  // Distance along the unit ray (ox, oy, dx, dy) to a circle, or -1 for a miss.
  function rayCircle(ox, oy, dx, dy, len, cx, cy, r) {
    var fx = cx - ox, fy = cy - oy;
    var t = fx * dx + fy * dy;
    if (t < -r || t > len + r) return -1;
    var perp2 = fx * fx + fy * fy - t * t;
    if (perp2 > r * r) return -1;
    var d = t - Math.sqrt(r * r - perp2);
    return d < 0 ? 0 : d;
  }

  // Trace one shot from the player; fills `out` with the end distance and what it struck.
  function trace(p, ang, range, slop) {
    var W = VR.world, dx = Math.cos(ang), dy = Math.sin(ang);
    var ox = p.x, oy = p.y;
    var h = W.raycast(ox, oy, ox + dx * range, oy + dy * range, W.RAY_WALLS | W.RAY_FULL);
    var dist = h.hit ? h.dist : range;
    out.crate = null;
    // A window at the end of the ray takes the hit unless something nearer catches the shot first.
    out.win = h.hit && h.tile === W.TILE.WINDOW;
    out.wtx = h.tx; out.wty = h.ty;
    var hh = W.raycast(ox, oy, ox + dx * dist, oy + dy * dist, W.RAY_HALF);
    if (hh.hit && hh.cover && hh.cover !== p.cover) { dist = hh.dist; out.crate = hh.cover; out.win = false; }
    var list = VR.enemies.list, best = null;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!e.alive) continue;
      var t = rayCircle(ox, oy, dx, dy, dist, e.x, e.y, e.radius + slop);
      if (t >= 0 && t <= dist) { dist = t; best = e; out.crate = null; out.win = false; }
    }
    out.enemy = best;
    out.dist = dist;
    out.ex = ox + dx * dist;
    out.ey = oy + dy * dist;
    return out;
  }

  function muzzle(p, offset, o) {
    o.x = p.x + Math.cos(p.angle) * offset;
    o.y = p.y + Math.sin(p.angle) * offset;
  }

  function fireShotgun(p, w) {
    var c = VR.config.shotgun, i, n = c.pellets;
    var spread = c.spreadDeg * (p.spreadMul || 1) * rad();
    var slice = spread / n;
    touched.length = 0;
    muzzle(p, c.muzzleOffset, mz);
    var totalHits = 0;
    for (i = 0; i < n; i++) {
      // Fan the pellets evenly across the cone, jittered inside their slice, so close range is reliable.
      var ang = p.angle - spread * 0.5 + slice * (i + 0.5) + (Math.random() - 0.5) * slice * c.pelletJitter;
      trace(p, ang, c.range, c.pelletSlop);
      VR.fx.tracer(mz.x, mz.y, out.ex, out.ey);
      if (out.enemy) {
        var e = out.enemy;
        if (e.pellets === 0) touched.push(e);
        e.pellets++;
        totalHits++;
      } else if (out.crate) {
        VR.cover.damage(out.crate, c.crateDamage);
      } else if (out.win) {
        if (VR.breach) VR.breach.hitWindow(out.wtx, out.wty, VR.config.breach.hitDamage);
      }
    }
    for (i = 0; i < touched.length; i++) {
      var t = touched[i], ddx = t.x - p.x, ddy = t.y - p.y, dd = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
      var fall = 1 - c.knockbackFalloff * Math.min(1, dd / c.range);
      t.pellets = 0;
      VR.enemies.damage(t, ddx / dd, ddy / dd, c.knockback * fall, 'shotgun');
    }
    VR.fx.flash(mz.x, mz.y, p.height * VR.config.enemy.muzzleHeight);
    VR.camera.shake(c.shakeBase + c.shakePerPellet * totalHits, c.shakeDuration);
    VR.audio.play('shot');
    VR.enemies.alertNear(p.x, p.y, VR.config.enemy.noiseRadius);
    w.ammo--;
    w.cooldown = c.pumpDelay;
  }

  function firePistol(p, w) {
    var c = VR.config.pistol;
    var ang = p.angle + (Math.random() - 0.5) * c.spreadDeg * rad();
    trace(p, ang, c.range, VR.config.shotgun.pelletSlop);
    muzzle(p, c.muzzleOffset, mz);
    VR.fx.tracer(mz.x, mz.y, out.ex, out.ey);
    VR.fx.flash(mz.x, mz.y, p.height * VR.config.enemy.muzzleHeight);
    if (out.enemy) {
      VR.enemies.damage(out.enemy, Math.cos(ang), Math.sin(ang), c.knockback, 'pistol');
    } else if (out.crate) {
      VR.cover.damage(out.crate, VR.config.shotgun.crateDamage);
    } else if (out.win) {
      if (VR.breach) VR.breach.hitWindow(out.wtx, out.wty, VR.config.breach.hitDamage);
    }
    VR.camera.shake(c.shake, c.shakeDuration);
    VR.audio.play('shot', c.shotVolume);
    VR.enemies.alertNear(p.x, p.y, VR.config.enemy.noiseRadius * 0.5);
    w.ammo--;
    w.cooldown = c.delay;
  }

  function nearestItem(p) {
    var best = null, range = VR.config.combat.pickupRange, bd2 = range * range;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.flying) continue;
      var dx = it.x - p.x, dy = it.y - p.y, d2 = dx * dx + dy * dy;
      if (d2 <= bd2) { bd2 = d2; best = it; }
    }
    return best;
  }

  var weapons = {
    items: items,
    bullets: bullets,

    equip: function (p, type, ammo) {
      p.weapon = { type: type, ammo: ammo, cooldown: 0, queued: 0 };
    },

    maxShells: function (p) { return VR.config.shotgun.shellsPerRoom + (p.shellBonus || 0); },

    refill: function (p) {
      if (p.weapon && p.weapon.type === 'shotgun') p.weapon.ammo = weapons.maxShells(p);
      for (var i = 0; i < items.length; i++) if (items[i].type === 'shotgun') items[i].ammo = weapons.maxShells(p);
    },

    drop: function (type, ammo, x, y) {
      items.push({ type: type, ammo: ammo, x: x, y: y, vx: 0, vy: 0, flying: false, travelled: 0 });
    },

    tryFire: function (p) {
      var w = p.weapon;
      if (!w || w.type === 'none') return false;
      if (VR.input.mousePressed(0)) w.queued = VR.config.shotgun.fireBuffer;
      if (w.queued <= 0 || w.cooldown > 0) return false;
      w.queued = 0;
      if (w.ammo <= 0) {
        VR.audio.play('click');   // empty: throw it with G
        return false;
      }
      if (VR.roomState) VR.roomState.activate();
      if (w.type === 'shotgun') fireShotgun(p, w); else firePistol(p, w);
      return true;
    },

    pickupOrThrow: function (p) {
      var near = nearestItem(p), w = p.weapon;
      if (near) {
        // Swap: the held weapon (if any) drops where the new one lay.
        var old = (w && w.type !== 'none') ? { type: w.type, ammo: w.ammo } : null;
        items.splice(items.indexOf(near), 1);
        weapons.equip(p, near.type, near.ammo);
        if (old) weapons.drop(old.type, old.ammo, near.x, near.y);
        VR.audio.play('click');
        return true;
      }
      if (w && w.type !== 'none' && w.ammo <= 0) {
        var c = VR.config.combat;
        items.push({ type: w.type, ammo: 0, x: p.x, y: p.y, vx: Math.cos(p.angle) * c.throwSpeed,
          vy: Math.sin(p.angle) * c.throwSpeed, flying: true, travelled: 0 });
        weapons.equip(p, 'none', 0);
        VR.audio.play('kick');
        return true;
      }
      return false;
    },

    spawnBullet: function (owner, x, y, angle, maxDist, ownCover) {
      var s = VR.config.enemy.bulletSpeed;
      bullets.push({ x: x, y: y, px: x, py: y, sx: owner.x, sy: owner.y, vx: Math.cos(angle) * s, vy: Math.sin(angle) * s,
        speed: s, travelled: 0, max: maxDist || VR.config.enemy.bulletMaxDist, own: ownCover || null });
    },

    reset: function () { items.length = 0; bullets.length = 0; },

    snapshot: function () { return items.map(function (i) { return { type: i.type, ammo: i.ammo, x: i.x, y: i.y }; }); },

    restore: function (snap) {
      weapons.reset();
      for (var i = 0; i < snap.length; i++) weapons.drop(snap[i].type, snap[i].ammo, snap[i].x, snap[i].y);
    },

    update: function (dt, p) {
      var W = VR.world, ec = VR.config.enemy, c = VR.config.combat, i, k, list = VR.enemies.list;
      if (p.weapon) {
        if (p.weapon.cooldown > 0) p.weapon.cooldown -= dt;
        if (p.weapon.queued > 0) p.weapon.queued -= dt;
      }

      // Thrown weapons: stun the first enemy hit, otherwise stop at a wall or at max range.
      for (i = 0; i < items.length; i++) {
        var it = items[i];
        if (!it.flying) continue;
        var nx = it.x + it.vx * dt, ny = it.y + it.vy * dt;
        var wall = W.raycast(it.x, it.y, nx, ny, W.RAY_WALLS | W.RAY_FULL | W.RAY_HALF).hit;
        var victim = null;
        for (k = 0; k < list.length; k++) {
          var e = list[k];
          if (!e.alive) continue;
          var ddx = e.x - nx, ddy = e.y - ny, rr = e.radius + c.throwRadius;
          if (ddx * ddx + ddy * ddy <= rr * rr) { victim = e; break; }
        }
        if (victim) { VR.enemies.stun(victim, c.throwStun); VR.audio.play('kick'); }
        if (!wall) { it.x = nx; it.y = ny; }
        it.travelled += Math.sqrt(it.vx * it.vx + it.vy * it.vy) * dt;
        if (victim || wall || it.travelled >= c.throwRange) { it.flying = false; it.vx = it.vy = 0; }
      }

      // Enemy bullets: stopped by walls, full cover and half cover (except the cover you pop out over).
      for (i = bullets.length - 1; i >= 0; i--) {
        var b = bullets[i], step = b.speed * dt;
        b.px = b.x; b.py = b.y;
        var tx = b.x + b.vx * dt, ty = b.y + b.vy * dt;
        var stop = step, dead = false;
        var wh = W.raycast(b.x, b.y, tx, ty, W.RAY_WALLS | W.RAY_FULL);
        if (wh.hit) { stop = wh.dist; dead = true; }
        var ch = W.raycast(b.x, b.y, tx, ty, W.RAY_HALF);
        if (ch.hit && ch.dist < stop && ch.cover !== b.own && !(p.cover && ch.cover === p.cover && p.popped)) {
          stop = ch.dist; dead = true;
          if (ch.cover) VR.cover.damage(ch.cover, VR.config.cover.bulletDamage);   // crates chip away under fire
        }
        // Dashing is invulnerable, so a bullet simply passes through the dasher.
        if (p.alive && p.dashTime <= 0) {
          var pt = rayCircle(b.x, b.y, b.vx / b.speed, b.vy / b.speed, step, p.x, p.y, p.radius + ec.bulletRadius);
          if (pt >= 0 && pt <= stop) {
            if (!VR.cover.isProtected(p, b.sx, b.sy)) VR.player.hit(p, 'bullet');
            dead = true;
          }
        }
        b.travelled += step;
        if (dead || b.travelled >= b.max) { bullets.splice(i, 1); continue; }
        b.x = tx; b.y = ty;
      }
    },

    render: function (p, alpha) {
      var h = VR.config.hit, i, it, label;
      for (i = 0; i < items.length; i++) {
        it = items[i];
        VR.render.submit({ kind: 'block', x: it.x, y: it.y, z: 0, w: h.pickupW, d: h.pickupD, height: h.pickupH, color: h.pickupColor });
      }
      for (i = 0; i < bullets.length; i++) {
        var b = bullets[i];
        VR.render.submit({ kind: 'projectile', x: b.x, y: b.y, z: p.height * VR.config.enemy.muzzleHeight,
          x2: b.px, y2: b.py, radius: VR.config.enemy.bulletRadius, color: h.telegraphColor });
      }
      // Stopgap readout until the HUD exists: weapon letter and ammo above the player's head.
      if (p.alive && p.weapon) {
        label = p.weapon.type === 'none' ? '-' : p.weapon.type.charAt(0).toUpperCase() + p.weapon.ammo;
        VR.render.submit({ kind: 'text', layer: 'overlay', x: VR.entity.ix(p, alpha), y: VR.entity.iy(p, alpha),
          z: p.height + h.comboPopHeight * 0.5, text: label, size: h.textSize,
          color: p.weapon.ammo > 0 ? '#ffffff' : h.telegraphColor });
      }
    }
  };

  VR.weapons = weapons;
})(window.VR = window.VR || {});
