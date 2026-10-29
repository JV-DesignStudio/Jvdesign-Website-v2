/**
 * fx.js - Web Audio synthesizer and canvas particle engine.
 * No external audio files; all sounds are synthesized on the fly.
 */

const AC = window.AudioContext || window.webkitAudioContext;

export const SoundFX = {
  _ctx() {
    if (!this.__ctx && AC) {
      try { this.__ctx = new AC(); } catch { /* unsupported */ }
    }
    return this.__ctx;
  },

  _resume(ctx) {
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  },

  /** Ascending two-tone chord: E5 -> A5, sine wave, 0.15s */
  playSuccess() {
    const ctx = this._resume(this._ctx());
    if (!ctx) return;
    [[659.25, 0], [880, 0.08]].forEach(([freq, delay]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime + delay;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.start(t); o.stop(t + 0.15);
    });
  },

  /** Low sawtooth buzz: 150Hz -> 100Hz, 0.25s */
  playFailure() {
    const ctx = this._resume(this._ctx());
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.connect(g); g.connect(ctx.destination);
    o.frequency.setValueAtTime(150, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.25);
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    o.start(); o.stop(ctx.currentTime + 0.25);
  },

  /** Arpeggiated C-Major: C5, E5, G5, C6, triangle wave */
  playLevelUp() {
    const ctx = this._resume(this._ctx());
    if (!ctx) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.1;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.13, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.start(t); o.stop(t + 0.35);
    });
  },
};

export const ParticleEngine = {
  /**
   * Render a confetti burst on the canvas element with id "fx-canvas".
   * @param {number} count - number of particles (default 60)
   */
  burst(count = 60) {
    const canvas = document.getElementById('fx-canvas');
    if (!canvas) return;

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.pointerEvents = 'none';

    const ctx = canvas.getContext('2d');
    const cx  = canvas.width  / 2;
    const cy  = canvas.height * 0.35;

    const COLORS = ['#70A3A7', '#F0EAD6', '#BC4749', '#f39c12', '#403B33', '#ffffff'];

    const particles = Array.from({ length: count }, () => ({
      x:   cx + (Math.random() - 0.5) * 20,
      y:   cy,
      vx:  (Math.random() - 0.5) * 10,
      vy:  -(Math.random() * 8 + 4),
      r:   Math.random() * 5 + 3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
      alpha: 1,
      rot:  Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.2,
    }));

    let frame;
    const GRAVITY = 0.35;
    const DRAG    = 0.98;

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;

      particles.forEach(p => {
        p.vy += GRAVITY;
        p.vx *= DRAG;
        p.x  += p.vx;
        p.y  += p.vy;
        p.rot += p.spin;
        p.alpha -= 0.014;
        if (p.alpha <= 0) return;
        alive = true;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle   = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);

        if (p.shape === 'rect') {
          ctx.fillRect(-p.r, -p.r * 0.4, p.r * 2, p.r * 0.8);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      if (alive) {
        frame = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    cancelAnimationFrame(frame);
    requestAnimationFrame(tick);
  },
};
