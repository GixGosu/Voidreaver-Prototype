// Headless smoke test (Playwright, dev-only). Usage: node tests/smoke.js
// Exit codes: 0 pass, 1 fail, 2 playwright unavailable.
const path = require('path'), { pathToFileURL } = require('url');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  try { ({ chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright')); }
  catch (e2) { console.error('SKIP: playwright not found'); process.exit(2); }
}
(async () => {
  const fails = [];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error') fails.push('console error: ' + m.text()); });
  page.on('pageerror', (e) => fails.push('page error: ' + e.message));
  page.on('requestfailed', (r) => fails.push('request failed: ' + r.url()));
  await page.goto(pathToFileURL(path.join(process.env.VR_ROOT || path.join(__dirname, '..'), 'index.html')).href);
  await page.waitForTimeout(500);
  if (!(await page.evaluate(() => !!(window.VR && VR.loop && VR.scenes)))) fails.push('VR not initialised');

  const m4wired = await page.evaluate(() => !!(window.VR && VR.doors && VR.upgrades && VR.data.upgrades && VR.boarding));
  if (!m4wired) {
    fails.push('m4-wiring: index.html does not load src/data/upgrades.js, src/game/doors.js and src/game/upgrades.js, so the boarding scene throws on start (blocking request for proto-architect); remaining checks skipped');
    await browser.close(); console.error('FAIL smoke\n' + fails.join('\n')); process.exit(1);
  }

  // From M5 the run opens in the flight scene; the M1-M4 checks below need a boarding room, so go there first.
  await page.evaluate(() => { if (VR.scenes.current !== 'boarding') VR.scenes.go('boarding', { room: VR.data.rooms[0].id }); });
  await page.waitForTimeout(400);

  // Aim exactness: screen -> world -> screen round trip using the frame's camera.
  await page.mouse.move(900, 300);
  await page.waitForTimeout(200);
  const aim = await page.evaluate(() => {
    const m = VR.input.mouse, o = {};
    VR.camera.worldToScreen(m.wx, m.wy, 0, o);
    return { dx: o.x - m.sx, dy: o.y - m.sy };
  });
  if (Math.abs(aim.dx) > 0.5 || Math.abs(aim.dy) > 0.5) fails.push('aim round trip off by ' + JSON.stringify(aim));

  // Hold each movement key with fire held; the picture must change.
  const before = (await page.screenshot()).toString('base64');
  await page.mouse.move(400, 300);
  for (const k of ['KeyD', 'KeyS', 'KeyA', 'KeyW']) {
    await page.keyboard.down(k);
    await page.mouse.down();
    await page.waitForTimeout(800);
    await page.mouse.up();
    await page.keyboard.up(k);
  }
  for (const k of ['Space', 'KeyC', 'KeyF', 'F1', 'F1']) await page.keyboard.press(k);
  await page.waitForTimeout(300);
  const after = (await page.screenshot()).toString('base64');
  if (before === after) fails.push('screen identical after movement');

  // Frame cadence over 3 s while moving diagonally.
  await page.keyboard.down('KeyW'); await page.keyboard.down('KeyD');
  const avg = await page.evaluate(() => new Promise((res) => {
    const t = []; let last = performance.now(); const end = last + 3000;
    requestAnimationFrame(function f(n) {
      t.push(n - last); last = n;
      if (n < end) requestAnimationFrame(f);
      else { const u = t.slice(5); res(u.reduce((a, b) => a + b, 0) / u.length); }
    });
  }));
  await page.keyboard.up('KeyW'); await page.keyboard.up('KeyD');
  const st = await page.evaluate(() => ({ upd: VR.loop.stats.updateMs, rnd: VR.loop.stats.renderMs }));
  if (avg > 20) fails.push('average frame ' + avg.toFixed(2) + ' ms exceeds 20 ms');

  const results = [];   // M2 checks: [name, ok, detail]
  const note = (n, ok, d) => { results.push([n, ok, d]); if (!ok) fails.push(n + ': ' + d); };
  const wired = await page.evaluate(() => !!(VR.roomState && VR.enemies && VR.weapons && VR.fx && VR.combo && VR.data.enemies));
  if (!wired) {
    note('m2-wiring', false, 'combat modules (roomState, enemies, weapons, fx, combo, data/enemies) not loaded or not initialised');
  } else {
    // Fresh room, then drive the shot through the real mouse so the aim path is exercised.
    await page.keyboard.press('KeyR');
    await page.waitForTimeout(300);
    const toScreen = (wx, wy) => page.evaluate(([x, y]) => { const o = {}; VR.camera.worldToScreen(x, y, 0, o); return o; }, [wx, wy]);

    const n0 = await page.evaluate(() => VR.enemies.aliveCount());
    note('room-has-enemies', n0 > 0, 'alive at start: ' + n0);

    // Shotgun: one blast kills a point-blank grunt and knocks it back; juice hooks fire.
    await page.evaluate(() => {
      const p = VR.roomState.player; p.shield = 1000; VR.enemies.clear();
      window.__juice = { shake: 0, stop: 0, sounds: [] };
      const sh = VR.camera.shake, hs = VR.loop.hitStop, pl = VR.audio.play;
      VR.camera.shake = function () { __juice.shake++; return sh.apply(this, arguments); };
      VR.loop.hitStop = function () { __juice.stop++; return hs.apply(this, arguments); };
      VR.audio.play = function (n) { __juice.sounds.push(n); return pl.apply(this, arguments); };
      const g = VR.enemies.spawn('grunt', p.x - 70, p.y, 0);
      g.state = 'idle'; g.alerted = false; window.__g = g;
      VR.enemies.spawn('grunt', p.x + 10, p.y - 300, 0).state = 'idle'; // second grunt keeps the room uncleared so the clear-refill does not hide the shell spend
      window.__g0 = { x: g.x, y: g.y };
      VR.fx.reset();
    });
    const p0 = await page.evaluate(() => ({ x: VR.roomState.player.x, y: VR.roomState.player.y }));
    const sc = await toScreen(p0.x - 70, p0.y);
    await page.mouse.move(sc.x, sc.y);
    await page.waitForTimeout(100);
    await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up();
    await page.waitForTimeout(500);
    const shot = await page.evaluate(() => ({ alive: __g.alive, moved: Math.hypot(__g.x - __g0.x, __g.y - __g0.y), juice: __juice, decals: VR.fx.decalCount(), shells: VR.roomState.info.shells, max: VR.roomState.info.maxShells }));
    note('shotgun-one-hit-kill', shot.alive === false, 'grunt alive after point-blank shot: ' + shot.alive);
    note('shotgun-knockback', shot.moved > 8, 'corpse displaced ' + shot.moved.toFixed(1) + ' px');
    note('shell-consumed', shot.shells < shot.max, 'shells ' + shot.shells + '/' + shot.max);
    note('hit-stop-present', shot.juice.stop > 0, 'hitStop calls ' + shot.juice.stop);
    note('screen-shake-present', shot.juice.shake > 0, 'camera.shake calls ' + shot.juice.shake);
    note('decals-present', shot.decals > 0, 'decals ' + shot.decals);
    note('sounds-present', shot.juice.sounds.length > 0, 'sounds ' + shot.juice.sounds.join(','));

    // Grunt: must pass through a reaction (telegraph) state of about reactionDelay before attacking.
    const tele = await page.evaluate(() => new Promise((res) => {
      VR.enemies.clear(); const p = VR.roomState.player; p.shield = 1000;
      const e = VR.enemies.spawn('grunt', p.x - 130, p.y, 0); e.alerted = false;
      const t0 = performance.now(); let react = null, attack = null; const seen = [];
      (function poll() {
        const t = performance.now() - t0;
        if (seen[seen.length - 1] !== e.state) seen.push(e.state);
        if (react === null && e.state === 'react') react = t;
        if (attack === null && e.state === 'attack') attack = t;
        if (attack !== null || t > 3000) res({ react, attack, seen, delay: VR.config.enemy.reactionDelay });
        else requestAnimationFrame(poll);
      })();
    }));
    note('grunt-telegraphs', tele.react !== null && tele.attack !== null && tele.attack - tele.react >= tele.delay * 600,
      'react at ' + tele.react + ' ms, attack at ' + tele.attack + ' ms, states ' + tele.seen.join('>') + ', delay ' + tele.delay + ' s');

    // Rusher: charges, closing distance quickly.
    const rush = await page.evaluate(() => new Promise((res) => {
      VR.enemies.clear(); const p = VR.roomState.player; p.shield = 1000;
      const e = VR.enemies.spawn('rusher', p.x - 200, p.y, 0);
      const d0 = Math.hypot(e.x - p.x, e.y - p.y); let charged = false; const t0 = performance.now();
      (function poll() {
        if (e.state === 'charge') charged = true;
        const d = Math.hypot(e.x - p.x, e.y - p.y), t = performance.now() - t0;
        if (d < d0 * 0.5 || t > 3000) res({ charged, d0, d, t });
        else requestAnimationFrame(poll);
      })();
    }));
    note('rusher-charges', rush.charged && rush.d < rush.d0 * 0.5, 'charge state ' + rush.charged + ', distance ' + rush.d0.toFixed(0) + ' -> ' + rush.d.toFixed(0) + ' in ' + rush.t.toFixed(0) + ' ms');

    // Death: restart the room, kill the player, time until a live player is back and the room matches its start.
    await page.keyboard.press('KeyR');
    await page.waitForTimeout(300);
    const death = await page.evaluate((n) => new Promise((res) => {
      VR.enemies.list.forEach((e) => VR.enemies.kill(e, 1, 0, 100, 'smoke'));   // the restart must revive them
      const p0 = VR.roomState.player; p0.shield = 0; const deaths0 = VR.roomState.info.deaths;
      const t0 = performance.now(); VR.player.hit(p0, 'smoke-test');
      (function poll() {
        const t = performance.now() - t0, p = VR.roomState.player;
        const back = p.alive && VR.roomState.info.deaths > deaths0;
        if (back || t > 2000) res({ ms: t, back, same: VR.enemies.aliveCount() === n && VR.enemies.list.length === n, deaths: VR.roomState.info.deaths, cause: VR.roomState.info.lastCause });
        else requestAnimationFrame(poll);
      })();
    }), n0);
    note('death-resets-room-under-0.5s', death.back && death.ms < 500, 'player back after ' + death.ms.toFixed(0) + ' ms');
    note('death-restores-exact-start', death.same, 'all ' + n0 + ' enemies revived to start, none left over: ' + death.same);
    note('death-cause-recorded', death.cause === 'smoke-test' && death.deaths >= 1, 'cause ' + death.cause + ', deaths ' + death.deaths);

    // 20 enemies: frame time while all are alive and shooting at a shielded player.
    await page.evaluate(() => {
      VR.enemies.clear(); const p = VR.roomState.player; p.shield = 100000;
      for (let i = 0; i < 20; i++) VR.enemies.spawn(i % 3 === 0 ? 'rusher' : 'grunt', 32 * (1.5 + (i % 10)), 32 * (7.5 + Math.floor(i / 10) * 2), 0);
    });
    await page.waitForTimeout(300);
    const crowd = await page.evaluate(() => new Promise((res) => {
      const t = []; let last = performance.now(); const end = last + 3000;
      requestAnimationFrame(function f(n) {
        t.push(n - last); last = n;
        if (n < end) requestAnimationFrame(f);
        else res({ avg: t.slice(5).reduce((a, b) => a + b, 0) / (t.length - 5), max: Math.max.apply(null, t.slice(5)), alive: VR.enemies.aliveCount(), upd: VR.loop.stats.updateMs, rnd: VR.loop.stats.renderMs });
      });
    }));
    note('20-enemies-60fps', crowd.alive >= 15 && crowd.avg < 17.5, 'avg ' + crowd.avg.toFixed(2) + ' ms, worst ' + crowd.max.toFixed(1) + ' ms, update ' + crowd.upd.toFixed(2) + ' ms, render ' + crowd.rnd.toFixed(2) + ' ms, alive ' + crowd.alive);
  }

  // ---- M3: cover, shield icon, breach, room jump ----
  const m3wired = await page.evaluate(() => !!(VR.cover && VR.breach && VR.world && VR.world.covers));
  note('m3-wiring', m3wired, m3wired ? 'cover and breach modules loaded by index.html' : 'index.html does not load src/game/breach.js (VR.breach undefined): blocking request for proto-architect; the checks below inject it for diagnosis only');
  if (!m3wired) {
    await page.addScriptTag({ path: path.join(process.env.VR_ROOT || path.join(__dirname, '..'), 'src/game/breach.js') });
  }
  {
    const toScr = (wx, wy) => page.evaluate(([x, y]) => { const o = {}; VR.camera.worldToScreen(x, y, 0, o); return o; }, [wx, wy]);
    const jump = async (n) => { await page.keyboard.press('Digit' + n); await page.waitForTimeout(350); };
    const countWindows = () => { const W = VR.world; let w = 0; for (let y = 0; y < W.rows; y++) for (let x = 0; x < W.cols; x++) if (W.tile(x, y) === W.TILE.WINDOW) w++; return w; };
    const coverSig = () => VR.world.covers.filter((c) => c.alive).map((c) => c.tx + ',' + c.ty + ',' + VR.cover.hpOf(c)).sort().join('|');
    const winX = () => { const W = VR.world, xs = []; for (let x = 0; x < W.cols; x++) if (W.tile(x, 0) === W.TILE.WINDOW) xs.push(x); return xs; };
    // The camera leads toward the aim, so the cursor's world point drifts; re-aim a few times until it settles on the target.
    const aimAt = async (wx, wy) => { for (let i = 0; i < 4; i++) { const o = await toScr(wx, wy); await page.mouse.move(o.x, o.y); await page.waitForTimeout(150); } };
    // Teleport the player (and snap the camera so screen coordinates are valid), clear enemies, full shield.
    const place = (tx, ty) => page.evaluate(([x, y]) => {
      const p = VR.roomState.player, T = VR.world.T; p.shield = 1000; VR.enemies.clear();
      p.x = p.px = (x + 0.5) * T; p.y = p.py = (y + 0.5) * T; p.vx = p.vy = 0; VR.camera.snap(p.x, p.y);
    }, [tx, ty]);
    const fns = `({countWindows:${countWindows},coverSig:${coverSig},winX:${winX}})`;

    // Room jump: keys 1-3 load rooms with the right shape and a live player.
    const rj = [];
    for (const n of [1, 2, 3]) {
      await jump(n);
      rj.push(await page.evaluate((f) => { const H = eval(f); return { alive: VR.roomState.player.alive, enemies: VR.enemies.aliveCount(), covers: VR.world.covers.length,
        types: [...new Set(VR.world.covers.map((c) => c.type))].sort().join('+'), windows: H.countWindows() }; }, fns));
    }
    note('room-jump-1-2-3', rj.every((r) => r.alive && r.enemies > 0), rj.map((r, i) => 'room' + (i + 1) + ': enemies ' + r.enemies + ' covers ' + r.covers + ' [' + r.types + '] windows ' + r.windows).join('; '));
    note('room2-has-all-cover-types', rj[1].types === 'crate+full+half', 'room2 cover types ' + rj[1].types);
    note('room3-has-windows', rj[2].windows > 0, 'room3 windows ' + rj[2].windows);

    // Half and full cover: protection from a shooter, and what popping out does.
    await jump(2);
    const cov = await page.evaluate(() => {
      const p = VR.roomState.player, T = VR.world.T; VR.enemies.clear();
      const res = {};
      for (const type of ['half', 'full']) {
        const c = VR.world.covers.find((k) => k.type === type); if (!c) { res[type] = null; continue; }
        // Shooter 3 tiles up (-y) from the block, player one tile below it; assess only raycasts, so teleporting is fine.
        p.x = c.x; p.y = c.y + T; const sx = c.x, sy = c.y - T * 3;
        p.cover = null; p.popped = false;
        const behind = VR.cover.assess(p, sx, sy).protected;
        p.cover = c; p.popped = true; const popped = VR.cover.assess(p, sx, sy).protected;
        p.cover = null; p.popped = false;
        res[type] = { behind, popped };
      }
      return res;
    });
    note('half-cover-blocks-shots', !!cov.half && cov.half.behind === true, JSON.stringify(cov.half));
    note('half-cover-popout-exposes', !!cov.half && cov.half.popped === false, 'popped protected=' + (cov.half && cov.half.popped));
    note('full-cover-blocks-even-popped', !!cov.full && cov.full.behind === true && cov.full.popped === true, JSON.stringify(cov.full));

    // Destructible crate: real shotgun blasts from point blank must break it in 2-3 shots.
    await jump(2);
    const crate = await page.evaluate(() => {
      VR.enemies.clear();
      for (const c of VR.world.covers) if (c.type === 'crate') {
        for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
          const tx = c.tx + dx, ty = c.ty + dy;
          if (VR.world.tile(tx, ty) === VR.world.TILE.FLOOR && !VR.world.coverAt(tx, ty)) return { cx: c.x, cy: c.y, px: tx, py: ty, tx: c.tx, ty: c.ty, hp: VR.cover.hpOf(c) };
        }
      } return null;
    });
    if (!crate) note('crate-breaks-in-2-3-shots', false, 'no crate with a free neighbour in room 2');
    else {
      await place(crate.px, crate.py);
      await aimAt(crate.cx, crate.cy);
      let shots = 0, broken = false;
      for (let i = 0; i < 6 && !broken; i++) {
        await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up(); shots++;
        await page.waitForTimeout(550);
        broken = await page.evaluate(([x, y]) => !VR.world.coverAt(x, y), [crate.tx, crate.ty]);
      }
      note('crate-breaks-in-2-3-shots', broken && shots >= 2 && shots <= 3, 'crate hp ' + crate.hp + ' broke after ' + shots + ' shot(s), broken=' + broken);
    }

    // Shield icon: green when protected, red when exposed; nothing without an alerted enemy.
    await jump(2);
    const icon = await page.evaluate(() => {
      const p = VR.roomState.player, cfg = VR.config.cover; VR.enemies.clear(); p.shield = 1000;
      const subs = []; const orig = VR.render.submit; VR.render.submit = function (it) { subs.push({ color: it.color }); return orig.apply(this, arguments); };
      const run = (prot) => {
        subs.length = 0; const e = VR.enemies.spawn('grunt', p.x, p.y - 200, 0); e.state = 'attack'; e.alerted = true; e.prot = prot;
        VR.cover.render(p, 1); const n = { safe: subs.filter((s) => s.color === cfg.safeColor).length, bad: subs.filter((s) => s.color === cfg.exposedColor).length };
        VR.enemies.clear(); return n;
      };
      const safe = run(true), bad = run(false);
      subs.length = 0; VR.cover.render(p, 1); const none = subs.filter((s) => s.color === cfg.safeColor || s.color === cfg.exposedColor).length;
      VR.render.submit = orig; return { safe, bad, none };
    });
    note('shield-icon-protected-green', icon.safe.safe > 0 && icon.safe.bad === 0, JSON.stringify(icon.safe));
    note('shield-icon-exposed-red', icon.bad.bad > 0 && icon.bad.safe === 0, JSON.stringify(icon.bad));
    note('shield-icon-hidden-without-threat', icon.none === 0, 'icon strokes with no alerted enemy: ' + icon.none);

    // Breach (room 3): real shots blow the window out; enemy beside it is spaced; shutter seals it.
    await jump(3);
    const wxs = await page.evaluate((f) => { const H = eval(f); return H.winX(); }, fns);
    const wx = wxs[Math.floor(wxs.length / 2)];
    await place(wx, 3);
    await page.evaluate((x) => {
      const T = VR.world.T, e = VR.enemies.spawn('grunt', (x + 0.5) * T + 40, T * 1.5, 0);
      e.state = 'idle'; e.alerted = false; window.__bg = e;
    }, wx);
    await aimAt((wx + 0.5) * 32, 16);
    let opened = false, tries = 0;
    while (!opened && tries < 5) {
      await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up(); tries++;
      await page.waitForTimeout(550);
      opened = await page.evaluate((x) => VR.world.tile(x, 0) === VR.world.TILE.VOID || VR.breach.active.length > 0, wx);
    }
    note('window-shot-opens-breach', opened, 'breach open after ' + tries + ' real shot(s)');
    if (opened) {
      await page.waitForTimeout(1500);
      const sp = await page.evaluate(() => ({ alive: window.__bg.alive, spaced: !!window.__bg.spaced }));
      note('breach-spaces-enemy', sp.alive === false && sp.spaced, 'enemy beside window alive=' + sp.alive + ' spaced=' + sp.spaced);
      await page.waitForTimeout(1200);
      const sealed = await page.evaluate((x) => ({ tile: VR.world.tile(x, 0), wall: VR.world.TILE.WALL, active: VR.breach.active.length }), wx);
      note('breach-seals-after-shutter', sealed.tile === sealed.wall && sealed.active === 0, 'tile ' + sealed.tile + ' (wall=' + sealed.wall + '), active breaches ' + sealed.active);
    }

    // Player is pulled too, and a loose crate slides toward the hole.
    await jump(3);
    const pull = await page.evaluate((f) => new Promise((res) => {
      const H = eval(f);
      const W = VR.world, T = W.T; VR.enemies.clear();
      const xs = H.winX(), x = xs[Math.floor(xs.length / 2)], p = VR.roomState.player; p.shield = 0;
      p.x = p.px = (x + 0.5) * T; p.y = p.py = T * 5.5; p.vx = p.vy = 0;
      const crate = W.covers.find((c) => c.type === 'crate');
      if (crate) VR.cover.move(crate, x, 3);
      const d0 = Math.abs(p.y - 16); VR.breach.open(x, 0);
      setTimeout(() => res({ d0, d1: Math.abs(p.y - 16), crateRow: crate ? crate.ty : null, crateAlive: crate ? crate.alive : null, playerAlive: p.alive }), 900);
    }), fns);
    note('breach-pulls-player', pull.d1 < pull.d0 - 10 || !pull.playerAlive, 'player distance to hole ' + pull.d0.toFixed(0) + ' -> ' + pull.d1.toFixed(0) + ', alive ' + pull.playerAlive);
    note('breach-slides-loose-crate', pull.crateRow !== null && (pull.crateRow < 3 || pull.crateAlive === false), 'crate row 3 -> ' + pull.crateRow + ', alive ' + pull.crateAlive);

    // Death after a breach and a broken crate: the room must restore exactly (window back, crate back at full hp, enemies back).
    await jump(3);
    const before = await page.evaluate((f) => { const H = eval(f); return { n: VR.enemies.aliveCount(), covers: H.coverSig(), win: H.countWindows() }; }, fns);
    await page.evaluate((f) => {
      const H = eval(f);
      const c = VR.world.covers.find((k) => k.type === 'crate'); VR.cover.damage(c, 1000);
      VR.breach.open(H.winX()[0], 0);
      VR.enemies.list.forEach((e) => VR.enemies.kill(e, 1, 0, 100, 'smoke'));
    }, fns);
    const dd = await page.evaluate((f) => new Promise((res) => {
      const H = eval(f);
      const p0 = VR.roomState.player; p0.shield = 0; const d0 = VR.roomState.info.deaths; const t0 = performance.now(); VR.player.hit(p0, 'smoke-m3');
      (function poll() {
        const t = performance.now() - t0, p = VR.roomState.player;
        if ((p.alive && VR.roomState.info.deaths > d0) || t > 2000) res({ ms: t, back: p.alive, n: VR.enemies.aliveCount(), covers: H.coverSig(), win: H.countWindows(), breaches: VR.breach.active.length });
        else requestAnimationFrame(poll);
      })();
    }), fns);
    note('death-after-breach-resets-under-0.5s', dd.back && dd.ms < 500, 'restart took ' + dd.ms.toFixed(0) + ' ms');
    note('death-after-breach-restores-exact', dd.n === before.n && dd.covers === before.covers && dd.win === before.win && dd.breaches === 0,
      'enemies ' + dd.n + '/' + before.n + ', covers equal ' + (dd.covers === before.covers) + ', windows ' + dd.win + '/' + before.win + ', open breaches ' + dd.breaches);
  }

  // ---- M4: chain, doors, scanner, rewards, upgrades, gunner, heavy, grades, crowd ----
  {
    const jump4 = async (n) => { await page.keyboard.press('Digit' + n); await page.waitForTimeout(100); };
    const killAll = () => page.evaluate(() => { VR.enemies.list.forEach((e) => VR.enemies.kill(e, 1, 0, 100, 'smoke-m4')); });
    const doorTiles = () => page.evaluate(() => {
      const W = VR.world, o = {};
      W.spawns.forEach((s) => { if ('D12'.indexOf(s.ch) >= 0) o[s.ch] = { tx: s.tx, ty: s.ty, floor: W.tile(s.tx, s.ty) === W.TILE.FLOOR }; });
      return o;
    });

    // Rooms: all five exist, in order, with the enemy kinds the design promises.
    const rooms = await page.evaluate(() => VR.data.rooms.filter((r) => /^room\d+-/.test(r.id)).map((r) => ({ id: r.id, final: !!r.final })));
    note('chain-has-5-rooms', rooms.length === 5 && rooms[4].final && !rooms.slice(0, 4).some((r) => r.final), rooms.map((r) => r.id).join(', '));
    const kinds = [];
    for (let n = 1; n <= 5; n++) {
      await jump4(n); await page.waitForTimeout(50);
      kinds.push(await page.evaluate(() => { const k = {}; VR.enemies.list.forEach((e) => { k[e.def.id] = (k[e.def.id] || 0) + 1; }); return k; }));
    }
    note('gunners-in-rooms-2-4-5', !!(kinds[1].gunner && kinds[3].gunner && kinds[4].gunner), JSON.stringify(kinds));
    note('heavy-in-room-5', !!kinds[4].heavy, 'room5 kinds ' + JSON.stringify(kinds[4]));

    // Exit reward previews.
    const prev = await page.evaluate(() => {
      const T = VR.data.upgrades.types, res = [];
      VR.data.rooms.filter((r) => /^room\d+-/.test(r.id)).forEach((r) => {
        const e = r.exits || {}, ks = Object.keys(e);
        res.push({ id: r.id, n: ks.length, known: ks.every((k) => !!T[e[k]]), distinct: ks.length < 2 || e[ks[0]] !== e[ks[1]] });
      });
      return res;
    });
    note('exit-previews-defined', prev.slice(0, 4).every((r) => r.n === 2 && r.known) && prev[4].n >= 1 && prev[4].known,
      prev.map((r) => r.id + ':' + r.n + (r.known ? '' : '!unknown')).join(' '));
    note('exit-previews-differ', prev.slice(0, 4).every((r) => r.distinct), 'two doors of rooms 1-4 offer different reward types');
    await jump4(1); await page.waitForTimeout(50);
    const drawn = await page.evaluate(() => {
      const subs = []; const orig = VR.render.submit; VR.render.submit = function (it) { if (it.kind === 'text') subs.push(it.text); return orig.apply(this, arguments); };
      VR.doors.render(VR.roomState.player, 1); VR.render.submit = orig;
      return subs;
    });
    note('exit-previews-rendered', drawn.filter((t) => ['ATK', 'MOV', 'DEF', 'END'].indexOf(t) >= 0).length === 2, 'door texts ' + drawn.join(','));

    // Doors seal on entry and stay shut until the room is clear.
    await jump4(1); await page.waitForTimeout(50);
    const d0 = await doorTiles();
    note('doors-sealed-on-entry', !!(d0.D && !d0.D.floor && d0['1'] && !d0['1'].floor && d0['2'] && !d0['2'].floor), JSON.stringify(d0));

    // Scanner: world frozen for about scanDuration, then play starts.
    await jump4(1);
    const scan = await page.evaluate(() => new Promise((res) => {
      const e0 = VR.enemies.list.map((e) => [e.x, e.y]); const t0 = performance.now(); const p = VR.roomState.player; const p0 = [p.x, p.y];
      const wasScanning = VR.doors.scanning(); let moved = 0, pm = 0;
      (function poll() {
        const t = performance.now() - t0;
        if (VR.doors.scanning()) {
          VR.enemies.list.forEach((e, i) => { moved = Math.max(moved, Math.hypot(e.x - e0[i][0], e.y - e0[i][1])); });
          pm = Math.max(pm, Math.hypot(p.x - p0[0], p.y - p0[1]));
        }
        if (!VR.doors.scanning() || t > 3000) res({ wasScanning, ms: t, moved, pm, want: VR.config.doors.scanDuration });
        else requestAnimationFrame(poll);
      })();
    }));
    note('scanner-runs-on-entry', scan.wasScanning && scan.ms > scan.want * 700 && scan.ms < scan.want * 1000 + 400, 'scan lasted ' + scan.ms.toFixed(0) + ' ms, configured ' + scan.want + ' s');
    note('scanner-freezes-world', scan.moved < 1 && scan.pm < 1, 'enemy drift ' + scan.moved.toFixed(1) + ' px, player drift ' + scan.pm.toFixed(1) + ' px during scan');
    await jump4(2); await page.waitForTimeout(60);
    const markers = await page.evaluate(() => {
      const kindsSeen = {}; const orig = VR.render.submit; VR.render.submit = function (it) { kindsSeen[it.kind] = (kindsSeen[it.kind] || 0) + 1; return orig.apply(this, arguments); };
      const scanning = VR.doors.scanning(); VR.doors.render(VR.roomState.player, 1); VR.render.submit = orig;
      return { scanning, markers: kindsSeen.marker || 0, enemies: VR.enemies.aliveCount() };
    });
    note('scanner-marks-every-enemy', markers.scanning && markers.markers === markers.enemies && markers.enemies > 0, 'markers ' + markers.markers + ' for ' + markers.enemies + ' enemies');
    await page.waitForTimeout(900);

    // Full chain, rooms 1-5: clear each, doors open, reward screen, pick, take an exit, grade reported.
    await page.evaluate(() => VR.scenes.go('boarding', { room: 'room1-intro' }));
    await page.waitForTimeout(1200);
    const log = [];
    let chainOk = true;
    for (let n = 1; n <= 5 && chainOk; n++) {
      const st = await page.evaluate(() => ({ id: VR.roomState.info.roomId, idx: VR.boarding.run.index, pending: VR.boarding.run.pending, owned: VR.upgrades.owned.length }));
      const row = { n, id: st.id, idx: st.idx };
      if (st.idx !== n - 1) { row.err = 'expected chain index ' + (n - 1) + ' got ' + st.idx; log.push(row); chainOk = false; break; }
      await page.evaluate(() => { VR.roomState.player.shield = 1000; });   // stray bullets of killed enemies must not end the chain test
      const sealed = await doorTiles();
      row.sealed = !sealed['1'].floor && !sealed.D.floor;
      await killAll();
      await page.waitForTimeout(150);
      const cl = await page.evaluate(() => ({ cleared: VR.roomState.cleared, grade: VR.roomState.info.grade, hudGrade: VR.hudState.grade }));
      row.cleared = cl.cleared; row.grade = cl.grade;
      row.gradeOk = cl.grade.length === 1 && 'SABC'.indexOf(cl.grade) >= 0 && cl.hudGrade === cl.grade;
      const opened = await doorTiles();
      row.opened = !!opened['1'].floor;
      // Room 5 is final: boarding.js never opens the pick screen there, so the room 4 reward is not collected (reported as a minor design gap).
      if (st.pending) {
        await page.waitForTimeout(900);
        const up = await page.evaluate(() => {
          const d = [...document.querySelectorAll('div')].filter((x) => x.textContent === 'CHOOSE AN UPGRADE' && x.offsetParent !== null)[0];
          return { active: VR.upgrades.active, cards: d ? d.parentNode.children[1].children.length : 0 };
        });
        row.reward = up;
        if (up.active) {
          // Paused: nothing may move while the pick screen is up.
          row.pausedDuring = await page.evaluate(() => new Promise((res) => { const p = VR.roomState.player, x = p.x, y = p.y, t = VR.roomState.info.time; setTimeout(() => res(p.x === x && p.y === y && VR.roomState.info.time === t), 300); }));
          await page.keyboard.down('Digit1'); await page.waitForTimeout(60); await page.keyboard.up('Digit1');
          await page.waitForTimeout(150);
          row.picked = await page.evaluate((o) => VR.upgrades.owned.length === o + 1 && !VR.upgrades.active, st.owned);
        }
      }
      // Step into an exit (teleport onto it; the real door code reads the tile under the player).
      row.exit = await page.evaluate((k) => {
        const s = VR.world.spawns.filter((q) => q.ch === '1' || q.ch === '2'); const pick = s[k % s.length];
        const p = VR.roomState.player; p.x = p.px = pick.x; p.y = p.py = pick.y; return pick.ch;
      }, n);
      await page.waitForTimeout(400);
      if (n < 5) {
        const after = await page.evaluate(() => ({ idx: VR.boarding.run.index, pending: VR.boarding.run.pending }));
        row.advanced = after.idx === n;
        await page.waitForTimeout(900);   // let the next room's scan finish
      } else {
        row.complete = await page.evaluate(() => VR.boarding.run.complete);
      }
      log.push(row);
    }
    const bad = log.filter((r) => r.err || !r.sealed || !r.cleared || !r.gradeOk || !r.opened || (r.reward && (!r.reward.active || r.reward.cards !== 3 || !r.pausedDuring || !r.picked)) || (r.n < 5 && !r.advanced) || (r.n === 5 && !r.complete));
    note('chain-playable-rooms-1-5', chainOk && log.length === 5 && bad.length === 0,
      bad.length ? 'problems: ' + JSON.stringify(bad) : 'cleared and left 5 rooms; ' + log.map((r) => r.id + ' grade ' + r.grade + (r.reward ? ' pick ok' : '')).join('; '));
    note('doors-open-on-clear', log.length === 5 && log.every((r) => r.sealed && r.opened), log.map((r) => r.id + ' sealed=' + r.sealed + ' opened=' + r.opened).join('; '));
    note('grades-reported', log.length === 5 && log.every((r) => r.gradeOk), log.map((r) => r.grade).join(','));
    note('rewards-after-rooms-2-4', log.length === 5 && log.slice(1, 4).every((r) => r.reward && r.picked), log.map((r) => r.reward ? r.reward.cards + ' cards' : 'none').join(','));
    note('run-complete-screen', await page.evaluate(() => VR.boarding.run.complete && [...document.querySelectorAll('div')].some((d) => d.textContent.indexOf('RUN COMPLETE') >= 0 && d.offsetParent !== null)), 'final exit ends the run and shows RUN COMPLETE');

    // Each upgrade changes the player field the combat code reads.
    const eff = await page.evaluate(() => {
      const d0 = VR.config.player.dashCharges, res = {};
      for (const id of ['extraShell', 'thirdDash', 'shield', 'wideSpread', 'longDash', 'shockwave']) {
        const p = VR.player.create(50, 50);
        VR.data.upgrades.list.filter((u) => u.id === id)[0].apply(p);
        res[id] = { shellBonus: p.shellBonus, dash: p.maxDashCharges, shield: p.shield, spread: p.spreadMul, dashMul: p.dashDistMul, sw: p.kickShockwave };
      }
      return { res, d0 };
    });
    note('upgrade-extra-shell', eff.res.extraShell.shellBonus > 0, 'shellBonus ' + eff.res.extraShell.shellBonus);
    note('upgrade-third-dash', eff.res.thirdDash.dash === eff.d0 + 1, 'dash charges ' + eff.res.thirdDash.dash + ' (base ' + eff.d0 + ')');
    note('upgrade-shield', eff.res.shield.shield >= 1, 'shield ' + eff.res.shield.shield);
    note('upgrade-wide-spread', eff.res.wideSpread.spread > 1, 'spreadMul ' + eff.res.wideSpread.spread);
    note('upgrade-long-dash', eff.res.longDash.dashMul > 1, 'dashDistMul ' + eff.res.longDash.dashMul);
    note('upgrade-shockwave', eff.res.shockwave.sw === true, 'kickShockwave ' + eff.res.shockwave.sw);

    // Upgrades last the run: owned upgrades survive a room jump and a death restart.
    await page.evaluate(() => { VR.scenes.go('boarding', { room: 'room2-cover' }); });
    await page.waitForTimeout(200);
    await page.evaluate(() => { VR.upgrades.owned.push('extraShell', 'shield'); });
    await jump4(3);
    const kept = await page.evaluate(() => ({ shells: VR.roomState.info.maxShells, base: VR.config.shotgun.shellsPerRoom, shield: VR.roomState.player.shield }));
    note('upgrades-persist-across-rooms', kept.shells > kept.base && kept.shield >= 1, 'room 3 maxShells ' + kept.shells + ' (base ' + kept.base + '), shield ' + kept.shield);
    const keptDeath = await page.evaluate(() => new Promise((res) => {
      const p = VR.roomState.player; p.shield = 0;
      VR.player.hit(p, 'smoke-m4'); setTimeout(() => res({ shield: VR.roomState.player.shield, shells: VR.roomState.info.maxShells }), 800);
    }));
    note('upgrades-persist-across-death', keptDeath.shield >= 1 && keptDeath.shells > kept.base, 'after death shield ' + keptDeath.shield + ', maxShells ' + keptDeath.shells);

    // Heavy: three armored hits, kicks shove but never stun.
    await jump4(5); await page.waitForTimeout(1000);
    const heavy = await page.evaluate(() => {
      const p = VR.roomState.player; p.shield = 1000; VR.enemies.clear();
      const h = VR.enemies.spawn('heavy', p.x, p.y - 60, 0); h.state = 'idle'; h.alerted = false;
      const out = { hp0: h.hp };
      VR.enemies.damage(h, 0, -1, 100, 'smoke'); out.afterOne = h.alive;
      VR.enemies.damage(h, 0, -1, 100, 'smoke'); out.afterTwo = h.alive;
      VR.enemies.damage(h, 0, -1, 100, 'smoke'); out.afterThree = h.alive;
      const k = VR.enemies.spawn('heavy', p.x, p.y - 30, 0); k.state = 'idle';
      p.angle = -Math.PI / 2;
      VR.enemies.kick(p); out.kickState = k.state; out.kickStunAfter = k.stunAfter;
      return out;
    });
    note('heavy-takes-3-hits', heavy.hp0 === 3 && heavy.afterOne && heavy.afterTwo && !heavy.afterThree, JSON.stringify(heavy));
    note('heavy-immune-to-kick-stun', heavy.kickState === 'knocked' && !heavy.kickStunAfter, 'after kick state ' + heavy.kickState + ', stunAfter ' + heavy.kickStunAfter);
    // Through the real input path: one point-blank blast lands exactly one hit on a heavy.
    await page.evaluate(() => { const p = VR.roomState.player; p.shield = 1000; VR.enemies.clear(); window.__h = VR.enemies.spawn('heavy', p.x, p.y - 50, 0); __h.state = 'idle'; __h.alerted = false; VR.enemies.spawn('grunt', p.x + 200, p.y - 20, 0).state = 'idle'; });
    for (let i = 0; i < 3; i++) {
      const hp = await page.evaluate(() => { const o = {}; VR.camera.worldToScreen(__h.x, __h.y, 0, o); return o; });
      await page.mouse.move(hp.x, hp.y); await page.waitForTimeout(150);
    }
    await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up(); await page.waitForTimeout(500);
    const real = await page.evaluate(() => ({ alive: __h.alive, hp: __h.hp }));
    note('heavy-real-shot-one-hit-only', real.alive && real.hp === 2, 'after one real blast alive=' + real.alive + ' hp=' + real.hp);
    const hshot = await page.evaluate(() => new Promise((res) => {
      const p = VR.roomState.player; p.shield = 1000; VR.enemies.clear();
      const h = VR.enemies.spawn('heavy', p.x, p.y - 150, Math.PI / 2); h.state = 'idle';
      let seen = 0; const st = []; const t0 = performance.now(); const sb = VR.weapons.spawnBullet; VR.weapons.spawnBullet = function () { seen++; return sb.apply(this, arguments); };
      (function poll() {
        if (st[st.length - 1] !== h.state) st.push(h.state);
        if (seen > 0 || performance.now() > t0 + 5000) { VR.weapons.spawnBullet = sb; res({ seen, st, expect: VR.config.enemy.heavy.pellets }); } else requestAnimationFrame(poll);
      })();
      VR.enemies.alertNear(h.x, h.y, 50);
    }));
    note('heavy-fires-shotgun-blast', hshot.seen >= 2, 'pellets spawned ' + hshot.seen + ' (config pellets ' + hshot.expect + '), states ' + hshot.st.join('>'));

    // Gunner: fires multi-round bursts and relocates between bursts.
    await jump4(2); await page.waitForTimeout(1000);
    const gun = await page.evaluate(() => new Promise((res) => {
      const p = VR.roomState.player; p.shield = 100000;
      VR.enemies.list.filter((e) => e.def.id !== 'gunner').forEach((e) => VR.enemies.kill(e, 1, 0, 0, 'smoke'));
      const gs = VR.enemies.list.filter((e) => e.alive); gs.forEach((g) => VR.enemies.alertNear(g.x, g.y, 9999));
      const start = gs.map((g) => [g.x, g.y]); const t0 = performance.now(); const states = []; const burstSizes = []; let n = 0, prev = 0, cur = 0, last = 0, drift = 0; const sb = VR.weapons.spawnBullet; VR.weapons.spawnBullet = function () { n++; return sb.apply(this, arguments); };
      (function poll() {
        const t = performance.now() - t0;
        gs.forEach((g, i) => { if (states.indexOf(g.state) < 0) states.push(g.state); drift = Math.max(drift, Math.hypot(g.x - start[i][0], g.y - start[i][1])); });
        if (n > prev) { cur += n - prev; last = t; } else if (cur > 0 && t - last > 250) { burstSizes.push(cur); cur = 0; }
        prev = n;
        if (t > 6000) { VR.weapons.spawnBullet = sb; res({ n: gs.length, states, burstSizes, moved: drift }); } else requestAnimationFrame(poll);
      })();
    }));
    note('gunner-fires-bursts', gun.n > 0 && gun.burstSizes.length > 0 && Math.max.apply(null, gun.burstSizes) >= 3, gun.n + ' gunners; bursts (bullets seen in 6 s) ' + JSON.stringify(gun.burstSizes) + ', states ' + gun.states.join('>'));
    note('gunner-relocates', gun.moved > 20, 'furthest drift from start ' + gun.moved.toFixed(0) + ' px');
    const gk = await page.evaluate(() => {
      const p = VR.roomState.player; VR.enemies.clear(); const g = VR.enemies.spawn('gunner', p.x, p.y - 40, 0); g.state = 'idle';
      VR.enemies.damage(g, 0, -1, 100, 'smoke'); return g.alive;
    });
    note('gunner-dies-in-one-hit', gk === false, 'gunner alive after one hit: ' + gk);

    // Death in the elite room restores a full-health heavy and every enemy in under 0.5 s.
    await jump4(5); await page.waitForTimeout(1000);
    const elite = await page.evaluate(() => new Promise((res) => {
      const n = VR.enemies.list.length; const hv = VR.enemies.list.filter((e) => e.def.id === 'heavy')[0];
      VR.enemies.damage(hv, 1, 0, 100, 'smoke'); VR.enemies.list.filter((e) => e !== hv).forEach((e) => VR.enemies.kill(e, 1, 0, 50, 'smoke'));
      const p = VR.roomState.player; p.shield = 0; const d0 = VR.roomState.info.deaths, t0 = performance.now(); VR.player.hit(p, 'smoke-elite');
      (function poll() {
        const t = performance.now() - t0;
        if ((VR.roomState.player.alive && VR.roomState.info.deaths > d0) || t > 2000) {
          const h2 = VR.enemies.list.filter((e) => e.def.id === 'heavy')[0];
          res({ ms: t, back: VR.roomState.player.alive, same: VR.enemies.aliveCount() === n, heavyHp: h2 && h2.hp, idx: VR.boarding.run.index });
        } else requestAnimationFrame(poll);
      })();
    }));
    note('elite-death-resets-under-0.5s', elite.back && elite.ms < 500 && elite.same && elite.heavyHp === 3, 'restart ' + elite.ms.toFixed(0) + ' ms, all enemies back ' + elite.same + ', heavy hp ' + elite.heavyHp + ', chain index kept ' + elite.idx);

    // 20 enemies of mixed kinds, shooting: frame time.
    await page.evaluate(() => {
      const p = VR.roomState.player; p.shield = 100000; VR.enemies.clear();
      const kindsL = ['grunt', 'gunner', 'rusher', 'heavy'];
      for (let i = 0; i < 20; i++) VR.enemies.spawn(kindsL[i % 4], 32 * (2.5 + (i % 10) * 2), 32 * (4.5 + Math.floor(i / 10) * 2), 0);
      VR.enemies.alertNear(0, 0, 99999);
    });
    await page.waitForTimeout(300);
    const crowd4 = await page.evaluate(() => new Promise((res) => {
      const t = []; let last = performance.now(); const end = last + 3000;
      requestAnimationFrame(function f(n) {
        t.push(n - last); last = n;
        if (n < end) requestAnimationFrame(f);
        else res({ avg: t.slice(5).reduce((a, b) => a + b, 0) / (t.length - 5), max: Math.max.apply(null, t.slice(5)), alive: VR.enemies.aliveCount(), bullets: VR.weapons.bullets.length });
      });
    }));
    note('20-mixed-enemies-60fps', crowd4.alive >= 15 && crowd4.avg < 17.5, 'avg ' + crowd4.avg.toFixed(2) + ' ms, worst ' + crowd4.max.toFixed(1) + ' ms, alive ' + crowd4.alive + ', bullets ' + crowd4.bullets);
  }

  // ---- M5: flight run into boarding --------------------------------------------------------------------
  const rootDir = process.env.VR_ROOT || path.join(__dirname, '..');
  const m5wired = await page.evaluate(() => !!(VR.flightSim && VR.flightDraw && VR.flightCourse && VR.flight));
  const m5html = require('fs').readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  const m5tags = ['flight-course', 'flight-sim', 'flight-draw', 'scenes/flight'].filter((s) => m5html.indexOf(s + '.js') < 0);
  note('m5-wiring', m5wired && m5tags.length === 0, m5wired ? 'flight modules loaded' : 'index.html does not load ' + (m5tags.join(', ') || 'flight modules') + ' so VR.flight, VR.flightSim and the flight scene do not exist (blocking request for proto-architect)');
  if (m5wired) {
    // Fresh load: the run must open in the flight scene, not in a boarding room.
    await page.goto(pathToFileURL(path.join(rootDir, 'index.html')).href);
    await page.waitForTimeout(600);
    const first = await page.evaluate(() => VR.scenes.current);
    note('flight-loads-first', first === 'flight', 'scene after fresh load: ' + first + (first === 'flight' ? '' : ' (boot.js starts boarding; M5 spec says flight run first, then room 1)'));

    // Geometry from the real sim: exactly one band fits through each wall, gaps are 2-3x the ship.
    const geo = await page.evaluate(() => {
      const c = VR.config.flight, f = VR.flightSim.create(); VR.flightSim.reset(f, 0);
      const hy = c.ship.width / 2, hz = c.ship.height / 2, out = { walls: 0, bad: [], mulW: c.gapMulWidth, mulH: c.gapMulHeight, bands: {} };
      f.walls.forEach((w) => {
        if (w.dock) return; out.walls++; out.bands[w.band] = 1;
        const y = (w.gy0 + w.gy1) / 2, fitting = [];
        c.bandZ.forEach((z, b) => { if (Math.abs(y) <= c.laneHalf && y - hy >= w.gy0 && y + hy <= w.gy1 && z - hz >= w.gz0 && z + hz <= w.gz1) fitting.push(b); });
        if (fitting.length !== 1 || fitting[0] !== w.band) out.bad.push(Math.round(-w.x / c.speed * 10) / 10 + 's fits ' + JSON.stringify(fitting) + ' want ' + w.band);
      });
      const cr = VR.flightCourse.course; out.endT = cr.endT; out.cps = cr.checkpoints; out.nBands = c.bandZ.length;
      return out;
    });
    note('flight-bands-and-gaps', geo.nBands === 3 && geo.mulW >= 2 && geo.mulW <= 3 && geo.mulH >= 2 && geo.mulH <= 3 && geo.bad.length === 0 && Object.keys(geo.bands).length === 3,
      geo.walls + ' walls, gap mul ' + geo.mulW + 'x' + geo.mulH + ', bands used ' + Object.keys(geo.bands).join('/') + ', ambiguous ' + JSON.stringify(geo.bad));
    const gaps = geo.cps.map((c, i) => c - (i ? geo.cps[i - 1] : 0));
    note('flight-length-and-checkpoints', geo.endT >= 60 && geo.endT <= 90 && geo.cps.length >= 2 && Math.max.apply(null, gaps) <= 25,
      'run ' + geo.endT + ' s, checkpoints at ' + geo.cps.join(',') + ' s (max spacing ' + Math.max.apply(null, gaps) + ' s)');

    // Real input in the flight scene: band up/down, strafe, fire. God mode so the course does not interfere.
    await page.evaluate(() => { VR.flight.state.god = true; });
    const fl = async () => page.evaluate(() => { const s = VR.flight.state; return { band: s.ship.band, y: s.ship.y, x: s.ship.x, shots: s.bullets.length }; });
    const a0 = await fl();
    await page.keyboard.press('KeyW'); await page.waitForTimeout(150);
    const a1 = await fl();
    await page.keyboard.press('KeyS'); await page.waitForTimeout(150); await page.keyboard.press('KeyS'); await page.waitForTimeout(150);
    const a2 = await fl();
    await page.keyboard.down('KeyA'); await page.waitForTimeout(400); await page.keyboard.up('KeyA');
    const a3 = await fl();
    await page.keyboard.down('KeyD'); await page.waitForTimeout(800); await page.keyboard.up('KeyD');
    const a4 = await fl();
    await page.mouse.move(640, 200); await page.mouse.down();
    let maxShots = 0; for (let i = 0; i < 8; i++) { await page.waitForTimeout(80); maxShots = Math.max(maxShots, (await fl()).shots); }
    await page.mouse.up();
    note('flight-altitude-bands', a1.band === a0.band + 1 && a2.band === a0.band - 1, 'W/S bands ' + a0.band + ' -> ' + a1.band + ' -> ' + a2.band);
    note('flight-strafe-and-fire', a3.y > a0.y + 20 && a4.y < a3.y - 20 && maxShots > 0 && a4.x < a0.x, 'A y ' + a3.y.toFixed(0) + ', D y ' + a4.y.toFixed(0) + ', scrolls ' + (a0.x - a4.x).toFixed(0) + ' px, player shots in flight ' + maxShots);
    for (const k of ['F1', 'F1']) await page.keyboard.press(k);   // debug overlay must survive a scene with no tile map

    // Flight is not blank and holds frame rate through turrets and fighters (checkpoint 40, god mode).
    await page.evaluate(() => { VR.scenes.go('flight', { checkpoint: 40 }); });
    await page.waitForTimeout(300);
    await page.evaluate(() => { VR.flight.state.god = true; });
    await page.keyboard.down('KeyA'); await page.mouse.down();
    const fr = await page.evaluate(() => new Promise((res) => {
      const t = []; let last = performance.now(); const end = last + 3000;
      requestAnimationFrame(function f(n) {
        t.push(n - last); last = n;
        if (n < end) requestAnimationFrame(f);
        else {
          const u = t.slice(5), c = document.getElementById('game'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, seen = {};
          for (let i = 0; i < d.length; i += 4 * 97) seen[(d[i] >> 5) + ',' + (d[i + 1] >> 5) + ',' + (d[i + 2] >> 5)] = 1;
          res({ avg: u.reduce((a, b) => a + b, 0) / u.length, max: Math.max.apply(null, u), colors: Object.keys(seen).length, turrets: VR.flight.state.turrets.length, shots: VR.flight.state.shots.length });
        }
      });
    }));
    await page.mouse.up(); await page.keyboard.up('KeyA');
    note('flight-60fps', fr.avg < 17.5, 'avg ' + fr.avg.toFixed(2) + ' ms, worst ' + fr.max.toFixed(1) + ' ms, turrets ' + fr.turrets + ', enemy shots ' + fr.shots);
    note('flight-renders-content', fr.colors >= 6, fr.colors + ' distinct quantised colours on canvas');

    // One-hit death and checkpoint restart: warp to checkpoint 20 with N, fly into a wrong-band wall, no god.
    await page.evaluate(() => { VR.scenes.go('flight'); });
    await page.waitForTimeout(300);
    await page.keyboard.press('KeyN'); await page.waitForTimeout(150);
    const dth = await page.evaluate(() => new Promise((res) => {
      const f = VR.flight.state, c = VR.config.flight; f.god = false;
      const cp = f.cpT, w = f.walls.filter((q) => !q.dock).sort((a, b) => b.x - a.x)[0], s = f.ship;
      const z = w.band === 0 ? c.bandZ[2] : c.bandZ[0];
      f.t = -w.x / c.speed - 0.05; s.x = s.px = -f.t * c.speed; s.band = w.band === 0 ? 2 : 0; s.z = s.pz = s.zFrom = s.zTo = z; s.y = s.py = c.laneHalf; s.zT = 1;
      const t0 = performance.now(); let sawDead = false, cause = '';
      (function poll() {
        const g = VR.flight.state, t = performance.now() - t0;
        if (g.dead) { sawDead = true; cause = g.cause; }
        if ((sawDead && !g.dead) || t > 2000) res({ ms: t, sawDead, cause, cp, t: g.t, cpT: g.cpT, x: g.ship.x, alive: !g.dead });
        else requestAnimationFrame(poll);
      })();
    }));
    note('flight-one-hit-death', dth.sawDead, 'cause "' + dth.cause + '"');
    note('flight-restart-under-0.5s', dth.sawDead && dth.alive && dth.ms < 500 && dth.cp > 0 && Math.abs(dth.t - dth.cp) < 0.2 && Math.abs(dth.x + dth.cp * 180) < 5, 'restart ' + dth.ms.toFixed(0) + ' ms, checkpoint ' + dth.cp + ' s, resumed at t=' + dth.t.toFixed(2) + ' s');

    // Run end: dock hands off to boarding room 1 with enemies present and no console errors (collected globally).
    await page.evaluate(() => { VR.scenes.go('flight', { checkpoint: 60 }); });
    await page.waitForTimeout(300);
    await page.evaluate(() => { const f = VR.flight.state, c = VR.config.flight; f.god = true; const d = f.walls.filter((w) => w.dock)[0]; f.t = -d.x / c.speed - 1; f.ship.x = f.ship.px = -f.t * c.speed; });
    let hand = null;
    for (let i = 0; i < 30 && !hand; i++) {
      await page.waitForTimeout(150);
      hand = await page.evaluate(() => VR.scenes.current === 'boarding' ? { room: (VR.data.rooms.filter((r) => /^room[0-9]+-/.test(r.id))[VR.boarding.run.index] || {}).id, idx: VR.boarding.run.index } : null);
    }
    note('flight-hands-off-to-room1', !!hand && hand.idx === 0 && hand.room === 'room1-intro', hand ? 'now in ' + hand.room : 'still in scene ' + await page.evaluate(() => VR.scenes.current) + ' 4.5 s after docking');
    if (hand) {
      await page.waitForTimeout(1200);
      const st1 = await page.evaluate(() => ({ en: VR.enemies.aliveCount(), pl: VR.roomState.player.alive, tiles: !!VR.world.tiles }));
      note('boarding-live-after-handoff', st1.en > 0 && st1.pl && st1.tiles, 'enemies ' + st1.en + ', player alive ' + st1.pl + ', tiles ' + st1.tiles);
      const bd = await page.evaluate(() => new Promise((res) => {
        const n = VR.enemies.list.length, p = VR.roomState.player; p.shield = 0; const d0 = VR.roomState.info.deaths, t0 = performance.now(); VR.player.hit(p, 'smoke-m5');
        (function poll() {
          const t = performance.now() - t0;
          if ((VR.roomState.player.alive && VR.roomState.info.deaths > d0) || t > 2000) res({ ms: t, back: VR.roomState.player.alive && VR.roomState.info.deaths > d0, same: VR.enemies.aliveCount() === n });
          else requestAnimationFrame(poll);
        })();
      }));
      note('boarding-death-restart-after-handoff', bd.back && bd.ms < 500 && bd.same, 'restart ' + bd.ms.toFixed(0) + ' ms, all enemies back ' + bd.same);
    }
  }

  // ---- M6: HUD, F1 overlay, tuning panel, telemetry export, full run ------------------------------------
  const m6wired = await page.evaluate(() => !!(VR.hud && VR.debug && VR.tuning && VR.telemetry && VR.clipboard));
  note('m6-wiring', m6wired, m6wired ? 'hud, debug, tuning, telemetry, clipboard loaded' : 'a debug/hud module is missing (blocking request for proto-architect)');
  if (m6wired) {
    await page.goto(pathToFileURL(path.join(rootDir, 'index.html')).href);
    await page.waitForTimeout(600);
    await page.evaluate(() => { VR.scenes.go('boarding', { room: 'room1-intro' }); });
    await page.waitForTimeout(1300);   // scan finishes

    // HUD: every spec field is in VR.hudState and actually painted (text spied on the 2D context).
    const hudFields = await page.evaluate(() => {
      const need = ['shells', 'maxShells', 'dashCharges', 'maxDashCharges', 'combo', 'time', 'deaths', 'grade', 'clearTime'];
      const h = VR.hudState; return { missing: need.filter((k) => !(k in h)), nonNum: need.filter((k) => k !== 'grade' && typeof h[k] !== 'number') };
    });
    note('hud-state-fields', hudFields.missing.length === 0 && hudFields.nonNum.length === 0, hudFields.missing.length || hudFields.nonNum.length ? JSON.stringify(hudFields) : 'shells, dash, combo, timer, deaths, grade present');
    const painted = await page.evaluate(() => new Promise((res) => {
      const ctx = document.getElementById('game').getContext('2d'), seen = [], orig = ctx.fillText;
      ctx.fillText = function (s) { seen.push(String(s)); return orig.apply(this, arguments); };
      // Quick kills build a combo; clearing the room shows the grade banner.
      VR.roomState.player.shield = 1000;
      VR.enemies.list.forEach((e) => VR.enemies.kill(e, 1, 0, 100, 'smoke-m6'));
      setTimeout(() => { ctx.fillText = orig; res(seen); }, 400);
    }));
    const has = (re) => painted.some((s) => re.test(s));
    const checks = { shells: has(/^SHELLS$/), dash: has(/^DASH$/), combo: has(/COMBO x\d/), timer: has(/\d:\d\d\.\d/), deaths: has(/deaths \d/), grade: has(/^[SABC]$/) };
    note('hud-paints-all-fields', Object.values(checks).every(Boolean), JSON.stringify(checks));

    // F1 overlay toggles and changes the picture; second press hides it.
    const f1 = await page.evaluate(() => VR.debug.enabled);
    await page.keyboard.press('F1'); await page.waitForTimeout(150);
    const f1on = await page.evaluate(() => VR.debug.enabled);
    const shotOn = (await page.screenshot()).toString('base64');
    await page.keyboard.press('F1'); await page.waitForTimeout(150);
    const f1off = await page.evaluate(() => VR.debug.enabled);
    const shotOff = (await page.screenshot()).toString('base64');
    note('f1-overlay-toggles', !f1 && f1on && !f1off && shotOn !== shotOff, 'enabled ' + f1 + ' -> ' + f1on + ' -> ' + f1off + ', picture differs ' + (shotOn !== shotOff));

    // Tuning panel: backtick opens, slider input changes VR.config live, Reset restores.
    await page.keyboard.press('Backquote'); await page.waitForTimeout(150);
    const tp = await page.evaluate(() => {
      const open = VR.tuning.isOpen, sliders = document.querySelectorAll('input[type=range]');
      const n = sliders.length; let target = null;
      sliders.forEach((s) => { if (s.parentNode.firstChild.title.indexOf('player.speed') === 0) target = s; });
      const before = VR.config.player.speed;
      target.value = String(before * 2); target.dispatchEvent(new Event('input', { bubbles: true }));
      const after = VR.config.player.speed, changes = VR.tuning.changes();
      return { open, n, before, after, listed: !!changes['player.speed'], cfg: JSON.parse(VR.tuning.configText()).changes['player.speed'] !== undefined };
    });
    note('tuning-panel-opens', tp.open && tp.n >= 20, 'open ' + tp.open + ', sliders ' + tp.n);
    note('tuning-slider-live', tp.after === tp.before * 2 && tp.listed && tp.cfg, 'player.speed ' + tp.before + ' -> ' + tp.after + ', in changes() ' + tp.listed + ', in copy-config ' + tp.cfg);
    const resetOk = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent === 'Reset values'); if (b) b.click(); return !!b; });
    const restored = await page.evaluate(() => VR.config.player.speed);
    note('tuning-reset-restores', resetOk && restored === tp.before, 'player.speed back to ' + restored);
    await page.keyboard.press('Backquote'); await page.waitForTimeout(150);
    note('tuning-panel-closes', !(await page.evaluate(() => VR.tuning.isOpen)), 'closed by second backtick');

    // Full run on a fresh load: flight (docks) then rooms 1-5; telemetry reset so the export covers exactly this run.
    await page.goto(pathToFileURL(path.join(rootDir, 'index.html')).href);
    await page.waitForTimeout(600);
    await page.evaluate(() => { VR.telemetry.reset(); VR.flight.state.god = true; });
    await page.evaluate(() => { const f = VR.flight.state, c = VR.config.flight, d = f.walls.filter((w) => w.dock)[0]; f.t = -d.x / c.speed - 1; f.ship.x = f.ship.px = -f.t * c.speed; });
    let inBoard = false;
    for (let i = 0; i < 40 && !inBoard; i++) { await page.waitForTimeout(150); inBoard = await page.evaluate(() => VR.scenes.current === 'boarding'); }
    note('fullrun-flight-to-boarding', inBoard, inBoard ? 'docked, boarding loaded' : 'never left flight after docking');
    const runLog = [];
    if (inBoard) {
      await page.waitForTimeout(1300);
      for (let n = 1; n <= 5; n++) {
        const row = { n };
        await page.evaluate(() => { VR.roomState.player.shield = 1000; VR.enemies.list.forEach((e) => VR.enemies.kill(e, 1, 0, 100, 'smoke-m6')); });
        await page.waitForTimeout(250);
        row.cleared = await page.evaluate(() => VR.roomState.cleared);
        await page.waitForTimeout(900);
        if (await page.evaluate(() => VR.upgrades.active)) { await page.keyboard.down('Digit1'); await page.waitForTimeout(60); await page.keyboard.up('Digit1'); await page.waitForTimeout(150); }
        await page.evaluate((k) => { const s = VR.world.spawns.filter((q) => q.ch === '1' || q.ch === '2'), pick = s[k % s.length], p = VR.roomState.player; if (pick) { p.x = p.px = pick.x; p.y = p.py = pick.y; } }, n);
        await page.waitForTimeout(n < 5 ? 1300 : 500);
        if (n < 5) row.advanced = await page.evaluate((k) => VR.boarding.run.index === k, n);
        else row.complete = await page.evaluate(() => VR.boarding.run.complete);
        runLog.push(row);
      }
    }
    const runOk = runLog.length === 5 && runLog.every((r) => r.cleared && (r.n < 5 ? r.advanced : r.complete));
    note('fullrun-flight-plus-5-rooms', runOk, JSON.stringify(runLog));

    // Telemetry: valid JSON, one flight visit + 5 rooms, every room has the fields the report needs.
    const tel = await page.evaluate(() => { try { return { text: VR.telemetry.json() }; } catch (e) { return { err: String(e) }; } });
    let parsed = null; try { parsed = JSON.parse(tel.text); } catch (e) { /* reported below */ }
    note('telemetry-valid-json', !!parsed && parsed.format === 'voidreaver-telemetry-1' && Array.isArray(parsed.rooms), parsed ? 'format ' + parsed.format + ', ' + parsed.rooms.length + ' visits' : 'JSON.parse failed: ' + (tel.err || ''));
    if (parsed) {
      const ids = parsed.rooms.map((r) => r.room);
      const want = ['flight', 'room1-intro', 'room2-cover', 'room3-breach', 'room4-rushers', 'room5-elite'];
      const fieldsOk = parsed.rooms.every((r) => typeof r.attempts === 'number' && 'timeToClear' in r && typeof r.deathCount === 'number' && Array.isArray(r.deaths));
      note('telemetry-covers-every-room', want.every((w) => ids.indexOf(w) >= 0) && fieldsOk, 'visits ' + ids.join(', '));
      note('telemetry-rooms-cleared', want.slice(1).every((w) => parsed.rooms.some((r) => r.room === w && r.cleared && r.timeToClear !== null)) && parsed.rooms.some((r) => r.room === 'flight' && r.cleared), parsed.rooms.map((r) => r.room + ':' + (r.cleared ? r.timeToClear : 'open')).join(' '));
    }
    // A death is recorded with its cause, then the Copy stats button puts the same valid JSON in the panel.
    await page.evaluate(() => { VR.scenes.go('boarding', { room: 'room2-cover' }); });
    await page.waitForTimeout(1400);
    await page.evaluate(() => { const p = VR.roomState.player; p.shield = 0; VR.player.hit(p, 'smoke-m6-death'); });
    await page.waitForTimeout(900);
    await page.keyboard.press('Backquote'); await page.waitForTimeout(150);
    const clicked = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent === 'Copy stats'); if (b) b.click(); return !!b; });
    await page.waitForTimeout(400);
    const ta = await page.evaluate(() => { const t = [...document.querySelectorAll('textarea')].find((x) => x.value.indexOf('voidreaver-telemetry') >= 0); return t ? t.value : ''; });
    let p2 = null; try { p2 = JSON.parse(ta); } catch (e) { /* reported below */ }
    const dead = !!p2 && p2.rooms.some((r) => r.room === 'room2-cover' && r.deaths.some((d) => d.cause === 'smoke-m6-death'));
    note('copy-stats-button-exports-json', clicked && !!p2 && dead, clicked ? (p2 ? 'valid JSON, death cause recorded ' + dead : 'textarea not valid JSON') : 'no Copy stats button');
    await page.keyboard.press('Backquote');
  }

  await browser.close();
  console.log('avgFrameMs ' + avg.toFixed(2) + '  update ' + st.upd.toFixed(2) + ' ms  render ' + st.rnd.toFixed(2) + ' ms');
  results.forEach((r) => console.log((r[1] ? 'ok   ' : 'FAIL ') + r[0] + ' - ' + r[2]));
  if (fails.length) { console.error('FAIL smoke\n' + fails.join('\n')); process.exit(1); }
  console.log('PASS smoke');
})();
