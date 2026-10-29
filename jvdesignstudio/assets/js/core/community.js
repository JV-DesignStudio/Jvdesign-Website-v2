/**
 * community.js - Player UGC quest sharing via Base64 URL hashes and .jvtrack files.
 * Zero external dependencies. All compression is native btoa/atob + JSON.
 */

const JVTRACK_MIME = 'application/json';
const JVTRACK_EXT  = '.jvtrack';

/* ═══════════════════════════════════════════════
   ENCODE / DECODE
═══════════════════════════════════════════════ */

/**
 * Encode a track object into a shareable Base64 URL hash string.
 * The hash is safe to embed in a URL fragment (#share=...) with no server.
 */
export function encodeTrack(trackObj) {
  const json = JSON.stringify(trackObj);
  // TextEncoder → Uint8Array → binary string → btoa
  const bytes  = new TextEncoder().encode(json);
  let binary   = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Decode a Base64 URL hash string back into a track object.
 * Returns null on invalid input.
 */
export function decodeTrack(hash) {
  try {
    const padded = hash.replace(/-/g, '+').replace(/_/g, '/');
    const pad    = (4 - padded.length % 4) % 4;
    const b64    = padded + '='.repeat(pad);
    const binary = atob(b64);
    const bytes  = Uint8Array.from(binary, c => c.charCodeAt(0));
    const json   = new TextDecoder().decode(bytes);
    return JSON.parse(json);
  } catch { return null; }
}

/* ═══════════════════════════════════════════════
   .jvtrack FILE EXPORT / IMPORT
═══════════════════════════════════════════════ */

/** Download a track as a .jvtrack file (JSON) */
export function exportTrackFile(trackObj) {
  const json = JSON.stringify(trackObj, null, 2);
  const blob = new Blob([json], { type: JVTRACK_MIME });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${(trackObj.id ?? 'custom-track')}${JVTRACK_EXT}`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Import a .jvtrack file chosen by the user.
 * @returns {Promise<object>} parsed track object
 */
export function importTrackFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = `${JVTRACK_EXT},application/json`;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return reject(new Error('No file selected'));
      const reader = new FileReader();
      reader.onload  = e => {
        try {
          const track = JSON.parse(e.target.result);
          if (!track.id || !Array.isArray(track.nodes)) throw new Error('Invalid .jvtrack format');
          resolve(track);
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    };
    input.click();
  });
}

/* ═══════════════════════════════════════════════
   COMMUNITY LIBRARY (localStorage)
═══════════════════════════════════════════════ */

const LIBRARY_KEY = 'jvds_community_tracks_v1';

export const CommunityLibrary = {
  getAll() {
    try { return JSON.parse(localStorage.getItem(LIBRARY_KEY) ?? '[]'); }
    catch { return []; }
  },

  add(trackObj) {
    const all = this.getAll();
    // Replace existing track with same id
    const idx = all.findIndex(t => t.id === trackObj.id);
    const entry = { ...trackObj, _addedAt: new Date().toISOString() };
    if (idx >= 0) all[idx] = entry;
    else all.unshift(entry);
    try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(all)); } catch {}
    return entry;
  },

  remove(trackId) {
    const filtered = this.getAll().filter(t => t.id !== trackId);
    try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(filtered)); } catch {}
  },

  find(trackId) {
    return this.getAll().find(t => t.id === trackId) ?? null;
  },
};

/* ═══════════════════════════════════════════════
   SHARE URL HELPERS
═══════════════════════════════════════════════ */

/** Build a share URL for a track using the page's current origin */
export function buildShareURL(trackObj) {
  const hash = encodeTrack(trackObj);
  return `${location.origin}${location.pathname}arcade.html#share=${hash}`;
}

/**
 * Read #share= from the current URL and return the decoded track, or null.
 * Call this on arcade.html load to auto-import shared tracks.
 */
export function readShareURL() {
  const fragment = location.hash.slice(1);
  const params   = new URLSearchParams(fragment);
  const hash     = params.get('share');
  return hash ? decodeTrack(hash) : null;
}
