/*
 * Flight course: the authored list of timed segments for the flight run (owner: flight-engineer).
 *
 * One line per segment: "<seconds> <kind> [args]". Seconds is when the ship reaches the segment at constant
 * speed, so position = seconds x flight.speed. Lines are strings (like the ASCII room maps) so the course stays
 * plain data and every tuning number stays in config.js.
 *
 *   wall <low|mid|high> [u=N]     solid wall with an oversized gap at that altitude band. Without u the gap is a
 *                                 slot across the whole lane; with u it is a window centred at lateral N
 *                                 (N > 0 is screen-left). Gap size is ship size x flight.gapMul*.
 *   field <L|R>                   force-field gate across the lane; its generator pylon stands on that side.
 *                                 Shoot the generator to drop the field.
 *   turrets <L|R|B> <band> [n=N]  row of N turrets beside the lane (B alternates sides) firing slow shots at that
 *                                 altitude. Seconds is when the first turret reaches the ship.
 *   fighter <weave|dive|cross> <band> [u=N] [side=L|R]
 *                                 enemy fighter that would meet the ship at that time; weave swings across u,
 *                                 dive drops from high to the band, cross flies across the lane from side.
 *   checkpoint                    respawn point. Keep roughly 3 s before and after it empty.
 *   dock                          the target ship's docking port; passing through it ends the run.
 *
 * VR.flightCourse.parse(lines) returns { items, checkpoints (sorted seconds), endT }.
 */
(function (VR) {
  'use strict';

  var BANDS = { low: 0, mid: 1, high: 2 };

  var lines = [
    // Section 1: walls only. Learn altitude, then lateral windows.
    '4 wall mid',
    '7.5 wall high',
    '11 wall low',
    '14 wall mid u=-90',
    '16.5 wall high u=80',
    '20 checkpoint',

    // Section 2: first gates, turrets and a fighter.
    '24 field L',
    '27.5 turrets L mid n=3',
    '31 wall low u=70',
    '33 fighter weave mid',
    '36.5 field R',
    '40 checkpoint',

    // Section 3: crossfire and combinations.
    '43 turrets B low n=4',
    '47 wall mid u=0',
    '49.5 wall high u=-80',
    '52 fighter dive low',
    '55 fighter cross mid side=R',
    '57 field L',
    '60 checkpoint',

    // Section 4: final approach.
    '63.5 turrets B high n=4',
    '67 fighter weave high u=100',
    '67.5 fighter weave low u=-100',
    '70.5 wall low u=80',
    '73 wall mid u=-80',
    '75 field R',
    '78.5 dock'
  ];

  function parse(src) {
    var items = [], checkpoints = [], endT = 0;
    src.forEach(function (line, i) {
      var tok = line.trim().split(/\s+/);
      var t = parseFloat(tok[0]);
      var kind = tok[1];
      if (isNaN(t) || !kind) throw new Error('flight-course line ' + (i + 1) + ': "' + line + '"');
      var it = { t: t, kind: kind, band: 1, u: null, side: 1, n: 1, pattern: 'weave' };
      tok.slice(2).forEach(function (a) {
        if (BANDS[a] !== undefined) it.band = BANDS[a];
        else if (a === 'L') it.side = 1;
        else if (a === 'R') it.side = -1;
        else if (a === 'B') it.side = 0;
        else if (a.indexOf('u=') === 0) it.u = parseFloat(a.slice(2));
        else if (a.indexOf('n=') === 0) it.n = parseInt(a.slice(2), 10);
        else if (a.indexOf('side=') === 0) it.side = a.split('=')[1] === 'R' ? -1 : 1;
        else if (kind === 'fighter') it.pattern = a;
        else throw new Error('flight-course line ' + (i + 1) + ': unknown token "' + a + '"');
      });
      if (kind === 'checkpoint') checkpoints.push(t);
      else items.push(it);
      if (kind === 'dock') endT = t;
    });
    checkpoints.sort(function (a, b) { return a - b; });
    return { items: items, checkpoints: checkpoints, endT: endT };
  }

  VR.flightCourse = { lines: lines, parse: parse, course: parse(lines) };
})(window.VR = window.VR || {});
