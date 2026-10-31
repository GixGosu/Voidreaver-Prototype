/*
 * VR.upgrades: run-long upgrades and the pick-one-of-three screen. Owner: level-builder.
 * Definitions are data in VR.data.upgrades; magnitudes are in VR.config.upgrades.
 *
 *   VR.upgrades.owned                 ids picked this run
 *   VR.upgrades.reset()               new run: forget everything
 *   VR.upgrades.applyTo(p)            replay every owned upgrade onto a freshly created player
 *   VR.upgrades.open(type, p)         show three cards (biased to the reward type); false if nothing is left to offer
 *   VR.upgrades.active                true while the screen is up; the scene must not simulate then (pause)
 *   VR.upgrades.update(dt)            polls keys 1/2/3 while active, ages the shockwave ring
 *   VR.upgrades.onKick(p)             kick shockwave, called from VR.doors.kick
 *   VR.upgrades.render(alpha)
 * The screen is a DOM overlay so clicks need no hit-testing in the canvas.
 */
(function (VR) {
  'use strict';

  var owned = [];
  var active = false;
  var cards = [];
  var target = null;
  var root = null;
  var rings = [];

  function byId(id) {
    var l = VR.data.upgrades.list;
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i];
      a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Two cards of the door's reward type when possible, the rest from anything unowned.
  function pickCards(type) {
    var free = VR.data.upgrades.list.filter(function (u) { return owned.indexOf(u.id) < 0; });
    var pref = shuffle(free.filter(function (u) { return u.type === type; })).slice(0, 2);
    var rest = shuffle(free.filter(function (u) { return pref.indexOf(u) < 0; }));
    return shuffle(pref.concat(rest).slice(0, 3));
  }

  function hide() {
    active = false;
    if (root) root.style.display = 'none';
    VR.input.clear();
  }

  function choose(i) {
    var u = cards[i];
    if (!active || !u) return;
    owned.push(u.id);
    u.apply(target);
    VR.weapons.refill(target);   // shell upgrades apply to the ammo already refilled by the clear
    VR.audio.play('clear');
    hide();
  }

  function build() {
    root = document.createElement('div');
    root.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;display:none;z-index:10;' +
      'background:rgba(4,6,12,0.82);color:#e8f0ff;font-family:monospace;align-items:center;' +
      'justify-content:center;flex-direction:column;user-select:none';
    document.body.appendChild(root);
  }

  function show() {
    if (!root) build();
    var types = VR.data.upgrades.types, w = VR.config.upgrades.cardWidth;
    root.innerHTML = '';
    var title = document.createElement('div');
    title.textContent = 'CHOOSE AN UPGRADE';
    title.style.cssText = 'font-size:26px;letter-spacing:4px;margin-bottom:24px';
    root.appendChild(title);
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:20px';
    root.appendChild(row);
    cards.forEach(function (u, i) {
      var t = types[u.type], el = document.createElement('div');
      el.style.cssText = 'width:' + w + 'px;padding:18px;cursor:pointer;background:#141a28;' +
        'border:2px solid ' + t.color + ';box-sizing:border-box';
      el.innerHTML = '<div style="color:' + t.color + ';font-size:13px">[' + (i + 1) + '] ' + t.label + '</div>' +
        '<div style="font-size:20px;margin:10px 0">' + u.name + '</div>' +
        '<div style="font-size:14px;line-height:1.4;color:#b8c4dc">' + u.desc + '</div>';
      el.addEventListener('mouseenter', function () { el.style.background = '#222c45'; });
      el.addEventListener('mouseleave', function () { el.style.background = '#141a28'; });
      el.addEventListener('click', function () { choose(i); });
      row.appendChild(el);
    });
    root.style.display = 'flex';
    VR.input.clear();
  }

  VR.upgrades = {
    owned: owned,
    get active() { return active; },

    reset: function () { owned.length = 0; hide(); rings.length = 0; },

    applyTo: function (p) {
      for (var i = 0; i < owned.length; i++) byId(owned[i]).apply(p);
    },

    open: function (type, p) {
      cards = pickCards(type);
      if (cards.length === 0) return false;
      target = p;
      active = true;
      show();
      return true;
    },

    update: function (dt) {
      if (active) {
        for (var i = 0; i < cards.length; i++) if (VR.input.pressed('Digit' + (i + 1))) { choose(i); break; }
      }
      for (var r = rings.length - 1; r >= 0; r--) {
        rings[r].t += dt;
        if (rings[r].t >= VR.config.upgrades.shockwaveRingLife) rings.splice(r, 1);
      }
    },

    // Kick shockwave: shoves and stuns everything near the player, heavies shoved only.
    onKick: function (p) {
      if (!p.kickShockwave) return;
      var c = VR.config.upgrades, list = VR.enemies.list, hit = false;
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (!e.alive) continue;
        var dx = e.x - p.x, dy = e.y - p.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (d > c.shockwaveRadius + e.radius) continue;
        hit = true;
        VR.enemies.knock(e, dx / d, dy / d, c.shockwaveKnockSpeed, c.shockwaveKnockTime, e.def.kickImmune ? 0 : c.shockwaveStun);
      }
      if (hit && VR.roomState) VR.roomState.activate();
      rings.push({ x: p.x, y: p.y, t: 0 });
    },

    render: function () {
      var c = VR.config.upgrades;
      for (var i = 0; i < rings.length; i++) {
        var k = rings[i].t / c.shockwaveRingLife;
        VR.render.submit({ kind: 'circle', layer: 'overlay', x: rings[i].x, y: rings[i].y, z: 0,
          radius: c.shockwaveRadius * k, color: '#ffffff', outline: true, alpha: 1 - k, width: 2 });
      }
    }
  };
})(window.VR = window.VR || {});
