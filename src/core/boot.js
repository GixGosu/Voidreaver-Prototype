/*
 * Boot: wires the modules together once every script has loaded, then starts the loop.
 * Debug toggles (F1 overlay, backtick tuning panel) are read before the scene step so they never lag a frame;
 * telemetry observes after it. Render order: world (scene) -> HUD -> F1 overlay -> pause banner.
 */
(function (VR) {
  'use strict';

  var canvas = document.getElementById('game');
  VR.render.init(canvas);
  VR.input.init(canvas);
  VR.camera.reset();

  VR.loop.onUpdate(VR.debug.step);
  VR.loop.onUpdate(VR.tuning.step);
  VR.loop.onUpdate(VR.scenes.update);
  VR.loop.onUpdate(VR.telemetry.step);   // after the scene, so it sees this step's deaths and clears

  VR.loop.onRender(VR.scenes.render);
  VR.loop.onRender(VR.hud.draw);
  VR.loop.onRender(VR.debug.draw);
  VR.loop.onRender(function () {
    if (VR.loop.paused) VR.render.banner('Paused - click to resume');
  });

  // The run opens with the flight; docking hands off to boarding room 1 (flight.nextRoom).
  VR.scenes.go('flight');
  VR.loop.start();
})(window.VR = window.VR || {});
