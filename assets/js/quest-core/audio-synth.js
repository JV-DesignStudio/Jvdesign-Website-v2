/* A2561: zero-dependency Web Audio sound effects for quest code.
 * Renders short WAV clips in the browser (or in Node for tests) and exposes a
 * Base64 data URI a learner can paste into a quest: new Audio(dataUri).play().
 * No network, no external libraries, no audio files on disk. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.JVDSAudioSynth = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var SAMPLE_RATE = 22050;
  var PRESETS = {
    jump: { label: 'Jump', duration: 0.18, wave: 'square', start: 240, end: 720, noise: 0 },
    laser: { label: 'Laser', duration: 0.22, wave: 'saw', start: 1600, end: 220, noise: 0 },
    explosion: { label: 'Explosion', duration: 0.45, wave: 'noise', start: 90, end: 40, noise: 1 }
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function seededNoise(seed) {
    var state = seed >>> 0;
    return function () {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296 * 2 - 1;
    };
  }

  function oscillator(wave, phase) {
    var t = phase % 1;
    if (wave === 'square') return t < 0.5 ? 1 : -1;
    if (wave === 'saw') return 2 * t - 1;
    if (wave === 'triangle') return 4 * Math.abs(t - 0.5) - 1;
    return Math.sin(phase * Math.PI * 2);
  }

  function render(options) {
    options = options || {};
    var preset = PRESETS[options.preset] || PRESETS.jump;
    var pitch = clamp(Number(options.pitch) || 1, 0.5, 2);
    var duration = clamp(Number(options.duration) || preset.duration, 0.05, 1);
    var sampleRate = options.sampleRate || SAMPLE_RATE;
    var total = Math.max(1, Math.round(duration * sampleRate));
    var samples = new Float32Array(total);
    var noise = seededNoise(0x51f15e);
    var phase = 0;
    var attack = Math.max(1, Math.round(0.005 * sampleRate));

    for (var i = 0; i < total; i++) {
      var progress = i / total;
      var freq = (preset.start + (preset.end - preset.start) * progress) * pitch;
      phase += freq / sampleRate;
      var tone = oscillator(preset.wave === 'noise' ? 'sine' : preset.wave, phase);
      if (preset.wave === 'noise') tone = noise();
      var envelope = i < attack ? i / attack : Math.pow(1 - progress, preset.noise ? 1.7 : 2.2);
      var fade = Math.min(1, (total - i) / Math.max(1, Math.round(0.008 * sampleRate)));
      samples[i] = Math.tanh(tone * 1.6) * envelope * fade * 0.8;
    }
    return { samples: samples, sampleRate: sampleRate, preset: options.preset || 'jump', pitch: pitch, duration: duration };
  }

  function toWavBytes(samples, sampleRate) {
    var rate = sampleRate || SAMPLE_RATE;
    var dataSize = samples.length * 2;
    var buffer = new ArrayBuffer(44 + dataSize);
    var view = new DataView(buffer);
    function text(offset, value) { for (var i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); }
    text(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    text(8, 'WAVE');
    text(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    text(36, 'data');
    view.setUint32(40, dataSize, true);
    for (var i = 0; i < samples.length; i++) {
      var s = clamp(samples[i], -1, 1);
      view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Uint8Array(buffer);
  }

  function bytesToBase64(bytes) {
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    var binary = '';
    var chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function toDataUri(samples, sampleRate) {
    return 'data:audio/wav;base64,' + bytesToBase64(toWavBytes(samples, sampleRate));
  }

  function build(options) {
    var rendered = render(options);
    return {
      preset: rendered.preset,
      pitch: rendered.pitch,
      duration: rendered.duration,
      sampleRate: rendered.sampleRate,
      samples: rendered.samples,
      dataUri: toDataUri(rendered.samples, rendered.sampleRate)
    };
  }

  function snippet(dataUri) {
    return "var sfx = new Audio('" + dataUri + "');\nsfx.play();";
  }

  var audioContext = null;
  function preview(options) {
    var built = build(options);
    if (typeof Audio === 'undefined') return Promise.resolve(false);
    try {
      var audio = new Audio(built.dataUri);
      audio.volume = 0.8;
      var played = audio.play();
      if (played && typeof played.then === 'function') return played.then(function () { return true; }).catch(function () { return false; });
      return Promise.resolve(true);
    } catch (e) {
      return Promise.resolve(false);
    }
  }

  function getAudioContext() {
    if (audioContext) return audioContext;
    var Ctor = root.AudioContext || root.webkitAudioContext;
    if (!Ctor) return null;
    try { audioContext = new Ctor(); } catch (e) { audioContext = null; }
    return audioContext;
  }

  function initPanel() {
    var panel = typeof document !== 'undefined' && document.getElementById('sfx-panel');
    if (!panel) return null;
    var pitchInput = panel.querySelector('#sfx-pitch');
    var durationInput = panel.querySelector('#sfx-duration');
    var output = panel.querySelector('#sfx-output');
    var status = panel.querySelector('#sfx-status');
    var playBtn = panel.querySelector('#sfx-preview');
    var exportBtn = panel.querySelector('#sfx-export');
    var copyBtn = panel.querySelector('#sfx-copy');
    var pitchValue = panel.querySelector('#sfx-pitch-value');
    var presetButtons = Array.prototype.slice.call(panel.querySelectorAll('[data-sfx-preset]'));
    var state = { preset: 'jump', pitch: 1, duration: PRESETS.jump.duration };

    function settings() {
      return { preset: state.preset, pitch: Number(pitchInput && pitchInput.value) || 1, duration: Number(durationInput && durationInput.value) || state.duration };
    }

    function setStatus(text) { if (status) status.textContent = text; }

    function selectPreset(name) {
      if (!PRESETS[name]) return;
      state.preset = name;
      state.duration = PRESETS[name].duration;
      presetButtons.forEach(function (btn) {
        var on = btn.getAttribute('data-sfx-preset') === name;
        btn.classList.toggle('is-on', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      if (durationInput) durationInput.value = state.duration;
      setStatus(PRESETS[name].label + ' selected. Press Preview or Export.');
    }

    function writeOutput() {
      var result = build(settings());
      if (output) output.value = result.dataUri;
      setStatus('Ready: ' + Math.round(result.dataUri.length / 1024) + ' KB Base64 WAV. Paste it into your quest code.');
      return result;
    }

    presetButtons.forEach(function (btn) {
      btn.addEventListener('click', function () { selectPreset(btn.getAttribute('data-sfx-preset')); });
    });
    if (pitchInput) pitchInput.addEventListener('input', function () {
      if (pitchValue) pitchValue.textContent = Number(pitchInput.value).toFixed(1).replace(/\.0$/, '') + 'x';
      setStatus('Pitch ' + pitchInput.value + 'x. Press Preview or Export.');
    });
    if (durationInput) durationInput.addEventListener('input', function () { setStatus('Length ' + durationInput.value + 's. Press Preview or Export.'); });
    if (playBtn) playBtn.addEventListener('click', function () {
      var ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(function () {});
      preview(settings()).then(function (ok) { setStatus(ok ? 'Playing preview.' : 'This browser blocked audio. Press Preview again after a click.'); });
    });
    if (exportBtn) exportBtn.addEventListener('click', function () { writeOutput(); });
    if (copyBtn) copyBtn.addEventListener('click', function () {
      var result = writeOutput();
      var text = result.dataUri;
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { setStatus('Copied the Base64 WAV.'); }).catch(function () { setStatus('Copy failed. Select the text and copy it by hand.'); });
      else setStatus('Select the data string and copy it by hand.');
    });

    selectPreset('jump');
    writeOutput();

    return { selectPreset: selectPreset, settings: settings, writeOutput: writeOutput };
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPanel);
    else initPanel();
  }

  return {
    SAMPLE_RATE: SAMPLE_RATE,
    PRESETS: PRESETS,
    render: render,
    toWavBytes: toWavBytes,
    toDataUri: toDataUri,
    build: build,
    preview: preview,
    snippet: snippet,
    initPanel: initPanel
  };
});
