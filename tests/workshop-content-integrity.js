// workshop-content-integrity.js - guards the data behind every canvas workshop.
//
// A1707 externalised the page scripts, so CW_CONFIG now lives in
// assets/js/inline/workshops-*.js. A typo in that data blocks a learner who
// followed the instructions perfectly: a check string the solution can never
// contain, a quiz key pointing outside its options, a fill-in-the-blank with
// more answers than blanks, or a template that throws before it draws.
//
// Each config is loaded in a small sandbox (no browser), then every step is
// checked and every reference solution is run through its own template.
//
// Run: node tests/workshop-content-integrity.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SITE = path.resolve(__dirname, '..');
const DIR = path.join(SITE, 'assets', 'js', 'inline');
const TAKE_HOME = /take it home|mod card|at home|take-home/i;
const CANVAS_PROPS = new Set([
  'fillStyle', 'strokeStyle', 'font', 'lineWidth', 'lineCap', 'lineJoin', 'globalAlpha',
  'globalCompositeOperation', 'textAlign', 'textBaseline', 'shadowBlur', 'shadowColor',
  'shadowOffsetX', 'shadowOffsetY', 'miterLimit', 'direction', 'filter', 'letterSpacing',
  'wordSpacing', 'imageSmoothingEnabled', 'lineDashOffset',
]);

function makeSandbox() {
  const noop = () => {};
  const ctx2d = new Proxy({}, {
    get: (target, key) => {
      if (typeof key !== 'string') return undefined;
      if (CANVAS_PROPS.has(key)) return '';
      if (key === 'measureText') return () => ({ width: 10 });
      if (key === 'createLinearGradient' || key === 'createRadialGradient' || key === 'createPattern') return () => ({ addColorStop: noop });
      if (key === 'getImageData' || key === 'createImageData') return () => ({ data: [] });
      if (key === 'isPointInPath') return () => false;
      return noop;
    },
    set: () => true,
  });
  const el = () => ({
    getContext: () => ctx2d, style: {}, dataset: {},
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    setAttribute: noop, getAttribute: () => null, appendChild: noop, insertAdjacentHTML: noop,
    addEventListener: noop, removeEventListener: noop, querySelector: () => null,
    querySelectorAll: () => [], focus: noop, remove: noop, click: noop,
    value: '', textContent: '', innerHTML: '', width: 500, height: 400,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 500, height: 400 }),
  });
  const document = {
    getElementById: () => el(), querySelector: () => null, querySelectorAll: () => [],
    createElement: () => el(), addEventListener: noop, head: el(), body: el(), documentElement: el(),
  };
  const storage = { getItem: () => null, setItem: noop, removeItem: noop };
  const location = { href: '', search: '', replace: noop, reload: noop, assign: noop };
  const cwBlobWrap = (css, canvas, presetup, blob, after) =>
    '<!DOCTYPE html><html><head>' + String(css || '') + '</head><body>' + String(canvas || '') +
    '<script>' + String(presetup || '') + String(blob || '') + String(after || '') + '</script></body></html>';
  const window = {
    document, addEventListener: noop, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: noop,
    localStorage: storage, matchMedia: () => ({ matches: false, addEventListener: noop }),
    location, console, navigator: { userAgent: 'node' }, requestAnimationFrame: noop, cwBlobWrap,
    IntersectionObserver: function () { this.observe = noop; this.disconnect = noop; this.unobserve = noop; },
    MutationObserver: function () { this.observe = noop; this.disconnect = noop; },
  };
  return {
    window, document, console, setTimeout, clearTimeout, setInterval: window.setInterval,
    clearInterval: noop, localStorage: storage, navigator: window.navigator, location,
    requestAnimationFrame: noop, matchMedia: window.matchMedia, cwBlobWrap,
    IntersectionObserver: window.IntersectionObserver, MutationObserver: window.MutationObserver,
  };
}

