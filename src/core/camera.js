/*
 * VR.camera: follows a world point with a lead toward the aim, plus screen shake.
 *
 *   VR.camera.snap(x, y)                     jump instantly (scene enter, restart)
 *   VR.camera.follow(x, y, aimX, aimY)       set this step's target (call every fixed update)
 *   VR.camera.update(dt)                     ease toward the target, tick shake
 *   VR.camera.shake(strength, duration)      strength in screen px; the strongest active shake wins
 *   VR.camera.beginFrame(alpha, w, h)        compute this frame's view transform (interpolated + shake)
 *   VR.camera.view                           { ox, oy, w, h }: screen = VR.iso.toScreen(world) + (ox, oy)
 *   VR.camera.worldToScreen / screenToWorld  convert with the current frame's transform
 *
 * Tuning (VR.config.camera, read live so the tuning panel applies instantly):
 *   leadFactor  fraction of the player->aim vector the target leans toward
 *   leadMax     cap on that lead, world px
 *   followSharpness, shakeMax
 */
(function (VR) {
  'use strict';

  var tmp = { x: 0, y: 0 };
  var cam = { x: 0, y: 0, px: 0, py: 0, tx: 0, ty: 0 };
  var shakeStrength = 0;
  var shakeLeft = 0;
  var shakeDur = 0;

  var view = { ox: 0, oy: 0, w: 0, h: 0, cx: 0, cy: 0 };

  VR.camera = {
    view: view,
    state: cam,

    snap: function (x, y) {
      cam.x = cam.px = cam.tx = x;
      cam.y = cam.py = cam.ty = y;
    },

    reset: function () {
      shakeStrength = shakeLeft = shakeDur = 0;
      VR.camera.snap(0, 0);
    },

    follow: function (x, y, aimX, aimY) {
      var c = VR.config.camera;
      var lx = (aimX - x) * c.leadFactor;
      var ly = (aimY - y) * c.leadFactor;
      var len = Math.sqrt(lx * lx + ly * ly);
      if (len > c.leadMax) { lx *= c.leadMax / len; ly *= c.leadMax / len; }
      cam.tx = x + lx;
      cam.ty = y + ly;
    },

    update: function (dt) {
      cam.px = cam.x;
      cam.py = cam.y;
      var k = 1 - Math.exp(-VR.config.camera.followSharpness * dt);
      cam.x += (cam.tx - cam.x) * k;
      cam.y += (cam.ty - cam.y) * k;
      if (shakeLeft > 0) {
        shakeLeft -= dt;
        if (shakeLeft <= 0) shakeLeft = shakeStrength = 0;
      }
    },

    shake: function (strength, duration) {
      // Compare remaining intensity so a weak late shake cannot cut a strong one short.
      var current = shakeDur > 0 ? shakeStrength * (shakeLeft / shakeDur) : 0;
      if (strength >= current) {
        shakeStrength = Math.min(strength, VR.config.camera.shakeMax);
        shakeLeft = shakeDur = duration;
      }
    },

    beginFrame: function (alpha, w, h) {
      var x = cam.px + (cam.x - cam.px) * alpha;
      var y = cam.py + (cam.y - cam.py) * alpha;
      VR.iso.toScreen(x, y, 0, tmp);
      var sx = 0, sy = 0;
      if (shakeLeft > 0 && shakeDur > 0) {
        var s = shakeStrength * (shakeLeft / shakeDur);
        sx = (Math.random() * 2 - 1) * s;
        sy = (Math.random() * 2 - 1) * s;
      }
      view.w = w;
      view.h = h;
      view.cx = x;
      view.cy = y;
      // Round so floor tiles and blocks land on whole pixels; aim uses the same rounded transform.
      view.ox = Math.round(w * 0.5 - tmp.x + sx);
      view.oy = Math.round(h * 0.5 - tmp.y + sy);
    },

    worldToScreen: function (x, y, z, out) {
      VR.iso.toScreen(x, y, z, out);
      out.x += view.ox;
      out.y += view.oy;
      return out;
    },

    screenToWorld: function (sx, sy, out) {
      return VR.iso.toWorld(sx - view.ox, sy - view.oy, 0, out);
    }
  };
})(window.VR = window.VR || {});
