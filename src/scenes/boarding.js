/*
 * Boarding scene: runs the compartment chain, room 1 -> 5, then the run-complete state.
 * Owner: level-builder (seeded by proto-architect in M1).
 *
 *   VR.scenes.go('boarding', { room: 'room1-intro' })   room id from VR.data.rooms (default: first room)
 *
 * Chain: the rooms whose id starts with 'roomN-', in file order. Entering a room from a door seals it behind you
 * and plays the door scanner (world frozen, enemies marked). Taking exit door 1 or 2 of rooms 1-4 queues that
 * door's reward type; clearing the next room opens the pick-one-of-three upgrade screen (the game pauses).
 * The final room also grants room 4's reward before its exit (which ends the run) unlocks. Any non-chain room (m1-test) leads into room 1.
 *
 * Debug: press Digit1..5 (top row) to jump to room N with the current upgrades; R restarts the current room;
 * on the run-complete screen R or a click starts a fresh run. VR.boarding.run exposes the chain state.
 */
(function (VR) {
  'use strict';

  var player = null;
  var room = null;
  var panel = null;

  // pending: reward type of the exit taken last, granted when the current room is cleared.
  var run = { index: 0, pending: null, rewardT: 0, complete: false, time: 0, deaths: 0, picks: 0 };

  function chain() {
    return VR.data.rooms.filter(function (r) { return /^room\d+-/.test(r.id); });
  }

  function findRoom(id) {
    var rooms = VR.data.rooms;
    for (var i = 0; i < rooms.length; i++) if (rooms[i].id === id) return rooms[i];
    return rooms[0];
  }

  function roomByNumber(n) {
    return chain()[n - 1] || null;
  }

  // Enemy kinds that are in the map but not built yet are skipped with a warning, never an error.
  function warnUnknownKinds() {
    var sp = VR.world.spawns, by = VR.data.enemies.byChar, skipped = {};
    for (var i = 0; i < sp.length; i++) {
      var ch = sp[i].ch;
      if ('grnH'.indexOf(ch) >= 0 && !by[ch]) skipped[ch] = (skipped[ch] || 0) + 1;
    }
    for (var k in skipped) console.warn('[boarding] ' + room.id + ': skipping ' + skipped[k] + ' unknown enemy kind "' + k + '" (not implemented yet)');
  }

  function hidePanel() { if (panel) panel.style.display = 'none'; }

  function showComplete() {
    if (!panel) {
      panel = document.createElement('div');
      panel.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:10;display:none;' +
        'background:rgba(4,6,12,0.85);color:#e8f0ff;font-family:monospace;align-items:center;' +
        'justify-content:center;flex-direction:column;text-align:center;cursor:pointer';
      panel.addEventListener('click', newRun);
      document.body.appendChild(panel);
    }
    var names = VR.upgrades.owned.map(function (id) {
      return VR.data.upgrades.list.filter(function (u) { return u.id === id; })[0].name;
    });
    panel.innerHTML = '<div style="font-size:34px;letter-spacing:6px;margin-bottom:18px">RUN COMPLETE</div>' +
      '<div style="font-size:16px;line-height:1.8">Fight time ' + run.time.toFixed(1) + 's, deaths ' + run.deaths +
      '<br>Upgrades: ' + (names.length ? names.join(', ') : 'none') +
      '<br><br>Click or press R to run it again</div>';
    panel.style.display = 'flex';
  }

  function start(scan) {
    VR.world.load(room);
    warnUnknownKinds();
    player = VR.player.create(VR.world.playerStart.x, VR.world.playerStart.y);
    VR.upgrades.applyTo(player);   // before roomState.enter so shell upgrades fill the magazine
    VR.camera.snap(player.x, player.y);
    VR.roomState.enter(room, player);
    VR.doors.enter(room, scan);
    run.rewardT = 0;
  }

  function jumpTo(target, pending) {
    var idx = chain().indexOf(target);
    run.index = idx < 0 ? 0 : idx;
    run.pending = pending || null;
    run.complete = false;
    hidePanel();
    room = target;
    start(true);
  }

  function newRun() {
    VR.upgrades.reset();
    run.time = 0; run.deaths = 0; run.picks = 0;
    jumpTo(chain()[0], null);
  }

  function takeExit(ex) {
    var info = VR.roomState.info;
    run.time += info.clearTime;
    run.deaths += info.deaths;
    if (room.final) {
      run.complete = true;
      showComplete();
      return;
    }
    var next = chain()[run.index + 1] || chain()[0];
    jumpTo(next, ex.type === 'extract' ? null : ex.type);
  }

  // The reward screen waits for the delay after the clear; exits stay shut until it is picked.
  function rewardWaiting() {
    return VR.roomState.cleared && run.pending !== null;
  }

  VR.boarding = { run: run };

  VR.scenes.register('boarding', {
    enter: function (params) {
      var target = findRoom(params.room);
      run.time = 0; run.deaths = 0; run.picks = 0;
      VR.upgrades.reset();
      jumpTo(target, null);
      if (chain().indexOf(target) < 0) run.index = -1;
    },

    exit: function () {
      VR.roomState.exit(); VR.doors.exit(); VR.upgrades.reset(); hidePanel();
      player = null;
    },

    update: function (dt) {
      if (VR.upgrades.active) { VR.upgrades.update(dt); return; }   // pick screen pauses the game
      VR.upgrades.update(dt);
      if (run.complete) {
        if (VR.input.pressed(VR.config.keys.restart)) newRun();
        return;
      }
      for (var n = 1; n <= chain().length; n++) {
        if (VR.input.pressed('Digit' + n)) { jumpTo(roomByNumber(n), null); return; }
      }
      // Player flags restartRequested after the death freeze; R restarts at any time.
      if (player.restartRequested || VR.input.pressed(VR.config.keys.restart)) { start(false); return; }
      if (player.alive && VR.doors.scanning()) {   // a death during the scan still runs its freeze and restart
        VR.doors.update(player, dt);
        VR.camera.follow(player.x, player.y, player.aimX, player.aimY);
        VR.camera.update(dt);
        return;
      }
      VR.player.update(player, dt);
      VR.roomState.update(player, dt);
      if (rewardWaiting()) {
        run.rewardT += dt;
        if (run.rewardT >= VR.config.doors.rewardDelay) {
          var type = run.pending;
          run.pending = null;
          if (VR.upgrades.open(type, player)) run.picks++;
        }
      }
      var ex = VR.doors.update(player, dt);
      if (ex && !rewardWaiting()) { takeExit(ex); return; }
      VR.camera.follow(player.x, player.y, player.aimX, player.aimY);
      VR.camera.update(dt);
    },

    render: function (alpha) {
      VR.player.render(player, alpha);
      VR.roomState.render(player, alpha);
      VR.doors.render(player, alpha);
      VR.upgrades.render(alpha);
    }
  });
})(window.VR = window.VR || {});
