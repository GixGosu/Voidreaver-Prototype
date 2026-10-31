/*
 * Flight scene (owner: flight-engineer): the Zaxxon-style approach to the target ship.
 *
 *   VR.scenes.go('flight')                          start of the run
 *   VR.scenes.go('flight', { checkpoint: seconds }) start at that time (must be one of the course checkpoints, or 0)
 *
 * Controls: A/D strafe, W/S altitude band, hold left click to fire, R restarts from the last checkpoint.
 * Docking at the end hands off to VR.scenes.go('boarding', { room: flight.nextRoom }).
 *
 * Debug keys (work from any scene): F2 jump to the flight scene, F4 jump to boarding room 1.
 * In the flight scene: N warps to the next checkpoint (wraps to the start), H toggles god mode.
 * VR.flight.state exposes the live sim state for tests and the tuning panel.
 *
 * The simulation lives in src/game/flight-sim.js, drawing in flight-draw.js, the authored course in
 * flight-course.js. This file only wires input, camera, restart and the hand-off.
 */
(function (VR) {
  'use strict';

  var f = null;
  var handedOff = false;

  function cfg() { return VR.config.flight; }

  function snapCamera() {
    var cam = VR.camera.state;
    VR.camera.snap(f.ship.x - cfg().cameraAhead, 0);
    cam.px = cam.x;
    cam.py = cam.y;
  }

  function restart(cpT) {
    VR.flightSim.reset(f, cpT);
    snapCamera();
  }

  function nextCheckpoint() {
    var cps = VR.flightCourse.course.checkpoints;
    for (var i = 0; i < cps.length; i++) if (cps[i] > f.cpT) return cps[i];
    return 0;
  }

  function readInput() {
    var k = cfg().keys, inp = VR.flight.input;
    inp.strafe = (VR.input.down(k.left) ? 1 : 0) - (VR.input.down(k.right) ? 1 : 0);
    inp.up = VR.input.pressed(k.up);
    inp.down = VR.input.pressed(k.down);
    inp.fire = VR.input.mouseDown(0);
    return inp;
  }

  // Scene-independent debug hotkeys, so the flight can be reached from boarding and back without a rebuild.
  window.addEventListener('keydown', function (e) {
    var k = VR.config && VR.config.flight && VR.config.flight.keys;
    if (!k || e.repeat) return;
    if (e.code === k.toFlight) { e.preventDefault(); VR.scenes.go('flight'); }
    else if (e.code === k.toBoarding) { e.preventDefault(); VR.scenes.go('boarding', { room: cfg().nextRoom }); }
  });

  VR.flight = {
    state: null,
    input: { strafe: 0, up: false, down: false, fire: false }
  };

  VR.scenes.register('flight', {
    enter: function (params) {
      // The flight has no tile map; clearing it stops the renderer drawing the previous room's floor.
      VR.world.tiles = null;
      handedOff = false;
      f = VR.flightSim.create();
      VR.flight.state = f;
      restart(params.checkpoint || 0);
    },

    exit: function () {
      VR.flight.state = f = null;
    },

    update: function (dt) {
      var k = cfg().keys;
      if (VR.input.pressed(k.god)) f.god = !f.god;
      if (VR.input.pressed(k.nextCheckpoint)) { restart(nextCheckpoint()); return; }
      if (VR.input.pressed(k.restart)) { restart(f.cpT); return; }

      VR.flightSim.step(f, dt, readInput());

      if (f.dead && f.deadT <= 0) { restart(f.cpT); return; }
      if (f.docked && f.dockT <= 0 && !handedOff) {
        handedOff = true;
        VR.scenes.go('boarding', { room: cfg().nextRoom });
        return;
      }

      VR.camera.follow(f.ship.x - cfg().cameraAhead, 0, f.ship.x - cfg().cameraAhead, 0);
      VR.camera.update(dt);
    },

    render: function (alpha) {
      VR.flightDraw.render(f, alpha);
    }
  });
})(window.VR = window.VR || {});
