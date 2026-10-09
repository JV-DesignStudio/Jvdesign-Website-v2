/*!
 * game-showcase.js - A952 shared "showcase polish" for the flagship arcade games.
 *
 * The three showcase runners (Crossy Crew, Highway Dodge, Lumo's Dash) each need
 * the same three things: a reason to keep playing (milestone progression), clear
 * feedback when something happens (screen shake) and a bit of animation life
 * (running dust). This file is the single implementation so the games do not
 * each hand-roll it, and so the behaviour stays identical across the trio.
 *
 * No build step, no dependencies. Load with:
 *   <script src="../game-showcase.js"></script>
 *
 * API:
 *   var ms = new JVDSShowcase.Milestones([10, 25, 50], function (value, ms) {
 *     // fires once per threshold, in order
 *   });
 *   ms.reset(); ms.check(currentValue); ms.next();
 *
 *   var shake = new JVDSShowcase.Shake(12);
 *   shake.hit(16);                       // trigger (uses 16, or the base if omitted)
 *   ctx.save(); shake.apply(ctx, dpr); ...draw...; ctx.restore();
 *   shake.decay();                       // call once per frame
 *
 *   JVDSShowcase.dust(particles, x, y, '#fff', 3, { drift: 60 });
 */
(function (global) {
  'use strict';

  // Milestone progression: thresholds fire once, in order, as a value climbs.
  function Milestones(list, onReach) {
    this.list = (list || []).slice().sort(function (a, b) { return a - b; });
    this.onReach = onReach || null;
    this.index = 0;
  }
  Milestones.prototype.reset = function () { this.index = 0; return this; };
  Milestones.prototype.next = function () {
    return this.index < this.list.length ? this.list[this.index] : null;
  };
  Milestones.prototype.check = function (value) {
    var reached = [];
    while (this.index < this.list.length && value >= this.list[this.index]) {
      reached.push(this.list[this.index]);
      this.index++;
    }
    if (this.onReach) {
      for (var i = 0; i < reached.length; i++) this.onReach(reached[i], this);
    }
    return reached;
  };

  // Screen shake: hit() to trigger, apply() inside save/restore, decay() per frame.
  // `hits` counts triggers since the last reset() so tests can prove a death shake.
  function Shake(strength) { this.base = strength || 12; this.amount = 0; this.hits = 0; }
  Shake.prototype.reset = function () { this.amount = 0; this.hits = 0; return this; };
  Shake.prototype.hit = function (strength) {
    this.amount = Math.max(this.amount, strength || this.base);
    this.hits++;
    return this;
  };
  Shake.prototype.apply = function (ctx, dpr) {
    if (this.amount <= 0) return false;
    var a = this.amount * (dpr || 1);
    ctx.translate((Math.random() - .5) * a, (Math.random() - .5) * a);
    return true;
  };
  Shake.prototype.decay = function () {
    this.amount *= .86;
    if (this.amount < .4) this.amount = 0;
    return this;
  };

  // Running dust: puffs pushed into a game's own particle array. The field names
  // match the particle shape all three games already update and draw.
  function dust(particles, x, y, color, n, opts) {
    opts = opts || {};
    var spread = opts.spread || 34;
    var up = opts.up || 70;
    for (var i = 0; i < (n || 3); i++) {
      particles.push({
        x: x + (Math.random() - .5) * spread,
        y: y + (Math.random() - .5) * (opts.spreadY || 8),
        vx: -(opts.drift || 60) - Math.random() * 70,
        vy: -Math.random() * up,
        life: opts.life || .55,
        color: color,
        size: (opts.size || 2) + Math.random() * 2
      });
    }
  }

  global.JVDSShowcase = { Milestones: Milestones, Shake: Shake, dust: dust };
})(typeof window !== 'undefined' ? window : this);
