/*
 * VR.render: isometric renderer driven by a per-frame draw list.
 *
 * Every frame, after VR.camera.beginFrame(), scenes call VR.render.submit(item) for each dynamic thing,
 * then VR.render.frame() draws: background, floor (cached), 'floor' layer, depth-sorted 'world' layer
 * merged with the room's static blocks (walls, windows, doors, cover), then 'overlay' layer.
 * The draw list is cleared after each frame.
 *
 * submit(item) copies the fields below into a pooled record, so callers may reuse one object.
 *   kind     'actor'      upright cylinder with drop shadow; x, y, z, radius, height, color, angle (facing, rad)
 *            'block'      world-aligned box; x, y (centre), z, w, d (world extents), height, color,
 *                         colorLeft, colorRight (side faces; default color), outline (stroke only)
 *            'projectile' glowing dot at x, y, z; radius; optional trail back to x2, y2 (same z)
 *            'line'       segment x, y, z -> x2, y2, z2; color, width
 *            'circle'     ellipse lying on the plane at height z; radius, color, outline
 *            'marker'     screen-size crosshair centred on the projection of x, y, z; size, color
 *            'text'       text centred at x, y, z; text, size, color
 *   layer    'world' (default, depth sorted) | 'floor' (under everything, submit order) | 'overlay' (on top)
 *   alpha    0..1 (default 1)
 *   depthBias  added to the sort key (x + y) to break ties deliberately
 * Positions are world px (interpolate before submitting); z / height are screen px straight up.
 *
 * Depth rule: a draw is ordered by x + y of its footprint centre. Static blocks on tile (tx, ty) sort at
 * (tx + ty + 1) * T, the x + y of the tile centre, which is exact for unit tiles and actors smaller than a tile.
 *
 * Screen-space drawing (HUD, debug) after frame(): var ctx = VR.render.screenSpace(); then CSS-pixel coordinates.
 *
 * Wall fade: VR.render.setFocus(x, y, radius, height) marks the actor to keep visible (the player). Any
 * static block that sorts in front of it and overlaps its screen box (plus config.render.fadeMargin) is
 * drawn as an outline only.
 */
