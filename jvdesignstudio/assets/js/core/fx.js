/**
 * fx.js — Lightweight audio & particle effects.
 * Uses Web Audio API — no files needed for SFX, synthesized on the fly.
 */

const AudioContext = window.AudioContext || window.webkitAudioContext;

export const FX = {
  _ctx: null,
  _enabled: true,

  _getCtx() {
    if (!this._ctx && AudioContext) {
      try { this._ctx = new AudioContext(); } catch { /* unsupported */ }
    }
    return this._ctx;
  },

  enable(val) { this._enabled = val; },

  playSFX(type) {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const fn = this._sounds[type] ?? this._sounds.xp;
    try { fn(ctx); } catch { /* silence audio errors */ }
  },

  _sounds: {
    xp(ctx) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.setValueAtTime(880, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
      g.gain.setValueAtTime(0.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      o.start(); o.stop(ctx.currentTime + 0.25);
    },
    levelup(ctx) {
      [523, 659, 784, 1047].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        const t = ctx.currentTime + i * 0.1;
        o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.15, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        o.start(t); o.stop(t + 0.3);
      });
    },
    achievement(ctx) {
      [660, 880, 1100].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.connect(g); g.connect(ctx.destination);
        const t = ctx.currentTime + i * 0.08;
        o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        o.start(t); o.stop(t + 0.4);
      });
    },
    error(ctx) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.connect(g); g.connect(ctx.destination);
      o.frequency.setValueAtTime(220, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.2);
      g.gain.setValueAtTime(0.1, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      o.start(); o.stop(ctx.currentTime + 0.25);
    },
    pass(ctx) {
      [784, 988].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        const t = ctx.currentTime + i * 0.12;
        o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        o.start(t); o.stop(t + 0.25);
      });
    },
  },

  /* ── Confetti burst (CSS-based, no canvas) ── */
  confetti(x = window.innerWidth / 2, y = window.innerHeight / 2, count = 24) {
    const colors = ['#7c3aed','#f59e0b','#10b981','#ef4444','#60a5fa'];
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      const angle = (Math.PI * 2 * i) / count;
      const dist = 80 + Math.random() * 80;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const color = colors[Math.floor(Math.random() * colors.length)];
      Object.assign(el.style, {
        position: 'fixed',
        left: `${x}px`, top: `${y}px`,
        width: '8px', height: '8px',
        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
        background: color,
        pointerEvents: 'none',
        zIndex: 9999,
        transition: 'all 0.8s cubic-bezier(0.25,0.46,0.45,0.94)',
        transform: 'scale(1)',
        opacity: '1',
      });
      document.body.appendChild(el);
      requestAnimationFrame(() => {
        el.style.transform = `translate(${dx}px, ${dy}px) scale(0)`;
        el.style.opacity = '0';
      });
      setTimeout(() => el.remove(), 900);
    }
  },
};
