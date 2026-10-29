/**
 * app.js - Application entry point.
 * Detects page context (index.html vs workspace.html) and dispatches accordingly.
 */
import { GameState }           from './core/state.js';
import { CodeEvaluator }       from './core/evaluator.js';
import { SkillTreeRenderer }   from './core/skill-tree.js';
import { SoundFX, ParticleEngine } from './core/fx.js';
import { openProfileModal, openMascotVault, checkLoreUnlocks } from './core/ui.js';
import { PlayerStats, showTrackCompletionPopup } from './core/stats.js';
import { mountMobileToolbar } from './core/mobile-keys.js';
import { checkPrintableUnlock }   from './core/printables.js';
import { showHint }               from './core/ai-assistant.js';
import { openProfileManager }     from './core/profiles.js';

/* ── Service Worker registration ── */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
}

async function loadJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
  return res.json();
}

/* ── Shared HUD update ── */
function updateHUD(state) {
  const level  = GameState.calcLevel(state.xp);
  const xpEl   = document.getElementById('hud-xp');
  const lvlEl  = document.getElementById('hud-level');
  const strEl  = document.getElementById('hud-streak');
  if (xpEl)  xpEl.textContent   = `${state.xp} XP`;
  if (lvlEl) lvlEl.textContent  = `Lvl ${level}`;
  if (strEl) strEl.textContent  = `${state.streak} Day${state.streak !== 1 ? 's' : ''}`;
}

