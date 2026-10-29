/**
 * lore.js - Sticker album grid modal.
 * Unlocked cards show full bio + quote; locked cards render as dark silhouettes.
 *
 * API:
 *   openStickerAlbum()  - open the full album modal
 *   checkLoreUnlocks(completedNodeId) - unlock stickers/lore on node completion
 */
import { GameState } from './state.js';

const RARITY_COLOR = {
  common:    '#70A3A7',
  rare:      '#f39c12',
  epic:      '#BC4749',
  legendary: '#F0EAD6',
};

async function loadLore() {
  try {
    return await fetch('./data/lore.json').then(r => r.json());
  } catch {
    return { mascots: [], loreEntries: [] };
  }
}

/* ─── Unlock check ──────────────────────────────────────────────── */

export async function checkLoreUnlocks(completedNodeId) {
  const loreData = await loadLore();
  const state    = GameState.get();
  const unlocked = state.unlockedLore ?? [];
  let changed    = false;

  for (const mascot of (loreData.mascots ?? [])) {
    if (mascot.unlockNode === completedNodeId) {
      for (const sticker of (mascot.stickers ?? [])) {
        if (!unlocked.includes(sticker.id)) {
          unlocked.push(sticker.id);
          changed = true;
          _showUnlockToast({ type: 'sticker', name: sticker.label, emoji: sticker.emoji, rarity: sticker.rarity });
        }
      }
    }
  }

  for (const entry of (loreData.loreEntries ?? [])) {
    if (entry.unlockNode === completedNodeId && !unlocked.includes(entry.id)) {
      unlocked.push(entry.id);
      changed = true;
      _showUnlockToast({ type: 'lore', name: entry.title, emoji: '📖', rarity: 'common' });
    }
  }

  if (changed) {
    const s = GameState.get();
    s.unlockedLore = unlocked;
    GameState.save(s);
  }
}

/* ─── Sticker album modal ───────────────────────────────────────── */

export async function openStickerAlbum() {
  document.getElementById('lore-album-modal')?.remove();
  _injectStyles();

  const loreData = await loadLore();
  const state    = GameState.get();
  const unlocked = new Set(state.unlockedLore ?? []);

  const totalStickers = (loreData.mascots ?? []).reduce((n, m) => n + (m.stickers?.length ?? 0), 0);
  const ownedCount    = (loreData.mascots ?? []).reduce((n, m) => n + (m.stickers ?? []).filter(s => unlocked.has(s.id)).length, 0);

  // Build mascot card grid
  const mascotGrid = (loreData.mascots ?? []).map(mascot => {
    const ownedStickers = (mascot.stickers ?? []).filter(s => unlocked.has(s.id));
    const isUnlocked    = ownedStickers.length > 0;

    const stickerChips = (mascot.stickers ?? []).map(s => {
      const owned = unlocked.has(s.id);
      return `<div class="la-chip ${owned ? 'la-chip-owned' : 'la-chip-locked'}"
                   style="${owned ? `border-color:${RARITY_COLOR[s.rarity] ?? '#70A3A7'}` : ''}"
                   title="${owned ? s.label : '???'}">
        <span>${owned ? s.emoji : '🔒'}</span>
        <span class="la-chip-label">${owned ? s.label : '???'}</span>
        ${owned ? `<span class="la-rarity" style="color:${RARITY_COLOR[s.rarity]}">${s.rarity}</span>` : ''}
      </div>`;
    }).join('');

    if (!isUnlocked) {
      return `<div class="la-card la-card-locked">
        <div class="la-silhouette">${mascot.avatar}</div>
        <div class="la-card-body">
          <div class="la-card-name">???</div>
          <div class="la-card-role" style="color:#524c42">Complete quests to reveal</div>
          <div class="la-stickers">${stickerChips}</div>
        </div>
      </div>`;
    }

    return `<div class="la-card" style="border-color:${mascot.colour ?? '#403B33'}">
      <div class="la-avatar">${mascot.avatar}</div>
      <div class="la-card-body">
        <div class="la-card-name">${mascot.name}</div>
        <div class="la-card-role" style="color:${mascot.colour ?? '#70A3A7'}">${mascot.role}</div>
        <p class="la-bio">${mascot.lore ?? ''}</p>
        <div class="la-stickers">${stickerChips}</div>
      </div>
    </div>`;
  }).join('');

  // Build lore entries tab
  const unlockedEntries = (loreData.loreEntries ?? []).filter(e => unlocked.has(e.id));
  const lockedCount     = (loreData.loreEntries ?? []).length - unlockedEntries.length;

  const loreGrid = unlockedEntries.length
    ? unlockedEntries.map(e => `
        <div class="la-lore-card">
          <div class="la-lore-title">📖 ${e.title}</div>
          <p class="la-lore-text">${e.text}</p>
        </div>`).join('')
      + (lockedCount ? `<p class="la-empty">${lockedCount} lore entr${lockedCount === 1 ? 'y' : 'ies'} still locked - keep playing!</p>` : '')
    : '<p class="la-empty">Complete quests to unlock lore entries.</p>';

  const modal = document.createElement('div');
  modal.id = 'lore-album-modal';
  modal.innerHTML = `
    <div class="la-overlay" id="la-overlay"></div>
    <div class="la-dialog" role="dialog" aria-modal="true" aria-label="Sticker Album">
      <div class="la-header">
        <span class="la-title">✨ Sticker Album</span>
        <span class="la-progress">${ownedCount} / ${totalStickers} stickers</span>
        <button class="la-close" id="la-close" aria-label="Close">✕</button>
      </div>
      <div class="la-tabs">
        <button class="la-tab la-tab-active" data-tab="mascots">Characters</button>
        <button class="la-tab" data-tab="lore">Lore</button>
      </div>
      <div class="la-body" id="la-tab-mascots">${mascotGrid}</div>
      <div class="la-body" id="la-tab-lore" style="display:none">${loreGrid}</div>
    </div>`;

  document.body.appendChild(modal);

  document.getElementById('la-close').onclick  = () => modal.remove();
  document.getElementById('la-overlay').onclick = () => modal.remove();
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', onKey); }
  });

  modal.querySelectorAll('.la-tab').forEach(btn => {
    btn.onclick = () => {
      modal.querySelectorAll('.la-tab').forEach(b => b.classList.remove('la-tab-active'));
      btn.classList.add('la-tab-active');
      ['mascots', 'lore'].forEach(t => {
        document.getElementById(`la-tab-${t}`).style.display = btn.dataset.tab === t ? '' : 'none';
      });
    };
  });
}

