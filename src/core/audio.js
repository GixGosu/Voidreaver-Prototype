/*
 * VR.audio: tiny WebAudio blip synth.
 *
 *   VR.audio.play(name [, volumeScale])   name is a key of VR.config.audio.sounds
 *                                         ('shot', 'kill', 'death', 'clear', 'dash', 'click', 'kick', 'breach')
 *
 * The AudioContext is created on the first user gesture (browsers block audio before one); calls made
 * earlier are silently ignored. Presets are data in config so the feel-tuner can shape them.
 */
(function (VR) {
  'use strict';

  var ctx = null;
  var master = null;
  var noise = null;

  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
    // One second of white noise, reused by every noise blip.
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var d = noise.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  window.addEventListener('mousedown', unlock);
  window.addEventListener('keydown', unlock);

  VR.audio = {
    play: function (name, volumeScale) {
      if (!ctx || ctx.state !== 'running') return;
      var p = VR.config.audio.sounds[name];
      if (!p) return;
      var t = ctx.currentTime;
      var vol = p.volume * (volumeScale === undefined ? 1 : volumeScale);
      master.gain.value = VR.config.audio.volume;

      var gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + p.duration);
      gain.connect(master);

      var src;
      if (p.wave === 'noise') {
        // Noise pitch is shaped by a sweeping low-pass filter.
        src = ctx.createBufferSource();
        src.buffer = noise;
        var filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(p.freq, t);
        filter.frequency.exponentialRampToValueAtTime(Math.max(1, p.freqEnd), t + p.duration);
        src.connect(filter);
        filter.connect(gain);
      } else {
        src = ctx.createOscillator();
        src.type = p.wave;
        src.frequency.setValueAtTime(p.freq, t);
        src.frequency.exponentialRampToValueAtTime(Math.max(1, p.freqEnd), t + p.duration);
        src.connect(gain);
      }
      src.start(t);
      src.stop(t + p.duration);
    }
  };
})(window.VR = window.VR || {});
