/*
 * Flight rendering (owner: flight-engineer): turns flight state into VR.render submissions.
 *
 *   VR.flightDraw.render(f, alpha)
 *
 * Readability rules this file implements:
 *  - the ship always has a floor shadow plus a drop line to it, so altitude reads from the gap between them;
 *  - every wall casts a floor shadow whose clear zone grows with the gap's altitude, and its gap is framed in
 *    the band colour (low green, mid yellow, high pink) that the HUD gauge repeats;
 *  - enemy shots carry a drop line and shadow too.
 * Walls are drawn as small cells so the renderer's x + y depth sort stays correct against the ship.
 */
(function (VR) {
  'use strict';

  var tmp = { x: 0, y: 0 };
  var block = { kind: 'block' };
  var item = {};

  function cfg() { return VR.config.flight; }

  function box(layer, x, y, z, w, d, h, color, left, right, alpha, bias) {
    block.layer = layer; block.x = x; block.y = y; block.z = z; block.w = w; block.d = d; block.height = h;
    block.color = color; block.colorLeft = left || color; block.colorRight = right || color;
    block.alpha = alpha === undefined ? 1 : alpha;
    block.depthBias = bias || 0;
    VR.render.submit(block);
  }

  function line(layer, x, y, z, x2, y2, z2, color, width, alpha, bias) {
    item.kind = 'line'; item.layer = layer; item.x = x; item.y = y; item.z = z; item.x2 = x2; item.y2 = y2; item.z2 = z2;
    item.color = color; item.width = width; item.alpha = alpha === undefined ? 1 : alpha; item.depthBias = bias || 0;
    VR.render.submit(item);
    item.x2 = undefined; item.y2 = undefined; item.z2 = undefined;
  }

  function dot(layer, x, y, z, radius, color, alpha, x2, y2) {
    item.kind = 'projectile'; item.layer = layer; item.x = x; item.y = y; item.z = z; item.radius = radius;
    item.color = color; item.alpha = alpha; item.x2 = x2; item.y2 = y2; item.width = undefined;
    VR.render.submit(item);
    item.x2 = undefined; item.y2 = undefined;
  }

  function circle(layer, x, y, z, radius, color, outline, width, alpha) {
    item.kind = 'circle'; item.layer = layer; item.x = x; item.y = y; item.z = z; item.radius = radius;
    item.color = color; item.outline = outline; item.width = width; item.alpha = alpha;
    VR.render.submit(item);
    item.outline = undefined;
  }

  // Screen-space helpers for the HUD: the draw list is world-space, so convert pixels to the floor point there.
  function screenText(str, px, py, size, color, alpha) {
    VR.camera.screenToWorld(px, py, tmp);
    item.kind = 'text'; item.layer = 'overlay'; item.x = tmp.x; item.y = tmp.y; item.z = 0;
    item.text = str; item.size = size; item.color = color; item.alpha = alpha;
    VR.render.submit(item);
  }

  function screenLine(x0, y0, x1, y1, color, width, alpha) {
    VR.camera.screenToWorld(x0, y0, tmp);
    var ax = tmp.x, ay = tmp.y;
    VR.camera.screenToWorld(x1, y1, tmp);
    line('overlay', ax, ay, 0, tmp.x, tmp.y, 0, color, width, alpha);
  }

  // ---- scenery -----------------------------------------------------------------------------------
  function drawDeck(sx) {
    var c = cfg(), d = c.draw, col = c.colors;
    var x0 = sx - d.deckAhead, x1 = sx + d.deckBehind, half = c.laneHalf + d.deckEdge;
    box('floor', (x0 + x1) * 0.5, 0, 0, x1 - x0, half * 2, 1, col.deck, col.deck, col.deck);
    for (var gx = Math.floor(x0 / d.gridStep) * d.gridStep; gx < x1; gx += d.gridStep) {
      line('floor', gx, -half, 0, gx, half, 0, col.deckGrid, 1);
    }
    line('floor', x0, -c.laneHalf, 0, x1, -c.laneHalf, 0, col.rail, 2);
    line('floor', x0, c.laneHalf, 0, x1, c.laneHalf, 0, col.rail, 2);
  }

  function inRange(x, sx) {
    var d = cfg().draw;
    return sx - x < d.cullAhead && x - sx < d.cullBehind;
  }

  function drawWall(w, sx) {
    var c = cfg(), d = c.draw, col = c.colors, i, k;
    var top = w.dock ? col.hullTop : col.wallTop, left = w.dock ? col.hullLeft : col.wallLeft;
    var right = w.dock ? col.hullRight : col.wallRight;
    var front = w.x + w.thick * 0.5, band = col.bands[w.band];

    // Floor shadow: one strip per solid piece, offset by altitude. The clear strip between the wall and the
    // shadow of the beam above the gap is the gap's altitude made visible on the floor.
    for (i = 0; i < w.regions.length; i++) {
      var r = w.regions[i];
      for (k = 0; k < r.pieces.length; k++) {
        var p = r.pieces[k], len = (p[1] - p[0]) * c.shadowSlope;
        box('floor', front + p[0] * c.shadowSlope + len * 0.5, (r.y0 + r.y1) * 0.5, 0, len, r.y1 - r.y0, 1,
          col.shadow, col.shadow, col.shadow, d.wallShadowAlpha);
      }
    }
    for (i = 0; i < w.cells.length; i++) {
      var cell = w.cells[i], yc = (cell.y0 + cell.y1) * 0.5;
      for (k = 0; k < cell.pieces.length; k++) {
        var q = cell.pieces[k];
        box('world', w.x, yc, q[0], w.thick, cell.y1 - cell.y0, q[1] - q[0], top, left, right, 1, 0);
      }
      if (cell.open) {
        line('world', front, cell.y0, w.gz1, front, cell.y1, w.gz1, band, d.frameWidth, 1, 1);
        if (w.gz0 > 0) line('world', front, cell.y0, w.gz0, front, cell.y1, w.gz0, band, d.frameWidth, 1, 1);
      }
    }
    var windowed = w.gy0 > -w.halfW;
    if (windowed) {
      line('world', front, w.gy0, w.gz0, front, w.gy0, w.gz1, band, d.frameWidth, 1, 1);
      line('world', front, w.gy1, w.gz0, front, w.gy1, w.gz1, band, d.frameWidth, 1, 1);
    }
  }

  function drawField(fl, sx, time) {
    var c = cfg(), fc = c.field, d = c.draw, col = c.colors, g = VR.flightSim.geo(), y;
    var pulse = 1 + fc.pulseAmt * Math.sin(time * fc.pulseHz);
    if (fl.fade > 0) {
      var n = Math.ceil(g.wallHalf * 2 / c.wallCell), step = g.wallHalf * 2 / n;
      for (var k = 0; k < n; k++) {
        y = -g.wallHalf + step * (k + 0.5);
        box('world', fl.x, y, 0, fc.thickness, step, c.wallTop, col.field, col.field, col.field, fc.alpha * fl.fade * pulse, 0);
      }
    }
    box('world', fl.x, -fl.genY, 0, fc.pylonSize, fc.pylonSize, c.wallTop, col.pylon, col.pylon, col.pylon, 1, 1);
    var gen = fl.on ? col.generator : col.pylon;
    box('world', fl.x, fl.genY, 0, fc.pylonSize, fc.pylonSize, c.wallTop, gen, gen, gen, 1, 1);
    if (fl.on) {
      circle('floor', fl.x, fl.genY, 0, fc.ringRadius * pulse, col.generator, true, 2, 1);
      item.kind = 'marker'; item.layer = 'overlay'; item.x = fl.x; item.y = fl.genY; item.z = c.wallTop + fc.markerLift;
      item.size = fc.markerSize; item.color = col.generator; item.width = 2; item.alpha = 1;
      VR.render.submit(item);
    }
  }

  function drawTurret(t) {
    var c = cfg(), tc = c.turret, col = c.colors, z = c.bandZ[t.band];
    box('floor', t.x, t.y, 0, tc.towerHalf * 2, tc.towerHalf * 2, 1, col.shadow, col.shadow, col.shadow, c.draw.wallShadowAlpha);
    box('world', t.x, t.y, 0, tc.towerHalf * 2, tc.towerHalf * 2, z - tc.headLift, col.turret, col.turret, col.turret, 1, 0);
    var head = t.flash ? col.turretFlash : col.turretHead;
    box('world', t.x, t.y, z - tc.headLift, tc.headHalf * 2, tc.headHalf * 2, tc.headHeight, head, head, head, 1, 1);
  }

  function drawFighter(fg) {
    var c = cfg(), fc = c.fighter, col = c.colors;
    box('floor', fg.x, fg.y, 0, fc.length, fc.width, 1, col.shadow, col.shadow, col.shadow, c.ship.shadowAlpha);
    line('floor', fg.x, fg.y, 0, fg.x, fg.y, fg.z, col.fighter, 1, c.draw.dropLineAlpha);
    box('world', fg.x, fg.y, fg.z - fc.wingThick * 0.5, fc.length * c.draw.wingFrac, fc.width, fc.wingThick, col.fighter, col.fighter, col.fighter, 1, 0);
    box('world', fg.x, fg.y, fg.z - fc.bodyThick * 0.5, fc.length, fc.bodyWidth, fc.bodyThick, col.fighterBody, col.fighterBody, col.fighterBody, 1, 1);
  }

  function drawShip(s, alpha) {
    var c = cfg(), sc = c.ship, col = c.colors;
    var x = VR.entity.ix(s, alpha), y = VR.entity.iy(s, alpha), z = VR.entity.iz(s, alpha);
    // The shadow and drop line are never skipped: they are the player's altitude read.
    box('floor', x, y, 0, sc.length, sc.width, 1, col.shadow, col.shadow, col.shadow, sc.shadowAlpha);
    line('floor', x, y, 0, x, y, z, col.ship, 1, c.draw.dropLineAlpha);
    box('world', x, y, z - sc.wingThick * 0.5, sc.wingLength, sc.width, sc.wingThick, col.ship, col.ship, col.ship, 1, 0);
    box('world', x - sc.bodyShift, y, z - sc.bodyThick * 0.5, sc.length, sc.bodyWidth, sc.bodyThick, col.shipBody, col.shipBody, col.shipBody, 1, 1);
  }

  function drawFx(f) {
    var col = cfg().colors;
    f.fx.forEach(function (e) {
      var life = e.life / e.max;
      if (e.type === 'ring') circle('world', e.x, e.y, e.z, e.maxR * (1 - life), e.color, true, 2, life);
      else dot('world', e.x, e.y, e.z, cfg().fire.radius, e.color || col.debris, life);
    });
  }

  // ---- HUD -----------------------------------------------------------------------------------------
  function drawHud(f) {
    var c = cfg(), d = c.draw, col = c.colors, W = VR.render.width, H = VR.render.height, i;
    var endT = VR.flightCourse.course.endT;
    var x0 = W * 0.5 - d.progressWidth * 0.5, x1 = W * 0.5 + d.progressWidth * 0.5;
    screenLine(x0, d.hudMargin, x1, d.hudMargin, col.hudDim, 4, 1);
    screenLine(x0, d.hudMargin, x0 + (x1 - x0) * Math.min(1, f.t / endT), d.hudMargin, col.hud, 4, 1);
    VR.flightCourse.course.checkpoints.forEach(function (cp) {
      var px = x0 + (x1 - x0) * cp / endT;
      screenLine(px, d.hudMargin - d.gaugeStep * 0.5, px, d.hudMargin + d.gaugeStep * 0.5, f.cpT >= cp ? col.checkpoint : col.hudDim, 2, 1);
    });

    // Altitude gauge: three notches, the current band bright. Same colours as the wall frames.
    var gx = W - d.hudMargin, gy = H * 0.5;
    for (i = 0; i < c.bandZ.length; i++) {
      var yy = gy - (i - 1) * d.gaugeStep * 2;
      screenLine(gx - d.gaugeLen, yy, gx, yy, col.bands[i], f.ship.band === i ? 4 : 2, f.ship.band === i ? 1 : d.gaugeDim);
    }
    screenText('ALT', gx - d.gaugeLen * 0.5, gy - d.gaugeStep * 3, d.textSize, col.hudDim, 1);

    if (f.t < d.hintTime) screenText('A/D strafe     W/S altitude     hold LEFT CLICK to fire', W * 0.5, d.hintY, d.textSize, col.hud, 1);
    if (f.banner > 0) screenText('CHECKPOINT', W * 0.5, d.hintY, d.bannerSize, col.checkpoint, Math.min(1, f.banner));
    if (f.docked) screenText('DOCKING', W * 0.5, d.hintY, d.bannerSize, col.hud, 1);
    if (f.god) screenText('GOD MODE', W * 0.5, H - d.hudMargin, d.textSize, col.warn, 1);
  }

  // ---- entry ---------------------------------------------------------------------------------------
  function render(f, alpha) {
    var c = cfg(), col = c.colors, s = f.ship;
    var sx = VR.entity.ix(s, alpha);
    var time = f.t;
    var i;

    drawDeck(sx);
    for (i = 0; i < f.walls.length; i++) if (inRange(f.walls[i].x, sx)) drawWall(f.walls[i], sx);
    for (i = 0; i < f.fields.length; i++) if (inRange(f.fields[i].x, sx)) drawField(f.fields[i], sx, time);
    for (i = 0; i < f.turrets.length; i++) if (inRange(f.turrets[i].x, sx)) drawTurret(f.turrets[i]);
    for (i = 0; i < f.fighters.length; i++) drawFighter(f.fighters[i]);

    f.shots.forEach(function (e) {
      var tr = c.draw.trailSeconds;
      circle('floor', e.x, e.y, 0, c.turret.shotRadius, col.shadow, false, 1, c.draw.dropLineAlpha);
      line('world', e.x, e.y, 0, e.x, e.y, e.z, col.enemyShot, 1, c.draw.dropLineAlpha);
      dot('world', e.x, e.y, e.z, c.turret.shotRadius, col.enemyShot, 1, e.x - e.vx * tr, e.y - e.vy * tr);
    });
    f.bullets.forEach(function (b) {
      circle('floor', b.x, b.y, 0, c.fire.radius, col.shadow, false, 1, c.draw.dropLineAlpha);
      dot('world', b.x, b.y, b.z, c.fire.radius, col.bullet, 1, b.x + c.fire.speed * c.fire.trail, b.y);
    });

    if (!f.dead) drawShip(s, alpha);
    drawFx(f);
    drawHud(f);
  }

  VR.flightDraw = { render: render };
})(window.VR = window.VR || {});
