/**
 * stats.js - Client-side player analytics and certificate generator.
 * All data stays in localStorage. No external calls.
 */
import { GameState } from './state.js';

const STATS_KEY = 'jvds_stats_v1';

/* ═══════════════════════════════════════════════
   STATS TRACKER
═══════════════════════════════════════════════ */

function defaultStats() {
  return {
    totalLinesWritten: 0,
    totalRunsAttempted: 0,
    questsCleared: 0,
    streakMilestones: [],   // [3, 7, 14, 30]
    speedrunTimes: {},      // { nodeId: ms }
    sessionStart: null,
    tracksCompleted: [],
  };
}

export const PlayerStats = {
  get() {
    try {
      const raw = localStorage.getItem(STATS_KEY);
      return raw ? { ...defaultStats(), ...JSON.parse(raw) } : defaultStats();
    } catch { return defaultStats(); }
  },

  save(stats) {
    try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch {}
  },

  /** Call once when the player opens workspace.html */
  startSession() {
    const s = this.get();
    s.sessionStart = Date.now();
    this.save(s);
  },

  /** Call on every editor keydown (debounced externally if needed) */
  recordLine() {
    const s = this.get();
    s.totalLinesWritten = (s.totalLinesWritten ?? 0) + 1;
    this.save(s);
  },

  /** Call every time the Run button is pressed */
  recordRun() {
    const s = this.get();
    s.totalRunsAttempted = (s.totalRunsAttempted ?? 0) + 1;
    this.save(s);
  },

  /** Call when a quest is completed for the first time */
  recordQuestCleared(nodeId) {
    const s = this.get();
    s.questsCleared = (s.questsCleared ?? 0) + 1;
    // Record speedrun time (ms since session start)
    if (s.sessionStart && !s.speedrunTimes[nodeId]) {
      s.speedrunTimes[nodeId] = Date.now() - s.sessionStart;
    }
    this.save(s);
  },

  /** Call after updateStreak; saves milestone badge if newly crossed */
  checkStreakMilestone(currentStreak) {
    const MILESTONES = [3, 7, 14, 30, 100];
    const s = this.get();
    let hit = null;
    for (const m of MILESTONES) {
      if (currentStreak >= m && !s.streakMilestones.includes(m)) {
        s.streakMilestones.push(m);
        hit = m;
      }
    }
    if (hit !== null) this.save(s);
    return hit; // returns the newly crossed milestone (or null)
  },

  recordTrackCompleted(trackId) {
    const s = this.get();
    if (!s.tracksCompleted.includes(trackId)) {
      s.tracksCompleted.push(trackId);
      this.save(s);
    }
  },

  formatTime(ms) {
    if (!ms) return '--';
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  },
};

/* ═══════════════════════════════════════════════
   CERTIFICATE GENERATOR
═══════════════════════════════════════════════ */

/**
 * Draw and download a completion certificate.
 * @param {{ playerName: string, trackTitle: string, mascotAvatar: string, mascotName: string, date?: string }} opts
 */
