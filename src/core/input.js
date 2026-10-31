/*
 * VR.input: keyboard + mouse state with edge detection.
 *
 *   VR.input.down(code)       held right now (KeyboardEvent.code, e.g. 'KeyW', 'Space')
 *   VR.input.pressed(code)    went down since the last fixed update
 *   VR.input.released(code)   went up since the last fixed update
 *   VR.input.mouseDown(b) / mousePressed(b) / mouseReleased(b)   b: 0 left, 1 middle, 2 right
 *   VR.input.mouse            { sx, sy } screen (CSS px)  { wx, wy } world point on the floor under the cursor
 *
 * Edges are cleared by VR.input.endStep() after each fixed update, so the first update that runs after
 * an event sees it exactly once, even on high refresh displays where some frames run no update.
 * mouse.wx/wy are recomputed by refreshMouseWorld() right after the camera transform for the frame is
 * set, so aim always matches what is on screen.
 */
(function (VR) {
  'use strict';

  var keysDown = Object.create(null);
  var keysPressed = Object.create(null);
  var keysReleased = Object.create(null);
  var btnDown = [false, false, false];
  var btnPressed = [false, false, false];
  var btnReleased = [false, false, false];
  var tmp = { x: 0, y: 0 };

  // Keys the browser would otherwise act on (scrolling, help, find, quick find).
  var swallow = { Space: 1, F1: 1, Backquote: 1, ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, Quote: 1, Slash: 1 };

  var mouse = { sx: 0, sy: 0, wx: 0, wy: 0, inside: false };

  function onKeyDown(e) {
    if (swallow[e.code]) e.preventDefault();
    if (!keysDown[e.code]) keysPressed[e.code] = true;
    keysDown[e.code] = true;
  }
  function onKeyUp(e) {
    if (swallow[e.code]) e.preventDefault();
    if (keysDown[e.code]) keysReleased[e.code] = true;
    keysDown[e.code] = false;
  }
  function onMouseMove(e) {
    mouse.sx = e.clientX;
    mouse.sy = e.clientY;
    mouse.inside = true;
  }
  function onMouseDown(e) {
    onMouseMove(e);
    if (e.button > 2) return;
    if (!btnDown[e.button]) btnPressed[e.button] = true;
    btnDown[e.button] = true;
  }
  function onMouseUp(e) {
    if (e.button > 2) return;
    if (btnDown[e.button]) btnReleased[e.button] = true;
    btnDown[e.button] = false;
  }

  VR.input = {
    mouse: mouse,

    init: function (canvas) {
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('mousemove', onMouseMove);
      canvas.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mouseup', onMouseUp);
      canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      document.addEventListener('mouseleave', function () { mouse.inside = false; });
    },

    down: function (code) { return keysDown[code] === true; },
    pressed: function (code) { return keysPressed[code] === true; },
    released: function (code) { return keysReleased[code] === true; },

    mouseDown: function (b) { return btnDown[b]; },
    mousePressed: function (b) { return btnPressed[b]; },
    mouseReleased: function (b) { return btnReleased[b]; },

    // Called once per render frame after VR.camera.beginFrame().
    refreshMouseWorld: function () {
      VR.camera.screenToWorld(mouse.sx, mouse.sy, tmp);
      mouse.wx = tmp.x;
      mouse.wy = tmp.y;
    },

    endStep: function () {
      var k;
      for (k in keysPressed) delete keysPressed[k];
      for (k in keysReleased) delete keysReleased[k];
      btnPressed[0] = btnPressed[1] = btnPressed[2] = false;
      btnReleased[0] = btnReleased[1] = btnReleased[2] = false;
    },

    // Drop everything (tab blur, scene switch) so no key sticks down.
    clear: function () {
      var k;
      for (k in keysDown) {
        if (keysDown[k]) keysReleased[k] = true;
        keysDown[k] = false;
      }
      for (k in keysPressed) delete keysPressed[k];
      btnDown[0] = btnDown[1] = btnDown[2] = false;
      btnPressed[0] = btnPressed[1] = btnPressed[2] = false;
    }
  };
})(window.VR = window.VR || {});
