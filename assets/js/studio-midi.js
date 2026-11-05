// studio-midi.js (A2107)
// Small, dependency-free Type 1 MIDI writer and reader for the browser studios.
// Works in the page (window.StudioMIDI) and in Node (module.exports) so the
// round trip can be checked without a browser.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StudioMIDI = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var PPQ = 480;              // ticks per quarter note
  var STEP_TICKS = PPQ / 4;   // one 16th-note step
  var DRUM_CHANNEL = 9;       // General MIDI percussion channel

  function noteToMidi(name, oct) {
    var i = NOTE_NAMES.indexOf(String(name || 'C').toUpperCase());
    if (i < 0) i = 0;
    var o = oct == null ? 4 : Number(oct);
    if (!isFinite(o)) o = 4;
    return Math.max(0, Math.min(127, 12 * (o + 1) + i));
  }

  function midiToNote(midi) {
    var n = Math.max(0, Math.min(127, Math.round(Number(midi) || 0)));
    return { name: NOTE_NAMES[n % 12], oct: Math.floor(n / 12) - 1 };
  }

  function pushVar(out, value) {
    var buffer = value & 0x7f;
    while ((value >>= 7)) {
      buffer <<= 8;
      buffer |= ((value & 0x7f) | 0x80);
    }
    for (;;) {
      out.push(buffer & 0xff);
      if (buffer & 0x80) buffer >>= 8;
      else break;
    }
  }

  function pushU16(out, v) { out.push((v >> 8) & 0xff, v & 0xff); }
  function pushU32(out, v) { out.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff); }

  function textBytes(str) {
    var out = [];
    str = String(str == null ? '' : str);
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i) & 0x7f;
      out.push(c || 32);
    }
    return out;
  }

  function meta(type, data) {
    var out = [0x00, 0xff, type];
    pushVar(out, data.length);
    return out.concat(data);
  }

  function chunk(data) {
    var out = [0x4d, 0x54, 0x72, 0x6b]; // MTrk
    pushU32(out, data.length);
    return out.concat(data);
  }

  function buildTempoTrack(bpm, name) {
    var data = [];
    var us = Math.max(1, Math.round(60000000 / Math.max(1, bpm || 120)));
    data = data.concat(meta(0x51, [(us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff]));
    data = data.concat(meta(0x58, [0x04, 0x02, 0x18, 0x08])); // 4/4
    data = data.concat(meta(0x03, textBytes(name || 'JVDS Sound Studio')));
    data = data.concat([0x00, 0xff, 0x2f, 0x00]);
    return chunk(data);
  }

  function buildNoteTrack(track, trackIndex, grid, steps) {
    track = track || {};
    var row = (grid && grid[trackIndex]) || [];
    var events = [];
    for (var s = 0; s < steps; s++) {
      var cell = row[s];
      if (!cell || !cell.on) continue;
      var midi = noteToMidi(cell.note, cell.oct != null ? cell.oct : track.oct);
      var vel = Math.max(1, Math.min(127, Math.round((cell.vel == null ? 1 : cell.vel) * 127)));
      var start = s * STEP_TICKS;
      var dur = Math.max(1, Number(cell.len) || 1) * STEP_TICKS;
      var channel = (track.drum && track.drum !== 'none') ? DRUM_CHANNEL : 0;
      events.push({ tick: start, order: 1, midi: midi, vel: vel, channel: channel, on: true });
      events.push({ tick: start + dur, order: 0, midi: midi, vel: 0, channel: channel, on: false });
    }
    events.sort(function (a, b) {
      return (a.tick - b.tick) || (a.order - b.order);
    });
    var data = meta(0x03, textBytes(track.name || ('Track ' + (trackIndex + 1))));
    var last = 0;
    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      pushVar(data, e.tick - last);
      last = e.tick;
      data.push(((e.on ? 0x90 : 0x80) | e.channel) & 0xff, e.midi & 0x7f, e.vel & 0x7f);
    }
    data = data.concat([0x00, 0xff, 0x2f, 0x00]);
    return chunk(data);
  }

  function encode(opts) {
    opts = opts || {};
    var bpm = Number(opts.bpm) || 120;
    var steps = Number(opts.steps) || 16;
    var tracks = Array.isArray(opts.tracks) ? opts.tracks : [];
    var grid = Array.isArray(opts.grid) ? opts.grid : [];
    var chunks = [buildTempoTrack(bpm, opts.name)];
    for (var ti = 0; ti < tracks.length; ti++) {
      chunks.push(buildNoteTrack(tracks[ti], ti, grid, steps));
    }
    var out = [0x4d, 0x54, 0x68, 0x64]; // MThd
    pushU32(out, 6);
    pushU16(out, tracks.length ? 1 : 0);
    pushU16(out, chunks.length);
    pushU16(out, PPQ);
    for (var c = 0; c < chunks.length; c++) out = out.concat(chunks[c]);
    return new Uint8Array(out);
  }

  function decode(input) {
    var bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    var pos = 0;

    function u8() { return bytes[pos++]; }
    function u16() { var v = (bytes[pos] << 8) | bytes[pos + 1]; pos += 2; return v; }
    function u32() {
      var v = ((bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3]) >>> 0;
      pos += 4;
      return v;
    }
    function str(n) {
      var s = '';
      for (var i = 0; i < n; i++) s += String.fromCharCode(bytes[pos++]);
      return s;
    }
    function vlq() {
      var v = 0, b;
      do { b = bytes[pos++]; v = (v << 7) | (b & 0x7f); } while (b & 0x80);
      return v;
    }

    if (str(4) !== 'MThd') throw new Error('not a MIDI file');
    var headerLen = u32();
    if (headerLen < 6) throw new Error('bad MIDI header');
    var format = u16();
    var ntrks = u16();
    var division = u16();
    if (division & 0x8000) throw new Error('SMPTE timing is not supported');
    var ppq = division || PPQ;
    if (headerLen > 6) pos += headerLen - 6;

    var bpm = 120;
    var tracksOut = [];
    var guard = 0;

    while (tracksOut.length < ntrks && pos + 8 <= bytes.length && guard++ < 4096) {
      var id = str(4);
      var len = u32();
      var end = pos + len;
      if (id !== 'MTrk') { pos = end; continue; }

      var abs = 0, running = 0, trackName = '', hasChannel = false, notes = [], active = {};

      while (pos < end) {
        var delta = vlq();
        abs += delta;
        if (pos >= end) break;
        var status = bytes[pos];
        var type;
        if (status < 0x80) {
          type = running;
        } else {
          pos++;
          if (status < 0xf0) running = status;
          type = status;
        }

        if (type === 0xff) {
          var mtype = u8();
          var mlen = vlq();
          if (mtype === 0x51 && mlen === 3) {
            var us = (bytes[pos] << 16) | (bytes[pos + 1] << 8) | bytes[pos + 2];
            if (us > 0) bpm = Math.round(60000000 / us);
            pos += 3;
          } else if (mtype === 0x03) {
            trackName = str(mlen);
          } else if (mtype === 0x2f) {
            pos = end;
            break;
          } else {
            pos += mlen;
          }
          continue;
        }

        if (type === 0xf0 || type === 0xf7) {
          var slen = vlq();
          pos += slen;
          continue;
        }

        var cmd = type & 0xf0;
        var ch = type & 0x0f;
        if (cmd === 0xc0 || cmd === 0xd0) { u8(); continue; }
        if (cmd === 0x80 || cmd === 0x90) {
          var n = u8(), v = u8();
          var key = ch + ':' + n;
          hasChannel = true;
          if (cmd === 0x90 && v > 0) {
            active[key] = { tick: abs, vel: v, channel: ch, midi: n };
          } else if (active[key]) {
            var a = active[key];
            notes.push({
              midi: a.midi,
              startTicks: a.tick,
              durTicks: Math.max(1, abs - a.tick),
              velocity: a.vel,
              channel: a.channel
            });
            delete active[key];
          }
          continue;
        }
        // Other channel voice messages (aftertouch, controller, pitch bend)
        u8(); u8();
      }

      Object.keys(active).forEach(function (k) {
        var a = active[k];
        notes.push({
          midi: a.midi,
          startTicks: a.tick,
          durTicks: Math.max(1, abs - a.tick),
          velocity: a.vel,
          channel: a.channel
        });
      });

      tracksOut.push({
        name: trackName,
        channel: notes.length ? notes[0].channel : 0,
        hasChannel: hasChannel,
        notes: notes,
        isConductor: (format === 1 && tracksOut.length === 0 && !hasChannel && notes.length === 0)
      });
      pos = end;
    }

    return { format: format, ppq: ppq, bpm: bpm, tracks: tracksOut };
  }

  return {
    PPQ: PPQ,
    STEP_TICKS: STEP_TICKS,
    NOTE_NAMES: NOTE_NAMES.slice(),
    noteToMidi: noteToMidi,
    midiToNote: midiToNote,
    encode: encode,
    decode: decode
  };
});
