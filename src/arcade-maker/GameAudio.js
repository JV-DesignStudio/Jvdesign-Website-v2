// GameAudio.js — extracted from tools/arcade-game-maker.html for Vite module split.
// This is the complete audio engine: Web Audio API SFX synthesis, music, and buffers.
// Import: import { GameAudio } from './GameAudio.js';

const GameAudio = {
    ctx: null, volume: 0.5, sfxEnabled: true,
    sfxVol: 1.0, musicVol: 0.6,
    sounds: { shoot:'laser', jump:'boing', hit:'boom', score:'coin', levelup:'fanfare', death:'lose', powerup:'powerup', victory:'victory' },
    customBuffers: { shoot:null, jump:null, hit:null, score:null, levelup:null, death:null, powerup:null, victory:null },
    musicNodes: [], musicTimeout: null, musicStep: 0,
    customMusic: null, _musicSource: null,

    getCtx() {
        if (!this.ctx) this.ctx = new (window.AudioContext||window.webkitAudioContext)();
        if (this.ctx.state==='suspended') this.ctx.resume();
        return this.ctx;
    },

    play(event) {
        if (!this.sfxEnabled) return;
        const s = this.sounds[event];
        if (s === 'off') return;
        if (this.customBuffers[event]) { this._playBuffer(this.customBuffers[event]); return; }
        const fn = this['_snd_' + s];
        if (fn) fn.call(this);
    },

    previewSlot(event) {
        const saved = this.sfxEnabled;
        this.sfxEnabled = true;
        this.play(event);
        this.sfxEnabled = saved;
    },

    setVolume(v) {
        this.volume = Math.max(0, Math.min(1, Number(v) || 0));
    },

    _osc(type, freq0, freq1, dur, vol) {
        const ac = this.getCtx(), t = ac.currentTime + 0.01;
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = window._soundPackType || type;
        const _pitchVariance = window._sfxPitchVariance || 0;
        const _randomDetune = _pitchVariance > 0 ? (Math.random() * 2 - 1) * _pitchVariance * 100 : 0;
        o.detune.value = (window._soundPackDetune || 0) + _randomDetune;
        o.connect(g); g.connect(ac.destination);
        o.frequency.setValueAtTime(freq0, t);
        if (freq1) o.frequency.exponentialRampToValueAtTime(freq1, t + dur * 0.8);
        g.gain.setValueAtTime(this.volume * this.sfxVol * vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.start(t); o.stop(t + dur + 0.02);
    },

    _noise(dur, vol) {
        const ac = this.getCtx(), t = ac.currentTime + 0.01;
        const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        const src = ac.createBufferSource(), g = ac.createGain();
        src.buffer = buf; src.connect(g); g.connect(ac.destination);
        g.gain.setValueAtTime(this.volume * this.sfxVol * vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        src.start(t);
    },

    _snd_laser()  { this._osc('sawtooth', 880, 110, 0.13, 0.25); },
    _snd_plasma() { this._osc('square', 440, 55, 0.18, 0.2); },
    _snd_zap() {
        const ac = this.getCtx(), t = ac.currentTime + 0.01;
        [800,600,400].forEach((f,i) => {
            const o = ac.createOscillator(), g = ac.createGain();
            o.type = 'square'; o.connect(g); g.connect(ac.destination);
            o.frequency.value = f;
            const st = t + i * 0.03;
            g.gain.setValueAtTime((this.volume * this.sfxVol) * 0.15, st);
            g.gain.exponentialRampToValueAtTime(0.001, st + 0.05);
            o.start(st); o.stop(st + 0.07);
        });
    },
    _snd_pop() { this._osc('sine', 600, 200, 0.07, 0.3); },
    _snd_boing()  { this._osc('sine', 220, 550, 0.22, 0.3); },
    _snd_spring() { this._osc('triangle', 300, 700, 0.15, 0.28); },
    _snd_rocket() { this._osc('sawtooth', 150, 600, 0.2, 0.22); },
    _snd_float()  { this._osc('sine', 400, 600, 0.3, 0.18); },
    _snd_boom()   { this._noise(0.25, 0.4); this._osc('sine', 80, 20, 0.25, 0.3); },
    _snd_crunch() { this._noise(0.12, 0.35); },
    _snd_buzz()   { this._osc('square', 220, 80, 0.2, 0.3); },
    _snd_coin() {
        const ac = this.getCtx(), t = ac.currentTime + 0.01;
        [523, 784].forEach((f, i) => {
            const o = ac.createOscillator(), g = ac.createGain();
            o.connect(g); g.connect(ac.destination);
            o.frequency.value = f;
            const st = t + i * 0.07;
            g.gain.setValueAtTime((this.volume * this.sfxVol) * 0.22, st);
            g.gain.exponentialRampToValueAtTime(0.001, st + 0.12);
            o.start(st); o.stop(st + 0.14);
        });
    },
    _snd_ding() { this._osc('sine', 880, 880, 0.15, 0.25); },
    _snd_chime() {
        const ac = this.getCtx(), t = ac.currentTime + 0.01;
        [523, 659, 784, 1047].forEach((f, i) => {
            const o = ac.createOscillator(), g = ac.createGain();
            o.connect(g); g.connect(ac.destination);
            o.frequency.value = f;
            const st = t + i * 0.055;
            g.gain.setValueAtTime((this.volume * this.sfxVol) * 0.18, st);
            g.gain.exponentialRampToValueAtTime(0.001, st + 0.14);
            o.start(st); o.stop(st + 0.16);
        });
    },
    _snd_fanfare() {
        const _pick = Math.floor(Math.random() * 3);
        if (_pick === 1) { this._snd_fanfare_b(); return; }
        if (_pick === 2) { this._snd_fanfare_c(); return; }
        const ac = this.getCtx(), t = ac.currentTime + 0.01;
        [523,659,784,1047].forEach((f,i) => {
            const o = ac.createOscillator(), g = ac.createGain();
            o.type = window._soundPackType||'square'; o.detune.value=window._soundPackDetune||0;
            o.connect(g); g.connect(ac.destination);
            o.frequency.value = f;
            const st = t + i * 0.09;
            g.gain.setValueAtTime((this.volume * this.sfxVol)*0.22, st);
            g.gain.exponentialRampToValueAtTime(0.001, st+0.22);
            o.start(st); o.stop(st+0.25);
        });
    },
    _snd_fanfare_b() {
        const ac = this.getCtx(), t = ac.currentTime + 0.01;
        [392,494,587,784,988].forEach((f,i) => {
            const o = ac.createOscillator(), g = ac.createGain();
            o.type = window._soundPackType||'triangle'; o.detune.value=window._soundPackDetune||0;
            o.connect(g); g.connect(ac.destination);
            o.frequency.value = f;
            const st = t + i * 0.08;
            g.gain.setValueAtTime((this.volume * this.sfxVol)*0.2, st);
            g.gain.exponentialRampToValueAtTime(0.001, st+0.18);
            o.start(st); o.stop(st+0.2);
        });
    },
    _snd_fanfare_c() {
        const ac = this.getCtx(), t = ac.currentTime + 0.01;
        [[440,554,659],[554,659,880]].forEach(([f1,f2,f3],i) => {
            [f1,f2,f3].forEach(f => {
                const o = ac.createOscillator(), g = ac.createGain();
                o.type = window._soundPackType||'sine'; o.detune.value=window._soundPackDetune||0;
                o.connect(g); g.connect(ac.destination); o.frequency.value = f;
                const st = t + i * 0.25;
                g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime((this.volume * this.sfxVol)*0.14, st+0.06);
                g.gain.exponentialRampToValueAtTime(0.001, st+0.45);
                o.start(st); o.stop(st+0.5);
            });
        });
    },
    _snd_jingle() { this._osc('square', 784, 1568, 0.35, 0.2); },
    _snd_ascend() {
        const ac = this.getCtx(), t = ac.currentTime + 0.01;
        [330,392,494,659].forEach((f,i) => {
            const o = ac.createOscillator(), g = ac.createGain();
            o.type = window._soundPackType||'square'; o.detune.value=window._soundPackDetune||0;
            o.connect(g); g.connect(ac.destination);
            o.frequency.value = f;
            const st = t + i*0.07;
            g.gain.setValueAtTime((this.volume * this.sfxVol)*0.2, st);
            g.gain.exponentialRampToValueAtTime(0.001, st+0.18);
            o.start(st); o.stop(st+0.2);
        });
    },
    _snd_lose() {
        const ac = this.getCtx(), t = ac.currentTime + 0.01;
        [440,350,280,220].forEach((f,i) => {
            const o = ac.createOscillator(), g = ac.createGain();
            o.type = window._soundPackType||'sawtooth'; o.detune.value=window._soundPackDetune||0;
            o.connect(g); g.connect(ac.destination);
            o.frequency.value = f;
            const st = t + i*0.1;
            g.gain.setValueAtTime((this.volume * this.sfxVol)*0.2, st);
            g.gain.exponentialRampToValueAtTime(0.001, st+0.18);
            o.start(st); o.stop(st+0.22);
        });
    },
    _snd_wah()   { this._osc('sawtooth', 300, 100, 0.5, 0.25); },
    _snd_splat() { this._noise(0.35, 0.4); this._osc('sine', 100, 40, 0.4, 0.2); },
    _snd_powerup() {
        const ac = this.getCtx(), t = ac.currentTime + 0.01;
        [392,523,659,784].forEach((f,i) => {
            const o = ac.createOscillator(), g = ac.createGain();
            o.type = window._soundPackType||'triangle'; o.detune.value=window._soundPackDetune||0;
            o.connect(g); g.connect(ac.destination);
            o.frequency.value = f;
            const st = t + i*0.065;
            g.gain.setValueAtTime((this.volume * this.sfxVol)*0.2, st);
            g.gain.exponentialRampToValueAtTime(0.001, st+0.15);
            o.start(st); o.stop(st+0.18);
        });
    },
    _snd_sparkle() { this._osc('sine', 1200, 2400, 0.18, 0.18); },
    _snd_shield()  { this._osc('triangle', 500, 800, 0.22, 0.2); },
    _snd_victory() {
        const ac = this.getCtx(), t = ac.currentTime + 0.01;
        [523,659,784,880,1047].forEach((f,i) => {
            const o = ac.createOscillator(), g = ac.createGain();
            o.type = window._soundPackType||'square'; o.detune.value=window._soundPackDetune||0;
            o.connect(g); g.connect(ac.destination);
            o.frequency.value = f;
            const st = t + i*0.1;
            g.gain.setValueAtTime((this.volume * this.sfxVol)*0.22, st);
            g.gain.exponentialRampToValueAtTime(0.001, st+0.25);
            o.start(st); o.stop(st+0.28);
        });
    },
    _snd_tada()    { this._osc('square', 784, 1568, 0.4, 0.28); },
    _snd_triumph() {
        const ac = this.getCtx(), t = ac.currentTime + 0.01;
        [392,494,587,784,987].forEach((f,i) => {
            const o = ac.createOscillator(), g = ac.createGain();
            o.type = window._soundPackType||'square'; o.detune.value=window._soundPackDetune||0;
            o.connect(g); g.connect(ac.destination);
            o.frequency.value = f;
            const st = t + i*0.08;
            g.gain.setValueAtTime((this.volume * this.sfxVol)*0.2, st);
            g.gain.exponentialRampToValueAtTime(0.001, st+0.22);
            o.start(st); o.stop(st+0.24);
        });
    },

    _playBuffer(dataUrl) {
        const ac = this.getCtx();
        const _decode = (ab) => {
            ac.decodeAudioData(ab).then(buf => {
                const src = ac.createBufferSource(), g = ac.createGain();
                src.buffer = buf; src.connect(g); g.connect(ac.destination);
                g.gain.value = (this.volume * this.sfxVol); src.start();
            }).catch(() => {});
        };
        if (typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
            try {
                const b64  = dataUrl.split(',')[1];
                const bin  = atob(b64);
                const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                _decode(bytes.buffer);
            } catch(e) {}
        } else {
            fetch(dataUrl).then(r => r.arrayBuffer()).then(_decode).catch(() => {});
        }
    },

    setMusic(on) {
        if (on) this.startMusic(document.getElementById('musicStyle').value);
        else this.stopMusic();
    },

    startMusic(style) {
        this.stopMusic();
        if (this.customMusic) { this._playCustomMusic(); return; }
        const ac = this.getCtx();
        const patterns = {
            chiptune: { notes:[262,294,330,349,392,440,494,523], bpm:160, seq:[0,2,4,2,0,2,4,5,0,2,4,2,5,4,2,0] },
            space:    { notes:[110,138,165,184,220,277,330,369], bpm:60,  seq:[0,null,null,2,null,null,4,null,null,1,null,null,3,null,null,null] },
            action:   { notes:[330,370,415,440,494,554,622,660], bpm:200, seq:[0,4,2,5,1,4,3,5,0,4,2,5,3,2,1,0] }
        };
        const p = patterns[style] || patterns.chiptune;
        const interval = (60 / p.bpm) * 1000 / 2;
        let step = 0;
        const tick = () => {
            const ni = p.seq[step % p.seq.length];
            if (ni !== null && ni !== undefined) {
                const o = ac.createOscillator(), g = ac.createGain();
                o.type = style === 'space' ? 'sine' : 'square';
                o.connect(g); g.connect(ac.destination);
                o.frequency.value = p.notes[ni];
                const t = ac.currentTime;
                g.gain.setValueAtTime((this.volume * this.musicVol) * 0.08, t);
                g.gain.exponentialRampToValueAtTime(0.001, t + interval / 1000 * 0.9);
                o.start(t); o.stop(t + interval / 1000);
            }
            step++;
            this.musicTimeout = setTimeout(tick, interval);
        };
        tick();
    },

    stopMusic() {
        if (this.musicTimeout) clearTimeout(this.musicTimeout);
        this.musicTimeout = null;
        if (this._musicSource) { try { this._musicSource.stop(); } catch(e) {} this._musicSource = null; }
    },

    _playCustomMusic() {
        const ac = this.getCtx();
        const _start = (buf) => {
            if (this._musicSource) { try { this._musicSource.stop(); } catch(e) {} }
            const src = ac.createBufferSource(), g = ac.createGain();
            src.buffer = buf; src.loop = true;
            src.connect(g); g.connect(ac.destination);
            g.gain.value = this.volume * this.musicVol * 0.5;
            src.start(); this._musicSource = src;
        };
        const url = this.customMusic;
        if (typeof url === 'string' && url.startsWith('data:')) {
            try {
                const b64  = url.split(',')[1];
                const bin  = atob(b64);
                const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                ac.decodeAudioData(bytes.buffer).then(_start).catch(() => {});
            } catch(e) {}
        } else {
            fetch(url).then(r => r.arrayBuffer()).then(ab => ac.decodeAudioData(ab)).then(_start).catch(() => {});
        }
    },

    previewMusic() {
        const wasOn = document.getElementById('musicToggle')?.checked || false;
        if (!wasOn) {
            const style = document.getElementById('musicStyle')?.value || 'chiptune';
            this.startMusic(style);
            setTimeout(() => { if (!wasOn) this.stopMusic(); }, 3000);
        } else {
            window.showToast && showToast('Music is already playing!');
        }
    }
};

export { GameAudio };
export default GameAudio;
