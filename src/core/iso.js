/*
 * VR.iso: exact world <-> screen conversion for 2:1 dimetric tiles.
 *
 * World: x/y in pixels on the flat ground plane, z = height in screen pixels straight up.
 * Screen (relative to the projected world origin, before camera offset):
 *   sx = (x - y) * kx          kx = (tileW / 2) / tileWorld
 *   sy = (x + y) * ky - z      ky = (tileH / 2) / tileWorld
 * The inverse is exact for any z, so aim on the floor (z = 0) lands exactly under the cursor.
 *
 * All functions write into an `out` object ({x, y}) to avoid per-frame allocations.
 */
(function (VR) {
  'use strict';

  function kx() { var c = VR.config.iso; return (c.tileW / 2) / c.tileWorld; }
  function ky() { var c = VR.config.iso; return (c.tileH / 2) / c.tileWorld; }

  VR.iso = {
    kx: kx,
    ky: ky,

    // World point -> screen offset from the projected origin.
    toScreen: function (x, y, z, out) {
      out.x = (x - y) * kx();
      out.y = (x + y) * ky() - z;
      return out;
    },

    // Screen offset -> world point on the plane at height z (z = 0 for the floor).
    toWorld: function (sx, sy, z, out) {
      var a = sx / kx();          // x - y
      var b = (sy + z) / ky();    // x + y
      out.x = (a + b) * 0.5;
      out.y = (b - a) * 0.5;
      return out;
    },

    // Screen-space direction -> world-space direction (not normalised). Used for screen-relative WASD.
    dirToWorld: function (dx, dy, out) {
      var a = dx / kx();
      var b = dy / ky();
      out.x = (a + b) * 0.5;
      out.y = (b - a) * 0.5;
      return out;
    },

    // Screen half-extents of a world circle of radius r lying on the floor (an ellipse).
    circleRx: function (r) { return r * Math.SQRT2 * kx(); },
    circleRy: function (r) { return r * Math.SQRT2 * ky(); }
  };
})(window.VR = window.VR || {});
