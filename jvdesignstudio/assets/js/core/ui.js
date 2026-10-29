/**
 * ui.js — DOM helpers, toasts, achievement popups, HUD updates.
 */
import { FX } from './fx.js';

export const UI = {
  /* ── HUD ── */
  updateHUD(player) {
    const pct = Math.round((player.xp / player.xpToNext) * 100);
    this._setAttr('.hud-level', 'textContent', `Lv ${player.level}`);
    this._setStyle('.hud-xp-fill', 'width', `${pct}%`);
    this._setAttr('.hud-avatar', 'textContent', player.name[0]?.toUpperCase() ?? '?');
    this._setAttr('[data-streak]', 'textContent', `🔥 ${player.streak}`);
  },

  /* ── XP Toast ── */
  showXPToast(amount, label = '') {
    const el = document.createElement('div');
    el.className = 'xp-toast';
    el.innerHTML = `<span class="xp-amount">+${amount} XP</span><span>${label}</span>`;
    document.body.appendChild(el);
    FX.playSFX('xp');
    setTimeout(() => el.remove(), 3200);
  },

  /* ── Level-up Banner ── */
  showLevelUp(level) {
    const el = document.createElement('div');
    el.className = 'achievement-popup';
    el.innerHTML = `
      <div style="font-size:2rem">⬆️</div>
      <div>
        <div style="font-weight:700;font-size:1.1rem">Level Up!</div>
        <div style="color:var(--color-text-muted);font-size:.85rem">You reached Level ${level}</div>
      </div>`;
    document.body.appendChild(el);
    FX.playSFX('levelup');
    setTimeout(() => el.remove(), 4000);
  },

  /* ── Achievement Popup ── */
  showAchievement(achievement) {
    const el = document.createElement('div');
    el.className = 'achievement-popup';
    el.innerHTML = `
      <div style="font-size:2rem">${achievement.icon ?? '🏆'}</div>
      <div>
        <div style="font-weight:700;color:var(--color-rank-gold)">${achievement.name}</div>
        <div style="color:var(--color-text-muted);font-size:.8rem">${achievement.description}</div>
      </div>`;
    document.body.appendChild(el);
    FX.playSFX('achievement');
    setTimeout(() => el.remove(), 5000);
  },

  /* ── Test Result Feedback ── */
  renderTestResults(results, container) {
    if (!container) return;
    container.innerHTML = results.map(r => `
      <div class="test-result ${r.pass ? 'pass' : 'fail'}">
        <span>${r.pass ? '✅' : '❌'}</span>
        <span>${r.description}</span>
        ${r.error ? `<span class="test-error">${r.error}</span>` : ''}
      </div>`).join('');
  },

  /* ── Console Output ── */
  renderOutput(logs, error, consoleEl) {
    if (!consoleEl) return;
    const lines = logs.map(l => `<div class="output-line-ok">${this._escape(l)}</div>`);
    if (error) lines.push(`<div class="output-line-err">Error: ${this._escape(error)}</div>`);
    if (!lines.length) lines.push(`<div class="output-line-info">// No output</div>`);
    consoleEl.innerHTML = lines.join('');
  },

  /* ── Track Progress ── */
  updateTrackProgress(trackId, pct) {
    const fill = document.querySelector(`[data-track="${trackId}"] .track-progress-fill`);
    if (fill) fill.style.width = `${pct}%`;
  },

  /* ── Utility ── */
  _escape(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  },
  _setAttr(sel, attr, val) {
    const el = document.querySelector(sel);
    if (el) el[attr] = val;
  },
  _setStyle(sel, prop, val) {
    const el = document.querySelector(sel);
    if (el) el.style[prop] = val;
  },
};
