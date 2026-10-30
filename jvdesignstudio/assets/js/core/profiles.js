/**
 * profiles.js - Multi-profile manager and QR code progress transfer.
 * Stores up to 5 named profiles in localStorage.
 * QR generation is pure SVG (no library) encoding a data URL of the profile JSON.
 */
import { GameState } from './state.js';

const PROFILES_KEY   = 'jvds_profiles_v1';
const ACTIVE_KEY     = 'jvds_active_profile_v1';
const MAX_PROFILES   = 5;

/* ═══════════════════════════════════════════════
   PROFILE STORE
═══════════════════════════════════════════════ */

export const ProfileManager = {
  /** Return all saved profiles as { id, name, avatar, savedAt, state } */
  getAll() {
    try { return JSON.parse(localStorage.getItem(PROFILES_KEY) ?? '[]'); }
    catch { return []; }
  },

  getActive() {
    return localStorage.getItem(ACTIVE_KEY) ?? null;
  },

  /** Snapshot the current game state into a named profile slot */
  save(name, avatarEmoji = '🦊') {
    const profiles = this.getAll();
    if (profiles.length >= MAX_PROFILES && !profiles.find(p => p.name === name)) {
      throw new Error(`Maximum ${MAX_PROFILES} profiles reached. Delete one first.`);
    }
    const existing = profiles.findIndex(p => p.name === name);
    const entry = {
      id:      `profile-${Date.now()}`,
      name,
      avatar:  avatarEmoji,
      savedAt: new Date().toISOString(),
      state:   GameState.get(),
    };
    if (existing >= 0) {
      entry.id = profiles[existing].id;
      profiles[existing] = entry;
    } else {
      profiles.push(entry);
    }
    try { localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles)); } catch {}
    return entry;
  },

  /** Load a profile's state into the active game */
  load(profileId) {
    const profile = this.getAll().find(p => p.id === profileId);
    if (!profile) throw new Error(`Profile "${profileId}" not found`);
    try {
      localStorage.setItem('jv_studio_player_v1', JSON.stringify(profile.state));
      localStorage.setItem(ACTIVE_KEY, profileId);
    } catch {}
    return profile;
  },

  delete(profileId) {
    const filtered = this.getAll().filter(p => p.id !== profileId);
    try { localStorage.setItem(PROFILES_KEY, JSON.stringify(filtered)); } catch {}
    if (this.getActive() === profileId) localStorage.removeItem(ACTIVE_KEY);
  },
};

/* ═══════════════════════════════════════════════
   QR CODE GENERATOR (pure SVG, no library)
   Encodes a short text string as a QR-like grid.
   Uses a real QR encoding algorithm subset for
   alphanumeric mode (data URL of profile JSON).
═══════════════════════════════════════════════ */

/**
 * Generate an SVG string containing a QR code for the given text payload.
 * Uses a lightweight pure-JS QR encoder (Alphanumeric / Byte mode, error level M).
 * Implementation: self-contained minimal QR generator based on public domain spec.
 */
