// A2703a: pure project save/import/export helpers for the Arcade Game Maker.
// No DOM and no window globals: the maker passes its save object in and gets a
// string or a normalised object back.

export const SAVE_VERSION = 1;
export const AUTOSAVE_KEY = 'jv_arcade_autosave';

export function normalise(data) {
  if (!data || typeof data !== 'object') throw new Error('Invalid project file');
  const out = Object.assign({}, data);
  out.liveConfig = out.liveConfig && typeof out.liveConfig === 'object' ? out.liveConfig : {};
  out.title = out.title || 'Imported Game';
  out.version = out.version || SAVE_VERSION;
  return out;
}

export function toJSON(data, pretty = true) {
  return JSON.stringify(data, null, pretty ? 2 : 0);
}

export function fromJSON(text) {
  return normalise(JSON.parse(String(text || '')));
}

// Exported HTML keeps the config in `window.__exportMode=true;var _c={...};`.
export function fromHTML(text) {
  const match = String(text || '').match(/window\.__exportMode=true;var _c=(\{.*?\});/s);
  if (!match) throw new Error('No config found in HTML file');
  const d = JSON.parse(match[1]);
  d.liveConfig = d.liveConfig || {};
  d.title = d.title || 'Imported Game';
  return normalise(d);
}

export function fromFileText(text, filename) {
  return /\.html$/i.test(String(filename || '')) ? fromHTML(text) : fromJSON(text);
}

export function downloadName(title, ext = 'json') {
  const base = String(title || 'arcade-game').replace(/[^a-z0-9]/gi, '-').toLowerCase().replace(/^-+|-+$/g, '') || 'arcade-game';
  return base + '.' + ext;
}

export const SaveState = {
  SAVE_VERSION,
  AUTOSAVE_KEY,
  normalise,
  toJSON,
  fromJSON,
  fromHTML,
  fromFileText,
  downloadName
};

export default SaveState;
