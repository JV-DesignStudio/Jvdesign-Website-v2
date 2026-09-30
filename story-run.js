/*!
 * story-run.js - A585 shared story-run layer for arcade action games.
 *
 * The A584 contract promised every arcade card would run as one short story:
 * an opening problem, one skillful loop, a rising beat, a finish/score screen
 * and a one-line story result, capped at five minutes with no grind. A584 only
 * labelled the cards; this file is the runtime that makes the run real so each
 * game implements the same shape instead of fifteen hand-rolled timers.
 *
 * A game opts in with a config and a few callbacks:
 *
 *   const run = new StoryRun({
 *     id: 'dough-dash',
 *     gameSystem: gameSystem,             // optional, for score/XP/achievements
 *     title: 'Ember's Bakery Rush',
 *     character: 'Ember',
 *     open: 'Ember's dough is rolling and the kitchen is on fire with orders.',
 *     objective: 'Deliver the orders before the heat runs out.',
 *     beats: [                            // rising beat, in order
 *       { at: 0.0, text: 'First order on the pass.' },
 *       { at: 0.5, text: 'The rush doubles up.' },
 *       { at: 0.85, text: 'Last call, the ovens are glowing.' }
 *     ],
 *     cap: 300,                           // seconds, default 300 (5:00)
 *     result: {                           // one-line story result per outcome
 *       success: 'The last oven opens and Ember high-fives you.',
 *       partial: 'Most orders land, one burns and the shift still ends.',
 *       fail: 'The kitchen wins this round, but the dough is still warm.'
 *     },
 *     onStart, onTick, onBeat, onFinish, onRestart   // optional callbacks
 *   });
 *
 *   run.begin();                 // start the clock + HUD
 *   run.beat(1);                 // push a rising beat (or call run.tick() and
 *                                // let the `beats` timeline fire them)
 *   run.finish('success', score) // show the finish/score screen
 *
 * StoryRun never owns game state. It only reports run progress and renders its
 * own HUD/modal nodes, so a game keeps its existing loop untouched.
 *
 * No build step: load with <script src="../story-run.js"> after game-system.js.
 */
