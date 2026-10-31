/*
 * VR.telemetry: per-room playtest stats, exported as JSON for the human to paste back.
 *
 *   VR.telemetry.step(dt)      fixed-update callback, registered after VR.scenes.update (boot.js)
 *   VR.telemetry.visits        one record per room visit, in play order (flight run included)
 *   VR.telemetry.data()        the export object; VR.telemetry.json() the same as pretty JSON text
 *   VR.telemetry.copy()        copy json() to the clipboard -> Promise<boolean> (call from a click/key handler)
 *   VR.telemetry.reset()       drop everything recorded so far
 *
 * It only observes: VR.roomState.info / .player (boarding) and VR.flight.state (flight). It never writes game
 * state, and it allocates only when something happens (new visit, death, clear).
 *
 * A visit starts when the room id changes (or the flight state is new). Within a visit:
 *   attempts    room attempts as counted by VR.roomState (1 + every death restart and every R restart);
 *               flight: 1 + every checkpoint restart (death, R or N)
 *   deaths      [{ attempt, cause, at, ... }]  at = fight-clock seconds into that attempt (flight: course time)
 *   clears      [{ attempt, time, grade, bestCombo }]  time = fight clock of the clearing attempt
 *   timeToClear first clear's fight time (flight: sim seconds from entering the run to docking, retries included)
 *   totalTime   simulated seconds spent in the visit (excludes pause and hit-stop)
 */
(function (VR) {
  'use strict';

  var FORMAT = 'voidreaver-telemetry-1';
  var visits = [];
  var cur = null;
  var session = 0;
  var lastPlayer = null, lastAlive = true;
  var lastFlight = null, lastDead = false, lastT = 0;

  function round(v) { return Math.round(v * 100) / 100; }

  function open(scene, id, name) {
    cur = {
      index: visits.length, scene: scene, room: id, name: name || id,
      startedAt: round(session), attempts: 1, deaths: [], clears: [],
      cleared: false, timeToClear: null, grade: null, bestCombo: 0,
      kills: 0, enemies: 0, totalTime: 0, debugAssisted: false
    };
    visits.push(cur);
    return cur;
  }

  function trackRoom(dt) {
    var info = VR.roomState.info, pl = VR.roomState.player;
    if (!cur || cur.scene !== 'boarding' || cur.room !== info.roomId || info.attempts < cur.attempts) {
      var room = VR.world.room;
      open('boarding', info.roomId, room && room.id === info.roomId ? room.name : info.roomId);
      lastPlayer = null;
    }
    cur.totalTime += dt;
    cur.attempts = info.attempts;
    cur.enemies = info.total;
    cur.kills = info.kills;   // of the current (or clearing) attempt

    if (pl !== lastPlayer) { lastPlayer = pl; lastAlive = pl.alive; }
    if (lastAlive && !pl.alive) {
      cur.deaths.push({ attempt: info.attempts, cause: pl.cause || 'unknown', at: round(info.time), kills: info.kills });
    }
    lastAlive = pl.alive;

    var clearedNow = info.cleared && info.total > 0;
    var last = cur.clears[cur.clears.length - 1];
    if (clearedNow && (!last || last.attempt !== info.attempts)) {
      cur.clears.push({ attempt: info.attempts, time: round(info.clearTime), grade: info.grade, bestCombo: info.bestCombo });
      if (!cur.cleared) {
        cur.cleared = true;
        cur.timeToClear = round(info.clearTime);
        cur.grade = info.grade;
        cur.bestCombo = info.bestCombo;
      }
    }
  }

  function trackFlight(f, dt) {
    if (!cur || cur.scene !== 'flight' || f !== lastFlight) {
      open('flight', 'flight', 'Flight run');
      lastFlight = f; lastDead = f.dead; lastT = f.t;
    }
    cur.totalTime += dt;
    if (f.god) cur.debugAssisted = true;
    // Any jump of the course clock that is not one step forward is a checkpoint restart (death, R) or warp (N).
    if (f.t < lastT - dt * 0.5 || f.t > lastT + dt * 2) {
      cur.attempts++;
      if (f.t > lastT) cur.debugAssisted = true;
    }
    if (!lastDead && f.dead) {
      cur.deaths.push({ attempt: cur.attempts, cause: f.cause || 'unknown', at: round(f.t), checkpoint: f.cpT });
    }
    if (f.docked && !cur.cleared) {
      cur.cleared = true;
      cur.timeToClear = round(cur.totalTime);
      cur.clears.push({ attempt: cur.attempts, time: round(f.t - f.cpT), grade: null, bestCombo: 0 });
    }
    lastDead = f.dead;
    lastT = f.t;
  }

  function exportVisit(v) {
    var manual = v.attempts - 1 - v.deaths.length;
    return {
      index: v.index, scene: v.scene, room: v.room, name: v.name, startedAt: v.startedAt,
      attempts: v.attempts, deathCount: v.deaths.length, manualRestarts: manual > 0 ? manual : 0,
      cleared: v.cleared, timeToClear: v.timeToClear, grade: v.grade, bestCombo: v.bestCombo,
      kills: v.kills, enemies: v.enemies, totalTime: round(v.totalTime), debugAssisted: v.debugAssisted,
      deaths: v.deaths, clears: v.clears
    };
  }

  var telemetry = {
    visits: visits,

    step: function (dt) {
      session += dt;
      var scene = VR.scenes.current;
      // Debug room jumps (Digit keys) are recorded like any other visit, so a playtest log shows them.
      if (scene === 'boarding' && VR.roomState && VR.roomState.player && VR.roomState.info.roomId) {
        trackRoom(dt);
      } else if (scene === 'flight' && VR.flight && VR.flight.state) {
        trackFlight(VR.flight.state, dt);
      } else {
        cur = null;
      }
    },

    reset: function () {
      visits.length = 0;
      cur = null; lastPlayer = null; lastFlight = null;
      session = 0;
    },

    data: function () {
      var causes = {}, deaths = 0, attempts = 0, cleared = 0, i, k;
      for (i = 0; i < visits.length; i++) {
        var v = visits[i];
        attempts += v.attempts;
        if (v.cleared) cleared++;
        for (k = 0; k < v.deaths.length; k++) {
          deaths++;
          var key = v.scene + ':' + v.deaths[k].cause;
          causes[key] = (causes[key] || 0) + 1;
        }
      }
      return {
        format: FORMAT,
        exportedAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
        sessionSeconds: round(session),
        totals: { visits: visits.length, cleared: cleared, attempts: attempts, deaths: deaths, causes: causes },
        configChanges: VR.tuning ? VR.tuning.changes() : {},
        rooms: visits.map(exportVisit)
      };
    },

    json: function () { return JSON.stringify(telemetry.data(), null, 2); },

    copy: function () { return VR.clipboard.copy(telemetry.json()); }
  };

  VR.telemetry = telemetry;
})(window.VR = window.VR || {});
