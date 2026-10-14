/* Unit test for workshops/builder-gestures.js (plain Node, no browser).
   Run: node tests/builder-gestures-unit.js
   Covers the shared touch layer A1480 wires into all 11 3D builders:
   tap-vs-drag slop, one-finger orbit, two-finger pinch, preventDefault
   (page-scroll guard), detach, NDC math and tap-select raycasting. */
'use strict';
const assert = require('assert');
const G = require('../workshops/builder-gestures.js');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log('PASS ' + name); }
  catch (e) { failures++; console.log('FAIL ' + name + ' - ' + e.message); }
}

function makeCanvas() {
  const listeners = {};
  return {
    style: {},
    clientWidth: 300, clientHeight: 150,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 150 }),
    addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
    removeEventListener(t, fn) { listeners[t] = (listeners[t] || []).filter(f => f !== fn); },
    fire(t, ev) { (listeners[t] || []).forEach(f => f(ev)); },
    count(t) { return (listeners[t] || []).length; }
  };
}
function touchEvt(touches, changed) {
  const ev = { touches, changedTouches: changed || touches, prevented: 0, preventDefault() { this.prevented++; } };
  return ev;
}
const touch = (x, y) => ({ clientX: x, clientY: y });

check('attach sets touch-action:none and adds listeners', () => {
  const c = makeCanvas();
  G.attach(c, {});
  assert.strictEqual(c.style.touchAction, 'none');
  assert.ok(c.count('touchstart') === 1 && c.count('touchmove') === 1 &&
    c.count('touchend') === 1 && c.count('touchcancel') === 1);
});

check('still finger is a tap, not a 1px orbit', () => {
  const c = makeCanvas();
  const taps = [], orbits = [];
  G.attach(c, { onTap: (x, y) => taps.push([x, y]), onOrbit: (dx, dy) => orbits.push([dx, dy]) });
  const start = touchEvt([touch(50, 50)]);
  c.fire('touchstart', start);
  const end = touchEvt([], [touch(50, 50)]);
  c.fire('touchend', end);
  assert.strictEqual(taps.length, 1, 'one tap expected');
  assert.deepStrictEqual(taps[0], [50, 50]);
  assert.strictEqual(orbits.length, 0, 'no orbit for a tap');
  assert.ok(start.prevented > 0 && end.prevented > 0, 'preventDefault on start+end');
});

check('jitter under TAP_SLOP stays a tap', () => {
  const c = makeCanvas();
  const taps = [], orbits = [];
  G.attach(c, { onTap: () => taps.push(1), onOrbit: () => orbits.push(1) });
  c.fire('touchstart', touchEvt([touch(50, 50)]));
  c.fire('touchmove', touchEvt([touch(54, 53)])); // ~5px, under 10
  c.fire('touchend', touchEvt([], [touch(54, 53)]));
  assert.strictEqual(orbits.length, 0, 'no orbit under slop');
  assert.strictEqual(taps.length, 1, 'tap still fires');
});

check('drag past slop orbits, fires dragStart/dragEnd, and is not a tap', () => {
  const c = makeCanvas();
  const orbits = [], taps = [];
  let started = 0, ended = 0;
  G.attach(c, {
    onOrbit: (dx, dy) => orbits.push([dx, dy]),
    onTap: () => taps.push(1),
    onDragStart: () => started++, onDragEnd: () => ended++
  });
  const move = touchEvt([touch(80, 50)]);
  c.fire('touchstart', touchEvt([touch(50, 50)]));
  c.fire('touchmove', move);
  c.fire('touchend', touchEvt([], [touch(80, 50)]));
  assert.strictEqual(orbits.length, 1, 'one orbit delta');
  assert.deepStrictEqual(orbits[0], [30, 0]);
  assert.strictEqual(started, 1, 'dragStart once (on first move past slop)');
  assert.strictEqual(ended, 1, 'dragEnd once');
  assert.strictEqual(taps.length, 0, 'a drag is never a tap');
  assert.ok(move.prevented > 0, 'preventDefault on move (scroll guard)');
});

check('two-finger pinch reports prevDist/dist ratio', () => {
  const c = makeCanvas();
  const pinches = [];
  G.attach(c, { onPinch: (ratio, d, prev) => pinches.push([ratio, d, prev]) });
  c.fire('touchstart', touchEvt([touch(100, 50), touch(200, 50)])); // dist 100
  c.fire('touchmove', touchEvt([touch(100, 50), touch(150, 50)]));  // dist 50 -> ratio 2
  assert.strictEqual(pinches.length, 1);
  assert.ok(Math.abs(pinches[0][0] - 2) < 1e-9, 'ratio = prevDist/dist');
  assert.ok(Math.abs(pinches[0][2] - 100) < 1e-9, 'prevDist recorded');
});

check('detach removes every listener', () => {
  const c = makeCanvas();
  const detach = G.attach(c, {});
  detach();
  assert.strictEqual(c.count('touchstart') + c.count('touchmove') + c.count('touchend') + c.count('touchcancel'), 0);
});

check('ndc maps canvas corners to -1..1', () => {
  const c = makeCanvas();
  const tl = G._internals.ndc(0, 0, c);
  const br = G._internals.ndc(300, 150, c);
  assert.ok(Math.abs(tl.x + 1) < 1e-9 && Math.abs(tl.y - 1) < 1e-9, 'top-left');
  assert.ok(Math.abs(br.x - 1) < 1e-9 && Math.abs(br.y + 1) < 1e-9, 'bottom-right');
});

check('pick raycasts the group and returns the first mesh', () => {
  const mesh = { isMesh: true, material: { visible: true } };
  const notMesh = { isMesh: false };
  global.THREE = {
    Vector2: function () {},
    Raycaster: function () {
      this.setFromCamera = () => {};
      this.intersectObject = (g) => g._hits || [];
    }
  };
  const group = { _hits: [{ object: notMesh }, { object: mesh }] };
  const c = makeCanvas();
  const hit = G.pick(10, 10, c, {}, group);
  assert.strictEqual(hit.object, mesh, 'skips non-mesh hit');
  delete global.THREE;
});

check('attachTapSelect fires onSelect and boxes the tapped part', () => {
  const mesh = { isMesh: true, material: { visible: true }, parent: null };
  let added = null;
  const scene = { add(o) { added = o; o.parent = this; } };
  const group = { _hits: [{ object: mesh }], parent: scene };
  global.THREE = {
    Vector2: function () {},
    Raycaster: function () {
      this.setFromCamera = () => {};
      this.intersectObject = (g) => g._hits || [];
    },
    BoxHelper: function (obj) { this.object = obj; this.material = {}; this.geometry = { dispose() {} }; this.parent = null; }
  };
  const c = makeCanvas();
  let selected = null;
  G.attachTapSelect(c, {}, () => group, { onSelect: (h) => { selected = h; } });
  c.fire('touchstart', touchEvt([touch(50, 50)]));
  c.fire('touchend', touchEvt([], [touch(50, 50)]));
  assert.ok(selected && selected.object === mesh, 'onSelect gets the hit');
  assert.ok(added && added.object === mesh, 'BoxHelper added for the hit');
  delete global.THREE;
});

if (failures) { console.log('\n' + failures + ' CHECK(S) FAILED'); process.exit(1); }
console.log('\nALL BUILDER-GESTURES CHECKS PASSED');
