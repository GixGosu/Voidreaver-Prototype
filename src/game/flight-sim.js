/*
 * Flight simulation (owner: flight-engineer): everything that moves or collides in the flight run.
 *
 *   VR.flightSim.create()          fresh state f
 *   VR.flightSim.reset(f, cpT)     rebuild the course ahead of the ship at checkpoint time cpT (seconds)
 *   VR.flightSim.step(f, dt, inp)  inp = { strafe (-1..1, +1 = screen-left), up, down, fire }
 *
 * Space: the run scrolls along -x at flight.speed; the ship sits at x = -t * speed. Lateral y is clamped to the
 * lane; z is altitude (one of three bands). Hitboxes are boxes; the ship hitbox is what gaps are sized from.
 * Every threat can only hurt the ship where the ship is, and enemy fire only starts while its source is on
 * screen, so nothing kills from off-screen.
 */
(function (VR) {
  'use strict';

  var tmp = { x: 0, y: 0 };

  function cfg() { return VR.config.flight; }

  function smooth(p) {
    p = p < 0 ? 0 : p > 1 ? 1 : p;
    return p * p * (3 - 2 * p);
  }

  function geo() {
    var c = cfg();
    return {
      gapHalfY: c.ship.width * c.gapMulWidth * 0.5,
      gapHalfZ: c.ship.height * c.gapMulHeight * 0.5,
      wallHalf: c.laneHalf + c.wallOverhang
    };
  }

  // Uses the camera of the last fixed step; enemies only open fire when this says the player can see them.
  function onScreen(x, y, z, margin) {
    var cam = VR.camera.state;
    VR.iso.toScreen(x - cam.x, y - cam.y, z, tmp);
    var sx = tmp.x + VR.render.width * 0.5, sy = tmp.y + VR.render.height * 0.5;
    return sx > margin && sx < VR.render.width - margin && sy > margin && sy < VR.render.height - margin;
  }

  // ---- builders -------------------------------------------------------------------------------------
  // A wall is split into regions (solid left, gap window, solid right) and each region into cells no wider than
  // wallCell, so the renderer can depth-sort the ship against every cell.
  function buildWall(item, isDock) {
    var c = cfg(), g = geo(), d = c.dock, i, k;
    var w = { kind: 'wall', dock: isDock, x: -item.t * c.speed, band: isDock ? 1 : item.band };
    w.thick = isDock ? d.depth : c.wallThickness;
    w.top = isDock ? d.hullTop : c.wallTop;
    w.halfW = isDock ? d.hullHalf : g.wallHalf;
    w.gz0 = Math.max(0, c.bandZ[w.band] - g.gapHalfZ);
    w.gz1 = c.bandZ[w.band] + g.gapHalfZ;
    if (isDock) { w.gy1 = c.ship.width * d.widthMul * 0.5; w.gy0 = -w.gy1; }
    else if (item.u !== null) { w.gy0 = item.u - g.gapHalfY; w.gy1 = item.u + g.gapHalfY; }
    else { w.gy0 = -w.halfW; w.gy1 = w.halfW; }
    var pts = [-w.halfW, Math.max(-w.halfW, w.gy0), Math.min(w.halfW, w.gy1), w.halfW];
    w.regions = [];
    w.cells = [];
    for (i = 0; i < 3; i++) {
      var a = pts[i], b = pts[i + 1];
      if (b - a < 0.001) continue;
      var open = i === 1, pieces = [];
      if (open) {
        if (w.gz0 > 0) pieces.push([0, w.gz0]);
        pieces.push([w.gz1, w.top]);
      } else pieces.push([0, w.top]);
      w.regions.push({ y0: a, y1: b, open: open, pieces: pieces });
      var n = Math.ceil((b - a) / c.wallCell);
      for (k = 0; k < n; k++) w.cells.push({ y0: a + (b - a) * k / n, y1: a + (b - a) * (k + 1) / n, open: open, pieces: pieces });
    }
    return w;
  }

  function buildField(item) {
    var c = cfg();
    return {
      kind: 'field', x: -item.t * c.speed, on: true, fade: 1,
      genY: item.side * (c.laneHalf - c.field.genInset)
    };
  }

  function buildTurrets(item, out) {
    var c = cfg(), k;
    for (k = 0; k < item.n; k++) {
      var side = item.side !== 0 ? item.side : (k % 2 === 0 ? 1 : -1);
      out.push({
        x: -(item.t * c.speed + k * c.turret.rowStep), y: side * (c.laneHalf + c.turret.offset),
        band: item.band, hp: c.turret.hp, cd: k * c.turret.stagger, flash: 0
      });
    }
  }

  function spawnT(item) {
    var c = cfg();
    return item.t - c.fighter.spawnDist / (c.fighter.speed + c.speed);
  }

  function makeFighter(item, age) {
    var c = cfg();
    return {
      def: item, age: age, hp: c.fighter.hp, cd: 0,
      x0: -(spawnT(item) * c.speed) - c.fighter.spawnDist,
      x: 0, y: 0, z: 0
    };
  }

  // Fighters are pure functions of their age, so a checkpoint restart can fast-forward them exactly.
  function poseFighter(fg) {
    var c = cfg(), d = fg.def, fc = c.fighter, base = d.u === null ? 0 : d.u;
    var arrive = fc.spawnDist / (fc.speed + c.speed);
    fg.x = fg.x0 + fc.speed * fg.age;
    fg.y = base;
    fg.z = c.bandZ[d.band];
    if (d.pattern === 'weave') fg.y = base + fc.weaveAmp * Math.sin(fc.weaveRate * (fg.age - arrive));
    else if (d.pattern === 'dive') fg.z = c.bandZ[2] + (c.bandZ[d.band] - c.bandZ[2]) * smooth((fg.age - fc.diveStart) / fc.diveTime);
    else if (d.pattern === 'cross') fg.y = base + d.side * fc.crossSpeed * (arrive - fg.age);
  }

  // ---- state ----------------------------------------------------------------------------------------
  function create() {
    return {
      t: 0, cpT: 0, banner: 0, god: false, dead: false, deadT: 0, cause: '', docked: false, dockT: 0,
      cd: 0, ship: { x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0, vy: 0, band: 1, zFrom: 0, zTo: 0, zT: 1 },
      bullets: [], shots: [], fx: [], walls: [], fields: [], turrets: [], fighters: [], pending: [], deaths: 0
    };
  }

  function reset(f, cpT) {
    var c = cfg(), course = VR.flightCourse.course, s = f.ship;
    f.t = cpT; f.cpT = cpT; f.banner = 0; f.dead = false; f.deadT = 0; f.cause = ''; f.docked = false; f.dockT = 0; f.cd = 0;
    s.x = s.px = -cpT * c.speed;
    s.y = s.py = 0; s.vy = 0;
    s.band = c.ship.startBand;
    s.z = s.pz = s.zFrom = s.zTo = c.bandZ[s.band];
    s.zT = 1;
    f.bullets.length = f.shots.length = f.fx.length = 0;
    f.walls.length = f.fields.length = f.turrets.length = f.fighters.length = f.pending.length = 0;
    course.items.forEach(function (it) {
      if (it.kind === 'fighter') {
        if (it.t < cpT) return;
        if (spawnT(it) <= cpT) f.fighters.push(makeFighter(it, cpT - spawnT(it)));
        else f.pending.push(it);
        return;
      }
      if (-it.t * c.speed >= s.x) return;   // already behind the checkpoint
      if (it.kind === 'wall') f.walls.push(buildWall(it, false));
      else if (it.kind === 'dock') f.walls.push(buildWall(it, true));
      else if (it.kind === 'field') f.fields.push(buildField(it));
      else if (it.kind === 'turrets') buildTurrets(it, f.turrets);
    });
    f.fighters.forEach(poseFighter);
  }

  // ---- effects --------------------------------------------------------------------------------------
  function ring(f, x, y, z, color, maxR, life) {
    f.fx.push({ type: 'ring', x: x, y: y, z: z, color: color, maxR: maxR, life: life, max: life });
  }

  function explode(f, x, y, z, color) {
    var d = cfg().death, k;
    ring(f, x, y, z, color, d.ring, d.debrisLife);
    for (k = 0; k < d.debris; k++) {
      var a = k / d.debris * Math.PI * 2;
      f.fx.push({ type: 'debris', x: x, y: y, z: z, vx: Math.cos(a) * d.debrisSpeed, vy: Math.sin(a) * d.debrisSpeed,
        color: color, life: d.debrisLife, max: d.debrisLife });
    }
  }

  function spark(f, x, y, z) {
    var b = cfg().bullets;
    ring(f, x, y, z, cfg().colors.spark, b.sparkSize, b.sparkLife);
  }

  function updateFx(f, dt) {
    for (var i = f.fx.length - 1; i >= 0; i--) {
      var e = f.fx[i];
      e.life -= dt;
      if (e.type === 'debris') { e.x += e.vx * dt; e.y += e.vy * dt; }
      if (e.life <= 0) f.fx.splice(i, 1);
    }
  }

  function kill(f, cause) {
    var c = cfg(), s = f.ship;
    if (f.god || f.dead) return;
    f.dead = true;
    f.deadT = c.death.restartDelay;
    f.cause = cause;
    f.deaths++;
    explode(f, s.x, s.y, s.z, c.colors.ship);
    VR.audio.play('death');
    VR.camera.shake(c.death.shake, c.death.shakeTime);
    VR.loop.hitStop(c.death.hitStop);
  }

  // ---- player bullets -------------------------------------------------------------------------------
  function inGap(w, y, z) {
    return y >= w.gy0 && y <= w.gy1 && z >= w.gz0 && z <= w.gz1;
  }

  // True when the bullet (moving from b.px to b.x) is absorbed by something this step.
  function bulletHit(f, b) {
    var c = cfg(), lo = Math.min(b.x, b.px), hi = Math.max(b.x, b.px), i;
    for (i = 0; i < f.walls.length; i++) {
      var w = f.walls[i];
      if (hi < w.x - w.thick * 0.5 || lo > w.x + w.thick * 0.5) continue;
      if (!inGap(w, b.y, b.z)) { spark(f, b.x, b.y, b.z); return true; }
    }
    for (i = 0; i < f.fields.length; i++) {
      var fl = f.fields[i];
      if (!fl.on || hi < fl.x - c.field.genHalfX || lo > fl.x + c.field.genHalfX) continue;
      if (Math.abs(b.y - fl.genY) <= c.field.genHitHalf) {
        fl.on = false;
        explode(f, fl.x, fl.genY, c.wallTop * 0.5, c.colors.generator);
        VR.audio.play('kill');
        return true;
      }
      spark(f, b.x, b.y, b.z);
      return true;
    }
    for (i = 0; i < f.turrets.length; i++) {
      var t = f.turrets[i], tc = c.turret;
      if (hi < t.x - tc.hitHalf || lo > t.x + tc.hitHalf || Math.abs(b.y - t.y) > tc.hitHalf) continue;
      if (b.z > c.bandZ[t.band] + tc.hitAbove) continue;
      if (--t.hp <= 0) {
        f.turrets.splice(i, 1);
        explode(f, t.x, t.y, c.bandZ[t.band], c.colors.turretHead);
        VR.audio.play('kill');
      } else spark(f, b.x, b.y, b.z);
      return true;
    }
    for (i = 0; i < f.fighters.length; i++) {
      var fg = f.fighters[i], fc = c.fighter;
      if (hi < fg.x - fc.length * 0.5 || lo > fg.x + fc.length * 0.5) continue;
      if (Math.abs(b.y - fg.y) > fc.width * 0.5 || Math.abs(b.z - fg.z) > fc.height * 0.5 + c.bullets.hitMargin) continue;
      if (--fg.hp <= 0) {
        f.fighters.splice(i, 1);
        explode(f, fg.x, fg.y, fg.z, c.colors.fighter);
        VR.audio.play('kill');
      } else spark(f, b.x, b.y, b.z);
      return true;
    }
    return false;
  }

  // ---- step -----------------------------------------------------------------------------------------
  function overlapBox(s, x, y, z, hx, hy, hz) {
    var c = cfg().ship;
    return Math.abs(s.x - x) < c.length * 0.5 + hx && Math.abs(s.y - y) < c.width * 0.5 + hy &&
      Math.abs(s.z - z) < c.height * 0.5 + hz;
  }

  function updateShip(f, dt, inp) {
    var c = cfg(), sc = c.ship, s = f.ship;
    s.px = s.x; s.py = s.y; s.pz = s.z;
    s.x = -f.t * c.speed;

    var target = inp.strafe * sc.strafeSpeed;
    s.vy += (target - s.vy) * (1 - Math.exp(-sc.strafeSmooth * dt));
    s.y += s.vy * dt;
    if (s.y > c.laneHalf) { s.y = c.laneHalf; s.vy = 0; }
    if (s.y < -c.laneHalf) { s.y = -c.laneHalf; s.vy = 0; }

    var nb = s.band + (inp.up ? 1 : 0) - (inp.down ? 1 : 0);
    nb = Math.max(0, Math.min(c.bandZ.length - 1, nb));
    if (nb !== s.band) {
      s.band = nb;
      s.zFrom = s.z; s.zTo = c.bandZ[nb]; s.zT = 0;
    }
    if (s.zT < 1) {
      s.zT = Math.min(1, s.zT + dt / sc.bandTime);
      s.z = s.zFrom + (s.zTo - s.zFrom) * smooth(s.zT);
    }
  }

  function fire(f, dt, inp) {
    var c = cfg(), s = f.ship;
    f.cd -= dt;
    if (inp.fire && f.cd <= 0) {
      f.cd = c.fire.interval;
      f.bullets.push({ x: s.x - c.ship.length * 0.5 - c.fire.muzzleLead, px: s.x, y: s.y, z: s.z, life: c.fire.range });
      VR.audio.play('shot', c.fire.volume);
    }
    for (var i = f.bullets.length - 1; i >= 0; i--) {
      var b = f.bullets[i];
      b.px = b.x;
      b.x -= c.fire.speed * dt;
      b.life -= c.fire.speed * dt;
      if (b.life <= 0 || bulletHit(f, b)) f.bullets.splice(i, 1);
    }
  }

  function enemyShot(f, x, y, z, vx, vy) {
    f.shots.push({ x: x, y: y, z: z, vx: vx, vy: vy });
  }

  function updateTurrets(f, dt) {
    var c = cfg(), tc = c.turret, s = f.ship;
    f.turrets.forEach(function (t) {
      t.cd -= dt;
      t.flash = t.cd > 0 && t.cd < tc.flashTime && s.x - t.x > tc.fireMin ? 1 : 0;
      var ahead = s.x - t.x, z = c.bandZ[t.band];
      if (ahead < tc.fireMin || ahead > tc.fireMax || t.cd > 0) return;
      if (!onScreen(t.x, t.y, z, tc.screenMargin)) return;
      t.cd = tc.fireInterval;
      var dx = s.x - t.x, dy = s.y - t.y, len = Math.sqrt(dx * dx + dy * dy);
      enemyShot(f, t.x, t.y, z, dx / len * tc.shotSpeed, dy / len * tc.shotSpeed);
    });
  }

  function updateFighters(f, dt) {
    var c = cfg(), fc = c.fighter, s = f.ship, i;
    for (i = f.pending.length - 1; i >= 0; i--) {
      if (f.t >= spawnT(f.pending[i])) { f.fighters.push(makeFighter(f.pending[i], f.t - spawnT(f.pending[i]))); f.pending.splice(i, 1); }
    }
    for (i = f.fighters.length - 1; i >= 0; i--) {
      var fg = f.fighters[i];
      fg.age += dt;
      fg.cd -= dt;
      poseFighter(fg);
      var ahead = s.x - fg.x;
      if (ahead < -fc.cullBehind) { f.fighters.splice(i, 1); continue; }
      if (ahead > fc.fireMin && ahead < fc.fireMax && fg.cd <= 0 && onScreen(fg.x, fg.y, fg.z, c.turret.screenMargin)) {
        fg.cd = fc.fireInterval;
        enemyShot(f, fg.x, fg.y, fg.z, c.turret.shotSpeed, 0);
      }
    }
  }

  function updateShots(f, dt) {
    var c = cfg(), tc = c.turret, s = f.ship;
    for (var i = f.shots.length - 1; i >= 0; i--) {
      var e = f.shots[i];
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.x > s.x + tc.cullBehind || Math.abs(e.y) > c.laneHalf + tc.cullSide) f.shots.splice(i, 1);
    }
  }

  function collide(f) {
    var c = cfg(), s = f.ship, hx = c.ship.length * 0.5, hy = c.ship.width * 0.5, hz = c.ship.height * 0.5, i;
    for (i = 0; i < f.walls.length; i++) {
      var w = f.walls[i];
      if (Math.abs(s.x - w.x) >= w.thick * 0.5 + hx) continue;
      var fits = s.y - hy >= w.gy0 && s.y + hy <= w.gy1 && s.z - hz >= w.gz0 && s.z + hz <= w.gz1;
      if (!fits) return kill(f, w.dock ? 'dock hull' : 'wall');
    }
    for (i = 0; i < f.fields.length; i++) {
      var fl = f.fields[i];
      if (fl.on && Math.abs(s.x - fl.x) < c.field.thickness * 0.5 + hx) return kill(f, 'force field');
    }
    var r = c.turret.shotRadius;
    for (i = 0; i < f.shots.length; i++) {
      var e = f.shots[i];
      if (overlapBox(s, e.x, e.y, e.z, r, r, r)) return kill(f, 'shot');
    }
    for (i = 0; i < f.fighters.length; i++) {
      var fg = f.fighters[i];
      if (overlapBox(s, fg.x, fg.y, fg.z, c.fighter.length * 0.5, c.fighter.width * 0.5, c.fighter.height * 0.5)) return kill(f, 'fighter');
    }
  }

  function step(f, dt, inp) {
    var c = cfg(), i;
    updateFx(f, dt);
    if (f.banner > 0) f.banner -= dt;
    if (f.dead) { f.deadT -= dt; return; }

    f.t += dt;
    updateShip(f, dt, inp);
    fire(f, dt, inp);
    for (i = f.fields.length - 1; i >= 0; i--) {
      var fl = f.fields[i];
      if (!fl.on) fl.fade = Math.max(0, fl.fade - dt / c.field.fadeTime);
    }
    updateTurrets(f, dt);
    updateFighters(f, dt);
    updateShots(f, dt);

    if (f.docked) { f.dockT -= dt; return; }
    collide(f);
    if (f.dead) return;

    var cps = VR.flightCourse.course.checkpoints;
    for (i = 0; i < cps.length; i++) {
      if (f.t >= cps[i] && cps[i] > f.cpT) {
        f.cpT = cps[i];
        f.banner = c.checkpoint.bannerTime;
        VR.audio.play('clear');
      }
    }
    for (i = 0; i < f.walls.length; i++) {
      if (f.walls[i].dock && f.ship.x < f.walls[i].x) {
        f.docked = true;
        f.dockT = c.dock.delay;
        VR.audio.play('clear');
      }
    }
  }

  VR.flightSim = {
    create: create, reset: reset, step: step, geo: geo, smooth: smooth, onScreen: onScreen
  };
})(window.VR = window.VR || {});
