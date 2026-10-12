/* ═══════════════════════════════════════════════════════════
   Audio & Visual Effects Engine, Sound, Shake, Particles
   ═══════════════════════════════════════════════════════════ */

class AudioEffects {
  constructor(masterVolume = 0.7) {
    this.audioContext = null;
    this.masterVolume = masterVolume;
    this.musicVolume = 1;   // separate music trim on top of master (0..1)
    this._sndWinStart = 0;  // sfx voice-rate limiter state
    this._sndWinCount = 0;
    this.maxSfxPerWindow = 16; // max one-shot starts per 100ms window
    this.initAudioContext();
  }
  setMusicVolume(v) { this.musicVolume = Math.max(0, Math.min(1, v)); this._applyMusicGain(); }

  initAudioContext() {
    if (!this.audioContext) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContext();
        this._buildBus();
      } catch (e) {
        console.warn('Web Audio API not supported');
      }
    }
  }

  // ── MASTER BUS ── everything routes through a shared dry path plus a small
  // convolution-reverb send, so the whole game sits in one dusty, desolate
  // space instead of dry beeps. A gentle low-pass warms the top end.
  _buildBus() {
    const ctx = this.audioContext;
    this.master = ctx.createGain(); this.master.gain.value = 1;
    this.warmth = ctx.createBiquadFilter(); this.warmth.type = 'lowpass';
    this.warmth.frequency.value = 8200; this.warmth.Q.value = 0.4;
    this.warmth.connect(this.master); this.master.connect(ctx.destination);
    this.busDry = ctx.createGain(); this.busDry.gain.value = 0.9; this.busDry.connect(this.warmth);
    this.reverb = ctx.createConvolver(); this.reverb.buffer = this._makeImpulse(2.6, 2.8);
    this.busWet = ctx.createGain(); this.busWet.gain.value = 0.14;
    this.busWet.connect(this.reverb); this.reverb.connect(this.warmth);
    // Music sub-bus (drone + score) sits pre-send so mute/volume moves it alone.
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.0001;
    this.connectOut(this.musicBus);
    this._applyMusicGain(true);
  }
  connectOut(node) {
    if (this.busDry) { node.connect(this.busDry); if (this.busWet) node.connect(this.busWet); }
    else if (this.audioContext) node.connect(this.audioContext.destination);
  }
  _makeImpulse(dur = 2.4, decay = 2.6) {
    const ctx = this.audioContext, rate = ctx.sampleRate, len = Math.max(1, Math.floor(rate * dur));
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }
  _noiseBuf() {
    if (this._noise) return this._noise;
    const ctx = this.audioContext, len = Math.floor(ctx.sampleRate * 1.2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return (this._noise = buf);
  }
  _applyMusicGain(instant) {
    if (!this.musicBus || !this.audioContext) return;
    const g = (this.musicMuted ? 0 : (this.musicVolume == null ? 1 : this.musicVolume)) * this.masterVolume * 0.5;
    const now = this.audioContext.currentTime;
    this.musicBus.gain.cancelScheduledValues(now);
    this.musicBus.gain.setValueAtTime(Math.max(0.0001, this.musicBus.gain.value), now);
    this.musicBus.gain.linearRampToValueAtTime(Math.max(0.0001, g), now + (instant ? 0.02 : 0.25));
  }

  // Contexts created before a user gesture start suspended; play calls come
  // from input handlers, so resuming here unblocks audio on Chrome/Safari.
  getContext() {
    if (!this.audioContext) this.initAudioContext();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  // ── SFX VOICE RATE LIMITER ── during heavy fights (minigun + chains + boss
  // rings) dozens of oscillators/noise sources can start per frame; every one
  // allocates Web Audio nodes that later become GC pressure -- a real stutter
  // source on mobile. This caps starts to a per-100ms budget; excess one-shots
  // are simply skipped (imperceptible drops under load, big win on low-end).
  _sfxAllow() {
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (now - this._sndWinStart > 100) { this._sndWinStart = now; this._sndWinCount = 0; }
    if (this._sndWinCount >= this.maxSfxPerWindow) return false;
    this._sndWinCount++;
    return true;
  }

  // Effective volume, honoring the active game's sound settings when a
  // GameSystem exists on the page. Returns 0 when muted.
  getVolume() {
    let volume = this.masterVolume;
    try {
      const gs = typeof GameSystem !== 'undefined' && GameSystem.lastInstance;
      if (gs) {
        if (gs.getSetting('soundEnabled') === false) return 0;
        const sfx = gs.getSetting('sfxVolume');
        if (typeof sfx === 'number') volume *= sfx;
      }
    } catch (e) { /* settings unavailable, keep masterVolume */ }
    return volume;
  }

  /* ─── SOUND EFFECTS USING WEB AUDIO API ─── */
  playTap(pitch = 800) {
    if (!this.getContext() || !this.getVolume()) return;
    if (!this._sfxAllow()) return; // rate-limit: skip excess one-shots under load
    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.connect(gain);
    this.connectOut(gain);
    osc.frequency.value = pitch;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3 * this.getVolume(), now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playSuccess(pitch = 1200) {
    if (!this.getContext() || !this.getVolume()) return;
    if (!this._sfxAllow()) return; // rate-limit: skip excess one-shots under load
    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.connect(gain);
    this.connectOut(gain);
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 1.5, now + 0.15);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.4 * this.getVolume(), now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playLevelUp() {
    if (!this.getContext() || !this.getVolume()) return;
    if (!this._sfxAllow()) return; // rate-limit: skip excess one-shots under load
    const now = this.audioContext.currentTime;
    const notes = [800, 1000, 1200, 1400];
    notes.forEach((pitch, i) => {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      osc.connect(gain);
      this.connectOut(gain);
      osc.frequency.value = pitch;
      osc.type = 'sine';
      const startTime = now + (i * 0.08);
      gain.gain.setValueAtTime(0.3 * this.getVolume(), startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);
      osc.start(startTime);
      osc.stop(startTime + 0.15);
    });
  }

  playCombo(multiplier = 2) {
    if (!this.getContext() || !this.getVolume()) return;
    if (!this._sfxAllow()) return; // rate-limit: skip excess one-shots under load
    const now = this.audioContext.currentTime;
    const pitch = 600 + (multiplier * 100);
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.connect(gain);
    this.connectOut(gain);
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.8, now + 0.12);
    osc.type = 'square';
    gain.gain.setValueAtTime(0.35 * this.getVolume(), now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  // Rising pitch over the telegraph window -- an audio "something's coming"
  // cue to pair with the boss's visual wind-up, distinct from the short
  // hit/pop effects above.
  playCharge(durationSec = 0.3) {
    if (!this.getContext() || !this.getVolume()) return;
    if (!this._sfxAllow()) return; // rate-limit: skip excess one-shots under load
    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.connect(gain);
    this.connectOut(gain);
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(560, now + durationSec);
    osc.type = 'sawtooth';
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.18 * this.getVolume(), now + durationSec * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);
    osc.start(now);
    osc.stop(now + durationSec);
  }

  // Explosion -- a filtered noise burst with a low thump, for rockets/grenades.
  playBoom() {
    if (!this.getContext() || !this.getVolume()) return;
    if (!this._sfxAllow()) return; // rate-limit: skip excess one-shots under load
    const ctx = this.audioContext, now = ctx.currentTime, v = this.getVolume();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.5 * v, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    src.connect(lp); lp.connect(g); this.connectOut(g); src.start(now);
    const osc = ctx.createOscillator(), og = ctx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(90, now); osc.frequency.exponentialRampToValueAtTime(30, now + 0.25);
    og.gain.setValueAtTime(0.4 * v, now); og.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(og); this.connectOut(og); osc.start(now); osc.stop(now + 0.3);
  }

  // Warm noise whoosh for flamethrower / fire weapons. Distinct from the
  // sharp crack of a bullet - sounds like igniting fuel rather than a bang.
  playFlame() {
    if (!this.getContext() || !this.getVolume()) return;
    if (!this._sfxAllow()) return;
    const ctx = this.audioContext, now = ctx.currentTime, v = this.getVolume();
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.18), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2200, now); lp.frequency.exponentialRampToValueAtTime(380, now + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.20 * v, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    src.connect(lp); lp.connect(g); this.connectOut(g); src.start(now); src.stop(now + 0.19);
  }

  // Smooth sine thump for orb / plasma projectiles - weighted and resonant,
  // very different from the crackle of a ballistic shot.
  playOrb() {
    if (!this.getContext() || !this.getVolume()) return;
    if (!this._sfxAllow()) return;
    const ctx = this.audioContext, now = ctx.currentTime, v = this.getVolume();
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now); osc.frequency.exponentialRampToValueAtTime(160, now + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.26 * v, now + 0.025);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(g); this.connectOut(g); osc.start(now); osc.stop(now + 0.24);
  }

  // Crackly electric snap for chain / tesla weapons - high-passed noise
  // burst with a sharp sine sting, sounds like arcing electricity.
  playZap() {
    if (!this.getContext() || !this.getVolume()) return;
    if (!this._sfxAllow()) return;
    const ctx = this.audioContext, now = ctx.currentTime, v = this.getVolume();
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3800;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.28 * v, now); ng.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    src.connect(hp); hp.connect(ng); this.connectOut(ng); src.start(now); src.stop(now + 0.06);
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(2400, now); osc.frequency.exponentialRampToValueAtTime(700, now + 0.09);
    const og = ctx.createGain(); og.gain.setValueAtTime(0.20 * v, now); og.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(og); this.connectOut(og); osc.start(now); osc.stop(now + 0.11);
  }

  // Sharp sawtooth pitch arc for the beam whip - a fast whooomp that
  // reads as a close-range energy lash rather than a projectile.
  playWhip() {
    if (!this.getContext() || !this.getVolume()) return;
    if (!this._sfxAllow()) return;
    const ctx = this.audioContext, now = ctx.currentTime, v = this.getVolume();
    const osc = ctx.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(1400, now + 0.045);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.20);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.24 * v, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(g); this.connectOut(g); osc.start(now); osc.stop(now + 0.23);
  }

  // Heavy shotgun/cannon blast - deep filtered noise thump with a low sine boom.
  // Totally different character from a rifle: wide, bassy, authoritative.
  playHeavyShot() {
    if (!this.getContext() || !this.getVolume()) return;
    if (!this._sfxAllow()) return;
    const ctx = this.audioContext, now = ctx.currentTime, v = this.getVolume();
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.12), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.30 * v, now); ng.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    src.connect(lp); lp.connect(ng); this.connectOut(ng); src.start(now); src.stop(now + 0.13);
    const osc = ctx.createOscillator(), og = ctx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(160, now); osc.frequency.exponentialRampToValueAtTime(45, now + 0.18);
    og.gain.setValueAtTime(0.35 * v, now); og.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
    osc.connect(og); this.connectOut(og); osc.start(now); osc.stop(now + 0.21);
  }

  // Precision rifle crack - a tight high-velocity transient. Brief, punchy,
  // directional - sounds like something moving very fast through air.
  playCrack() {
    if (!this.getContext() || !this.getVolume()) return;
    if (!this._sfxAllow()) return;
    const ctx = this.audioContext, now = ctx.currentTime, v = this.getVolume();
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.035), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 0.7);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.42 * v, now); ng.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    src.connect(ng); this.connectOut(ng); src.start(now); src.stop(now + 0.04);
    const osc = ctx.createOscillator(), og = ctx.createGain();
    osc.type = 'square'; osc.frequency.setValueAtTime(1800, now); osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);
    og.gain.setValueAtTime(0.16 * v, now); og.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(og); this.connectOut(og); osc.start(now); osc.stop(now + 0.06);
  }

  // Melee swing whoosh - broad-band noise sweep tuned by weapon weight.
  // weight < 1 = fast hiss (voltgauntlet, rustblade);
  // weight > 1.5 = slower deeper whoosh (warhammer, reaperscythe).
  playMeleeSwing(weight = 1.0) {
    if (!this.getContext() || !this.getVolume()) return;
    if (!this._sfxAllow()) return;
    const ctx = this.audioContext, now = ctx.currentTime, v = this.getVolume();
    const dur = 0.10 + weight * 0.09;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = weight > 1.5 ? 200 : 700;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = weight > 1.5 ? 1800 : 5000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now); g.gain.linearRampToValueAtTime(0.20 * v, now + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(hp); hp.connect(lp); lp.connect(g); this.connectOut(g); src.start(now); src.stop(now + dur + 0.01);
  }

  // Melee impact thud - what you hear when the weapon connects with flesh.
  // Light hit = tight punch; heavy hit = dense low boom.
  playMeleeHit(heavy = false) {
    if (!this.getContext() || !this.getVolume()) return;
    if (!this._sfxAllow()) return;
    const ctx = this.audioContext, now = ctx.currentTime, v = this.getVolume();
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = 'sine';
    if (heavy) {
      osc.frequency.setValueAtTime(120, now); osc.frequency.exponentialRampToValueAtTime(35, now + 0.18);
      g.gain.setValueAtTime(0.38 * v, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
      osc.connect(g); this.connectOut(g); osc.start(now); osc.stop(now + 0.22);
    } else {
      osc.frequency.setValueAtTime(300, now); osc.frequency.exponentialRampToValueAtTime(100, now + 0.07);
      g.gain.setValueAtTime(0.24 * v, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(g); this.connectOut(g); osc.start(now); osc.stop(now + 0.11);
    }
  }

  // Short zap for beam/laser fire.
  playBeam() {
    if (!this.getContext() || !this.getVolume()) return;
    if (!this._sfxAllow()) return; // rate-limit: skip excess one-shots under load
    const ctx = this.audioContext, now = ctx.currentTime, v = this.getVolume();
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(1400, now); osc.frequency.exponentialRampToValueAtTime(600, now + 0.09);
    g.gain.setValueAtTime(0.16 * v, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(g); this.connectOut(g); osc.start(now); osc.stop(now + 0.11);
  }

  // Low thump for the low-HP heartbeat warning.
  playHeartbeat() {
    if (!this.getContext() || !this.getVolume()) return;
    if (!this._sfxAllow()) return; // rate-limit: skip excess one-shots under load
    const ctx = this.audioContext, now = ctx.currentTime, v = this.getVolume();
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(70, now); osc.frequency.exponentialRampToValueAtTime(40, now + 0.14);
    g.gain.setValueAtTime(0.001, now); g.gain.exponentialRampToValueAtTime(0.4 * v, now + 0.02); g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(g); this.connectOut(g); osc.start(now); osc.stop(now + 0.17);
  }

  playError() {
    if (!this.getContext() || !this.getVolume()) return;
    if (!this._sfxAllow()) return; // rate-limit: skip excess one-shots under load
    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.connect(gain);
    this.connectOut(gain);
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.2);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3 * this.getVolume(), now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  playPop() {
    if (!this.getContext() || !this.getVolume()) return;
    if (!this._sfxAllow()) return; // rate-limit: skip excess one-shots under load
    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.connect(gain);
    this.connectOut(gain);
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
    osc.type = 'square';
    gain.gain.setValueAtTime(0.4 * this.getVolume(), now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  setMasterVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this._applyMusicGain();
  }

  // Gritty wasteland gunshot: a high-passed noise crack over a short low thump,
  // so the auto-fire reads as a scrappy makeshift weapon, not a clean beep.
  playShot(tone = 1) {
    if (!this.getContext() || !this.getVolume()) return;
    if (!this._sfxAllow()) return; // rate-limit: skip excess one-shots under load
    const ctx = this.audioContext, now = ctx.currentTime, v = this.getVolume();
    const src = ctx.createBufferSource(); src.buffer = this._noiseBuf();
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 850;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.20 * v, now); ng.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    src.connect(hp); hp.connect(ng); this.connectOut(ng); src.start(now); src.stop(now + 0.07);
    const osc = ctx.createOscillator(); osc.type = 'square';
    osc.frequency.setValueAtTime(240 * tone, now);
    osc.frequency.exponentialRampToValueAtTime(85 * tone, now + 0.07);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.16 * v, now); og.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(og); this.connectOut(og); osc.start(now); osc.stop(now + 0.09);
  }

  /* ─── PROCEDURAL BACKGROUND MUSIC ───
     A dark, loopable synth groove built live from oscillators (no audio
     files, so the app stays fully self-contained). A lookahead scheduler
     queues notes slightly ahead of the audio clock for rock-steady timing
     regardless of frame rate. Respects the same volume/mute as the SFX,
     plus its own musicMuted toggle. bossMode fattens it for boss fights. */
  startMusic() {
    if (this.musicPlaying) return;
    if (!this.getContext()) return;
    this.musicPlaying = true;
    if (this.musicMuted === undefined) this.musicMuted = false;
    this._musicStep = 0;
    this._musicTempo = this.musicBoss ? 0.15 : 0.19; // sparse, slow wasteland pulse
    this._nextNoteTime = this.audioContext.currentTime + 0.1;
    this._startDrone();
    this._musicInterval = setInterval(() => this._musicScheduler(), 25);
  }
  stopMusic() {
    this.musicPlaying = false;
    if (this._musicInterval) { clearInterval(this._musicInterval); this._musicInterval = null; }
    this.setSecretHint(false); // drop the shimmer layer with everything else
    this._stopDrone();
  }
  setMusicMuted(muted) { this.musicMuted = !!muted; this._applyMusicGain(); }
  toggleMusic() { this.musicMuted = !this.musicMuted; this._applyMusicGain(); return !this.musicMuted; }
  setBossMode(on) {
    const was = this.musicBoss; this.musicBoss = !!on;
    this._musicTempo = (on ? 0.15 : 0.19) / (this.biomeTempoMul || 1);
    if (was !== this.musicBoss && this.musicPlaying) this._retuneDrone();
  }
  // ── BIOME MOOD ── shifts the drone pitch, the melody's scale and the tempo so
  // each region of the waste has its own feel (toxic = darker/dissonant, frozen
  // = cold/sparse/high, magma = tense/driving, storm = electric/faster, ...).
  setBiome(fam) {
    const B = {
      menu:  { semi: -1, scale: [0, 2, 3, 5, 7, 9, 10],  tempo: 0.80 }, // calm, slow lobby mood
      dust:  { semi: 0,  scale: [0, 2, 3, 5, 7, 8, 10],  tempo: 1.00 },
      toxic: { semi: -2, scale: [0, 1, 3, 5, 6, 8, 10],  tempo: 1.05 },
      frozen:{ semi: 3,  scale: [0, 2, 3, 7, 8, 10, 12], tempo: 0.90 },
      magma: { semi: -3, scale: [0, 2, 3, 5, 7, 8, 11],  tempo: 1.08 },
      void:  { semi: 1,  scale: [0, 1, 4, 6, 7, 10, 11], tempo: 0.97 },
      storm: { semi: 5,  scale: [0, 2, 4, 5, 7, 9, 11], tempo: 1.14 },
      throne:{ semi: -5, scale: [0, 2, 3, 5, 7, 8, 11],  tempo: 1.12 },
    };
    const b = B[fam] || B.dust;
    if (this.biomeFam === fam) return;
    this.biomeFam = fam; this.biomeSemi = b.semi; this.biomeScale = b.scale; this.biomeTempoMul = b.tempo;
    // ── PER-BIOME TIMBRE ── each family gets its own melodic voice, not just a
    // different scale: raspy saw for toxic, bell-ish sine for frozen, gritty
    // square for magma, twin detuned saws for void, tight plucks for storm.
    const W = {
      dust:  { wave:'triangle', dur:1.00, detune:0   },
      toxic: { wave:'sawtooth', dur:0.90, detune:0   },
      frozen:{ wave:'sine',     dur:1.60, detune:0   },
      magma: { wave:'square',   dur:0.80, detune:0   },
      void:  { wave:'sawtooth', dur:1.10, detune:7   }, // cents of detune
      storm: { wave:'triangle', dur:0.45, detune:0   },
      throne:{ wave:'sawtooth', dur:1.20, detune:5   },
      menu:  { wave:'sine',     dur:1.30, detune:0   },
    };
    this.biomeVoice = W[fam] || W.dust;
    // MENU MODE is a different TRACK, not just a mood swap: the lobby plays an
    // ambient pad/bell piece with no percussion (see _menuStep); gameplay keeps
    // the dusty pulse. Selecting the menu biome flips the whole arrangement.
    this.menuMode = (fam === 'menu');
    this._musicTempo = this.menuMode ? 0.30 : ((this.musicBoss ? 0.15 : 0.19) / b.tempo);
    if (this.musicPlaying) this._retuneDrone();
  }

  // ── COMBAT INTENSITY ── 0 = cleared/desolate (sparse, lonely), 1 = full room
  // mid-fight (denser melody + percussion ticks). Smoothed by the caller.
  setIntensity(v) {
    v = Math.max(0, Math.min(1, v));
    if (Math.abs((this.intensity || 0) - v) < 0.001) return;
    this.intensity = v;
  }

  // ── CLEAR STINGER ── a two-note resolve when a room clears: tension answered
  // by relief. Uses the score's own lead voice so it sits IN the track.
  playStinger() {
    try {
      const ctx = this.audioContext; if (!ctx || !this.musicPlaying) return;
      const semi = this.biomeSemi || 0;
      const root = 110 * Math.pow(2, semi / 12);
      const t = ctx.currentTime + 0.01;
      this._lead(root * 2, t, 0.30, 'triangle', 0.14);
      this._lead(root * 3, t + 0.13, 0.42, 'triangle', 0.12);
    } catch (err) {}
  }

  // ── SECRET NEAR ── a faint, high shimmer layered into the music while the
  // player is in a room that hides a secret entrance. Deliberately subtle: you
  // should FEEL "something is hidden here" more than consciously hear it.
  setSecretHint(on) {
    on = !!on;
    if (on === this._secretOn) return;
    this._secretOn = on;
    try {
      const ctx = this.getContext();
      if (!ctx || !ctx.createGain || !this.musicBus) return;
    if (on) {
      const g = ctx.createGain(); g.gain.value = 0.0001; g.connect(this.musicBus);
      const base = 880 * Math.pow(2, (this.biomeSemi || 0) / 12);
      const oscs = [base, base * 1.007, base * 1.5].map(f => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        o.connect(g); o.start(); return o;
      });
      // slow amplitude pulse so it shimmers rather than sits as a plain chord
      const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.33;
      const lg = ctx.createGain(); lg.gain.value = 0.010;
      lfo.connect(lg); lg.connect(g.gain); lfo.start();
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.018, ctx.currentTime + 1.6);
      this._secretLayer = { oscs, lfo, g };
      if (this._drone) this._drone.lp.frequency.setTargetAtTime(this.musicBoss ? 460 : 380, ctx.currentTime, 1.2); // drone brightens a touch
    } else {
      const s = this._secretLayer; this._secretLayer = null;
      if (s) {
        const now = ctx.currentTime;
        s.g.gain.cancelScheduledValues(now);
        s.g.gain.setValueAtTime(Math.max(0.0001, s.g.gain.value), now);
        s.g.gain.linearRampToValueAtTime(0.0001, now + 0.9);
        const stop = now + 1.0;
        try { s.oscs.forEach(o => o.stop(stop)); s.lfo.stop(stop); } catch (e) {}
      }
      if (!this.musicBoss && this._drone) this._drone.lp.frequency.setTargetAtTime(300, ctx.currentTime, 1.2);
    }
    } catch (err) { console.warn('[Audio] setSecretHint failed', err); this._secretLayer = null; }
  }

  // ── DRONE BED ── a low, detuned, slowly-breathing hum that is the desolate
  // wasteland's floor. Runs continuously while music plays, under everything.
  _startDrone() {
    const ctx = this.audioContext; if (!ctx || this._drone) return;
    const root = 55 * Math.pow(2, (this.biomeSemi || 0) / 12); // A1, shifted by biome
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300; lp.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    lp.connect(g); g.connect(this.musicBus);
    const oscs = [root, root * 1.005, root * 1.5].map((f, i) => {
      const o = ctx.createOscillator(); o.type = i === 2 ? 'triangle' : 'sawtooth'; o.frequency.value = f;
      o.connect(lp); o.start(); return o;
    });
    // slow filter sweep for a breathing feel
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.05;
    const lfoG = ctx.createGain(); lfoG.gain.value = 80;
    lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.16, now + 3);
    this._drone = { oscs, lfo, lfoG, lp, g };
  }
  _retuneDrone() {
    if (!this._drone) return;
    const now = this.audioContext.currentTime;
    // Slide the drone to the current biome's pitch...
    const rf = 55 * Math.pow(2, (this.biomeSemi || 0) / 12), freqs = [rf, rf * 1.005, rf * 1.5];
    this._drone.oscs.forEach((o, i) => { try { o.frequency.setTargetAtTime(freqs[i], now, 1.0); } catch (e) {} });
    // ...and set its character: boss = bright/tense, menu = barely-there hum,
    // exploration = dark and low.
    this._drone.lp.frequency.setTargetAtTime(this.musicBoss ? 460 : (this.menuMode ? 250 : 300), now, 1.2);
    this._drone.g.gain.setTargetAtTime(this.musicBoss ? 0.2 : (this.menuMode ? 0.08 : 0.16), now, 1.2);
  }
  _stopDrone() {
    const d = this._drone; if (!d) return; this._drone = null;
    const now = this.audioContext.currentTime;
    d.g.gain.cancelScheduledValues(now);
    d.g.gain.setValueAtTime(Math.max(0.0001, d.g.gain.value), now);
    d.g.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    const stop = now + 1.3;
    try { d.oscs.forEach(o => o.stop(stop)); d.lfo.stop(stop); } catch (e) {}
  }
  _musicScheduler() {
    if (!this.audioContext) return;
    const now = this.audioContext.currentTime;
    while (this._nextNoteTime < now + 0.12) {
      this._scheduleMusicStep(this._musicStep, this._nextNoteTime);
      this._nextNoteTime += this._musicTempo;
      this._musicStep = (this._musicStep + 1) % 32;
    }
  }
  _scheduleMusicStep(step, t) {
    if (this.musicMuted || this.masterVolume <= 0) return; // musicBus is silent anyway
    if (this.menuMode) { this._menuStep(step, t); return; } // lobby: ambient arrangement
    const boss = this.musicBoss;
    const inten = this.intensity || 0;                      // combat intensity 0..1
    const semi = this.biomeSemi || 0;                       // biome pitch shift
    const root = 110 * Math.pow(2, semi / 12);              // A2 lead, shifted by biome
    const scale = this.biomeScale || [0, 2, 3, 5, 7, 8, 10];// biome-specific scale
    const V = this.biomeVoice || { wave:'triangle', dur:1, detune:0 };
    // Dusty downbeat kick + a wind swell twice a bar -- but wind only in CALM
    // rooms; mid-fight the percussion takes that space instead.
    if (step === 0 || step === 16) { this._musicKick(t, boss ? 0.5 : 0.34); if (inten < 0.4) this._wind(t, boss ? 2.0 : 3.2); }
    // Boss adds a driving low pulse + off-beat kick for dread.
    if (boss) {
      if (step % 8 === 4) this._musicKick(t, 0.32);
      if (step % 4 === 0 && step !== 0 && step !== 16) {
        const b = [0, 3, 5, 3][(step / 4) % 4];
        this._lead(55 * Math.pow(2, (b + semi) / 12), t, 0.2, 'sawtooth', 0.12);
      }
    }
    // High-intensity percussion ticks: a soft noise hat on off-beats so combat
    // feels driven without ever turning into a drum loop.
    if (!boss && step % 4 === 2 && inten > 0.45) {
      try { this._clang(t, 0.03 + inten * 0.03); } catch (e) {}
    }
    // Sparse, lonely melody when calm -- denser and more insistent in combat.
    const melodySteps = boss ? [0, 4, 8, 12, 16, 20, 24, 28]
      : (inten > 0.55 ? [0, 6, 8, 14, 16, 22, 24] : [0, 8, 16, 24, 6, 22]);
    const melProb = boss ? 0.8 : (0.45 + inten * 0.4);
    if (melodySteps.includes(step) && Math.random() < melProb) {
      const deg = scale[Math.floor(Math.random() * scale.length)];
      const oct = Math.random() < 0.45 ? 2 : 1;
      const freq = root * Math.pow(2, deg / 12) * oct;
      this._lead(freq, t, (boss ? 0.3 : 0.62) * V.dur, V.wave, boss ? 0.16 : 0.12);
      if (V.detune) { // twin detuned voice (void/throne): wide, uneasy
        this._lead(freq * Math.pow(2, V.detune / 1200), t + 0.02, 1.1 * V.dur, 'sawtooth', 0.06);
      }
      if (!boss && Math.random() < 0.35) {
        const d2 = scale[Math.floor(Math.random() * scale.length)];
        this._lead(root * Math.pow(2, d2 / 12), t + 0.32, 0.5 * V.dur, V.wave, 0.08);
      }
    }
    // Distant metallic clang -- rusted debris echoing across the waste.
    if (Math.random() < (boss ? 0.06 : 0.028)) this._clang(t, boss ? 0.09 : 0.06);
  }
  _lead(freq, t, dur, type, v) {
    const ctx = this.audioContext;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    osc.connect(g); g.connect(this.musicBus);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + Math.min(0.12, dur * 0.25));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  _musicKick(t, v) {
    const ctx = this.audioContext;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(105, t);
    osc.frequency.exponentialRampToValueAtTime(36, t + 0.14);
    osc.connect(g); g.connect(this.musicBus);
    g.gain.setValueAtTime(Math.max(0.0002, v), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.start(t); osc.stop(t + 0.2);
  }
  _wind(t, dur) {
    const ctx = this.audioContext;
    const src = ctx.createBufferSource(); src.buffer = this._noiseBuf(); src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.7;
    const g = ctx.createGain();
    src.connect(bp); bp.connect(g); g.connect(this.musicBus);
    bp.frequency.setValueAtTime(420, t);
    bp.frequency.linearRampToValueAtTime(1000, t + dur * 0.5);
    bp.frequency.linearRampToValueAtTime(480, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.start(t); src.stop(t + dur + 0.1);
  }
  _clang(t, v) {
    const ctx = this.audioContext;
    const osc = ctx.createOscillator(), g = ctx.createGain(), bp = ctx.createBiquadFilter();
    osc.type = 'square'; osc.frequency.setValueAtTime(200 + Math.random() * 160, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.4);
    bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 7;
    osc.connect(bp); bp.connect(g); g.connect(this.musicBus);
    g.gain.setValueAtTime(Math.max(0.0002, v), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    osc.start(t); osc.stop(t + 0.6);
  }
  /* ─── MENU ARRANGEMENT ─── a slow ambient piece: two alternating chord pads
     under a sparse bell melody, no drums. Shares the biome's pitch world so it
     still feels like the same wasteland - just quiet enough to think in.
     setMenuMood() nudges the voicing per screen (home/select/market/codex). */
  setMenuMood(mood) {
    const map = { home: 0, select: 1, market: 2, codex: 3 };
    this.menuVar = map[mood] || 0;
  }
  _menuStep(step, t) {
    const semi = this.biomeSemi || 0;
    const scale = this.biomeScale || [0, 2, 3, 5, 7, 9, 10];
    // chord pad: one per 16 steps, alternating voicings - progression varies
    // subtly per screen so each menu has its own shade of calm.
    const PROGS = [
      [[0, 3, 7], [-3, 0, 4]],   // home
      [[0, 4, 7], [-1, 2, 5]],   // character select - a little brighter
      [[-5, 0, 3], [2, 5, 8]],   // black market - darker
      [[0, 2, 7], [3, 7, 10]],   // codex - suspended, airy
    ];
    const prog = PROGS[(this.menuVar || 0) % PROGS.length];
    if (step % 16 === 0) {
      const ci = Math.floor(step / 16) % 2;
      const dur = 16 * this._musicTempo;
      prog[ci].forEach(d => this._pad(110 * Math.pow(2, (semi + d) / 12), t, dur));
    }
    // sparse bell melody - long decays, lots of silence between notes
    const bellP = (this.menuVar === 2 ? 0.62 : 0.5);
    if ((step === 4 || step === 11 || step === 19 || step === 26) && Math.random() < bellP) {
      const d2 = scale[Math.floor(Math.random() * scale.length)];
      this._lead(220 * Math.pow(2, (semi + d2) / 12) * 2, t, 1.6, 'sine', 0.05);
      if (Math.random() < 0.35) this._lead(220 * Math.pow(2, (semi + d2) / 12) * 3, t + 0.45, 1.2, 'sine', 0.03);
    }
    // distant wind swell to keep the air moving
    if (step === 0 && Math.random() < 0.6) this._wind(t, 4.2);
  }
  _pad(f, t, dur) {
    const ctx = this.audioContext;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 0.4;
    lp.connect(g); g.connect(this.musicBus);
    [f * 0.997, f, f * 1.004].forEach((fr, k) => {
      const o = ctx.createOscillator(); o.type = k === 2 ? 'sine' : 'triangle';
      o.frequency.value = fr; o.connect(lp); o.start(t); o.stop(t + dur + 0.5);
    });
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.045, t + Math.min(1.3, dur * 0.3));
    g.gain.setValueAtTime(0.045, t + dur * 0.72);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
  }
}

/* ═══════════════════════════════════════════════════════════
   SCREEN SHAKE, Haptic feedback via CSS transforms
   ═══════════════════════════════════════════════════════════ */

class ScreenShake {
  static shake(element = document.body, intensity = 5, duration = 200) {
    const startTime = Date.now();
    const originalTransform = element.style.transform;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      if (progress < 1) {
        const shakeX = (Math.random() - 0.5) * intensity * (1 - progress);
        const shakeY = (Math.random() - 0.5) * intensity * (1 - progress);
        element.style.transform = `translate(${shakeX}px, ${shakeY}px)`;
        requestAnimationFrame(animate);
      } else {
        element.style.transform = originalTransform;
      }
    };

    animate();
  }

  static pulse(element, scale = 1.1, duration = 300) {
    const keyframes = [
      { transform: 'scale(1)' },
      { transform: `scale(${scale})` },
      { transform: 'scale(1)' }
    ];
    element.animate(keyframes, {
      duration,
      easing: 'ease-out'
    });
  }
}

