/**
 * app.js — Index page entry point.
 * Bootstraps state, renders track grid, wires HUD.
 */
import { State } from './core/state.js';
import { UI } from './core/ui.js';
import { FX } from './core/fx.js';

async function loadJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to load ${url}`);
  return r.json();
}

async function boot() {
  State.load();
  const player = State.get('player');
  UI.updateHUD(player);

  // Sound toggle
  const soundToggle = document.getElementById('sound-toggle');
  if (soundToggle) {
    const soundOn = State.get('settings.sound') ?? true;
    FX.enable(soundOn);
    soundToggle.textContent = soundOn ? '🔊' : '🔇';
    soundToggle.addEventListener('click', () => {
      const next = !FX._enabled;
      FX.enable(next);
      State.set('settings.sound', next);
      soundToggle.textContent = next ? '🔊' : '🔇';
    });
  }

  // Load tracks
  const grid = document.getElementById('track-grid');
  if (!grid) return;

  let tracks = [];
  try {
    tracks = await loadJSON('./data/tracks.json');
  } catch (e) {
    grid.innerHTML = `<p style="color:var(--color-text-muted)">Could not load tracks.</p>`;
    return;
  }

  renderTracks(tracks, grid);
}

function renderTracks(tracks, grid) {
  grid.innerHTML = '';
  tracks.forEach(track => {
    const prog = State.trackProgress(track.id);
    const total = track.lessonCount ?? 1;
    const done = prog.completed.length;
    const pct = Math.round((done / total) * 100);

    const card = document.createElement('article');
    card.className = 'card track-card';
    card.dataset.track = track.id;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Open ${track.name} track`);

    if (track.badge) {
      card.innerHTML += `<span class="track-badge ${track.badge.type}">${track.badge.label}</span>`;
    }

    card.innerHTML += `
      <div class="track-icon">${track.icon}</div>
      <h3>${track.name}</h3>
      <p>${track.description}</p>
      <div class="track-meta">
        <span>📚 ${total} lessons</span>
        <span>⚡ ${track.xpReward ?? 500} XP</span>
        ${track.difficulty ? `<span class="pill pill-purple">${track.difficulty}</span>` : ''}
      </div>
      <div class="track-progress">
        <div class="track-progress-fill" style="width:${pct}%"></div>
      </div>
      ${done > 0 ? `<div style="font-size:.75rem;color:var(--color-text-dim);margin-top:6px">${done}/${total} complete</div>` : ''}
    `;

    card.addEventListener('click', () => {
      window.location.href = `workspace.html?track=${track.id}`;
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') card.click();
    });

    grid.appendChild(card);
  });
}

boot().catch(console.error);
