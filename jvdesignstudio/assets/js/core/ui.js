/**
 * ui.js - Profile backup/restore modal, Mascot Vault, and shared UI helpers.
 */
import { GameState } from './state.js';

/* ═══════════════════════════════════════════════
   MASCOT VAULT
═══════════════════════════════════════════════ */

/**
 * Check completed nodes against lore.json; unlock stickers + lore entries.
 * Call this after every markCompleted().
 */
export async function checkLoreUnlocks(completedNodeId) {
  let loreData;
  try {
    loreData = await fetch('../data/lore.json').then(r => r.json());
  } catch {
    try { loreData = await fetch('./data/lore.json').then(r => r.json()); } catch { return; }
  }

  const state = GameState.get();
  const unlocked = state.unlockedLore ?? [];
  let changed = false;

  // Check mascot sticker unlocks
  for (const mascot of (loreData.mascots ?? [])) {
    if (mascot.unlockNode === completedNodeId) {
      for (const sticker of (mascot.stickers ?? [])) {
        if (!unlocked.includes(sticker.id)) {
          unlocked.push(sticker.id);
          changed = true;
          showLoreUnlock({ type: 'sticker', name: sticker.label, emoji: sticker.emoji, rarity: sticker.rarity });
        }
      }
    }
  }

  // Check lore entry unlocks
  for (const entry of (loreData.loreEntries ?? [])) {
    if (entry.unlockNode === completedNodeId && !unlocked.includes(entry.id)) {
      unlocked.push(entry.id);
      changed = true;
      showLoreUnlock({ type: 'lore', name: entry.title });
    }
  }

  if (changed) {
    const s = GameState.get();
    s.unlockedLore = unlocked;
    GameState.save(s);
  }
}

