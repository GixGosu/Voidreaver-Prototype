/*
 * VR.world: the tile grid of the current room, built from an ASCII map (see src/data/rooms.js).
 *
 * Tiles are squares of config.iso.tileWorld world px; tile (tx, ty) covers
 * x in [tx*T, (tx+1)*T), y in [ty*T, (ty+1)*T). Outside the map counts as wall.
 *
 *   VR.world.load(room)                 room = { id, map: [strings] }; resets everything
 *   VR.world.clear()                    no room at all (flight scene): tiles = null, so nothing tile-based draws
 *   VR.world.cols / rows / T            grid size and tile size
 *   VR.world.tile(tx, ty)               VR.world.TILE.* code
 *   VR.world.isWall(tx, ty)             wall, window or closed door (structural, drawn as wall blocks)
 *   VR.world.isSolid(tx, ty)            blocks movement: walls, void, plus any cover block
 *   VR.world.setTile(tx, ty, code)      e.g. open a door (FLOOR) or seal a breach (WALL); bumps version
 *   VR.world.coverAt(tx, ty)            cover object or null
 *   VR.world.covers                     array of cover objects: { tx, ty, x, y, type, ch, alive }
 *                                       type: 'half' | 'full' | 'crate' (crates are destructible half cover)
 *   VR.world.removeCover(cover)         destroy (e.g. crate broken); bumps version
 *   VR.world.nearestCover(x, y, maxDist) closest alive cover whose tile centre is within maxDist, or null
 *   VR.world.raycast(x0, y0, x1, y1, mask)  first blocking tile on the segment; returns a shared hit
 *                                       object (copy what you need before the next call):
 *                                       { hit, x, y, dist, t, tx, ty, nx, ny, tile, cover }
 *                                       mask: RAY_WALLS | RAY_FULL | RAY_HALF (default RAY_WALLS | RAY_FULL)
 *   VR.world.moveCircle(e, dx, dy)      move an entity with slide collision against solid tiles;
 *                                       returns true if it touched anything
 *   VR.world.spawns                     [{ ch, tx, ty, x, y }] for P g r n H and doors D 1 2
 *   VR.world.playerStart                { x, y } world centre of the P tile
 *   VR.world.version                    increments on every tile/cover change (renderer caches key off it)
 */
