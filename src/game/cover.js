/*
 * VR.cover: cover rules and readability. Owner: combat-engineer.
 *
 * Cover types come from VR.world: 'half' (h, blocks bullets and pellets, you fire over it by popping out),
 * 'full' (F, blocks everything, you lean out to its edge to fire) and 'crate' (c, half cover with hit points).
 *
 *   VR.cover.hpOf(cover)            current hp (crates only; other cover is indestructible, returns Infinity)
 *   VR.cover.setHp(cover, hp)       used by VR.roomState when restoring a snapshot
 *   VR.cover.damage(cover, amount)  returns true if the crate broke
 *   VR.cover.move(cover, tx, ty)    slide a crate to a free tile (breach pull)
 *   VR.cover.assess(p, sx, sy)      protection check against one shooter at (sx, sy); returns a SHARED record
 *                                   { protected, cover, nx, ny }: protected is true when something solid sits on
 *                                   the line of fire; cover/nx/ny name the cover tile and face the line enters
 *                                   (cover is null for plain walls). Popping out over half cover exposes you.
 *   VR.cover.isProtected(p, sx, sy) boolean form of assess
 *   VR.cover.render(p, alpha)       shield icons above the player and red glow on cover faces in the line of fire
 *
 * Enemies run assess() each step for the player and keep the result on themselves (e.prot, e.lofCover,
 * e.lofNx, e.lofNy), so render, AI and bullets all agree on who is protected.
 */