function checkConfig(file, config) {
  const issues = [];
  const add = (kind, detail) => issues.push({ file, kind, detail });
  if (!config.storageKey) add('no-storageKey', 'CW_CONFIG has no storageKey');
  if (!config.downloadName) add('no-downloadName', 'CW_CONFIG has no downloadName');

  const seen = new Set();
  for (const step of config.steps) {
    if (!step || typeof step.num !== 'number') { add('bad-step', 'step without a numeric num'); continue; }
    const where = 'step ' + step.num;
    if (seen.has(step.num)) add('duplicate-num', where + ' is defined twice');
    seen.add(step.num);
    for (const key of ['title', 'goal', 'challenge', 'starter', 'solution']) {
      if (!step[key] || typeof step[key] !== 'string') add('missing-' + key, where + ' has no ' + key);
    }
    const takeHome = TAKE_HOME.test(String(step.title || '') + ' ' + String(step.activity || ''));
    if (!Array.isArray(step.checks)) add('missing-checks', where + ' has no checks array');
    else if (!step.checks.length && !takeHome) add('empty-checks', where + ' has no checks and is not a take-home step');
    else if (step.checks.length && typeof step.solution === 'string') {
      const solution = step.solution.toLowerCase();
      const missing = step.checks.filter((c) => !solution.includes(String(c).toLowerCase()));
      if (missing.length) add('check-not-in-solution', where + ': ' + missing.join(', ') + ' cannot be typed by a correct learner');
    }
    if (typeof step.solution === 'string' && /_{3,}|\?\?/.test(step.solution)) add('solution-has-blanks', where + ' solution still has a blank');
    if (step.quiz) {
      const options = step.quiz.options;
      if (!step.quiz.question) add('quiz-no-question', where + ' has a quiz without a question');
      if (!Array.isArray(options) || options.length < 2) add('quiz-options', where + ' quiz needs at least two options');
      else {
        if (!Number.isInteger(step.quiz.correct) || step.quiz.correct < 0 || step.quiz.correct >= options.length) {
          add('quiz-correct-range', where + ' quiz correct=' + step.quiz.correct + ' but there are ' + options.length + ' options');
        }
        const normalised = options.map((o) => String(o).trim().toLowerCase());
        if (new Set(normalised).size !== normalised.length) add('quiz-duplicate-options', where + ' has two identical quiz options');
      }
    }
    if (step.fills) {
      const blanks = String(step.fills.text || '').split('___').length - 1;
      const answers = Array.isArray(step.fills.answers) ? step.fills.answers : [];
      if (!blanks) add('fills-no-blanks', where + ' fills.text has no ___ blank');
      if (blanks !== answers.length) add('fills-count-mismatch', where + ' has ' + blanks + ' blanks but ' + answers.length + ' answers');
      if (answers.some((a) => !String(a).trim())) add('fills-empty-answer', where + ' has an empty fill answer');
    }
    if (config.templates && typeof config.templates[step.num] === 'function' && typeof step.solution === 'string') {
      try {
        const built = config.templates[step.num](step.solution);
        const html = built && built.html ? built.html : built;
        if (typeof html !== 'string' || html.length < 80) add('template-empty-output', where + ' template returned no page');
      } catch (err) {
        add('template-throws', where + ' template throws: ' + String(err.message).slice(0, 100));
      }
    }
  }
  return issues;
}

function run() {
  const files = fs.readdirSync(DIR)
    .filter((f) => /^workshops-.*\.js$/.test(f))
    .filter((f) => fs.readFileSync(path.join(DIR, f), 'utf8').includes('CW_CONFIG'))
    .sort();
  const issues = [];
  let configs = 0;
  let steps = 0;
  for (const file of files) {
    const sandbox = makeSandbox();
    vm.createContext(sandbox);
    try {
      vm.runInContext(fs.readFileSync(path.join(DIR, file), 'utf8'), sandbox, { timeout: 4000 });
    } catch (err) {
      issues.push({ file, kind: 'eval-error', detail: String(err.message).slice(0, 120) });
      continue;
    }
    const config = sandbox.window.CW_CONFIG;
    if (!config || !Array.isArray(config.steps) || !config.steps.length) continue;
    configs++;
    steps += config.steps.length;
    issues.push(...checkConfig(file, config));
  }
  return { files: files.length, configs, steps, issues };
}

if (require.main === module) {
  const result = run();
  console.log('Workshop content integrity: ' + result.configs + ' configs across ' + result.files + ' inline scripts, ' + result.steps + ' steps checked');
  if (result.issues.length) {
    console.log('FAIL ' + result.issues.length + ' problem(s) that can block a learner:');
    result.issues.forEach((i) => console.log('  ' + i.file + ' | ' + i.kind + ' | ' + (i.detail || '')));
    process.exitCode = 1;
  } else {
    console.log('PASS every step has a reachable check set, a valid quiz key, matching fill answers and a template that runs');
  }
}

module.exports = { run };
