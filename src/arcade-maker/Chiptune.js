// A2569: a tiny zero-dependency chiptune sequencer.
// Returns note data; the maker schedules it with Web Audio on a user click.

export const PRESETS = {
  heroic: {
    label: 'Heroic',
    root: 60,
    scale: [0, 2, 4, 5, 7, 9, 11],
    pattern: [0, 4, 7, 4, 2, 5, 9, 5, 3, 7, 10, 7, 2, 5, 7, 5]
  },
  spooky: {
    label: 'Spooky',
    root: 57,
    scale: [0, 2, 3, 5, 6, 8, 10],
    pattern: [0, 3, 6, 3, 1, 4, 6, 4, 0, 3, 5, 3, 1, 4, 7, 4]
  },
  arcade: {
    label: 'Arcade',
    root: 62,
    scale: [0, 2, 4, 7, 9],
    pattern: [0, 2, 4, 7, 4, 2, 0, 2, 0, 4, 7, 9, 7, 4, 2, 0]
  }
};

export function sequence({ preset = 'heroic', bars = 4, bpm = 120, scale = null } = {}) {
  const p = PRESETS[preset] || PRESETS.heroic;
  const safeBpm = Math.max(40, Math.min(240, Number(bpm) || 120));
  const safeBars = Math.max(1, Math.min(8, Number(bars) || 4));
  const steps = Math.round(safeBars * 4);
  const stepTime = (60 / safeBpm) / 4;
  const scaleNotes = Array.isArray(scale) && scale.length ? scale : p.scale;
  const notes = [];
  for (let i = 0; i < steps; i++) {
    const degree = p.pattern[i % p.pattern.length] || 0;
    const octave = Math.floor(degree / scaleNotes.length);
    const midi = p.root + scaleNotes[degree % scaleNotes.length] + octave * 12;
    notes.push({ step: i, time: Number((i * stepTime).toFixed(4)), midi, dur: Number((stepTime * 0.85).toFixed(4)) });
  }
  return { preset, label: p.label, bars: safeBars, bpm: safeBpm, stepTime, notes };
}

export const Chiptune = { PRESETS, sequence };
export default Chiptune;
