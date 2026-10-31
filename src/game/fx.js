/*
 * VR.fx: short-lived visuals for hit feel: blood decals, tracers, muzzle flashes, floating text.
 * Owner: combat-engineer.
 *
 *   VR.fx.reset()                       drop everything (room restart)
 *   VR.fx.splatter(x, y, dx, dy, big)   blood pool plus droplets thrown along (dx, dy)
 *   VR.fx.debris(x, y)                  crate fragments
 *   VR.fx.tracer(x0, y0, x1, y1)        pellet / bullet line for config.shotgun.flashLife
 *   VR.fx.flash(x, y, z)                muzzle flash
 *   VR.fx.text(x, y, str, color)        text rising from a point
 *   VR.fx.update(dt) / VR.fx.render()
 */
(function (VR) {
  'use strict';

  var decals = [];     // permanent until reset; ring buffer capped by config.hit.decalMax
  var decalHead = 0;
  var timed = [];      // tracers, flashes, text
  var item = {};

  function reset() { decals.length = 0; decalHead = 0; timed.length = 0; }

  function addDecal(x, y, r, color, alpha) {
    var max = VR.config.hit.decalMax, d = { x: x, y: y, r: r, color: color, alpha: alpha };
    if (decals.length < max) decals.push(d);
    else { decals[decalHead] = d; decalHead = (decalHead + 1) % max; }
  }

  function put(kind, life, o) { o.kind = kind; o.life = o.max = life; timed.push(o); }

  VR.fx = {
    reset: reset,
    decalCount: function () { return decals.length; },

    splatter: function (x, y, dx, dy, big) {
      var h = VR.config.hit, i;
      addDecal(x, y, h.pool * (big ? h.bigPoolScale : 1), h.bloodDark, h.poolAlpha);
      for (i = 0; i < h.splatterCount; i++) {
        // Droplets bias toward the shot direction so the spray reads as an exit wound.
        var dist = Math.random() * h.splatterSpread, a = Math.random() * Math.PI * 2;
        var px = x + Math.cos(a) * dist * 0.5 + dx * dist, py = y + Math.sin(a) * dist * 0.5 + dy * dist;
        addDecal(px, py, h.splatterMin + Math.random() * (h.splatterMax - h.splatterMin),
          Math.random() < 0.5 ? h.bloodColor : h.bloodDark, h.dropAlpha);
      }
    },

    debris: function (x, y) {
      var c = VR.config.cover, h = VR.config.hit;
      for (var i = 0; i < c.debrisCount; i++) {
        var a = Math.random() * Math.PI * 2, d = Math.random() * c.debrisSpread;
        addDecal(x + Math.cos(a) * d, y + Math.sin(a) * d, h.splatterMin + Math.random() * h.splatterMin, h.pickupColor, h.dropAlpha);
      }
    },

    tracer: function (x0, y0, x1, y1) {
      put('tracer', VR.config.shotgun.flashLife, { x: x0, y: y0, x2: x1, y2: y1 });
    },

    flash: function (x, y, z) { put('flash', VR.config.shotgun.flashLife, { x: x, y: y, z: z }); },

    text: function (x, y, str, color) { put('text', VR.config.hit.textLife, { x: x, y: y, text: str, color: color }); },

    update: function (dt) {
      for (var i = timed.length - 1; i >= 0; i--) {
        timed[i].life -= dt;
        if (timed[i].life <= 0) { timed[i] = timed[timed.length - 1]; timed.pop(); }
      }
    },

    render: function () {
      var h = VR.config.hit, sg = VR.config.shotgun, i, t;
      for (i = 0; i < decals.length; i++) {
        var d = decals[i];
        item = { kind: 'circle', layer: 'floor', x: d.x, y: d.y, z: 0, radius: d.r, color: d.color, alpha: d.alpha };
        VR.render.submit(item);
      }
      for (i = 0; i < timed.length; i++) {
        t = timed[i];
        var k = t.life / t.max;
        if (t.kind === 'tracer') {
          item = { kind: 'line', x: t.x, y: t.y, z: h.tracerHeight, x2: t.x2, y2: t.y2, color: h.tracerColor, width: sg.tracerWidth, alpha: k, layer: 'overlay' };
        } else if (t.kind === 'flash') {
          item = { kind: 'projectile', x: t.x, y: t.y, z: t.z, radius: sg.flashRadius * k, color: h.flashColor, alpha: k, layer: 'overlay' };
        } else {
          item = { kind: 'text', x: t.x, y: t.y, z: h.comboPopHeight + (1 - k) * h.comboPopHeight, text: t.text, size: h.textSize, color: t.color, alpha: k, layer: 'overlay' };
        }
        VR.render.submit(item);
      }
    }
  };
})(window.VR = window.VR || {});