(function (VR) {
  'use strict';

  var canvas = null, ctx = null, dpr = 1;

  // Placeholder-art proportions (presentation, not gameplay; gameplay sizes come in on each item).
  var ACTOR = {
    shadowScale: 1.15,   // drop shadow ellipse relative to the body footprint
    capAlpha: 'rgba(255,255,255,0.28)',
    facingReach: 1.6,    // facing stub length, in body radii
    facingLift: 0.6,     // fraction of body height the facing stub sits at
    facingWidth: 3
  };
  var MIN_DOT = 1.5;          // px, smallest projectile dot so far-away shots stay visible
  var MARKER_ARM = 1.6, MARKER_STEM = 0.9;   // crosshair arms relative to marker size
  var TEXT_SIZE = 12;         // px, text items without a size
  var tmpA = { x: 0, y: 0 }, tmpB = { x: 0, y: 0 };

  // ---- draw list -------------------------------------------------------------------------------
  var pool = [];
  var count = 0;
  var sorted = [];

  function blank(r) {
    r.kind = ''; r.layer = 'world';
    r.x = 0; r.y = 0; r.z = 0; r.x2 = 0; r.y2 = 0; r.z2 = 0; r.hasEnd = false;
    r.w = 0; r.d = 0; r.height = 0; r.radius = 0; r.angle = 0; r.hasAngle = false;
    r.color = '#fff'; r.colorLeft = null; r.colorRight = null;
    r.outline = false; r.width = 1; r.alpha = 1; r.size = 0; r.text = '';
    r.depth = 0; r.depthBias = 0;
    return r;
  }

  function submit(it) {
    var r = pool[count];
    if (!r) { r = blank({}); pool[count] = r; } else blank(r);
    count++;
    r.kind = it.kind;
    if (it.layer !== undefined) r.layer = it.layer;
    if (it.x !== undefined) r.x = it.x;
    if (it.y !== undefined) r.y = it.y;
    if (it.z !== undefined) r.z = it.z;
    if (it.x2 !== undefined) { r.x2 = it.x2; r.hasEnd = true; }
    if (it.y2 !== undefined) r.y2 = it.y2;
    r.z2 = it.z2 !== undefined ? it.z2 : r.z;
    if (it.w !== undefined) r.w = it.w;
    if (it.d !== undefined) r.d = it.d;
    if (it.height !== undefined) r.height = it.height;
    if (it.radius !== undefined) r.radius = it.radius;
    if (it.angle !== undefined) { r.angle = it.angle; r.hasAngle = true; }
    if (it.color !== undefined) r.color = it.color;
    r.colorLeft = it.colorLeft !== undefined ? it.colorLeft : r.color;
    r.colorRight = it.colorRight !== undefined ? it.colorRight : r.color;
    if (it.outline !== undefined) r.outline = it.outline;
    if (it.width !== undefined) r.width = it.width;
    if (it.alpha !== undefined) r.alpha = it.alpha;
    if (it.size !== undefined) r.size = it.size;
    if (it.text !== undefined) r.text = it.text;
    if (it.depthBias !== undefined) r.depthBias = it.depthBias;
    r.depth = (r.kind === 'line' ? (r.x + r.x2 + r.y + r.y2) * 0.5 : r.x + r.y) + r.depthBias;
  }

  function byDepth(a, b) { return a.depth - b.depth; }

  // ---- static room geometry (rebuilt when VR.world.version changes) ------------------------------
  var builtVersion = -1;
  var diagonals = [];     // diagonals[tx + ty] = [block, ...]
  var floorCache = null;
  var floorOx = 0, floorOy = 0, floorW = 0, floorH = 0;

  function blockColors(b, kind) {
    var c = VR.config.render.colors;
    b.top = c[kind + 'Top']; b.left = c[kind + 'Left']; b.right = c[kind + 'Right'];
  }

  function buildStatic() {
    var w = VR.world, rc = VR.config.render, T = w.T, TILE = w.TILE;
    diagonals.length = 0;
    for (var d = 0; d < w.cols + w.rows - 1; d++) diagonals.push([]);

    for (var ty = 0; ty < w.rows; ty++) {
      for (var tx = 0; tx < w.cols; tx++) {
        var t = w.tile(tx, ty), cover = w.coverAt(tx, ty);
        var b = null, inset = 0;
        if (t === TILE.WALL) { b = { h: rc.wallHeight }; blockColors(b, 'wall'); }
        else if (t === TILE.WINDOW) { b = { h: rc.windowHeight }; blockColors(b, 'window'); }
        else if (t === TILE.DOOR) { b = { h: rc.doorHeight }; blockColors(b, 'door'); }
        else if (cover) {
          inset = rc.coverInset;
          if (cover.type === 'half') { b = { h: rc.halfCoverHeight }; blockColors(b, 'half'); }
          else if (cover.type === 'full') { b = { h: rc.fullCoverHeight }; blockColors(b, 'full'); }
          else { b = { h: rc.crateHeight }; blockColors(b, 'crate'); }
        }
        if (!b) continue;
        var x0 = tx * T + inset, y0 = ty * T + inset, x1 = (tx + 1) * T - inset, y1 = (ty + 1) * T - inset;
        VR.iso.toScreen(x0, y0, 0, tmpA); b.nx = tmpA.x; b.ny = tmpA.y;
        VR.iso.toScreen(x1, y0, 0, tmpA); b.ex = tmpA.x; b.ey = tmpA.y;
        VR.iso.toScreen(x1, y1, 0, tmpA); b.sx = tmpA.x; b.sy = tmpA.y;
        VR.iso.toScreen(x0, y1, 0, tmpA); b.wx = tmpA.x; b.wy = tmpA.y;
        b.depth = (tx + ty + 1) * T;
        diagonals[tx + ty].push(b);
      }
    }
    buildFloor();
    builtVersion = w.version;
  }

  function buildFloor() {
    var w = VR.world, rc = VR.config.render, hw = VR.config.iso.tileW / 2, hh = VR.config.iso.tileH / 2;
    var pad = 2;
    floorW = (w.cols + w.rows) * hw + pad * 2;
    floorH = (w.cols + w.rows) * hh + pad * 2;
    floorOx = w.rows * hw + pad;   // projected world origin inside the cache
    floorOy = pad;
    if (!floorCache) floorCache = document.createElement('canvas');
    floorCache.width = Math.ceil(floorW * dpr);
    floorCache.height = Math.ceil(floorH * dpr);
    var g = floorCache.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, floorW, floorH);
    for (var pass = 0; pass < 2; pass++) {
      g.beginPath();
      for (var ty = 0; ty < w.rows; ty++) {
        for (var tx = 0; tx < w.cols; tx++) {
          if (w.tile(tx, ty) === w.TILE.VOID || ((tx + ty) & 1) !== pass) continue;
          var cx = (tx - ty) * hw + floorOx, cy = (tx + ty) * hh + floorOy;
          g.moveTo(cx, cy);
          g.lineTo(cx + hw, cy + hh);
          g.lineTo(cx, cy + hh * 2);
          g.lineTo(cx - hw, cy + hh);
          g.closePath();
        }
      }
      g.fillStyle = pass === 0 ? rc.colors.floorA : rc.colors.floorB;
      g.fill();
      g.strokeStyle = rc.colors.floorGrid;
      g.lineWidth = 1;
      g.stroke();
    }
  }

  // ---- focus / wall fade -------------------------------------------------------------------------
  var focus = { on: false, depth: 0, x0: 0, y0: 0, x1: 0, y1: 0 };

  function setFocus(x, y, radius, height) {
    var m = VR.config.render.fadeMargin;
    VR.iso.toScreen(x, y, 0, tmpA);
    var rx = VR.iso.circleRx(radius), ry = VR.iso.circleRy(radius);
    focus.on = true;
    focus.depth = x + y;
    focus.x0 = tmpA.x - rx - m; focus.x1 = tmpA.x + rx + m;
    focus.y0 = tmpA.y - height - ry - m; focus.y1 = tmpA.y + ry + m;
  }

  function fades(b) {
    return focus.on && b.depth > focus.depth &&
      b.wx < focus.x1 && b.ex > focus.x0 && b.ny - b.h < focus.y1 && b.sy > focus.y0;
  }

  // ---- primitive drawing -------------------------------------------------------------------------
  function drawStatic(b, ox, oy, vw, vh) {
    // Cull blocks fully off screen.
    if (b.ex + ox < 0 || b.wx + ox > vw || b.sy + oy < 0 || b.ny - b.h + oy > vh) return;
    drawBox(ox + b.nx, oy + b.ny, ox + b.ex, oy + b.ey, ox + b.sx, oy + b.sy, ox + b.wx, oy + b.wy,
      b.h, b.top, b.left, b.right, fades(b));
  }

  // n/e/s/w are the ground corners of the box on screen; h lifts the top face.
  function drawBox(nx, ny, ex, ey, sx, sy, wx, wy, h, top, left, right, outline) {
    if (outline) {
      ctx.beginPath();
      ctx.moveTo(nx, ny - h); ctx.lineTo(ex, ey - h); ctx.lineTo(sx, sy - h); ctx.lineTo(wx, wy - h); ctx.closePath();
      ctx.moveTo(wx, wy - h); ctx.lineTo(wx, wy); ctx.lineTo(sx, sy); ctx.lineTo(ex, ey); ctx.lineTo(ex, ey - h);
      ctx.moveTo(sx, sy - h); ctx.lineTo(sx, sy);
      ctx.strokeStyle = VR.config.render.colors.wallOutline;
      ctx.lineWidth = 1;
      ctx.stroke();
      return;
    }
    // Left-front face (+y side).
    ctx.beginPath();
    ctx.moveTo(wx, wy); ctx.lineTo(sx, sy); ctx.lineTo(sx, sy - h); ctx.lineTo(wx, wy - h); ctx.closePath();
    ctx.fillStyle = left; ctx.fill();
    // Right-front face (+x side).
    ctx.beginPath();
    ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.lineTo(ex, ey - h); ctx.lineTo(sx, sy - h); ctx.closePath();
    ctx.fillStyle = right; ctx.fill();
    // Top.
    ctx.beginPath();
    ctx.moveTo(nx, ny - h); ctx.lineTo(ex, ey - h); ctx.lineTo(sx, sy - h); ctx.lineTo(wx, wy - h); ctx.closePath();
    ctx.fillStyle = top; ctx.fill();
  }

  function drawItem(r, ox, oy) {
    var colors = VR.config.render.colors;
    ctx.globalAlpha = r.alpha;
    VR.iso.toScreen(r.x, r.y, r.z, tmpA);
    var sx = tmpA.x + ox, sy = tmpA.y + oy;

    switch (r.kind) {
      case 'actor': {
        var rx = VR.iso.circleRx(r.radius), ry = VR.iso.circleRy(r.radius);
        var footY = sy, headY = sy - r.height;
        // Shadow stays on the floor even when the actor is lifted.
        VR.iso.toScreen(r.x, r.y, 0, tmpB);
        ctx.fillStyle = colors.shadow;
        ctx.beginPath(); ctx.ellipse(tmpB.x + ox, tmpB.y + oy, rx * ACTOR.shadowScale, ry * ACTOR.shadowScale, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = r.color;
        ctx.beginPath();
        ctx.ellipse(sx, footY, rx, ry, 0, 0, Math.PI);
        ctx.lineTo(sx - rx, headY);
        ctx.ellipse(sx, headY, rx, ry, 0, Math.PI, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
        // Lit top cap.
        ctx.fillStyle = ACTOR.capAlpha;
        ctx.beginPath(); ctx.ellipse(sx, headY, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
        if (r.hasAngle) {
          var reach = r.radius * ACTOR.facingReach, lift = r.height * ACTOR.facingLift;
          VR.iso.toScreen(r.x + Math.cos(r.angle) * reach, r.y + Math.sin(r.angle) * reach, r.z + lift, tmpB);
          ctx.strokeStyle = r.color;
          ctx.lineWidth = ACTOR.facingWidth;
          ctx.beginPath(); ctx.moveTo(sx, sy - lift); ctx.lineTo(tmpB.x + ox, tmpB.y + oy); ctx.stroke();
        }
        break;
      }
      case 'block': {
        var hx = r.w * 0.5, hy = r.d * 0.5;
        VR.iso.toScreen(r.x - hx, r.y - hy, r.z, tmpA); var nx = tmpA.x + ox, ny = tmpA.y + oy;
        VR.iso.toScreen(r.x + hx, r.y - hy, r.z, tmpA); var ex = tmpA.x + ox, ey = tmpA.y + oy;
        VR.iso.toScreen(r.x + hx, r.y + hy, r.z, tmpA); var bsx = tmpA.x + ox, bsy = tmpA.y + oy;
        VR.iso.toScreen(r.x - hx, r.y + hy, r.z, tmpA); var wx = tmpA.x + ox, wy = tmpA.y + oy;
        drawBox(nx, ny, ex, ey, bsx, bsy, wx, wy, r.height, r.color, r.colorLeft, r.colorRight, r.outline);
        break;
      }
      case 'projectile': {
        var pr = Math.max(MIN_DOT, VR.iso.circleRx(r.radius));
        if (r.hasEnd) {
          VR.iso.toScreen(r.x2, r.y2, r.z, tmpB);
          ctx.strokeStyle = r.color;
          ctx.lineWidth = pr;
          ctx.globalAlpha = r.alpha * 0.5;
          ctx.beginPath(); ctx.moveTo(tmpB.x + ox, tmpB.y + oy); ctx.lineTo(sx, sy); ctx.stroke();
          ctx.globalAlpha = r.alpha;
        }
        ctx.fillStyle = r.color;
        ctx.beginPath(); ctx.arc(sx, sy, pr, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'line': {
        VR.iso.toScreen(r.x2, r.y2, r.z2, tmpB);
        ctx.strokeStyle = r.color;
        ctx.lineWidth = r.width;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tmpB.x + ox, tmpB.y + oy); ctx.stroke();
        break;
      }
      case 'circle': {
        ctx.beginPath();
        ctx.ellipse(sx, sy, VR.iso.circleRx(r.radius), VR.iso.circleRy(r.radius), 0, 0, Math.PI * 2);
        if (r.outline) { ctx.strokeStyle = r.color; ctx.lineWidth = r.width; ctx.stroke(); }
        else { ctx.fillStyle = r.color; ctx.fill(); }
        break;
      }
      case 'marker': {
        var s = r.size;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = r.width;
        ctx.beginPath();
        ctx.moveTo(sx, sy - s * 0.5); ctx.lineTo(sx + s, sy); ctx.lineTo(sx, sy + s * 0.5); ctx.lineTo(sx - s, sy); ctx.closePath();
        ctx.moveTo(sx - s * MARKER_ARM, sy); ctx.lineTo(sx + s * MARKER_ARM, sy);
        ctx.moveTo(sx, sy - s * MARKER_STEM); ctx.lineTo(sx, sy + s * MARKER_STEM);
        ctx.stroke();
        break;
      }
      case 'text': {
        ctx.fillStyle = r.color;
        ctx.font = (r.size || TEXT_SIZE) + 'px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(r.text, sx, sy);
        break;
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- public ------------------------------------------------------------------------------------
  VR.render = {
    canvas: null,
    ctx: null,
    width: 0,
    height: 0,
    stats: { items: 0, blocks: 0 },

    init: function (cnv) {
      canvas = cnv;
      ctx = canvas.getContext('2d');
      VR.render.canvas = canvas;
      VR.render.ctx = ctx;
      VR.render.resize();
      window.addEventListener('resize', VR.render.resize);
    },

    resize: function () {
      dpr = window.devicePixelRatio || 1;
      var w = window.innerWidth, h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      VR.render.width = w;
      VR.render.height = h;
      builtVersion = -1;   // floor cache resolution follows dpr
    },

    reset: function () {
      count = 0;
      focus.on = false;
      builtVersion = -1;
    },

    submit: submit,
    setFocus: setFocus,

    frame: function () {
      var view = VR.camera.view, ox = view.ox, oy = view.oy, vw = VR.render.width, vh = VR.render.height;
      var colors = VR.config.render.colors;
      var i, r;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = colors.background;
      ctx.fillRect(0, 0, vw, vh);

      var hasWorld = VR.world.tiles !== null;
      if (hasWorld && builtVersion !== VR.world.version) buildStatic();
      if (hasWorld) ctx.drawImage(floorCache, ox - floorOx, oy - floorOy, floorW, floorH);

      for (i = 0; i < count; i++) if (pool[i].layer === 'floor') drawItem(pool[i], ox, oy);

      sorted.length = 0;
      for (i = 0; i < count; i++) if (pool[i].layer === 'world') sorted.push(pool[i]);
      sorted.sort(byDepth);

      var si = 0, blocks = 0;
      if (hasWorld) {
        var T = VR.world.T;
        for (var d = 0; d < diagonals.length; d++) {
          var limit = (d + 1) * T;
          while (si < sorted.length && sorted[si].depth < limit) drawItem(sorted[si++], ox, oy);
          var diag = diagonals[d];
          for (var k = 0; k < diag.length; k++) drawStatic(diag[k], ox, oy, vw, vh);
          blocks += diag.length;
        }
      }
      while (si < sorted.length) drawItem(sorted[si++], ox, oy);

      for (i = 0; i < count; i++) {
        r = pool[i];
        if (r.layer === 'overlay') drawItem(r, ox, oy);
      }

      VR.render.stats.items = count;
      VR.render.stats.blocks = blocks;
      count = 0;
      focus.on = false;
    },

    // Reset the context to CSS-pixel screen space for HUD / debug drawing after frame().
    screenSpace: function () {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      return ctx;
    },

    // Centered screen-space message (pause, scene transitions).
    banner: function (text) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, VR.render.width, VR.render.height);
      ctx.fillStyle = '#fff';
      ctx.font = '20px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, VR.render.width / 2, VR.render.height / 2);
    }
  };
})(window.VR = window.VR || {});
