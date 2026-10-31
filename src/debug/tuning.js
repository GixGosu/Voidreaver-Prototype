/*
 * VR.tuning: backtick (config.keys.tuning) panel with live sliders bound to VR.config, plus the export buttons.
 *
 *   VR.tuning.step()        fixed-update callback (boot.js): toggles the panel
 *   VR.tuning.open / close / toggle()
 *   VR.tuning.changes()     { 'path.to.value': { from, to } } for every value moved off its load-time default
 *   VR.tuning.configText()  JSON text of { changes, config } for "copy config"
 *
 * Every game file reads VR.config at call time, so a slider applies on the next frame. Values marked "R" are
 * read when a room, course or player is built and apply on the next restart (R).
 * Slider ranges are derived from each value's load-time default (0 .. default * RANGE_MUL), so this file holds
 * no tuning numbers itself; the PARAMS list is only which config paths are worth exposing.
 */
(function (VR) {
  'use strict';

  var RANGE_MUL = 3;      // slider max = default x this
  var STEPS = 200;        // resolution of non-integer sliders
  var PRECISION = 4;      // significant digits kept from a slider drag (no 0.35100000001 in exports)

  // [path, needsRestart]. Most important first within each group; groups follow the spec's tuning table.
  var PARAMS = [
    ['enemy.reactionDelay', false],
    ['enemy.bulletSpeed', false],
    ['enemy.sightRange', false],
    ['enemy.grunt.fireInterval', false],
    ['enemy.rusher.speed', false],
    ['enemy.gunner.burstCount', false],
    ['enemy.heavy.speed', false],
    ['player.speed', false],
    ['player.dashDistance', false],
    ['player.dashDuration', false],
    ['player.dashRecharge', false],
    ['shotgun.pellets', false],
    ['shotgun.spreadDeg', false],
    ['shotgun.range', false],
    ['shotgun.pumpDelay', false],
    ['shotgun.shellsPerRoom', true],
    ['shotgun.knockback', false],
    ['combat.comboWindow', false],
    ['combat.deathFreeze', false],
    ['combat.wallKillSpeed', false],
    ['hit.killStop', false],
    ['cover.crateHp', true],
    ['breach.pullRadius', false],
    ['breach.pullDuration', false],
    ['breach.shutterDelay', false],
    ['camera.leadFactor', false],
    ['camera.followSharpness', false],
    ['flight.speed', true],
    ['flight.turret.fireInterval', false],
    ['flight.turret.shotSpeed', false],
    ['flight.gapMulWidth', true],
    ['flight.gapMulHeight', true],
    ['flight.death.restartDelay', false]
  ];

  var defaults = Object.create(null);
  var rows = [];          // { path, input, number, row }
  var panel = null, status = null, output = null;

  function resolve(path) {
    var parts = path.split('.'), o = VR.config;
    for (var i = 0; i < parts.length - 1; i++) { o = o && o[parts[i]]; }
    return o && typeof o[parts[parts.length - 1]] === 'number' ? { obj: o, key: parts[parts.length - 1] } : null;
  }

  function get(path) { var r = resolve(path); return r ? r.obj[r.key] : undefined; }

  function set(path, v) {
    var r = resolve(path);
    if (r && isFinite(v)) r.obj[r.key] = v;
  }

  function isInt(v) { return Math.floor(v) === v && Math.abs(v) >= 1; }

  function css(el, text) { el.style.cssText = text; return el; }

  function el(tag, text, style) {
    var e = document.createElement(tag);
    if (text) e.textContent = text;
    if (style) css(e, style);
    return e;
  }

  function markChanged(r) {
    var changed = get(r.path) !== defaults[r.path];
    r.row.style.color = changed ? '#ffd34d' : '#e8f0ff';
  }

  function syncRow(r) {
    var v = get(r.path);
    r.input.value = v;
    r.number.value = v;
    markChanged(r);
  }

  function addRow(list, path, restart) {
    var d = defaults[path], int = isInt(d);
    var max = d > 0 ? d * RANGE_MUL : 1;
    var row = el('div', null, 'display:grid;grid-template-columns:150px 1fr 64px;gap:6px;align-items:center;margin:2px 0');
    var name = el('span', path.slice(path.indexOf('.') + 1) + (restart ? '  R' : ''), 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap');
    name.title = path + ' (default ' + d + ')' + (restart ? ' - applies on next restart (R)' : '');
    var input = el('input'); input.type = 'range';
    input.min = 0; input.max = max; input.step = int ? 1 : max / STEPS;
    var number = el('input', null, 'width:60px;background:#111826;color:inherit;border:1px solid #334;font:inherit');
    number.type = 'number'; number.step = 'any';
    var r = { path: path, input: input, number: number, row: row };
    input.addEventListener('input', function () { set(path, Number(parseFloat(input.value).toPrecision(PRECISION))); number.value = get(path); markChanged(r); });
    number.addEventListener('change', function () { set(path, parseFloat(number.value)); syncRow(r); });
    row.appendChild(name); row.appendChild(input); row.appendChild(number);
    list.appendChild(row);
    rows.push(r);
    syncRow(r);
  }

  function button(parent, text, fn) {
    var b = el('button', text, 'margin:0 6px 6px 0;padding:4px 8px;background:#1d2a40;color:#e8f0ff;border:1px solid #4a6a9a;font:inherit;cursor:pointer');
    b.addEventListener('click', function () { fn(); b.blur(); });   // blur so Space (dash) cannot re-click it
    parent.appendChild(b);
  }

  // Show the text (so it can always be copied by hand), select it, and try the clipboard.
  function exportText(label, text) {
    output.style.display = 'block';
    output.value = text;
    output.select();
    status.textContent = label + ': copying...';
    VR.clipboard.copy(text).then(function (ok) {
      status.textContent = ok ? label + ' copied to clipboard (' + text.length + ' chars)' : label + ': clipboard blocked, copy the text below by hand';
    });
  }

  function build() {
    panel = el('div', null, 'position:fixed;right:0;top:0;bottom:0;width:390px;overflow-y:auto;z-index:20;display:none;' +
      'background:rgba(6,9,16,0.92);color:#e8f0ff;font:12px monospace;padding:10px;box-sizing:border-box;border-left:1px solid #334');
    panel.appendChild(el('div', 'TUNING  (` to close)', 'font-size:14px;margin-bottom:6px;color:#9ef'));
    var buttons = el('div');
    button(buttons, 'Copy stats', function () { exportText('Stats', VR.telemetry.json()); });
    button(buttons, 'Copy config', function () { exportText('Config', VR.tuning.configText()); });
    button(buttons, 'Reset values', function () {
      for (var k in defaults) set(k, defaults[k]);
      rows.forEach(syncRow);
      status.textContent = 'All sliders back to defaults';
    });
    panel.appendChild(buttons);
    status = el('div', 'Yellow = changed from config.js.  R = applies on restart.', 'color:#7f8aa6;margin-bottom:6px;min-height:14px');
    panel.appendChild(status);
    output = el('textarea', null, 'display:none;width:100%;height:110px;background:#0b0f18;color:#cfe;border:1px solid #334;font:11px monospace;margin-bottom:8px');
    output.readOnly = true;
    panel.appendChild(output);

    var list = el('div'), group = '';
    for (var i = 0; i < PARAMS.length; i++) {
      var path = PARAMS[i][0], g = path.split('.')[0];
      if (defaults[path] === undefined) continue;   // a renamed key must not break the panel
      if (g !== group) { group = g; list.appendChild(el('div', g.toUpperCase(), 'margin:8px 0 2px;color:#9ef')); }
      addRow(list, path, PARAMS[i][1]);
    }
    panel.appendChild(list);

    // Typing a number must not drive the player; the toggle key still closes the panel.
    panel.addEventListener('keydown', function (e) {
      if (e.target.type === 'number' && e.code !== VR.config.keys.tuning) e.stopPropagation();
    });
    document.body.appendChild(panel);
  }

  // Capture defaults at load, before any slider can move them.
  for (var i = 0; i < PARAMS.length; i++) {
    var v0 = get(PARAMS[i][0]);
    if (v0 !== undefined) defaults[PARAMS[i][0]] = v0;
  }

  VR.tuning = {
    isOpen: false,

    open: function () {
      if (!panel) build();
      rows.forEach(syncRow);   // devtools or another tool may have changed values meanwhile
      panel.style.display = 'block';
      VR.tuning.isOpen = true;
    },

    close: function () {
      if (panel) panel.style.display = 'none';
      VR.tuning.isOpen = false;
    },

    toggle: function () { if (VR.tuning.isOpen) VR.tuning.close(); else VR.tuning.open(); },

    step: function () {
      if (VR.input.pressed(VR.config.keys.tuning)) VR.tuning.toggle();
    },

    changes: function () {
      var out = {};
      for (var k in defaults) {
        var v = get(k);
        if (v !== defaults[k]) out[k] = { from: defaults[k], to: v };
      }
      return out;
    },

    configText: function () {
      return JSON.stringify({ changes: VR.tuning.changes(), config: VR.config }, null, 2);
    }
  };
})(window.VR = window.VR || {});
