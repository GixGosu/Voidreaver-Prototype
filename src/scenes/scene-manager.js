/*
 * VR.scenes: owns the active scene and switches between them with a clean reset.
 *
 * A scene is a plain object: { enter(params), exit(), update(dt), render(alpha) }.
 *   VR.scenes.register(name, scene)
 *   VR.scenes.go(name, params)   switch at the start of the next fixed update (never mid-step)
 *   VR.scenes.current            name of the active scene
 *
 * On switch: old.exit(), then render list, camera and input are reset, then new.enter(params).
 * Each frame: camera.beginFrame -> input.refreshMouseWorld -> scene.render (submits) -> VR.render.frame().
 */
(function (VR) {
  'use strict';

  var scenes = Object.create(null);
  var active = null;
  var pending = null, pendingParams = null;

  function doSwitch() {
    var next = scenes[pending];
    if (!next) throw new Error('VR.scenes: unknown scene "' + pending + '"');
    if (active && active.exit) active.exit();
    VR.render.reset();
    VR.camera.reset();
    VR.input.clear();
    active = next;
    VR.scenes.current = pending;
    var params = pendingParams;
    pending = pendingParams = null;
    if (active.enter) active.enter(params || {});
  }

  VR.scenes = {
    current: null,

    register: function (name, scene) { scenes[name] = scene; },

    go: function (name, params) {
      pending = name;
      pendingParams = params || null;
      // Before any scene is active there is nothing to interrupt, so switch right away.
      if (!active) doSwitch();
    },

    update: function (dt) {
      if (pending) doSwitch();
      if (active && active.update) active.update(dt);
    },

    render: function (alpha) {
      VR.camera.beginFrame(alpha, VR.render.width, VR.render.height);
      VR.input.refreshMouseWorld();
      if (active && active.render) active.render(alpha);
      VR.render.frame();
    }
  };
})(window.VR = window.VR || {});
