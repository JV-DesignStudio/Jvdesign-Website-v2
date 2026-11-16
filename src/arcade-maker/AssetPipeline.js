// A2072b: one normalised shape for imported sprites, sounds and levels.
// The maker can pass anything it found in another studio and get a manifest it
// can save, export or hand to the game boot.

export function normaliseSprite(sprite) {
  const s = sprite || {};
  return {
    kind: 'sprite',
    name: s.name || 'sprite',
    dataUrl: s.dataUrl || '',
    w: Math.max(1, Math.min(512, Number(s.w) || 16)),
    h: Math.max(1, Math.min(512, Number(s.h) || 16)),
    frames: Math.max(1, Number(s.frames) || 1)
  };
}

export function normaliseSound(sound) {
  const s = sound || {};
  return {
    kind: 'sound',
    name: s.name || 'sound',
    dataUrl: s.dataUrl || '',
    volume: Math.max(0, Math.min(1, Number(s.volume == null ? 1 : s.volume))),
    loop: !!s.loop
  };
}

export function normaliseLevel(level) {
  const l = level || {};
  return {
    kind: 'level',
    name: l.name || 'level',
    w: Math.max(1, Math.min(256, Number(l.w) || 20)),
    h: Math.max(1, Math.min(256, Number(l.h) || 15)),
    map: Array.from(l.map || []).map(v => Math.min(2, Math.max(0, v | 0)))
  };
}

export function buildManifest(input = {}) {
  return {
    version: 1,
    sprites: (input.sprites || []).map(normaliseSprite),
    sounds: (input.sounds || []).map(normaliseSound),
    levels: (input.levels || []).map(normaliseLevel)
  };
}

export const AssetPipeline = { normaliseSprite, normaliseSound, normaliseLevel, buildManifest };
export default AssetPipeline;
