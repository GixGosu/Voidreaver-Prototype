/*
 * VR.debug: F1 overlay (screen space, drawn after the world and the HUD).
 *
 * Text panel: FPS, frame timings, draw counts, cursor in screen/world/tile space, scene, enemy/bullet counts.
 * World layer (boarding): the floor tile under the cursor (if it is not exactly under the cursor, aim is wrong),
 * hitboxes of the player, enemies and enemy bullets, each alerted-or-not enemy's line of sight to the player
 * (green = clear and in sight range, red = blocked, stopping where it hits, grey = out of range) and its AI state.
 * World layer (flight): the ship and fighter hitboxes and enemy shot radii.
 *
 *   VR.debug.enabled            other systems may check this to submit extra debug draws
 *   VR.debug.watch(label, fn)   add a line to the text panel; fn() returns the value to print
 *   VR.debug.step() / draw()    loop callbacks (boot.js)
 *
 * The numbers in STYLE are presentation only. No allocations per enemy per frame beyond the label strings.
 */
(function (VR) {
  'use strict';

  var STYLE = {
    font: '12px monospace', lineH: 16, panelW: 330, panelX: 4, panelY: 4, pad: 6,
    panelBg: 'rgba(0,0,0,0.6)', text: '#9ef',
    cursorTile: '#ffd34d',
    hitPlayer: '#4fffd0', hitEnemy: '#ff4fd8', hitCorpse: 'rgba(160,160,160,0.5)', hitBullet: '#fff36b',
    losClear: 'rgba(90,255,120,0.85)', losBlocked: 'rgba(255,70,60,0.85)', losFar: 'rgba(150,150,150,0.35)',
    stateText: '#ffffff', stateBg: 'rgba(0,0,0,0.55)', stateLift: 14,
    flightBox: '#4fffd0', flightEnemy: '#ff4fd8', flightShot: '#fff36b'
  };

  var watches = [];
  var p = { x: 0, y: 0 }, q = { x: 0, y: 0 };

  function fmt(v) { return v.toFixed(1); }

  // Floor ellipse plus a vertical outline of the body: the shape every hit test in boarding uses (a circle on the floor).
  function hitCircle(ctx, x, y, r, height, color) {
    VR.camera.worldToScreen(x, y, 0, p);
    var rx = VR.iso.circleRx(r), ry = VR.iso.circleRy(r);
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
    if (height > 0) {
      ctx.moveTo(p.x - rx, p.y); ctx.lineTo(p.x - rx, p.y - height);
      ctx.moveTo(p.x + rx, p.y); ctx.lineTo(p.x + rx, p.y - height);
      ctx.moveTo(p.x + rx, p.y - height);
      ctx.ellipse(p.x, p.y - height, rx, ry, 0, 0, Math.PI * 2);
    }
    ctx.stroke();
  }

  function segment(ctx, x0, y0, z0, x1, y1, z1, color) {
    VR.camera.worldToScreen(x0, y0, z0, p);
    VR.camera.worldToScreen(x1, y1, z1, q);
    ctx.strokeStyle = color;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
  }

  // Wireframe of a world-aligned box centred at (x, y), spanning z0..z1; hx/hy are half extents.
  function box(ctx, x, y, hx, hy, z0, z1, color) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (var k = 0; k < 2; k++) {
      var z = k === 0 ? z0 : z1;
      VR.camera.worldToScreen(x - hx, y - hy, z, p); ctx.moveTo(p.x, p.y);
      VR.camera.worldToScreen(x + hx, y - hy, z, p); ctx.lineTo(p.x, p.y);
      VR.camera.worldToScreen(x + hx, y + hy, z, p); ctx.lineTo(p.x, p.y);
      VR.camera.worldToScreen(x - hx, y + hy, z, p); ctx.lineTo(p.x, p.y);
      ctx.closePath();
    }
    for (var c = 0; c < 4; c++) {
      var cx = x + (c === 1 || c === 2 ? hx : -hx), cy = y + (c >= 2 ? hy : -hy);
      VR.camera.worldToScreen(cx, cy, z0, p); ctx.moveTo(p.x, p.y);
      VR.camera.worldToScreen(cx, cy, z1, p); ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  function label(ctx, s, x, y, z) {
    VR.camera.worldToScreen(x, y, z, p);
    var w = ctx.measureText(s).width;
    ctx.fillStyle = STYLE.stateBg;
    ctx.fillRect(p.x - w * 0.5 - 2, p.y - STYLE.lineH * 0.5, w + 4, STYLE.lineH);
    ctx.fillStyle = STYLE.stateText;
    ctx.fillText(s, p.x, p.y);
  }

  function cursorTile(ctx, w, tx, ty) {
    var hw = VR.config.iso.tileW / 2, hh = VR.config.iso.tileH / 2;
    VR.camera.worldToScreen(tx * w.T, ty * w.T, 0, p);
    ctx.strokeStyle = STYLE.cursorTile;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + hw, p.y + hh); ctx.lineTo(p.x, p.y + hh * 2); ctx.lineTo(p.x - hw, p.y + hh);
    ctx.closePath();
    ctx.stroke();
  }

  function enemyLabel(e) {
    var s = e.def ? e.def.id + ' ' + e.state : e.state;
    if (e.def && e.def.ai !== 'melee' && e.gs && e.state === 'attack') s += '/' + e.gs;
    if (e.state === 'react' || e.state === 'search') s += ' ' + e.t.toFixed(2);
    else if (e.state === 'stunned') s += ' ' + e.stun.toFixed(2);
    if (e.hp > 1) s += ' hp' + e.hp;
    if (e.prot) s += ' [cover]';
    return s;
  }

  function drawBoarding(ctx, alpha) {
    var W = VR.world, pl = VR.roomState.player, list = VR.enemies.list, ec = VR.config.enemy;
    var mask = W.RAY_WALLS | W.RAY_FULL, i;
    if (!pl) return;
    var px = VR.entity.ix(pl, alpha), py = VR.entity.iy(pl, alpha);
    ctx.lineWidth = 1;

    for (i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.spaced || !e.alive) continue;
      var ex = VR.entity.ix(e, alpha), ey = VR.entity.iy(e, alpha), z = e.height * ec.muzzleHeight;
      // Same test as the AI (enemies.js canSee): grid raycast through walls and full cover only.
      var hit = W.raycast(ex, ey, px, py, mask);
      var dx = px - ex, dy = py - ey, inRange = dx * dx + dy * dy <= ec.sightRange * ec.sightRange;
      if (hit.hit) segment(ctx, ex, ey, z, hit.x, hit.y, z, STYLE.losBlocked);
      else segment(ctx, ex, ey, z, px, py, z, inRange ? STYLE.losClear : STYLE.losFar);
    }
    for (i = 0; i < list.length; i++) {
      var en = list[i];
      if (en.spaced) continue;
      hitCircle(ctx, VR.entity.ix(en, alpha), VR.entity.iy(en, alpha), en.radius, en.alive ? en.height : 0,
        en.alive ? STYLE.hitEnemy : STYLE.hitCorpse);
    }
    hitCircle(ctx, px, py, pl.radius, pl.height, STYLE.hitPlayer);

    var bullets = VR.weapons.bullets, br = ec.bulletRadius;
    for (i = 0; i < bullets.length; i++) {
      var b = bullets[i];
      hitCircle(ctx, b.px + (b.x - b.px) * alpha, b.py + (b.y - b.py) * alpha, br, 0, STYLE.hitBullet);
    }

    ctx.font = STYLE.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (i = 0; i < list.length; i++) {
      var a = list[i];
      if (!a.alive || a.spaced) continue;
      label(ctx, enemyLabel(a), VR.entity.ix(a, alpha), VR.entity.iy(a, alpha), a.height + STYLE.stateLift);
    }
  }

  function drawFlight(ctx, alpha) {
    var f = VR.flight && VR.flight.state, c = VR.config.flight, i;
    if (!f) return;
    var s = f.ship, sh = c.ship, fc = c.fighter;
    ctx.lineWidth = 1;
    box(ctx, VR.entity.ix(s, alpha), VR.entity.iy(s, alpha), sh.length * 0.5, sh.width * 0.5,
      VR.entity.iz(s, alpha) - sh.height * 0.5, VR.entity.iz(s, alpha) + sh.height * 0.5, STYLE.flightBox);
    for (i = 0; i < f.fighters.length; i++) {
      var g = f.fighters[i];
      if (g.hp <= 0) continue;
      box(ctx, g.x, g.y, fc.length * 0.5, fc.width * 0.5, g.z - fc.height * 0.5, g.z + fc.height * 0.5, STYLE.flightEnemy);
    }
    for (i = 0; i < f.shots.length; i++) {
      var sh2 = f.shots[i];
      VR.camera.worldToScreen(sh2.x, sh2.y, sh2.z, p);
      ctx.strokeStyle = STYLE.flightShot;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, VR.iso.circleRx(c.turret.shotRadius), VR.iso.circleRx(c.turret.shotRadius), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  VR.debug = {
    enabled: false,

    watch: function (label, fn) { watches.push({ label: label, fn: fn }); },

    step: function () {
      if (VR.input.pressed(VR.config.keys.debug)) VR.debug.enabled = !VR.debug.enabled;
    },

    draw: function (alpha) {
      if (!VR.debug.enabled) return;
      var ctx = VR.render.screenSpace(), m = VR.input.mouse, s = VR.loop.stats, w = VR.world;
      var hasWorld = w.tiles !== null, scene = VR.scenes.current;
      var tx = 0, ty = 0;

      if (hasWorld) {
        tx = Math.floor(m.wx / w.T);
        ty = Math.floor(m.wy / w.T);
        ctx.lineWidth = 1;
        cursorTile(ctx, w, tx, ty);
      }
      if (scene === 'boarding' && hasWorld) drawBoarding(ctx, alpha);
      else if (scene === 'flight') drawFlight(ctx, alpha);

      var extra = (hasWorld ? 1 : 0) + (scene === 'boarding' ? 1 : 0);
      ctx.fillStyle = STYLE.panelBg;
      ctx.fillRect(STYLE.panelX, STYLE.panelY, STYLE.panelW, STYLE.pad * 2 + (7 + extra + watches.length) * STYLE.lineH);
      ctx.fillStyle = STYLE.text;
      ctx.font = STYLE.font;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      var x = STYLE.panelX + STYLE.pad, y = STYLE.panelY + STYLE.pad, L = STYLE.lineH;
      ctx.fillText('FPS ' + Math.round(s.fps) + '   frame ' + fmt(s.frameMs) + ' ms   steps ' + s.steps, x, y); y += L;
      ctx.fillText('update ' + fmt(s.updateMs) + ' ms   render ' + fmt(s.renderMs) + ' ms', x, y); y += L;
      ctx.fillText('draw items ' + VR.render.stats.items + '   blocks ' + VR.render.stats.blocks, x, y); y += L;
      ctx.fillText('mouse screen ' + Math.round(m.sx) + ', ' + Math.round(m.sy), x, y); y += L;
      ctx.fillText('mouse world  ' + fmt(m.wx) + ', ' + fmt(m.wy), x, y); y += L;
      if (hasWorld) { ctx.fillText('tile ' + tx + ', ' + ty + '   wall ' + w.isWall(tx, ty) + '   solid ' + w.isSolid(tx, ty), x, y); y += L; }
      if (scene === 'boarding') {
        ctx.fillText('enemies ' + VR.enemies.aliveCount() + '/' + VR.enemies.list.length + '   bullets ' + VR.weapons.bullets.length +
          '   attempt ' + VR.roomState.info.attempts, x, y);
        y += L;
      }
      ctx.fillText('scene ' + scene + (VR.loop.isHitStopped() ? '   HIT-STOP' : ''), x, y); y += L;
      ctx.fillText('F1 overlay   ` tuning + copy stats', x, y); y += L;
      for (var i = 0; i < watches.length; i++) { ctx.fillText(watches[i].label + ' ' + watches[i].fn(), x, y); y += L; }
    }
  };
})(window.VR = window.VR || {});