export function generateCertificate({ playerName, trackTitle, mascotAvatar, mascotName, date }) {
  const W = 900, H = 620;
  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, W, H);

  // Outer border
  ctx.strokeStyle = '#70A3A7';
  ctx.lineWidth = 6;
  ctx.strokeRect(18, 18, W - 36, H - 36);

  // Inner border
  ctx.strokeStyle = '#403B33';
  ctx.lineWidth = 2;
  ctx.strokeRect(28, 28, W - 56, H - 56);

  // Corner decorations
  const corners = [[40, 40], [W - 40, 40], [40, H - 40], [W - 40, H - 40]];
  ctx.fillStyle = '#70A3A7';
  corners.forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
  });

  // Mascot avatar (large, centered top area)
  ctx.font = '80px serif';
  ctx.textAlign = 'center';
  ctx.fillText(mascotAvatar ?? '✨', W / 2, 155);

  // Title
  ctx.font = 'bold 14px "Trebuchet MS", sans-serif';
  ctx.fillStyle = '#70A3A7';
  ctx.letterSpacing = '0.2em';
  ctx.fillText('CERTIFICATE OF COMPLETION', W / 2, 200);

  // Player name
  ctx.font = 'bold 48px Georgia, serif';
  ctx.fillStyle = '#F0EAD6';
  ctx.fillText(playerName || 'Adventurer', W / 2, 280);

  // Divider
  ctx.strokeStyle = '#403B33';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(150, 300); ctx.lineTo(W - 150, 300);
  ctx.stroke();

  // Body text
  ctx.font = '18px Georgia, serif';
  ctx.fillStyle = '#b0a898';
  ctx.fillText('has successfully completed the full quest track', W / 2, 340);

  // Track name
  ctx.font = 'bold 26px Georgia, serif';
  ctx.fillStyle = '#F0EAD6';
  ctx.fillText(trackTitle || 'Learning Track', W / 2, 388);

  // Mascot sign-off
  ctx.font = '16px "Trebuchet MS", sans-serif';
  ctx.fillStyle = '#70A3A7';
  ctx.fillText(`Approved by ${mascotAvatar ?? ''} ${mascotName || 'Your Guide'}`, W / 2, 448);

  // Date
  const certDate = date ?? new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
  ctx.font = '14px "Trebuchet MS", sans-serif';
  ctx.fillStyle = '#524c42';
  ctx.fillText(certDate, W / 2, 490);

  // JVDesignStudio watermark
  ctx.font = 'bold 12px "Trebuchet MS", sans-serif';
  ctx.fillStyle = '#403B33';
  ctx.fillText('JVDesignStudio', W / 2, 555);

  // Trigger download
  const link = document.createElement('a');
  link.download = `jvds-certificate-${(trackTitle || 'track').replace(/\s+/g, '-').toLowerCase()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

/**
 * Show a track-completion popup with a certificate download button.
 * Call after recording the final node of a track.
 */
export function showTrackCompletionPopup({ trackTitle, mascotAvatar, mascotName, storefront }) {
  document.getElementById('jvds-track-popup')?.remove();

  const popup = document.createElement('div');
  popup.id = 'jvds-track-popup';
  popup.style.cssText = `
    position:fixed;inset:0;z-index:12000;
    display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,.75);backdrop-filter:blur(4px);
  `;

  const storefrontLinks = (storefront ?? []).map(s =>
    `<a href="${s.url}" target="_blank" rel="noopener noreferrer" style="
      display:inline-block;padding:.45rem 1.1rem;border-radius:6px;
      background:#242424;border:1px solid #403B33;color:#F0EAD6;
      font-size:.82rem;text-decoration:none;transition:border-color .15s;
    " onmouseover="this.style.borderColor='#70A3A7'" onmouseout="this.style.borderColor='#403B33'">
      ${s.label}
    </a>`
  ).join('');

  popup.innerHTML = `
    <div style="
      background:#1a1a1a;border:1px solid #70A3A7;border-radius:14px;
      padding:2.5rem;max-width:480px;text-align:center;
      font-family:var(--font-body,sans-serif);color:#F0EAD6;
    ">
      <div style="font-size:4rem;margin-bottom:.5rem">${mascotAvatar ?? '✨'}</div>
      <h2 style="font-family:var(--font-heading,'Fredoka'),sans-serif;font-size:1.8rem;color:#F0EAD6;margin:0 0 .5rem">
        Track Complete!
      </h2>
      <p style="color:#70A3A7;font-size:.9rem;margin:0 0 1.5rem">
        You finished <strong>${trackTitle}</strong>. That's a real achievement.
      </p>
      <button id="cert-download-btn" style="
        background:#70A3A7;color:#000;border:none;border-radius:8px;
        padding:.65rem 1.5rem;font-size:.9rem;font-weight:700;cursor:pointer;
        font-family:inherit;margin-bottom:1rem;display:block;width:100%;
      ">🎓 Download Certificate</button>
      ${storefrontLinks ? `
        <p style="font-size:.75rem;color:#524c42;margin:.75rem 0 .5rem">Check out more from JVDesignStudio:</p>
        <div style="display:flex;flex-wrap:wrap;gap:.4rem;justify-content:center">
          ${storefrontLinks}
        </div>` : ''}
      <button id="popup-close-btn" style="
        background:none;border:none;color:#524c42;font-size:.8rem;
        cursor:pointer;margin-top:1rem;font-family:inherit;
      ">Close</button>
    </div>`;

  document.body.appendChild(popup);

  document.getElementById('cert-download-btn').onclick = () => {
    const state = GameState.get();
    generateCertificate({
      playerName: state.playerName ?? 'Adventurer',
      trackTitle,
      mascotAvatar,
      mascotName,
    });
  };
  document.getElementById('popup-close-btn').onclick = () => popup.remove();
  popup.addEventListener('click', e => { if (e.target === popup) popup.remove(); });
}
