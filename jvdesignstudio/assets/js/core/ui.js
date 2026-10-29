/**
 * ui.js - Profile backup/restore modal and shared UI helpers.
 */
import { GameState } from './state.js';

/* ── Profile Export ── */
export function exportProfile() {
  const json = GameState.exportSave();
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'jv_profile_backup.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
}

/* ── Profile Import ── */
export function importProfile(onSuccess, onError) {
  const input    = document.createElement('input');
  input.type     = 'file';
  input.accept   = '.json,application/json';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const ok = GameState.importSave(e.target.result);
      if (ok) {
        onSuccess?.();
      } else {
        onError?.('Invalid profile file. Make sure it is a JVDesignStudio backup.');
      }
    };
    reader.onerror = () => onError?.('Could not read file.');
    reader.readAsText(file);
    input.remove();
  };
  document.body.appendChild(input);
  input.click();
}

/* ── Profile Modal ── */
export function openProfileModal() {
  // Remove existing modal if any
  document.getElementById('profile-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'profile-modal';
  modal.innerHTML = `
    <div class="modal-overlay" id="modal-overlay"></div>
    <div class="modal-box" role="dialog" aria-modal="true" aria-label="Profile Settings">
      <div class="modal-header">
        <h3>Profile Settings</h3>
        <button class="modal-close" id="modal-close" aria-label="Close">✕</button>
      </div>
      <div class="modal-body">
        <div class="modal-stat-row">
          <span>XP</span><strong id="modal-xp"></strong>
        </div>
        <div class="modal-stat-row">
          <span>Level</span><strong id="modal-level"></strong>
        </div>
        <div class="modal-stat-row">
          <span>Streak</span><strong id="modal-streak"></strong>
        </div>
        <div class="modal-stat-row">
          <span>Nodes complete</span><strong id="modal-nodes"></strong>
        </div>
        <div class="modal-stat-row">
          <span>Badges</span><strong id="modal-badges"></strong>
        </div>
        <hr class="modal-divider">
        <div class="modal-actions">
          <button class="btn-teal" id="btn-export">⬇ Export Profile</button>
          <button class="btn-ghost" id="btn-import">⬆ Import Profile</button>
          <button class="btn-danger" id="btn-reset">Reset Progress</button>
        </div>
        <p id="modal-msg" class="modal-msg"></p>
      </div>
    </div>`;
  document.body.appendChild(modal);

  // Populate stats
  const state = GameState.get();
  document.getElementById('modal-xp').textContent      = `${state.xp} XP`;
  document.getElementById('modal-level').textContent   = `${GameState.calcLevel(state.xp)}`;
  document.getElementById('modal-streak').textContent  = `${state.streak} day${state.streak !== 1 ? 's' : ''}`;
  document.getElementById('modal-nodes').textContent   = `${state.completedNodes.length}`;
  document.getElementById('modal-badges').textContent  = `${state.unlockedBadges.length}`;

  const msg = (text, isErr = false) => {
    const el = document.getElementById('modal-msg');
    el.textContent = text;
    el.style.color = isErr ? 'var(--rose)' : 'var(--teal)';
  };

  document.getElementById('modal-close').onclick    = closeModal;
  document.getElementById('modal-overlay').onclick  = closeModal;
  document.getElementById('btn-export').onclick     = () => { exportProfile(); msg('Profile exported!'); };
  document.getElementById('btn-import').onclick     = () => {
    importProfile(
      () => { msg('Profile imported! Reloading...'); setTimeout(() => location.reload(), 800); },
      (err) => msg(err, true)
    );
  };
  document.getElementById('btn-reset').onclick = () => {
    if (confirm('Reset all progress? This cannot be undone.')) {
      GameState.reset();
      msg('Progress reset. Reloading...');
      setTimeout(() => location.reload(), 800);
    }
  };

  // Keyboard close
  const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', onKey);
  modal._removeKey = () => document.removeEventListener('keydown', onKey);
}

function closeModal() {
  const modal = document.getElementById('profile-modal');
  modal?._removeKey?.();
  modal?.remove();
}

/* ── Inject modal styles once ── */
(function injectModalStyles() {
  if (document.getElementById('ui-modal-styles')) return;
  const style = document.createElement('style');
  style.id = 'ui-modal-styles';
  style.textContent = `
    .modal-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,.65);
      z-index: 10000;
    }
    .modal-box {
      position: fixed;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      background: #1a1a1a;
      border: 1px solid #524c42;
      border-radius: 12px;
      padding: 1.5rem;
      min-width: 320px;
      max-width: 90vw;
      z-index: 10001;
      font-family: var(--font-body);
      color: var(--beige);
    }
    .modal-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 1rem;
    }
    .modal-header h3 { margin: 0; font-size: 1.05rem; }
    .modal-close {
      background: none; border: none; color: var(--beige);
      font-size: 1rem; cursor: pointer; line-height: 1;
    }
    .modal-stat-row {
      display: flex; justify-content: space-between;
      font-size: .85rem; padding: .3rem 0;
      border-bottom: 1px solid rgba(255,255,255,.05);
    }
    .modal-stat-row span { color: #524c42; }
    .modal-divider { border-color: #524c42; margin: 1rem 0; }
    .modal-actions { display: flex; flex-wrap: wrap; gap: .5rem; }
    .btn-ghost {
      background: transparent; color: var(--beige);
      border: 1px solid #524c42; border-radius: 4px;
      padding: .3rem .85rem; font-size: .78rem;
      font-weight: 600; cursor: pointer;
      font-family: var(--font-body);
      transition: border-color .15s;
    }
    .btn-ghost:hover { border-color: var(--teal); }
    .btn-danger {
      background: transparent; color: var(--rose);
      border: 1px solid var(--rose); border-radius: 4px;
      padding: .3rem .85rem; font-size: .78rem;
      font-weight: 600; cursor: pointer;
      font-family: var(--font-body);
      transition: opacity .15s;
    }
    .btn-danger:hover { opacity: .75; }
    .modal-msg { font-size: .8rem; margin: .75rem 0 0; min-height: 1.2em; }
  `;
  document.head.appendChild(style);
})();
