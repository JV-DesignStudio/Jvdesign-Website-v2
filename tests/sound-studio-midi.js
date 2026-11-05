#!/usr/bin/env node
// A2107: Audio Studio MIDI export/import round trip.
// Pure Node: exercises the shared module the page loads, plus a static check
// that tools/sound-studio.html is wired to the export/import buttons.
const fs = require('fs');
const path = require('path');
const StudioMIDI = require('../assets/js/studio-midi.js');

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

// --- pitch helpers ---
check('C4 is MIDI 60', StudioMIDI.noteToMidi('C', 4) === 60);
check('A4 is MIDI 69', StudioMIDI.noteToMidi('A', 4) === 69);
check('MIDI 60 is C4', JSON.stringify(StudioMIDI.midiToNote(60)) === JSON.stringify({ name: 'C', oct: 4 }));

// --- build a known pattern (same cell shape the studio uses) ---
const tracks = [
  { name: 'Kick', drum: 'kick', oct: 1 },
  { name: 'Bass', drum: 'none', oct: 2 },
  { name: 'Melody', drum: 'none', oct: 4 }
];
const empty = () => Array.from({ length: 16 }, (_, i) => ({ on: false, note: 'C', len: 1, vel: 1, oct: 4 }));
const grid = [empty(), empty(), empty()];
grid[0][0] = { on: true, note: 'C', oct: 1, len: 1, vel: 1 };
grid[0][4] = { on: true, note: 'C', oct: 1, len: 1, vel: 1 };
grid[1][0] = { on: true, note: 'C', oct: 2, len: 4, vel: 0.8 };
grid[2][2] = { on: true, note: 'E', oct: 4, len: 2, vel: 1 };
grid[2][6] = { on: true, note: 'G', oct: 4, len: 1, vel: 0.5 };

const bytes = StudioMIDI.encode({ bpm: 140, steps: 16, tracks, grid, name: 'Test song' });
check('encode returns a byte array', bytes instanceof Uint8Array && bytes.length > 40, String(bytes.length));
check('starts with MThd', String.fromCharCode.apply(null, bytes.slice(0, 4)) === 'MThd');

const decoded = StudioMIDI.decode(bytes);
check('reads format 1', decoded.format === 1, String(decoded.format));
check('reads tempo', decoded.bpm === 140, String(decoded.bpm));
check('reads 480 ticks per quarter', decoded.ppq === 480, String(decoded.ppq));

const inst = decoded.tracks.filter(t => !t.isConductor);
check('one track per instrument', inst.length === tracks.length, String(inst.length));
check('conductor marked', decoded.tracks[0].isConductor === true);

const totalNotes = inst.reduce((n, t) => n + t.notes.length, 0);
check('same note count after round trip', totalNotes === 5, String(totalNotes));

const kick = inst[0];
check('drum track uses channel 10', kick.notes.every(n => n.channel === 9), JSON.stringify(kick.notes.map(n => n.channel)));
check('kick note 1 starts at 0', kick.notes[0].startTicks === 0, String(kick.notes[0].startTicks));
check('kick note 2 starts on beat 2', kick.notes[1].startTicks === 480, String(kick.notes[1].startTicks));

const bass = inst[1];
check('bass pitch C2', bass.notes[0].midi === StudioMIDI.noteToMidi('C', 2), String(bass.notes[0].midi));
check('bass duration keeps 4 steps', bass.notes[0].durTicks === 4 * 120, String(bass.notes[0].durTicks));

const melody = inst[2];
check('melody pitches survive', melody.notes.map(n => n.midi).join(',') === [64, 67].join(','), melody.notes.map(n => n.midi).join(','));
check('melody durations survive', melody.notes.map(n => n.durTicks).join(',') === [240, 120].join(','), melody.notes.map(n => n.durTicks).join(','));

// Re-importing the decoded notes maps back onto the grid cells.
const back = grid.map(row => row.map(c => ({ ...c })));
const tickStep = decoded.ppq / 4;
inst.forEach((mt, ti) => {
  (mt.notes || []).forEach(n => {
    const step = Math.round(n.startTicks / tickStep);
    const note = StudioMIDI.midiToNote(n.midi);
    back[ti][step] = {
      on: true, note: note.name, oct: note.oct,
      len: Math.max(1, Math.round(n.durTicks / tickStep)),
      vel: n.velocity / 127
    };
  });
});
let same = true;
for (let t = 0; t < grid.length; t++) {
  for (let s = 0; s < grid[t].length; s++) {
    const a = grid[t][s], b = back[t][s];
    if (!!a.on !== !!b.on) same = false;
    if (a.on && (a.note !== b.note || a.oct !== b.oct || a.len !== b.len)) same = false;
  }
}
check('round trip restores the grid', same);

// --- read an external format-0 file with running status ---
const external = new Uint8Array([
  0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06,
  0x00, 0x00, 0x00, 0x01, 0x01, 0xe0,
  0x4d, 0x54, 0x72, 0x6b, 0x00, 0x00, 0x00, 0x13,
  0x00, 0xff, 0x03, 0x03, 0x50, 0x6e, 0x6f,
  0x00, 0x90, 0x3c, 0x64,
  0x83, 0x60, 0x3c, 0x00,
  0x00, 0xff, 0x2f, 0x00
]);
const ext = StudioMIDI.decode(external);
check('external file reads', ext.format === 0 && ext.tracks.length === 1);
check('external note off via running status', ext.tracks[0].notes.length === 1, String(ext.tracks[0].notes.length));
check('external duration is one beat', ext.tracks[0].notes[0].durTicks === 480, String(ext.tracks[0].notes[0].durTicks));
check('external velocity kept', ext.tracks[0].notes[0].velocity === 100, String(ext.tracks[0].notes[0].velocity));

// --- empty project still writes a valid file ---
const emptyFile = StudioMIDI.decode(StudioMIDI.encode({ bpm: 90, steps: 8, tracks: [], grid: [] }));
check('empty project is a valid MIDI file', emptyFile.format === 0 && emptyFile.bpm === 90);

// --- the page is wired to the module and the controls ---
const html = fs.readFileSync(path.join(__dirname, '..', 'tools', 'sound-studio.html'), 'utf8');
check('page loads the shared module', /<script src="\.\.\/assets\/js\/studio-midi\.js"><\/script>/.test(html));
check('page has export button', /data-on="exportMIDI"/.test(html));
check('page has import button', /data-on="importMIDI"/.test(html));
check('page has MIDI file input', /id="midiFileInput"[^>]*accept="[^"]*\.mid/.test(html));
check('import writes into the pattern grid', /patterns\[currentPattern\]\.grid=g;/.test(html));

if (failures) {
  console.error('\n' + failures + ' MIDI check(s) failed');
  process.exit(1);
}
console.log('\nsound-studio-midi PASS');