(function (VR) {
  'use strict';

  var TILE = { VOID: 0, FLOOR: 1, WALL: 2, WINDOW: 3, DOOR: 4 };
  var RAY_WALLS = 1, RAY_FULL = 2, RAY_HALF = 4;

  // Characters that are floor with something placed on them.
  var COVER_CHARS = { h: 'half', F: 'full', c: 'crate' };
  var SPAWN_CHARS = { P: 1, g: 1, r: 1, n: 1, H: 1 };
  var DOOR_CHARS = { D: 1, '1': 1, '2': 1 };

  var hit = { hit: false, x: 0, y: 0, dist: 0, t: 0, tx: 0, ty: 0, nx: 0, ny: 0, tile: 0, cover: null };

  var world = {
    TILE: TILE,
    RAY_WALLS: RAY_WALLS,
    RAY_FULL: RAY_FULL,
    RAY_HALF: RAY_HALF,

    room: null,
    cols: 0,
    rows: 0,
    T: VR.config.iso.tileWorld,
    tiles: null,       // Uint8Array cols*rows of TILE codes
    coverGrid: null,   // Array cols*rows of cover objects or null
    covers: [],
    spawns: [],
    playerStart: { x: 0, y: 0 },
    version: 0,

    load: function (room) {
      var map = room.map;
      var rows = map.length;
      var cols = 0;
      for (var r = 0; r < rows; r++) if (map[r].length > cols) cols = map[r].length;

      world.room = room;
      world.cols = cols;
      world.rows = rows;
      world.T = VR.config.iso.tileWorld;
      world.tiles = new Uint8Array(cols * rows);
      world.coverGrid = new Array(cols * rows);
      world.covers = [];
      world.spawns = [];
      world.playerStart.x = world.playerStart.y = 0;

      var T = world.T;
      for (var ty = 0; ty < rows; ty++) {
        for (var tx = 0; tx < cols; tx++) {
          var ch = map[ty].charAt(tx) || ' ';
          var i = ty * cols + tx;
          var code = TILE.FLOOR;
          world.coverGrid[i] = null;
          if (ch === ' ') code = TILE.VOID;
          else if (ch === '#') code = TILE.WALL;
          else if (ch === 'W') code = TILE.WINDOW;
          else if (DOOR_CHARS[ch]) code = TILE.DOOR;
          world.tiles[i] = code;

          var cx = (tx + 0.5) * T, cy = (ty + 0.5) * T;
          if (COVER_CHARS[ch]) {
            var cover = { tx: tx, ty: ty, x: cx, y: cy, type: COVER_CHARS[ch], ch: ch, alive: true };
            world.coverGrid[i] = cover;
            world.covers.push(cover);
          }
          if (SPAWN_CHARS[ch] || DOOR_CHARS[ch]) {
            world.spawns.push({ ch: ch, tx: tx, ty: ty, x: cx, y: cy });
            if (ch === 'P') { world.playerStart.x = cx; world.playerStart.y = cy; }
          }
        }
      }
      world.version++;
    },

    clear: function () {
      world.room = null;
      world.cols = world.rows = 0;
      world.tiles = null;
      world.coverGrid = null;
      world.covers = [];
      world.spawns = [];
      world.playerStart.x = world.playerStart.y = 0;
      world.version++;
    },

    inBounds: function (tx, ty) { return tx >= 0 && ty >= 0 && tx < world.cols && ty < world.rows; },

    tile: function (tx, ty) {
      if (tx < 0 || ty < 0 || tx >= world.cols || ty >= world.rows) return TILE.WALL;
      return world.tiles[ty * world.cols + tx];
    },

    isWall: function (tx, ty) {
      var t = world.tile(tx, ty);
      return t === TILE.WALL || t === TILE.WINDOW || t === TILE.DOOR;
    },

    isSolid: function (tx, ty) {
      var t = world.tile(tx, ty);
      if (t !== TILE.FLOOR) return true;   // walls, windows, doors and void
      return world.coverGrid[ty * world.cols + tx] !== null;
    },

    setTile: function (tx, ty, code) {
      if (!world.inBounds(tx, ty)) return;
      world.tiles[ty * world.cols + tx] = code;
      world.version++;
    },

    coverAt: function (tx, ty) {
      if (!world.inBounds(tx, ty)) return null;
      return world.coverGrid[ty * world.cols + tx];
    },

    removeCover: function (cover) {
      if (!cover.alive) return;
      cover.alive = false;
      world.coverGrid[cover.ty * world.cols + cover.tx] = null;
      world.version++;
    },

    nearestCover: function (x, y, maxDist) {
      var best = null, bestD = maxDist * maxDist;
      for (var i = 0; i < world.covers.length; i++) {
        var c = world.covers[i];
        if (!c.alive) continue;
        var dx = c.x - x, dy = c.y - y, d = dx * dx + dy * dy;
        if (d <= bestD) { bestD = d; best = c; }
      }
      return best;
    },

    toTile: function (v) { return Math.floor(v / world.T); },

    blocksRay: function (tx, ty, mask) {
      var t = world.tile(tx, ty);
      if (t !== TILE.FLOOR) return (mask & RAY_WALLS) !== 0;
      var c = world.coverGrid[ty * world.cols + tx];
      if (!c) return false;
      return c.type === 'full' ? (mask & RAY_FULL) !== 0 : (mask & RAY_HALF) !== 0;
    },

    // Grid traversal (Amanatides & Woo): visits every tile the segment crosses in order, so the hit is exact.
    raycast: function (x0, y0, x1, y1, mask) {
      if (mask === undefined) mask = RAY_WALLS | RAY_FULL;
      var T = world.T;
      var dx = x1 - x0, dy = y1 - y0;
      var len = Math.sqrt(dx * dx + dy * dy);
      var tx = Math.floor(x0 / T), ty = Math.floor(y0 / T);
      var stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
      var stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
      var tMaxX = stepX > 0 ? ((tx + 1) * T - x0) / dx : stepX < 0 ? (tx * T - x0) / dx : Infinity;
      var tMaxY = stepY > 0 ? ((ty + 1) * T - y0) / dy : stepY < 0 ? (ty * T - y0) / dy : Infinity;
      var tDX = stepX !== 0 ? T / Math.abs(dx) : Infinity;
      var tDY = stepY !== 0 ? T / Math.abs(dy) : Infinity;
      var t = 0, nx = 0, ny = 0;
      // A segment crosses at most this many tiles; the bound also guards against NaN input.
      var maxSteps = Math.ceil(Math.abs(dx) / T) + Math.ceil(Math.abs(dy) / T) + 2;

      for (var n = 0; n < maxSteps; n++) {
        if (world.blocksRay(tx, ty, mask)) {
          hit.hit = true;
          hit.t = t;
          hit.x = x0 + dx * t;
          hit.y = y0 + dy * t;
          hit.dist = len * t;
          hit.tx = tx; hit.ty = ty;
          hit.nx = nx; hit.ny = ny;
          hit.tile = world.tile(tx, ty);
          hit.cover = world.coverAt(tx, ty);
          return hit;
        }
        if (tMaxX < tMaxY) {
          t = tMaxX; tMaxX += tDX; tx += stepX; nx = -stepX; ny = 0;
        } else {
          t = tMaxY; tMaxY += tDY; ty += stepY; nx = 0; ny = -stepY;
        }
        if (t > 1) break;
      }
      hit.hit = false;
      hit.t = 1;
      hit.x = x1; hit.y = y1;
      hit.dist = len;
      hit.tx = Math.floor(x1 / T); hit.ty = Math.floor(y1 / T);
      hit.nx = hit.ny = 0;
      hit.tile = world.tile(hit.tx, hit.ty);
      hit.cover = null;
      return hit;
    },

    moveCircle: function (e, dx, dy) {
      // Sub-step so fast movers (dashes, knockback) cannot skip past a tile edge.
      var maxStep = Math.max(1, e.radius * 0.5);
      var steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / maxStep) || 1;
      var sx = dx / steps, sy = dy / steps;
      var touched = false;
      for (var i = 0; i < steps; i++) {
        e.x += sx;
        if (resolve(e)) touched = true;
        e.y += sy;
        if (resolve(e)) touched = true;
      }
      return touched;
    }
  };

  // Push a circle out of every solid tile it overlaps.
  function resolve(e) {
    var T = world.T, r = e.radius, touched = false;
    var tx0 = Math.floor((e.x - r) / T), tx1 = Math.floor((e.x + r) / T);
    var ty0 = Math.floor((e.y - r) / T), ty1 = Math.floor((e.y + r) / T);
    for (var ty = ty0; ty <= ty1; ty++) {
      for (var tx = tx0; tx <= tx1; tx++) {
        if (!world.isSolid(tx, ty)) continue;
        var bx0 = tx * T, by0 = ty * T, bx1 = bx0 + T, by1 = by0 + T;
        var cx = e.x < bx0 ? bx0 : e.x > bx1 ? bx1 : e.x;
        var cy = e.y < by0 ? by0 : e.y > by1 ? by1 : e.y;
        var ox = e.x - cx, oy = e.y - cy;
        var d2 = ox * ox + oy * oy;
        if (d2 >= r * r) continue;
        touched = true;
        if (d2 > 0) {
          var d = Math.sqrt(d2), push = (r - d) / d;
          e.x += ox * push;
          e.y += oy * push;
        } else {
          // Centre inside the tile: leave through the nearest face.
          var l = e.x - bx0, rt = bx1 - e.x, u = e.y - by0, b = by1 - e.y;
          var m = Math.min(l, rt, u, b);
          if (m === l) e.x = bx0 - r;
          else if (m === rt) e.x = bx1 + r;
          else if (m === u) e.y = by0 - r;
          else e.y = by1 + r;
        }
      }
    }
    return touched;
  }

  VR.world = world;
})(window.VR = window.VR || {});