/* ─── Unlock toast ──────────────────────────────────────────────── */

function _showUnlockToast({ type, name, emoji = '📖', rarity = 'common' }) {
  const color = RARITY_COLOR[rarity] ?? '#70A3A7';
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed;top:5rem;right:1.5rem;z-index:11000;
    background:#1a1a1a;border:2px solid ${color};border-radius:10px;
    padding:.65rem 1.1rem;display:flex;align-items:center;gap:.7rem;
    font-family:var(--font-body,sans-serif);color:#F0EAD6;
    box-shadow:0 4px 20px rgba(0,0,0,.6);
    animation:laPopIn .35s cubic-bezier(.34,1.56,.64,1);
    pointer-events:none;max-width:260px;
  `;
  el.innerHTML = `
    <span style="font-size:1.6rem">${type === 'sticker' ? emoji : '📖'}</span>
    <div>
      <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.09em;color:${color}">
        ${type === 'sticker' ? rarity + ' sticker' : 'Lore Unlocked'}</div>
      <div style="font-size:.85rem;font-weight:700">${name}</div>
    </div>`;
  _ensureKeyframes();
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

/* ─── Styles ────────────────────────────────────────────────────── */

function _ensureKeyframes() {
  if (document.getElementById('la-keyframes')) return;
  const s = document.createElement('style');
  s.id = 'la-keyframes';
  s.textContent = `@keyframes laPopIn{from{transform:scale(.7) translateY(-8px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}`;
  document.head.appendChild(s);
}

function _injectStyles() {
  if (document.getElementById('la-styles')) return;
  const s = document.createElement('style');
  s.id = 'la-styles';
  s.textContent = `
    .la-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:10500}
    .la-dialog{
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      z-index:10501;background:#1a1a1a;border:1px solid #524c42;border-radius:14px;
      width:min(680px,94vw);max-height:82vh;display:flex;flex-direction:column;
      font-family:var(--font-body,sans-serif);color:#F0EAD6;overflow:hidden;
    }
    .la-header{
      display:flex;align-items:center;gap:.75rem;padding:.85rem 1.2rem;
      border-bottom:1px solid #403B33;flex-shrink:0;background:#111;
    }
    .la-title{font-family:var(--font-heading,'Fredoka',cursive);font-size:1.05rem;color:#70A3A7}
    .la-progress{font-size:.72rem;color:#524c42;margin-left:auto}
    .la-close{background:none;border:none;color:#F0EAD6;font-size:.95rem;cursor:pointer;margin-left:.5rem;line-height:1}
    .la-tabs{display:flex;gap:.3rem;padding:.5rem 1rem;border-bottom:1px solid #403B33;flex-shrink:0}
    .la-tab{background:none;border:1px solid #403B33;color:#F0EAD6;border-radius:4px;padding:.25rem .75rem;font-size:.78rem;cursor:pointer;font-family:inherit}
    .la-tab-active{background:#70A3A7;color:#000;border-color:#70A3A7}
    .la-body{overflow-y:auto;padding:1rem;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:.85rem;align-content:start}
    .la-card{
      background:#242424;border:1px solid #403B33;border-radius:10px;
      padding:1rem;display:flex;gap:.85rem;align-items:flex-start;
    }
    .la-card-locked{opacity:.4;filter:grayscale(1)}
    .la-avatar{font-size:2.6rem;line-height:1;flex-shrink:0}
    .la-silhouette{font-size:2.6rem;line-height:1;flex-shrink:0;filter:brightness(0)}
    .la-card-body{flex:1;min-width:0}
    .la-card-name{font-weight:700;font-size:.95rem;margin-bottom:.15rem}
    .la-card-role{font-size:.72rem;margin-bottom:.5rem}
    .la-bio{font-size:.78rem;color:#b0a898;line-height:1.6;margin-bottom:.6rem}
    .la-stickers{display:flex;flex-wrap:wrap;gap:.3rem}
    .la-chip{
      display:flex;align-items:center;gap:.25rem;font-size:.68rem;
      padding:.15rem .45rem;border-radius:99px;border:1px solid #403B33;
    }
    .la-chip-owned{background:rgba(112,163,167,.08)}
    .la-chip-locked{opacity:.3}
    .la-chip-label{color:#F0EAD6}
    .la-rarity{font-size:.6rem;text-transform:uppercase;letter-spacing:.06em}
    .la-lore-card{background:#242424;border:1px solid #403B33;border-radius:8px;padding:.9rem;grid-column:1/-1}
    .la-lore-title{font-weight:700;font-size:.88rem;color:#70A3A7;margin-bottom:.4rem}
    .la-lore-text{font-size:.82rem;color:#b0a898;line-height:1.65}
    .la-empty{color:#524c42;font-size:.82rem;text-align:center;padding:1.5rem;grid-column:1/-1}
    @media(max-width:480px){.la-body{grid-template-columns:1fr}}
  `;
  document.head.appendChild(s);
}