(function (global) {
  'use strict';

  var DEFAULT_CAP = 300; // five minutes

  function fmt(sec) {
    sec = Math.max(0, Math.ceil(sec));
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function StoryRun(cfg) {
    cfg = cfg || {};
    this.cfg = cfg;
    this.id = cfg.id || 'story-run';
    this.character = cfg.character || 'Pip';
    this.title = cfg.title || 'Story Run';
    this.cap = typeof cfg.cap === 'number' && cfg.cap > 0 ? cfg.cap : DEFAULT_CAP;
    this.beats = Array.isArray(cfg.beats) ? cfg.beats.slice().sort(function (a, b) { return a.at - b.at; }) : [];
    this.result = cfg.result || {};
    this.gameSystem = cfg.gameSystem || global.gameSystem || null;

    this.running = false;
    this.finished = false;
    this.elapsed = 0;
    this.beatIndex = 0;
    this.outcome = '';
    this.score = 0;
    this._last = 0;
    this._raf = null;
  }

  StoryRun.prototype._mount = function () {
    if (this._root) return;
    var root = el('div', 'storyrun');
    root.setAttribute('data-storyrun', this.id);

    var bar = el('div', 'sr-bar');
    var lead = el('div', 'sr-lead');
    lead.appendChild(el('span', 'sr-guide', this.character));
    lead.appendChild(el('strong', 'sr-title', this.title));
    var clock = el('div', 'sr-clock');
    clock.appendChild(el('span', 'sr-time', fmt(this.cap)));
    clock.appendChild(el('i', 'sr-clock-fill'));
    bar.appendChild(lead);
    bar.appendChild(clock);

    var story = el('div', 'sr-story');
    story.appendChild(el('p', 'sr-open', this.cfg.open || ''));
    var obj = el('p', 'sr-objective');
    obj.appendChild(el('b', null, 'Goal. '));
    obj.appendChild(el('span', null, this.cfg.objective || ''));
    story.appendChild(obj);
    var beat = el('p', 'sr-beat');
    story.appendChild(beat);

    root.appendChild(bar);
    root.appendChild(story);

    this._modal = null;
    this._root = root;
    this._timeEl = clock.querySelector('.sr-time');
    this._fillEl = clock.querySelector('.sr-clock-fill');
    this._beatEl = beat;
    this._btn = null;

    var host = document.querySelector('[data-storyrun-host]') || document.querySelector('main') || document.body;
    host.insertBefore(root, host.firstChild);
  };

  StoryRun.prototype._hud = function () {
    if (!this._root) return;
    var left = this.cap - this.elapsed;
    this._timeEl.textContent = fmt(left);
    this._fillEl.style.width = Math.max(0, Math.min(1, left / this.cap)) * 100 + '%';
    var warn = left <= 30;
    this._root.classList.toggle('is-lowtime', warn);
    this._root.classList.toggle('is-running', this.running);
  };

  StoryRun.prototype.begin = function () {
    this._mount();
    this.running = true;
    this.finished = false;
    this.elapsed = 0;
    this.beatIndex = 0;
    this.outcome = '';
    this.score = 0;
    this._beatEl.textContent = this.beats.length ? this.beats[0].text : '';
    this._beatEl.classList.toggle('show', this.beats.length > 0);
    if (this._modal && this._modal.parentNode) this._modal.parentNode.removeChild(this._modal);
    this._modal = null;
    this._hud();
    this._last = 0;
    if (typeof this.cfg.onStart === 'function') { try { this.cfg.onStart.call(this); } catch (e) { /* game-owned */ } }
    this._loop(0);
    return this;
  };

  StoryRun.prototype._loop = function (t) {
    if (!this.running) return;
    if (!this._last) this._last = t;
    var dt = Math.min(0.05, (t - this._last) / 1000);
    this._last = t;
    this.elapsed += dt;
    this.tick(this.elapsed);
    if (typeof this.cfg.onTick === 'function') { try { this.cfg.onTick.call(this, this.elapsed); } catch (e) {} }
    this._hud();
    if (this.elapsed >= this.cap) { this.finish('partial', this.score, true); return; }
    var self = this;
    this._raf = global.requestAnimationFrame(function (nt) { self._loop(nt); });
  };

  // Fired by the timeline or called directly by the host game.
  StoryRun.prototype.beat = function (index) {
    if (this.finished) return;
    var b = this.beats[index];
    if (!b) return;
    this.beatIndex = index + 1;
    this._beatEl.textContent = b.text;
    this._beatEl.classList.remove('pulse');
    void this._beatEl.offsetWidth;
    this._beatEl.classList.add('show', 'pulse');
    this._hud();
    if (typeof this.cfg.onBeat === 'function') { try { this.cfg.onBeat.call(this, b, index); } catch (e) {} }
  };

  StoryRun.prototype.tick = function (elapsed) {
    if (typeof elapsed !== 'number') elapsed = this.elapsed;
    var next = this.beats[this.beatIndex];
    if (next && elapsed / this.cap >= next.at) this.beat(this.beatIndex);
    return this;
  };

  // Set the live score without ending the run.
  StoryRun.prototype.setScore = function (score) {
    this.score = score || 0;
    return this;
  };

  StoryRun.prototype.finish = function (outcome, score, timedOut) {
    if (this.finished) return this;
    this.finished = true;
    this.running = false;
    if (typeof score === 'number') this.score = score;
    this.outcome = outcome || 'partial';
    if (this._raf) { global.cancelAnimationFrame(this._raf); this._raf = null; }
    var line = this.result[this.outcome] || this.result.partial || '';
    this._hud();
    this._showModal(line, !!timedOut);
    if (this.gameSystem) {
      try { this.gameSystem.addScore(this.score); } catch (e) {}
      try { this.gameSystem.addXP(Math.max(8, Math.floor(this.score / 40))); } catch (e) {}
      try { this.gameSystem.unlockAchievement('firstPlay'); } catch (e) {}
      if (this.outcome === 'success') { try { this.gameSystem.unlockAchievement('storyComplete'); } catch (e) {} }
      try { this.gameSystem.recordGamePlay(Math.round(this.elapsed * 1000)); } catch (e) {}
      try { this.gameSystem.saveState(); } catch (e) {}
    }
    if (typeof this.cfg.onFinish === 'function') { try { this.cfg.onFinish.call(this, this.outcome, this.score, this.elapsed); } catch (e) {} }
    return this;
  };

  StoryRun.prototype._showModal = function (line, timedOut) {
    var self = this;
    var m = el('div', 'storyrun sr-modal show');
    m.setAttribute('data-storyrun', this.id);
    var card = el('div', 'sr-modal-card');
    var kicker = el('span', 'sr-modal-kicker', timedOut ? 'Time up' : (this.outcome === 'success' ? 'Run complete' : 'Run over'));
    var h = el('h2', null, this.title);
    card.appendChild(kicker);
    card.appendChild(h);
    card.appendChild(el('p', 'sr-result', line));
    var stats = el('div', 'sr-stats');
    stats.appendChild(this._stat('Score', String(this.score)));
    stats.appendChild(this._stat('Time', fmt(this.elapsed)));
    stats.appendChild(this._stat('Guide', this.character));
    card.appendChild(stats);
    var again = el('button', 'sr-again', 'Play again');
    again.type = 'button';
    again.addEventListener('click', function () {
      if (m.parentNode) m.parentNode.removeChild(m);
      self.begin();
      if (typeof self.cfg.onRestart === 'function') { try { self.cfg.onRestart.call(self); } catch (e) {} }
    });
    var back = el('a', 'sr-back', 'Back to Arcade');
    back.href = '../arcade.html';
    card.appendChild(again);
    card.appendChild(back);
    m.appendChild(card);
    this._modal = m;
    document.body.appendChild(m);
    this._btn = again;
  };

  StoryRun.prototype._stat = function (label, value) {
    var d = el('div');
    d.appendChild(el('span', null, label));
    d.appendChild(el('b', null, value));
    return d;
  };

  StoryRun.prototype.stop = function () {
    this.running = false;
    if (this._raf) { global.cancelAnimationFrame(this._raf); this._raf = null; }
    return this;
  };

  StoryRun.prototype.timeLeft = function () { return Math.max(0, this.cap - this.elapsed); };

  global.StoryRun = StoryRun;
})(typeof window !== 'undefined' ? window : this);
