/* ═══════════════════════════════════════════════════════════
   Audio & Visual Effects Engine — Sound, Shake, Particles
   ═══════════════════════════════════════════════════════════ */

class AudioEffects {
  constructor(masterVolume = 0.7) {
    this.audioContext = null;
    this.masterVolume = masterVolume;
    this.initAudioContext();
  }

  initAudioContext() {
    if (!this.audioContext) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContext();
      } catch (e) {
        console.warn('Web Audio API not supported');
      }
    }
  }

  /* ─── SOUND EFFECTS USING WEB AUDIO API ─── */
  playTap(pitch = 800) {
    if (!this.audioContext) return;
    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    osc.frequency.value = pitch;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3 * this.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playSuccess(pitch = 1200) {
    if (!this.audioContext) return;
    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 1.5, now + 0.15);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.4 * this.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playLevelUp() {
    if (!this.audioContext) return;
    const now = this.audioContext.currentTime;
    const notes = [800, 1000, 1200, 1400];
    notes.forEach((pitch, i) => {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      osc.connect(gain);
      gain.connect(this.audioContext.destination);
      osc.frequency.value = pitch;
      osc.type = 'sine';
      const startTime = now + (i * 0.08);
      gain.gain.setValueAtTime(0.3 * this.masterVolume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);
      osc.start(startTime);
      osc.stop(startTime + 0.15);
    });
  }

  playCombo(multiplier = 2) {
    if (!this.audioContext) return;
    const now = this.audioContext.currentTime;
    const pitch = 600 + (multiplier * 100);
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.8, now + 0.12);
    osc.type = 'square';
    gain.gain.setValueAtTime(0.35 * this.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playError() {
    if (!this.audioContext) return;
    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.2);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3 * this.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  playPop() {
    if (!this.audioContext) return;
    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
    osc.type = 'square';
    gain.gain.setValueAtTime(0.4 * this.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  setMasterVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }
}

/* ═══════════════════════════════════════════════════════════
   SCREEN SHAKE — Haptic feedback via CSS transforms
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
   PARTICLE SYSTEM — Burst effects, confetti, sparkles
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