/* ═══════════════════════════════════════════════════════════
   PARTICLE SYSTEM, Burst effects, confetti, sparkles
   ═══════════════════════════════════════════════════════════ */

class ParticleSystem {
  static burst(x, y, emoji = '✨', count = 8) {
    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.textContent = emoji;
      particle.style.position = 'fixed';
      particle.style.left = x + 'px';
      particle.style.top = y + 'px';
      particle.style.pointerEvents = 'none';
      particle.style.fontSize = '1.5rem';
      particle.style.zIndex = '9999';

      const angle = (i / count) * Math.PI * 2;
      const velocity = 4 + Math.random() * 3;
      const tx = Math.cos(angle) * velocity * 60;
      const ty = Math.sin(angle) * velocity * 60 - 30;

      particle.animate(
        [
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          { transform: `translate(${tx}px, ${ty}px) scale(0.3)`, opacity: 0 }
        ],
        {
          duration: 800,
          easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        }
      );

      document.body.appendChild(particle);
      setTimeout(() => particle.remove(), 800);
    }
  }

  static confetti(x, y, count = 12) {
    const emojis = ['🎉', '⭐', '✨', '🎊', '💫'];
    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      particle.style.position = 'fixed';
      particle.style.left = x + 'px';
      particle.style.top = y + 'px';
      particle.style.pointerEvents = 'none';
      particle.style.fontSize = '1.2rem';
      particle.style.zIndex = '9999';

      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 5;
      const tx = Math.cos(angle) * speed * 80;
      const ty = Math.sin(angle) * speed * 80 - 50;

      particle.animate(
        [
          { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1 },
          { transform: `translate(${tx}px, ${ty}px) rotate(360deg) scale(0)`, opacity: 0 }
        ],
        {
          duration: 1200,
          easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        }
      );

      document.body.appendChild(particle);
      setTimeout(() => particle.remove(), 1200);
    }
  }

  static sparkle(element, count = 6) {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.textContent = '✨';
      particle.style.position = 'fixed';
      particle.style.left = x + 'px';
      particle.style.top = y + 'px';
      particle.style.pointerEvents = 'none';
      particle.style.fontSize = '1rem';
      particle.style.zIndex = '9999';

      const angle = (i / count) * Math.PI * 2;
      const tx = Math.cos(angle) * 60;
      const ty = Math.sin(angle) * 60;

      particle.animate(
        [
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          { transform: `translate(${tx}px, ${ty}px) scale(0.1)`, opacity: 0 }
        ],
        {
          duration: 600,
          easing: 'ease-out'
        }
      );

      document.body.appendChild(particle);
      setTimeout(() => particle.remove(), 600);
    }
  }
}

/* ─── Export for use ─── */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AudioEffects, ScreenShake, ParticleSystem };
}