(function (VR) {
  'use strict';

  var rec = { protected: false, cover: null, nx: 0, ny: 0 };
  var off = { x: 0, y: 0 };
  var a = { x: 0, y: 0, z: 0 }, b = { x: 0, y: 0, z: 0 };
  var line = { kind: 'line', layer: 'overlay' };
  var pips = [];

  function maxHp() { return VR.config.cover.crateHp; }

  // Face of a tile cover block, as two world points, inset like the renderer draws the block.
  function faceEnds(cover, nx, ny, out0, out1) {
    var T = VR.world.T, inset = VR.config.render.coverInset;
    var x0 = cover.tx * T + inset, y0 = cover.ty * T + inset, x1 = (cover.tx + 1) * T - inset, y1 = (cover.ty + 1) * T - inset;
    if (nx !== 0) {
      var fx = nx > 0 ? x1 : x0;
      out0.x = fx; out0.y = y0; out1.x = fx; out1.y = y1;
    } else {
      var fy = ny > 0 ? y1 : y0;
      out0.x = x0; out0.y = fy; out1.x = x1; out1.y = fy;
    }
  }

  function coverHeight(cover) {
    var rc = VR.config.render;
    return cover.type === 'full' ? rc.fullCoverHeight : cover.type === 'half' ? rc.halfCoverHeight : rc.crateHeight;
  }

  function seg(x0, y0, z0, x1, y1, z1, color, width, alpha) {
    line.x = x0; line.y = y0; line.z = z0; line.x2 = x1; line.y2 = y1; line.z2 = z1;
    line.color = color; line.width = width; line.alpha = alpha;
    VR.render.submit(line);
  }

  // A point `sdx` screen px to the right of (x, y), `z` px up.
  function sp(x, y, sdx, z, out) {
    VR.iso.dirToWorld(sdx, 0, off);
    out.x = x + off.x; out.y = y + off.y; out.z = z;
    return out;
  }

  function shieldSeg(x, y, zb, s0, z0, s1, z1, color, width) {
    sp(x, y, s0, zb + z0, a); sp(x, y, s1, zb + z1, b);
    seg(a.x, a.y, a.z, b.x, b.y, b.z, color, width, 1);
  }

  // Shield icon centred `cx` screen px from the player: filled green when protected, red outline with a slash when not.
  function drawShield(x, y, zb, cx, safe) {
    var c = VR.config.cover, w = c.shieldW, h = c.shieldH, lo = h * c.shieldTaper;
    var col = safe ? c.safeColor : c.exposedColor, lw = c.iconLineWidth;
    shieldSeg(x, y, zb, cx - w, h, cx + w, h, col, lw);
    shieldSeg(x, y, zb, cx + w, h, cx + w, lo, col, lw);
    shieldSeg(x, y, zb, cx + w, lo, cx, 0, col, lw);
    shieldSeg(x, y, zb, cx, 0, cx - w, lo, col, lw);
    shieldSeg(x, y, zb, cx - w, lo, cx - w, h, col, lw);
    if (safe) {
      for (var k = -1; k <= 1; k++) {
        var s = w * 0.5 * k;
        shieldSeg(x, y, zb, cx + s, h, cx + s, lo * Math.abs(s) / w, col, lw * c.iconFillWidth);
      }
    } else {
      shieldSeg(x, y, zb, cx - w, h, cx + w, lo, col, lw);
    }
  }

  function threatening(e) {
    return e.alive && (e.state === 'react' || e.state === 'attack' || e.state === 'charge');
  }

  VR.cover = {
    hpOf: function (cover) {
      if (cover.type !== 'crate') return Infinity;
      if (cover.hp === undefined) cover.hp = maxHp();
      return cover.hp;
    },

    setHp: function (cover, hp) { if (cover.type === 'crate') cover.hp = hp; },

    damage: function (cover, amount) {
      if (!cover.alive || cover.type !== 'crate') return false;
      cover.hp = VR.cover.hpOf(cover) - amount;
      if (cover.hp > 0) return false;
      VR.world.removeCover(cover);
      VR.fx.debris(cover.x, cover.y);
      VR.camera.shake(VR.config.cover.breakShake, VR.config.cover.breakShakeDuration);
      VR.audio.play('kick');
      return true;
    },

    move: function (cover, tx, ty) {
      var W = VR.world;
      W.coverGrid[cover.ty * W.cols + cover.tx] = null;
      cover.tx = tx; cover.ty = ty;
      cover.x = (tx + 0.5) * W.T; cover.y = (ty + 0.5) * W.T;
      W.coverGrid[ty * W.cols + tx] = cover;
      W.version++;
    },

    assess: function (p, sx, sy) {
      var W = VR.world;
      rec.protected = false; rec.cover = null; rec.nx = rec.ny = 0;
      var h = W.raycast(sx, sy, p.x, p.y, W.RAY_WALLS | W.RAY_FULL | W.RAY_HALF);
      if (!h.hit) return rec;
      if (h.cover) { rec.cover = h.cover; rec.nx = h.nx; rec.ny = h.ny; }
      // Vaulting your own half cover: the shot passes over it and you are exposed.
      if (h.cover && h.cover === p.cover && p.popped && h.cover.type !== 'full') return rec;
      rec.protected = true;
      return rec;
    },

    isProtected: function (p, sx, sy) { return VR.cover.assess(p, sx, sy).protected; },

    render: function (p, alpha) {
      var c = VR.config.cover, list = VR.enemies.list, i, e;
      var x = VR.entity.ix(p, alpha), y = VR.entity.iy(p, alpha);

      // Damage cracks on wounded crates.
      var covers = VR.world.covers, T = VR.world.T, inset = VR.config.render.coverInset;
      for (i = 0; i < covers.length; i++) {
        var cv = covers[i];
        if (!cv.alive || cv.type !== 'crate' || cv.hp === undefined || cv.hp >= maxHp()) continue;
        VR.render.submit({ kind: 'block', x: cv.x, y: cv.y, z: 0, w: T - inset * 2, d: T - inset * 2,
          height: VR.config.render.crateHeight, color: c.crackColor, outline: true, width: 2,
          alpha: 1 - cv.hp / maxHp(), depthBias: 0.5 });
      }

      if (!p.alive) return;
      pips.length = 0;
      for (i = 0; i < list.length; i++) {
        e = list[i];
        if (!threatening(e)) continue;
        var dx = e.x - p.x, dy = e.y - p.y;
        e.threatD = dx * dx + dy * dy;
        pips.push(e);
      }
      if (pips.length === 0) return;
      pips.sort(function (m, n) { return m.threatD - n.threatD; });

      // Red glow on the cover face each shooter's line of fire runs into.
      var h0 = { x: 0, y: 0 }, h1 = { x: 0, y: 0 };
      var pulse = c.glowBase + (1 - c.glowBase) * (0.5 + 0.5 * Math.sin(VR.loop.time * c.glowPulse));
      for (i = 0; i < pips.length; i++) {
        e = pips[i];
        var cov = e.lofCover;
        if (!cov || !cov.alive || e.def.ai === 'melee' || (e.lofNx === 0 && e.lofNy === 0)) continue;
        faceEnds(cov, e.lofNx, e.lofNy, h0, h1);
        var top = coverHeight(cov);
        seg(h0.x, h0.y, top, h1.x, h1.y, top, c.glowColor, c.glowWidth, pulse);
        seg(h0.x, h0.y, top, h0.x, h0.y, 0, c.glowColor, c.glowWidth * 0.5, pulse);
        seg(h1.x, h1.y, top, h1.x, h1.y, 0, c.glowColor, c.glowWidth * 0.5, pulse);
        seg(h0.x, h0.y, 0, h1.x, h1.y, 0, c.glowColor, c.glowWidth, pulse);
      }

      // Shield icons: one per alerted enemy, nearest first.
      var n = Math.min(pips.length, c.iconMax), zb = p.height + c.iconLift;
      for (i = 0; i < n; i++) {
        drawShield(x, y, zb, (i - (n - 1) * 0.5) * c.iconGap, pips[i].prot === true);
      }
    }
  };
})(window.VR = window.VR || {});