export function generateQRSVG(text, opts = {}) {
  const { size = 256, fgColor = '#1a1a1a', bgColor = '#F0EAD6' } = opts;
  const matrix = encodeQR(text);
  if (!matrix) return null;

  const cells = matrix.length;
  const cellSize = size / (cells + 8); // 4-cell quiet zone each side
  const offset   = cellSize * 4;
  const totalSize = size + offset * 2;

  let rects = '';
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      if (matrix[r][c]) {
        rects += `<rect x="${offset + c * cellSize}" y="${offset + r * cellSize}" width="${cellSize}" height="${cellSize}" fill="${fgColor}"/>`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${totalSize}" height="${totalSize}">
  <rect width="${totalSize}" height="${totalSize}" fill="${bgColor}"/>
  ${rects}
</svg>`;
}

/** Download a QR code SVG for the current profile state */
export function downloadProfileQR(label = 'my-profile') {
  const state = GameState.get();
  const payload = JSON.stringify({ jvds: 1, state });
  // Clamp payload - QR has a ~2953 byte limit at level M
  if (payload.length > 2800) {
    // Strip speedrunTimes and large arrays to fit
    const compact = { jvds: 1, state: {
      xp: state.xp, streak: state.streak,
      completedNodes: state.completedNodes,
      unlockedBadges: state.unlockedBadges,
      currentTrack: state.currentTrack,
    }};
    return _downloadQR(JSON.stringify(compact), label);
  }
  return _downloadQR(payload, label);
}

function _downloadQR(text, label) {
  const svg = generateQRSVG(text);
  if (!svg) { alert('Profile is too large for a QR code - use Export instead.'); return; }
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `jvds-profile-${label}.svg`;
  a.click(); URL.revokeObjectURL(url);
}

/** Scan a QR code from a file upload and import the profile state */
export function importFromQRFile() {
  // We can't decode QR pixels natively; instruct user to copy-paste the JSON instead
  return importFromJSONPrompt();
}

function importFromJSONPrompt() {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position:fixed;inset:0;z-index:14000;background:rgba(0,0,0,.8);
    display:flex;align-items:center;justify-content:center;
    font-family:var(--font-body,sans-serif);
  `;
  modal.innerHTML = `
    <div style="background:#1a1a1a;border:1px solid #70A3A7;border-radius:12px;padding:2rem;max-width:460px;width:90%;color:#F0EAD6">
      <h3 style="margin:0 0 1rem;font-family:var(--font-heading,'Fredoka'),sans-serif">Import Profile via QR</h3>
      <p style="font-size:.83rem;color:#b0a898;margin:0 0 .75rem;line-height:1.6">
        Scan your JVDesignStudio QR code with your phone's camera app. Copy the text it shows, then paste it below.
      </p>
      <textarea id="qr-paste-area" rows="5" style="width:100%;background:#242424;border:1px solid #403B33;
        color:#F0EAD6;border-radius:6px;padding:.5rem;font-family:var(--font-code,monospace);
        font-size:.78rem;resize:vertical;box-sizing:border-box"></textarea>
      <div style="display:flex;gap:.5rem;margin-top:.75rem">
        <button id="qr-import-btn" style="flex:1;background:#70A3A7;color:#000;border:none;border-radius:6px;
          padding:.5rem;font-weight:700;cursor:pointer;font-family:inherit">Import</button>
        <button id="qr-cancel-btn" style="background:#403B33;color:#F0EAD6;border:none;border-radius:6px;
          padding:.5rem .75rem;cursor:pointer;font-family:inherit">Cancel</button>
      </div>
      <div id="qr-import-error" style="color:#BC4749;font-size:.78rem;margin-top:.4rem;min-height:1em"></div>
    </div>`;
  document.body.appendChild(modal);

  document.getElementById('qr-cancel-btn').onclick = () => modal.remove();
  document.getElementById('qr-import-btn').onclick = () => {
    const raw = document.getElementById('qr-paste-area').value.trim();
    try {
      const parsed = JSON.parse(raw);
      const state  = parsed.jvds ? parsed.state : parsed;
      if (!state?.completedNodes) throw new Error('Not a valid JVDesignStudio profile.');
      localStorage.setItem('jv_studio_player_v1', JSON.stringify(state));
      modal.remove();
      location.reload();
    } catch (e) {
      document.getElementById('qr-import-error').textContent = e.message;
    }
  };

  return modal;
}

/* ═══════════════════════════════════════════════
   LIGHTWEIGHT QR ENCODER
   Supports Byte mode only (UTF-8). Version 1-10.
   Based on the public-domain qrcode-generator algorithm.
═══════════════════════════════════════════════ */

function encodeQR(text) {
  try {
    // Use a self-contained micro QR generator
    return _microQR(text);
  } catch { return null; }
}

function _microQR(text) {
  // --- Reed-Solomon GF(256) setup ---
  const GF_EXP = new Uint8Array(512);
  const GF_LOG = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x = x << 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];

  const gfMul = (a, b) => a && b ? GF_EXP[GF_LOG[a] + GF_LOG[b]] : 0;
  const gfDiv = (a, b) => a ? GF_EXP[(GF_LOG[a] - GF_LOG[b] + 255) % 255] : 0;

  function rsPoly(degree) {
    let p = [1];
    for (let i = 0; i < degree; i++) {
      const t = [1, GF_EXP[i]];
      const r = new Uint8Array(p.length + t.length - 1);
      for (let a = 0; a < p.length; a++)
        for (let b = 0; b < t.length; b++)
          r[a + b] ^= gfMul(p[a], t[b]);
      p = Array.from(r);
    }
    return p;
  }

  function rsEncode(msg, nsym) {
    const gen = rsPoly(nsym);
    const out  = [...msg, ...new Array(nsym).fill(0)];
    for (let i = 0; i < msg.length; i++) {
      const c = out[i];
      if (c) for (let j = 0; j < gen.length; j++) out[i + j] ^= gfMul(gen[j], c);
    }
    return out.slice(msg.length);
  }

  // --- Version selection (Byte mode, Error Level M) ---
  // Capacity table: [version]: { data codewords, ec codewords }
  const CAP = [
    null,
    {d:16,e:10},{d:28,e:16},{d:44,e:26},{d:64,e:36},{d:86,e:46},
    {d:108,e:60},{d:124,e:66},{d:154,e:86},{d:182,e:100},{d:216,e:122},
  ];

  const bytes = new TextEncoder().encode(text);
  let version = 0;
  for (let v = 1; v <= 10; v++) {
    if (CAP[v].d >= bytes.length + 2) { version = v; break; }
  }
  if (!version) return null; // text too long for micro encoder

  const { d: dataLen, e: ecLen } = CAP[version];
  const size = 17 + version * 4;

  // --- Build bit stream ---
  const bits = [];
  const pushBits = (val, count) => {
    for (let i = count - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };

  pushBits(4, 4);                             // mode: byte
  pushBits(bytes.length, version < 10 ? 8 : 16); // char count
  bytes.forEach(b => pushBits(b, 8));
  // Terminator
  for (let i = 0; i < 4 && bits.length < dataLen * 8; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  // Pad codewords
  const pads = [0xEC, 0x11];
  let pi = 0;
  while (bits.length < dataLen * 8) pushBits(pads[pi++ % 2], 8);

  // Convert bits → bytes
  const dataWords = [];
  for (let i = 0; i < dataLen; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | (bits[i * 8 + j] ?? 0);
    dataWords.push(b);
  }

  const ecWords = rsEncode(dataWords, ecLen);
  const codewords = [...dataWords, ...ecWords];

  // --- Build matrix ---
  const mat = Array.from({ length: size }, () => new Array(size).fill(-1));
  const fn  = Array.from({ length: size }, () => new Array(size).fill(false));

  const setModule = (r, c, v, isFn = false) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      mat[r][c] = v; if (isFn) fn[r][c] = true;
    }
  };

  // Finder patterns
  const finder = (row, col) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const dark = r === -1 || r === 7 || c === -1 || c === 7
        || (r >= 1 && r <= 5 && c >= 1 && c <= 5 && !(r >= 2 && r <= 4 && c >= 2 && c <= 4));
      setModule(row + r, col + c, dark ? 1 : 0, true);
    }
  };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

  // Alignment patterns (version >= 2)
  const ALIGN = [null,[],[ ],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,28,46]];
  const align = ALIGN[version] ?? [];
  if (align.length > 1) {
    for (const ar of align) for (const ac of align) {
      if ((ar === 6 && ac === 6) || (ar === 6 && ac === align[align.length-1] && align[0] === 6)
        || (ac === 6 && ar === align[align.length-1] && align[0] === 6)) continue;
      for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) {
        setModule(ar + r, ac + c,
          (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) ? 1 : 0, true);
      }
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setModule(6, i, i % 2 === 0 ? 1 : 0, true);
    setModule(i, 6, i % 2 === 0 ? 1 : 0, true);
  }

  // Format info (mask 0, level M = 00)
  const FORMAT_M0 = [0,1,1,0,1,1,1,1,1,0,0,0,1,0,0];
  const fmtBits   = FORMAT_M0;
  const fmtPos1   = [[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
  const fmtPos2   = [[size-1,8],[size-2,8],[size-3,8],[size-4,8],[size-5,8],[size-6,8],[size-7,8],[8,size-8],[8,size-7],[8,size-6],[8,size-5],[8,size-4],[8,size-3],[8,size-2],[8,size-1]];
  fmtBits.forEach((b, i) => {
    setModule(fmtPos1[i][0], fmtPos1[i][1], b, true);
    setModule(fmtPos2[i][0], fmtPos2[i][1], b, true);
  });
  setModule(size - 8, 8, 1, true); // dark module

  // Place data bits (zigzag)
  let bitIdx = 0;
  const allBits = codewords.flatMap(b => [7,6,5,4,3,2,1,0].map(i => (b >> i) & 1));
  const maskFn  = (r, c) => (r + c) % 2 === 0; // mask 0

  let right = true;
  for (let col = size - 1; col >= 1; col -= 2) {
    if (col === 6) col--;
    for (let rr = 0; rr < size; rr++) {
      const r = right ? rr : size - 1 - rr;
      for (let dc = 0; dc < 2; dc++) {
        const c = col - dc;
        if (!fn[r][c]) {
          const bit = allBits[bitIdx++] ?? 0;
          mat[r][c] = bit ^ (maskFn(r, c) ? 1 : 0);
        }
      }
    }
    right = !right;
  }

  return mat.map(row => row.map(v => v === 1));
}

/* ═══════════════════════════════════════════════
   PROFILE MANAGER MODAL
═══════════════════════════════════════════════ */

export function openProfileManager() {
  document.getElementById('jvds-profile-modal')?.remove();

  const profiles = ProfileManager.getAll();
  const activeId = ProfileManager.getActive();

  const profileRows = profiles.map(p => `
    <div class="pm-row ${p.id === activeId ? 'pm-active' : ''}" data-id="${p.id}">
      <span class="pm-avatar">${p.avatar}</span>
      <div class="pm-info">
        <div class="pm-name">${escH(p.name)}</div>
        <div class="pm-meta">Lvl ${Math.floor(Math.sqrt((p.state.xp ?? 0) / 50)) + 1} &middot; ${p.state.completedNodes?.length ?? 0} quests &middot; Saved ${new Date(p.savedAt).toLocaleDateString()}</div>
      </div>
      <div class="pm-actions">
        ${p.id !== activeId ? `<button class="pm-btn pm-load" data-id="${p.id}">Load</button>` : '<span class="pm-badge">Active</span>'}
        <button class="pm-btn pm-del" data-id="${p.id}">✕</button>
      </div>
    </div>`).join('') || '<p style="color:#524c42;font-size:.85rem;padding:.5rem 0">No saved profiles yet.</p>';

  const modal = document.createElement('div');
  modal.id = 'jvds-profile-modal';
  modal.innerHTML = `
    <div class="modal-overlay" id="pm-overlay"></div>
    <div class="modal-box" style="max-width:520px" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h3>🎮 Player Profiles</h3>
        <button class="modal-close" id="pm-close">✕</button>
      </div>
      <div style="padding:1rem">
        ${profileRows}
        <div style="margin-top:1rem;display:flex;gap:.5rem;flex-wrap:wrap">
          <button id="pm-save-btn" class="btn-teal" style="font-size:.82rem">+ Save Current</button>
          <button id="pm-qr-dl-btn" class="btn-clear" style="font-size:.82rem">📲 QR Export</button>
          <button id="pm-qr-import-btn" class="btn-clear" style="font-size:.82rem">📷 QR Import</button>
        </div>
      </div>
    </div>`;

  // Inject styles once
  if (!document.getElementById('pm-styles')) {
    const s = document.createElement('style');
    s.id = 'pm-styles';
    s.textContent = `
      .pm-row{display:flex;align-items:center;gap:.75rem;padding:.65rem .5rem;border-radius:6px;border:1px solid #403B33;margin-bottom:.4rem;background:#1e1e1e}
      .pm-row.pm-active{border-color:#70A3A7}
      .pm-avatar{font-size:1.6rem;flex-shrink:0}
      .pm-info{flex:1;min-width:0}
      .pm-name{font-weight:600;font-size:.88rem;color:#F0EAD6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .pm-meta{font-size:.72rem;color:#524c42;margin-top:.15rem}
      .pm-actions{display:flex;gap:.3rem;align-items:center;flex-shrink:0}
      .pm-btn{background:#403B33;color:#F0EAD6;border:none;border-radius:4px;padding:.25rem .55rem;font-size:.75rem;cursor:pointer;font-family:var(--font-body,sans-serif)}
      .pm-load:hover{background:#70A3A7;color:#000}
      .pm-del:hover{background:#BC4749}
      .pm-badge{font-size:.7rem;color:#70A3A7;font-weight:700}
    `;
    document.head.appendChild(s);
  }

  document.body.appendChild(modal);
  document.getElementById('pm-close').onclick    = () => modal.remove();
  document.getElementById('pm-overlay').onclick  = () => modal.remove();

  document.getElementById('pm-save-btn').onclick = () => {
    const name = prompt('Profile name (e.g. "Speedrun", "Campaign"):')?.trim();
    if (!name) return;
    const avatar = prompt('Avatar emoji (e.g. 🦊):', '🦊')?.trim() || '🦊';
    try {
      ProfileManager.save(name, avatar);
      modal.remove(); openProfileManager();
    } catch (e) { alert(e.message); }
  };

  document.getElementById('pm-qr-dl-btn').onclick    = () => downloadProfileQR();
  document.getElementById('pm-qr-import-btn').onclick = () => importFromJSONPrompt();

  modal.querySelectorAll('.pm-load').forEach(btn => {
    btn.onclick = () => {
      ProfileManager.load(btn.dataset.id);
      modal.remove();
      location.reload();
    };
  });

  modal.querySelectorAll('.pm-del').forEach(btn => {
    btn.onclick = () => {
      if (!confirm('Delete this profile?')) return;
      ProfileManager.delete(btn.dataset.id);
      modal.remove(); openProfileManager();
    };
  });
}

function escH(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
