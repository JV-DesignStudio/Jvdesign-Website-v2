/* ═══════════════════════════════════════════════════════════
   JVDS Audio Engine — Shared by Sound Studio, SFX Generator,
   Music Maker, and Drum Pad. Single AudioContext, single
   master bus, single export pipeline.
   ═══════════════════════════════════════════════════════════ */

class JVDSAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.compressor = null;
    this.streamDest = null;
    this.recorder = null;
    this.recording = false;
    this.chunks = [];
  }

  /* ── CONTEXT ────────────────────────────────────────── */
  getCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -24;
      this.compressor.knee.value = 12;
      this.compressor.ratio.value = 4;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.25;
      this.compressor.connect(this.ctx.destination);
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.compressor);
      this.streamDest = this.ctx.createMediaStreamDestination();
      this.masterGain.connect(this.streamDest);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  /* ── MASTER VOLUME ──────────────────────────────────── */
  setMasterVolume(v) {
    this.getCtx();
    this.masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01);
  }

  /* ── NOTE FREQUENCY ─────────────────────────────────── */
  static noteFreq(name, oct) {
    const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const i = NOTES.indexOf(name);
    return 440 * Math.pow(2, (i + 12 * (oct - 4) - 9) / 12);
  }

  static midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /* ── SYNTH PRIMITIVES ───────────────────────────────── */
  osc(type, startFreq, endFreq, startTime, endTime, vol) {
    const ctx = this.getCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(startFreq, startTime);
    if (endFreq !== startFreq) o.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), endTime);
    g.gain.setValueAtTime(vol, startTime);
    g.gain.exponentialRampToValueAtTime(0.001, endTime + 0.01);
    o.connect(g);
    g.connect(this.masterGain);
    o.start(startTime);
    o.stop(endTime + 0.02);
  }

  noise(type, startTime, endTime, vol) {
    const ctx = this.getCtx();
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * (endTime - startTime));
    const buf = ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = 2000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, startTime);
    g.gain.exponentialRampToValueAtTime(0.001, endTime);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start(startTime);
    src.stop(endTime + 0.01);
  }

  /* ── DRUM SOUNDS ────────────────────────────────────── */
  kick(t, vol = 0.5) {
    const ctx = this.getCtx();
    this.osc('sine', 150, 30, t, t + 0.12, vol);
    this.noise('lowpass', t, t + 0.06, vol * 0.3);
  }

  snare(t, vol = 0.4) {
    const ctx = this.getCtx();
    this.osc('triangle', 200, 100, t, t + 0.08, vol * 0.3);
    this.noise('highpass', t, t + 0.12, vol);
  }

  hihat(t, open = false, vol = 0.3) {
    const ctx = this.getCtx();
    this.noise('highpass', t, t + (open ? 0.15 : 0.05), vol);
  }

  clap(t, vol = 0.35) {
    const ctx = this.getCtx();
    for (let i = 0; i < 3; i++) {
      this.noise('bandpass', t + i * 0.01, t + i * 0.01 + 0.02, vol * 0.7);
    }
    this.noise('highpass', t + 0.03, t + 0.12, vol);
  }

  tom(freq = 120, t, vol = 0.4) {
    this.osc('sine', freq, freq * 0.5, t, t + 0.15, vol);
    this.noise('lowpass', t, t + 0.06, vol * 0.2);
  }

  crash(t, vol = 0.3) {
    this.noise('highpass', t, t + 0.4, vol);
  }

  /* ── SFX PRESETS ────────────────────────────────────── */
  sfxJump(t) { this.osc('sine', 200, 600, t, t + 0.15, 0.4); return 0.2; }
  sfxCoin(t) { this.osc('sine', 880, 1320, t, t + 0.08, 0.4); this.osc('sine', 1320, 1760, t + 0.06, t + 0.18, 0.3); return 0.25; }
  sfxHit(t) { this.osc('sawtooth', 800, 200, t, t + 0.15, 0.35); return 0.2; }
  sfxExplosion(t) { this.noise('lowpass', t, t + 0.3, 0.6); this.osc('sine', 100, 20, t, t + 0.2, 0.5); return 0.4; }
  sfxPowerup(t) { [523,659,784,1047].forEach((f,i) => this.osc('sine', f, f, t + i * 0.06, t + i * 0.06 + 0.1, 0.3)); return 0.35; }
  sfxLaser(t) { this.osc('sawtooth', 1200, 400, t, t + 0.08, 0.35); return 0.15; }
  sfxSelect(t) { this.osc('sine', 600, 800, t, t + 0.06, 0.2); return 0.1; }
  sfxCancel(t) { this.osc('sine', 400, 200, t, t + 0.08, 0.2); return 0.1; }

  /* ── RECORDING ──────────────────────────────────────── */
  startRecording() {
    this.getCtx();
    this.recording = true;
    this.chunks = [];
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus' : 'audio/webm';
    this.recorder = new MediaRecorder(this.streamDest.stream, { mimeType });
    this.recorder.ondataavailable = e => { if (e.data.size > 0) this.chunks.push(e.data); };
    this.recorder.start();
  }

  stopRecording(filename = 'audio') {
    return new Promise(resolve => {
      this.recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.recorder.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename + '-' + Date.now() + '.webm';
        a.click();
        URL.revokeObjectURL(url);
        this.recording = false;
        resolve();
      };
      this.recorder.stop();
    });
  }

  /* ── EXPORT WAV ─────────────────────────────────────── */
  static encodeWAV(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const writeStr = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return new Blob([buffer], { type: 'audio/wav' });
  }

  /* ── LFO (vibrato/tremolo) ──────────────────────────── */
  lfo(type, freq, amount, startTime, endTime) {
    const ctx = this.getCtx();
    const lfo = ctx.createOscillator();
    const g = ctx.createGain();
    lfo.type = type;
    lfo.frequency.value = freq;
    g.gain.value = amount;
    lfo.connect(g);
    lfo.start(startTime);
    lfo.stop(endTime);
    return g; // connect this to a parameter
  }

  /* ── REVERB (convolution-free) ──────────────────────── */
  delay(time, feedback, wet) {
    const ctx = this.getCtx();
    const d = ctx.createDelay(2);
    d.delayTime.value = time;
    const fb = ctx.createGain();
    fb.gain.value = feedback;
    const w = ctx.createGain();
    w.gain.value = wet;
    return { input: d, output: w, feedback: fb };
  }
}

// Singleton — all tools share one instance
window.JVDSAudio = window.JVDSAudio || new JVDSAudioEngine();
