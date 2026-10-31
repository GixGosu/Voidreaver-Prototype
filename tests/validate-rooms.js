// Validates ASCII room maps: rectangular, enclosed, one player start, everything reachable.
const fs = require('fs'), path = require('path'), vm = require('vm');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/data/rooms.js'), 'utf8'), sandbox);
const rooms = sandbox.window.VR.data.rooms;
const errs = [];
const DOORS = 'D12';
const BLOCK = '#WhFc '; // not walkable for the flood fill; doors are targets only
const KNOWN = '#W.hFcD12PgrnH ';
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
for (const room of rooms) {
  const m = room.map, id = room.id, rows = m.length, cols = m[0].length;
  const err = (s) => errs.push(id + ': ' + s);
  m.forEach((r, i) => { if (r.length !== cols) err('row ' + i + ' length ' + r.length + ' != ' + cols); });
  const starts = [], targets = [];
  m.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch === 'P') starts.push([x, y]);
    if ('grnH'.includes(ch) || DOORS.includes(ch)) targets.push([x, y, ch]);
    if (!KNOWN.includes(ch)) err('unknown char ' + ch + ' at ' + x + ',' + y);
    if (ch === '#' || ch === 'W' || ch === ' ') return;
    const edge = x === 0 || y === 0 || x === cols - 1 || y === rows - 1;
    if (edge && !DOORS.includes(ch)) err('open edge tile ' + ch + ' at ' + x + ',' + y);
    if (!edge) for (const [dx, dy] of DIRS) {
      const c = (m[y + dy] || '')[x + dx];
      if (c === undefined || c === ' ') err('floor at ' + x + ',' + y + ' touches void');
    }
  }));
  if (starts.length !== 1) err('expected 1 player start, found ' + starts.length);
  else {
    const seen = new Set([starts[0].join()]), q = [starts[0]];
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy, c = (m[ny] || '')[nx];
        if (c === undefined || seen.has(nx + ',' + ny) || BLOCK.includes(c)) continue;
        seen.add(nx + ',' + ny);
        if (!DOORS.includes(c)) q.push([nx, ny]);
      }
    }
    for (const [x, y, ch] of targets) if (!seen.has(x + ',' + y)) err('unreachable ' + ch + ' at ' + x + ',' + y);
  }
}
// M2 acceptance: a combat room with 4 enemies must exist (spec: clears in under 5 s when played well).
const counts = rooms.map((r) => r.map.join('').replace(/[^grnH]/g, '').length);
if (Math.max(0, ...counts) < 4) errs.push('no room has 4 or more enemies (g r n H); best has ' + Math.max(0, ...counts));
// M3 acceptance: rooms 1-3 exist for the debug room-jump key (ids room1-, room2-, room3-); a room has half, full and crate cover;
// a room has window tiles, and every window faces floor so it can be shot.
for (const n of [1, 2, 3, 4, 5]) if (!rooms.some((r) => r.id.indexOf('room' + n + '-') === 0)) errs.push('no room with id prefix room' + n + '- (debug jump key needs it)');
const has = (ch) => rooms.some((r) => r.map.join('').includes(ch));
for (const ch of 'hFc') if (!has(ch)) errs.push('no room contains cover char ' + ch);
if (!rooms.some((r) => r.id.indexOf('room3-') === 0 && r.map.join('').includes('W'))) errs.push('room3 has no window (W) for the breach');
for (const room of rooms) room.map.forEach((r, y) => [...r].forEach((ch, x) => {
  if (ch !== 'W') return;
  const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => (room.map[y + dy] || '')[x + dx]);
  if (!nb.some((c) => c === '.')) errs.push(room.id + ': window at ' + x + ',' + y + ' has no adjacent floor tile');
}));

// M4 acceptance: 5 chain rooms with the specified enemy mix, 2 exits with reward icons in rooms 1-4, a final room with one exit.
const TYPES = ['offense', 'mobility', 'defense'];
const cnt = (room, ch) => [...room.map.join('')].filter((c) => c === ch).length;
const want = { 1: { g: 3 }, 2: { n: 2, g: 2 }, 4: { r: 4, n: 1 }, 5: { H: 1, n: 2, r: 2 } };
for (let n = 1; n <= 5; n++) {
  const room = rooms.find((r) => r.id.indexOf('room' + n + '-') === 0);
  if (!room) { errs.push('missing room' + n); continue; }
  for (const [ch, k] of Object.entries(want[n] || {})) if (cnt(room, ch) !== k) errs.push(room.id + ': expected ' + k + ' of ' + ch + ', found ' + cnt(room, ch));
  const exits = n < 5 ? '12' : '1';
  for (const d of '12') {
    const have = cnt(room, d);
    if (exits.includes(d) && have !== 1) errs.push(room.id + ': expected exactly one exit door ' + d + ', found ' + have);
    if (!exits.includes(d) && have !== 0) errs.push(room.id + ': unexpected exit door ' + d);
  }
  for (const d of exits) if (!room.exits || !room.exits[d]) errs.push(room.id + ': exit ' + d + ' has no reward type');
  if (n < 5) for (const d of exits) if (room.exits && !TYPES.includes(room.exits[d])) errs.push(room.id + ': bad reward type ' + room.exits[d]);
  if ((n === 5) !== (room.final === true)) errs.push(room.id + ': final flag wrong');
  if (n === 5 && cnt(room, 'W') < 1) errs.push(room.id + ': needs a window');
}
if (errs.length) { console.error('FAIL validate-rooms\n' + errs.join('\n')); process.exit(1); }
console.log('PASS validate-rooms (' + rooms.length + ' rooms)');