/* ═══════════════════════════════════════════════
   DASHBOARD ROUTING  (index.html)
═══════════════════════════════════════════════ */
async function bootDashboard() {
  const state = GameState.get();
  updateHUD(state);

  // HUD buttons
  document.getElementById('btn-profile')?.addEventListener('click', openProfileModal);
  document.getElementById('btn-vault')?.addEventListener('click', openMascotVault);
  document.getElementById('btn-profiles')?.addEventListener('click', openProfileManager);

  let data;
  try {
    data = await loadJSON('./data/tracks.json');
  } catch (e) {
    const c = document.getElementById('skill-tree-container');
    if (c) c.innerHTML = `<p style="color:var(--rose);padding:1rem">Could not load tracks: ${e.message}</p>`;
    return;
  }

  const tracks = data.tracks ?? [];

  // Build track selector tabs if multiple tracks exist
  const tabsEl = document.getElementById('track-tabs');
  if (tabsEl && tracks.length > 1) {
    tabsEl.innerHTML = tracks.map((t, i) =>
      `<button class="track-tab ${i === 0 ? 'active' : ''}" data-track="${t.id}">
         ${t.mascotAvatar ?? ''} ${t.title}
       </button>`
    ).join('');

    tabsEl.addEventListener('click', e => {
      const btn = e.target.closest('.track-tab');
      if (!btn) return;
      tabsEl.querySelectorAll('.track-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const track = tracks.find(t => t.id === btn.dataset.track);
      if (track) renderTree(track);
    });
  }

  // Render the first (or current) track
  const savedTrack = state.currentTrack ?? tracks[0]?.id;
  const active = tracks.find(t => t.id === savedTrack) ?? tracks[0];
  if (active) renderTree(active);

  function renderTree(track) {
    const renderer = new SkillTreeRenderer('skill-tree-container', track);
    renderer.render();

    // Update track info text
    const infoEl = document.getElementById('track-info');
    if (infoEl) {
      infoEl.innerHTML = `
        <span class="mascot-chip">${track.mascotAvatar ?? ''}</span>
        <strong>${track.title}</strong>
        <span>${track.description ?? ''}</span>`;
    }
  }
}

/* ═══════════════════════════════════════════════
   WORKSPACE ROUTING  (workspace.html?node=...)
═══════════════════════════════════════════════ */
async function bootWorkspace() {
  const params  = new URLSearchParams(window.location.search);
  const nodeId  = params.get('node');

  if (!nodeId) {
    document.getElementById('quest-title').textContent = 'No quest selected.';
    return;
  }

  // Load state
  const state = GameState.get();
  updateHUD(state);
  PlayerStats.startSession();

  // Find the node in tracks
  let node, track;
  try {
    const data = await loadJSON('./data/tracks.json');
    for (const t of (data.tracks ?? [])) {
      const found = t.nodes?.find(n => n.id === nodeId);
      if (found) { node = found; track = t; break; }
    }
  } catch (e) {
    document.getElementById('quest-title').textContent = 'Error loading quest data.';
    return;
  }

  if (!node) {
    document.getElementById('quest-title').textContent = `Quest "${nodeId}" not found.`;
    return;
  }

  // Populate mascot / briefing
  document.getElementById('quest-title').textContent   = node.title ?? nodeId;
  document.getElementById('mascot-avatar').textContent = track?.mascotAvatar ?? '🦊';
  document.getElementById('mascot-name').textContent   = node.mascot ?? track?.mascot ?? 'Guide';
  document.getElementById('mascot-role').textContent   = track?.mascotRole ?? '';
  document.getElementById('briefing-body').innerHTML   = node.briefing ?? '';

  // Task checkpoints
  const taskList = document.getElementById('task-list');
  if (taskList) {
    taskList.innerHTML = (node.testCases ?? []).map(tc =>
      `<li class="task-item" data-desc="${tc.description}">
         <span class="task-dot">○</span> ${tc.description}
       </li>`
    ).join('');
  }

  // Mobile touch toolbar
  const editor = document.getElementById('code-editor');
  mountMobileToolbar(editor);
  const saved  = sessionStorage.getItem(`jvds_code_${nodeId}`);
  editor.value = saved ?? node.initialCode ?? '';

  // Save edits to sessionStorage
  editor.addEventListener('input', () => {
    sessionStorage.setItem(`jvds_code_${nodeId}`, editor.value);
  });

  // ── Run Tests ──
  async function runTests() {
    const userCode = editor.value;
    const console_ = document.getElementById('terminal-console');
    console_.innerHTML = '<div class="log-info">Running...</div>';

    PlayerStats.recordRun();
    const { logs, results } = await CodeEvaluator.run(userCode, node.testCases ?? []);

    // Render console logs
    const logLines = logs.map(l => {
      const cls = l.startsWith('[error]') ? 'log-error' : l.startsWith('[warn]') ? 'log-warn' : 'log-ok';
      return `<div class="${cls}">${escHtml(l)}</div>`;
    });
    if (!logLines.length) logLines.push('<div class="log-info">// No console output</div>');

    // Render test results
    const resultLines = results.map(r => {
      const icon = r.passed ? '✅' : '❌';
      const err  = r.error ? ` <span class="log-error">(${escHtml(r.error)})</span>` : '';
      return `<div class="test-result ${r.passed ? 'pass' : 'fail'}">${icon} ${escHtml(r.description)}${err}</div>`;
    });

    console_.innerHTML = [
      '<div class="log-section">Console:</div>',
      ...logLines,
      results.length ? '<div class="log-section">Tests:</div>' : '',
      ...resultLines,
    ].filter(Boolean).join('');

    // Update task dots
    results.forEach((r, i) => {
      const dot = taskList?.querySelectorAll('.task-dot')[i];
      if (dot) dot.textContent = r.passed ? '✓' : '○';
    });

    const allPassed = results.length > 0 && results.every(r => r.passed);

    if (allPassed) {
      SoundFX.playSuccess();
      ParticleEngine.burst();
      const { leveledUp, newLevel } = GameState.markCompleted(nodeId, node.xp ?? 50);
      updateHUD(GameState.get());
      checkAchievements();
      checkLoreUnlocks(nodeId);
      PlayerStats.recordQuestCleared(nodeId);
      // Check if this node completes its track
      const allTrackNodes = track?.nodes?.map(n => n.id) ?? [];
      const completedSet  = new Set(GameState.get().completedNodes);
      if (allTrackNodes.length && allTrackNodes.every(id => completedSet.has(id))) {
        PlayerStats.recordTrackCompleted(track.id);
        showTrackCompletionPopup({
          trackTitle:    track.title,
          mascotAvatar:  track.mascotAvatar,
          mascotName:    track.mascot,
          storefront: [
            { label: '🎮 itch.io games', url: 'https://jvdesignstudio.itch.io' },
            { label: '☕ Ko-fi',          url: 'https://ko-fi.com/jvdesignstudio' },
          ],
        });
      }
      if (leveledUp) {
        SoundFX.playLevelUp();
        const prevLevel = newLevel - 1;
        checkPrintableUnlock(newLevel, prevLevel);
        showBanner(`Level Up! You reached Level ${newLevel} 🎉`);
      } else {
        showBanner(`Quest Complete! +${node.xp ?? 50} XP ⚡`);
      }
    } else if (results.some(r => !r.passed)) {
      SoundFX.playFailure();
      showHint(results, logs, track?.mascotId ?? 'lumo');
    }
  }

  document.getElementById('btn-run').addEventListener('click', runTests);

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runTests();
    }
  });

  // Mark already-completed tasks on load
  const alreadyDone = GameState.get().completedNodes.includes(nodeId);
  if (alreadyDone) {
    taskList?.querySelectorAll('.task-dot').forEach(d => d.textContent = '✓');
  }
}

/* ── Achievement checker ── */
async function checkAchievements() {
  const state = GameState.get();
  let data;
  try { data = await loadJSON('./data/achievements.json'); } catch { return; }

  for (const ach of (data.achievements ?? [])) {
    if (state.unlockedBadges.includes(ach.id)) continue;
    if (evalCondition(ach.condition, state)) {
      if (GameState.unlockBadge(ach.id)) {
        showBanner(`Achievement: ${ach.badgeIcon} ${ach.title}`);
      }
    }
  }
}

function evalCondition(condition, state) {
  try {
    const completedTracks = [];
    return new Function('completedNodes', 'streak', 'unlockedBadges', 'completedTracks',
      `return (${condition});`
    )(state.completedNodes, state.streak, state.unlockedBadges, completedTracks);
  } catch { return false; }
}

/* ── Toast banner ── */
function showBanner(msg) {
  const el = document.createElement('div');
  el.className = 'toast-banner';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('visible'), 50);
  setTimeout(() => { el.classList.remove('visible'); setTimeout(() => el.remove(), 400); }, 3000);
}

/* ── Escape HTML ── */
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ── Boot ── */
if (document.getElementById('skill-tree-container')) {
  bootDashboard().catch(console.error);
} else if (document.getElementById('code-editor')) {
  bootWorkspace().catch(console.error);
}
