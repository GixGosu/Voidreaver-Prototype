/*
 * VR.loop: fixed-timestep update with interpolated render.
 *
 *   VR.loop.onUpdate(fn)    fn(dt) runs every fixed step (dt = config.loop.step)
 *   VR.loop.onRender(fn)    fn(alpha) runs once per animation frame; alpha in [0,1) is how far the
 *                           clock is between the last two fixed steps (use VR.entity.ix/iy)
 *   VR.loop.hitStop(s)      freeze simulation for s seconds (rendering continues); overlapping calls keep the longest
 *   VR.loop.paused          true while the tab is blurred/hidden; the simulation does not advance
 *   VR.loop.stats           { fps, frameMs, updateMs, renderMs, steps }
 */
(function (VR) {
  'use strict';

  var updateFns = [];
  var renderFns = [];
  var last = 0;
  var acc = 0;
  var stopLeft = 0;
  var running = false;

  var loop = {
    alpha: 0,
    time: 0,          // simulated seconds since start
    paused: false,
    stats: { fps: 1 / VR.config.loop.step, frameMs: 0, updateMs: 0, renderMs: 0, steps: 0 },

    onUpdate: function (fn) { updateFns.push(fn); },
    onRender: function (fn) { renderFns.push(fn); },

    hitStop: function (seconds) { if (seconds > stopLeft) stopLeft = seconds; },
    isHitStopped: function () { return stopLeft > 0; },

    pause: function () {
      if (loop.paused) return;
      loop.paused = true;
      VR.input.clear();
    },
    resume: function () {
      if (!loop.paused) return;
      loop.paused = false;
      last = performance.now();   // do not simulate the time spent away
      acc = 0;
    },

    start: function () {
      if (running) return;
      running = true;
      window.addEventListener('blur', loop.pause);
      window.addEventListener('focus', loop.resume);
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) loop.pause(); else if (document.hasFocus()) loop.resume();
      });
      window.addEventListener('mousedown', loop.resume);
      last = performance.now();
      requestAnimationFrame(tick);
    }
  };

  function tick(now) {
    requestAnimationFrame(tick);
    var cfg = VR.config.loop;
    var frame = (now - last) / 1000;
    last = now;
    if (frame > cfg.maxFrame) frame = cfg.maxFrame;
    if (frame < 0) frame = 0;

    var stats = loop.stats;
    stats.frameMs = frame * 1000;
    if (frame > 0) stats.fps += (1 / frame - stats.fps) * VR.config.debug.fpsSmoothing;

    var t0 = performance.now();
    var steps = 0;
    if (!loop.paused) {
      if (stopLeft > 0) {
        stopLeft -= frame;
        // Any frame time left over after the stop ends feeds the simulation normally.
        if (stopLeft < 0) { acc -= stopLeft; stopLeft = 0; }
      } else {
        acc += frame;
      }
      while (acc >= cfg.step && steps < cfg.maxStepsPerFrame) {
        for (var i = 0; i < updateFns.length; i++) updateFns[i](cfg.step);
        VR.input.endStep();
        loop.time += cfg.step;
        acc -= cfg.step;
        steps++;
        if (stopLeft > 0) { acc = 0; break; }   // a hit-stop triggered mid-frame freezes on that exact step
      }
      // After a capped catch-up, drop the backlog rather than spiralling.
      if (steps >= cfg.maxStepsPerFrame) acc = 0;
      // While frozen, show the frozen step itself rather than a blend toward the previous one.
      loop.alpha = stopLeft > 0 ? 1 : acc / cfg.step;
    }
    var t1 = performance.now();
    for (var j = 0; j < renderFns.length; j++) renderFns[j](loop.alpha);
    var t2 = performance.now();

    stats.steps = steps;
    stats.updateMs = t1 - t0;
    stats.renderMs = t2 - t1;
  }

  VR.loop = loop;
})(window.VR = window.VR || {});
