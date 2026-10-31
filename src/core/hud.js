/*
 * VR.hud: the boarding HUD, drawn in screen space after the world (and under the F1 overlay).
 *
 *   VR.hud.draw()   render callback; does nothing outside the boarding scene or before a room is live
 *
 * Reads only VR.hudState (published by src/game/room-state.js every step), the player's weapon for pistol
 * ammo, and VR.world.room for the room name. It never writes game state.
 *
 * Layout: room line top-centre (name, fight timer, deaths, kills), shells + dash charges bottom-left,
 * combo bottom-centre, grade banner centre-top for combat.gradeShowTime after a clear.
 * The numbers in STYLE are presentation (pixels, fonts, colours), not gameplay tuning.
 */
(function (VR) {
  'use strict';

  var STYLE = {
    font: 'monospace',
    text: 14,              // px, normal HUD text
    big: 56,               // px, grade letter
    margin: 18,            // px from the screen edges
    pip: 11,               // px, shell / dash pip size
    pipGap: 5,
    rowGap: 26,            // px between the shells row and the dash row
    labelW: 64,            // px reserved for the row label
    comboBarW: 120, comboBarH: 6,
    panel: 'rgba(5,7,12,0.55)',
    fg: '#e8f0ff', dim: '#7f8aa6', warn: '#ff6b5a',
    shell: '#ffb347', dash: '#4fd1c5', combo: '#ffe9a0',
    grades: { S: '#ffd34d', A: '#7dffa8', B: '#7fd6ff', C: '#c0c6d4' }
  };

  function text(ctx, s, x, y, size, color, align) {
    ctx.font = size + 'px ' + STYLE.font;
    ctx.textAlign = align;
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  }

  // Row of pips: `full` solid, then one partially filled pip (frac), then outlines up to `max`.
  function pips(ctx, x, y, full, frac, max, color) {
    var s = STYLE.pip;
    ctx.lineWidth = 1.5;
    for (var i = 0; i < max; i++) {
      var px = x + i * (s + STYLE.pipGap);
      ctx.strokeStyle = color;
      ctx.strokeRect(px + 0.5, y + 0.5, s - 1, s - 1);
      ctx.fillStyle = color;
      if (i < full) ctx.fillRect(px, y, s, s);
      else if (i === full && frac > 0) ctx.fillRect(px, y + s * (1 - frac), s, s * frac);
    }
  }

  function clock(t) {
    var m = Math.floor(t / 60), s = t - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
  }

  function drawTop(ctx, h, W) {
    var room = VR.world.room;
    var name = room ? (room.name || room.id) : '';
    var line = name + '   ' + clock(h.cleared ? h.clearTime : h.time) + '   deaths ' + h.deaths +
      '   kills ' + h.kills + '/' + h.total + (h.cleared && h.grade ? '   grade ' + h.grade : '');
    ctx.font = STYLE.text + 'px ' + STYLE.font;
    var w = ctx.measureText(line).width + STYLE.margin;
    ctx.fillStyle = STYLE.panel;
    ctx.fillRect(W * 0.5 - w * 0.5, STYLE.margin * 0.5, w, STYLE.text + STYLE.margin * 0.5);
    text(ctx, line, W * 0.5, STYLE.margin * 0.5 + STYLE.text * 0.5 + STYLE.margin * 0.25, STYLE.text,
      h.deaths > 0 && !h.cleared ? STYLE.warn : STYLE.fg, 'center');
  }

  function drawLoadout(ctx, h, H) {
    var x = STYLE.margin, y = H - STYLE.margin - STYLE.pip - STYLE.rowGap;
    var p = VR.roomState.player;
    if (h.weapon === 'shotgun' || h.weapon === 'none') {
      text(ctx, 'SHELLS', x, y + STYLE.pip * 0.5, STYLE.text, h.shells > 0 ? STYLE.dim : STYLE.warn, 'left');
      pips(ctx, x + STYLE.labelW, y, h.shells, 0, h.maxShells, STYLE.shell);
    } else {
      var ammo = p && p.weapon ? p.weapon.ammo : 0;
      text(ctx, h.weapon.toUpperCase() + ' ' + ammo, x, y + STYLE.pip * 0.5, STYLE.text, ammo > 0 ? STYLE.fg : STYLE.warn, 'left');
    }
    y += STYLE.rowGap;
    text(ctx, 'DASH', x, y + STYLE.pip * 0.5, STYLE.text, STYLE.dim, 'left');
    pips(ctx, x + STYLE.labelW, y, h.dashCharges, h.dashFrac, h.maxDashCharges, STYLE.dash);
  }

  function drawCombo(ctx, h, W, H) {
    if (h.combo < 1) return;
    // Bottom-centre: in the eye line below the action, and never under the tuning panel on the right.
    var x = W * 0.5, y = H - STYLE.margin - STYLE.comboBarH, half = STYLE.comboBarW * 0.5;
    text(ctx, 'COMBO x' + h.combo, x, y - STYLE.text, STYLE.text * 1.4, STYLE.combo, 'center');
    ctx.fillStyle = STYLE.panel;
    ctx.fillRect(x - half, y, STYLE.comboBarW, STYLE.comboBarH);
    ctx.fillStyle = STYLE.combo;
    ctx.fillRect(x - half * h.comboFrac, y, STYLE.comboBarW * h.comboFrac, STYLE.comboBarH);
  }

  function drawGrade(ctx, h, W, H) {
    if (!h.cleared || !h.grade || h.gradeTime <= 0) return;
    var y = H * 0.25;
    ctx.globalAlpha = Math.min(1, h.gradeTime);
    text(ctx, h.grade, W * 0.5, y, STYLE.big, STYLE.grades[h.grade] || STYLE.fg, 'center');
    text(ctx, 'CLEAR ' + h.clearTime.toFixed(2) + 's   best combo x' + h.bestCombo, W * 0.5, y + STYLE.big * 0.75,
      STYLE.text, STYLE.fg, 'center');
    ctx.globalAlpha = 1;
  }

  VR.hud = {
    draw: function () {
      if (VR.scenes.current !== 'boarding' || !VR.hudState || !VR.roomState.player) return;
      var ctx = VR.render.screenSpace(), h = VR.hudState, W = VR.render.width, H = VR.render.height;
      ctx.textBaseline = 'middle';
      drawTop(ctx, h, W);
      drawLoadout(ctx, h, H);
      drawCombo(ctx, h, W, H);
      drawGrade(ctx, h, W, H);
    }
  };
})(window.VR = window.VR || {});