function showLoreUnlock({ type, name, emoji = '📖', rarity = 'common' }) {
  const rarityColour = { common: '#70A3A7', rare: '#f39c12', epic: '#BC4749', legendary: '#F0EAD6' };
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed;top:5rem;right:1.5rem;z-index:11000;
    background:#1a1a1a;border:1px solid ${rarityColour[rarity] ?? '#70A3A7'};
    border-radius:10px;padding:.75rem 1.25rem;
    font-family:var(--font-body,sans-serif);color:#F0EAD6;
    display:flex;align-items:center;gap:.75rem;
    box-shadow:0 4px 20px rgba(0,0,0,.5);
    animation:lorePopIn .4s cubic-bezier(.34,1.56,.64,1);
    pointer-events:none;max-width:280px;
  `;
  el.innerHTML = `
    <span style="font-size:1.8rem">${type === 'sticker' ? emoji : '📖'}</span>
    <div>
      <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;color:${rarityColour[rarity] ?? '#70A3A7'}">${type === 'sticker' ? rarity + ' sticker' : 'Lore Unlocked'}</div>
      <div style="font-size:.88rem;font-weight:600">${name}</div>
    </div>`;
  if (!document.getElementById('lore-keyframes')) {
    const s = document.createElement('style');
    s.id = 'lore-keyframes';
    s.textContent = `@keyframes lorePopIn{from{transform:scale(.7) translateY(-10px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}`;
    document.head.appendChild(s);
  }
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

/** Open the Mascot Vault modal */
export async function openMascotVault() {
  document.getElementById('mascot-vault-modal')?.remove();

  let loreData = { mascots: [], loreEntries: [] };
  try {
    loreData = await fetch('./data/lore.json').then(r => r.json());
  } catch { /* offline fallback - show empty vault */ }

  const state    = GameState.get();
  const unlocked = new Set(state.unlockedLore ?? []);

  const mascotCards = (loreData.mascots ?? []).map(m => {
    const ownedStickers = m.stickers.filter(s => unlocked.has(s.id));
    const locked = ownedStickers.length === 0;
    return `
      <div class="vault-mascot-card ${locked ? 'vault-locked' : ''}">
        <div class="vault-avatar">${locked ? '❓' : m.avatar}</div>
        <div class="vault-info">
          <div class="vault-name">${locked ? '???' : m.name}</div>
          <div class="vault-role">${locked ? 'Complete quests to unlock' : m.role}</div>
          ${!locked ? `<div class="vault-lore">${m.lore}</div>` : ''}
        </div>
        ${!locked ? `
          <div class="vault-stickers">
            ${m.stickers.map(s => `
              <div class="sticker-chip ${unlocked.has(s.id) ? 'owned' : 'missing'}" title="${s.label}">
                <span>${unlocked.has(s.id) ? s.emoji : '🔒'}</span>
                <span class="sticker-label">${s.label}</span>
              </div>`).join('')}
          </div>` : ''}
      </div>`;
  }).join('');

  const loreCards = (loreData.loreEntries ?? []).filter(e => unlocked.has(e.id)).map(e => `
    <div class="vault-lore-entry">
      <div class="vault-lore-title">📖 ${e.title}</div>
      <div class="vault-lore-text">${e.text}</div>
    </div>`).join('') || '<p class="vault-empty">Complete quests to unlock lore entries.</p>';

  const total   = (loreData.mascots ?? []).reduce((n, m) => n + m.stickers.length, 0);
  const ownedN  = (loreData.mascots ?? []).reduce((n, m) => n + m.stickers.filter(s => unlocked.has(s.id)).length, 0);

  const modal = document.createElement('div');
  modal.id = 'mascot-vault-modal';
  modal.innerHTML = `
    <div class="modal-overlay" id="vault-overlay"></div>
    <div class="modal-box vault-box" role="dialog" aria-modal="true" aria-label="Mascot Vault">
      <div class="modal-header">
        <h3>✨ Mascot Vault</h3>
        <span style="font-size:.8rem;color:#524c42">${ownedN} / ${total} stickers</span>
        <button class="modal-close" id="vault-close">✕</button>
      </div>
      <div class="vault-tabs">
        <button class="vault-tab active" data-tab="characters">Characters</button>
        <button class="vault-tab" data-tab="lore">Lore</button>
      </div>
      <div id="vault-tab-characters" class="vault-content">${mascotCards}</div>
      <div id="vault-tab-lore" class="vault-content" style="display:none">${loreCards}</div>
    </div>`;

  document.body.appendChild(modal);
  document.getElementById('vault-close').onclick   = () => modal.remove();
  document.getElementById('vault-overlay').onclick  = () => modal.remove();
  modal.querySelectorAll('.vault-tab').forEach(btn => {
    btn.onclick = () => {
      modal.querySelectorAll('.vault-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      modal.querySelectorAll('.vault-content').forEach(c => c.style.display = 'none');
      document.getElementById(`vault-tab-${btn.dataset.tab}`).style.display = '';
    };
  });

  // Inject vault styles once
  if (!document.getElementById('vault-styles')) {
    const s = document.createElement('style');
    s.id = 'vault-styles';
    s.textContent = `
      .vault-box { max-width:600px;max-height:80vh;overflow:hidden;display:flex;flex-direction:column; }
      .vault-tabs { display:flex;gap:.3rem;padding:.5rem 1rem;border-bottom:1px solid #524c42;flex-shrink:0; }
      .vault-tab { background:none;border:1px solid #403B33;color:#F0EAD6;border-radius:4px;padding:.25rem .75rem;font-size:.78rem;cursor:pointer;font-family:var(--font-body,sans-serif); }
      .vault-tab.active { background:#70A3A7;color:#000;border-color:#70A3A7; }
      .vault-content { overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.75rem; }
      .vault-mascot-card { background:#242424;border:1px solid #403B33;border-radius:8px;padding:1rem;display:flex;flex-direction:column;gap:.6rem; }
      .vault-mascot-card.vault-locked { opacity:.45;filter:grayscale(1); }
      .vault-avatar { font-size:2.5rem;line-height:1; }
      .vault-name { font-weight:700;font-size:.95rem; }
      .vault-role { font-size:.75rem;color:#70A3A7; }
      .vault-lore { font-size:.82rem;color:#b0a898;line-height:1.55;margin-top:.25rem; }
      .vault-stickers { display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.25rem; }
      .sticker-chip { display:flex;align-items:center;gap:.3rem;font-size:.72rem;padding:.2rem .5rem;border-radius:99px;border:1px solid #403B33; }
      .sticker-chip.owned { border-color:#70A3A7;background:rgba(112,163,167,.1); }
      .sticker-chip.missing { opacity:.35; }
      .sticker-label { color:#F0EAD6; }
      .vault-lore-entry { background:#242424;border:1px solid #403B33;border-radius:8px;padding:.85rem; }
      .vault-lore-title { font-weight:700;font-size:.88rem;margin-bottom:.4rem;color:#70A3A7; }
      .vault-lore-text { font-size:.82rem;color:#b0a898;line-height:1.6; }
      .vault-empty { color:#524c42;font-size:.85rem;text-align:center;padding:2rem; }
    `;
    document.head.appendChild(s);
  }
}

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
