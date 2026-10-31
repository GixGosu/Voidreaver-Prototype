/*
 * VR.entity: the shared entity shape. Entities are plain objects; no classes.
 *
 *   {
 *     kind,          // 'player' | 'grunt' | 'rusher' | 'bullet' | ... (string)
 *     x, y,          // world px on the ground plane (centre of the footprint)
 *     z,             // height above the floor, screen px (0 = standing on the floor)
 *     px, py, pz,    // previous-step position, for interpolated rendering
 *     vx, vy,        // velocity, world px / s
 *     radius,        // footprint radius, world px (collision + rendering)
 *     height,        // body height, screen px (rendering + wall fade)
 *     angle,         // facing, radians in world space (0 = +x)
 *     alive          // false once dead/removed
 *   }
 *
 * Owners may add any fields they need. Call VR.entity.savePrev(e) at the start of each fixed update
 * and draw at VR.entity.ix(e, alpha) / iy(e, alpha).
 */
(function (VR) {
  'use strict';

  VR.entity = {
    create: function (kind, x, y, radius, height) {
      return {
        kind: kind, x: x, y: y, z: 0, px: x, py: y, pz: 0,
        vx: 0, vy: 0, radius: radius, height: height, angle: 0, alive: true
      };
    },

    savePrev: function (e) { e.px = e.x; e.py = e.y; e.pz = e.z; },

    // Teleport without interpolation smear (spawns, restarts).
    place: function (e, x, y) { e.x = e.px = x; e.y = e.py = y; },

    ix: function (e, a) { return e.px + (e.x - e.px) * a; },
    iy: function (e, a) { return e.py + (e.y - e.py) * a; },
    iz: function (e, a) { return e.pz + (e.z - e.pz) * a; }
  };
})(window.VR = window.VR || {});
