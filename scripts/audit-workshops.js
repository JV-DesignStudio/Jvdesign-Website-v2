#!/usr/bin/env node
/*
 * Audit every workshop page against the guided-creation standard and write the
 * result to the studio board's workshop-audit.json.
 *
 * The board's Workshop Audit view used to show 381 entries all marked
 * not-started because nothing graded them. This script checks each page for the
 * four pillars (guided creation, makes what it says, shareable, clear
 * instructions), records the individual checks, and marks hubs, cheatsheets,
 * meta pages and redirects as reference instead of failures.
 *
 * Usage:
 *   node scripts/audit-workshops.js            report only (no write)
 *   node scripts/audit-workshops.js --write    update studio-workspace/workshop-audit.json
 *   node scripts/audit-workshops.js --json     print the full result object
 *   node scripts/audit-workshops.js --out FILE write somewhere else (used by tests)
 *   node scripts/audit-workshops.js --strict   exit 1 when any workshop fails
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SITE = path.resolve(__dirname, '..');
const WORKSHOPS = path.join(SITE, 'workshops');
const DEFAULT_OUT = path.resolve(SITE, '..', 'studio-workspace', 'workshop-audit.json');

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(name);
  if (i === -1) return fallback;
  const v = args[i + 1];
  return v && !v.startsWith('--') ? v : fallback;
}
const IN = path.resolve(arg('--in', DEFAULT_OUT));
const OUT = path.resolve(arg('--out', IN));
const WRITE = args.includes('--write') || args.includes('--out');
const JSON_OUT = args.includes('--json');
const STRICT = args.includes('--strict');

const CHECK_KEYS = [
  'title', 'description', 'mobile', 'steps', 'preview', 'share',
  'outcome', 'stuck', 'next', 'finish', 'quiz', 'interactive'
];
const PILLARS = ['guidedCreation', 'makesWhatItSays', 'shareable', 'clearInstructions'];
const REFERENCE_TYPES = new Set(['hub', 'cheatsheet', 'meta', 'guide']);

function read(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch (e) { return null; }
}

function detect(html, entry) {
  const type = String(entry.type || '').toLowerCase();
  const isBuilder = type === 'builder' || type === 'studio';
  const redirect = /http-equiv=["']refresh["']|location\.replace\s*\(/i.test(html);
  const title = /<title>\s*[^<\s][^<]*<\/title>/i.test(html) && !/Redirecting/i.test((html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '');
  const description = /<meta[^>]+name=["']description["'][^>]+content=["'][^"']{10,}/i.test(html);
  const canonical = /<link[^>]+rel=["']canonical["']/i.test(html);
  const mobile = /<meta[^>]+name=["']viewport["']/i.test(html);
  const steps = /cw-step|data-step=|class=["'][^"']*\bstep\b|workshop-engine\.js|<ol\b|step-by-step|lesson-step|workshop-step/i.test(html);
  const preview = /workshop-canvas-engine\.js|engine-feel\.js|<canvas\b|<iframe\b|gameFrame|workshop-canvas\.html|data-preview|preview-canvas|builder-(extras|templates)\.js|studio-liveedit\.js|unity-studio\.js/i.test(html);
  const share = /workshop-canvas-engine\.js|engine-feel\.js|downloadGame|downloadProject|projectCode|CW\.projectCode|data-on=["']CW\.download/i.test(html);
  const outcome = /WS-OUTCOME|ws-outcome/i.test(html);
  const stuck = /WS-STUCK|ws-stuck/i.test(html);
  const next = /WS-NEXT|next-route/i.test(html);
  const engine = /workshop-canvas-engine\.js|workshop-engine\.js/i.test(html);
  const finish = engine || /finishBanner|finish-banner|next-step|completeStep|all steps complete/i.test(html);
  const quiz = engine || /cw-quiz|quiz|knowledge check|data-answer|fill-in|checkQuiz/i.test(html);
  const interactive = engine || /<textarea\b|contenteditable|<input\b|data-on=|class=["'][^"']*\b(btn|button)\b/i.test(html);

  const checks = { title, description, mobile, steps, preview, share, outcome, stuck, next, finish, quiz, interactive };
  const reference = redirect || REFERENCE_TYPES.has(type);
  const role = redirect ? 'redirect' : (REFERENCE_TYPES.has(type) ? type : 'workshop');
  const builderInteractive = isBuilder && interactive;
  const pillars = {
    guidedCreation: (steps || builderInteractive) && preview,
    makesWhatItSays: title && description,
    shareable: share,
    clearInstructions: outcome && stuck && next && mobile
  };
  const passedPillars = PILLARS.filter(function (k) { return pillars[k]; }).length;
  const score = reference ? null : Math.round(passedPillars / PILLARS.length * 100);
  let result;
  if (reference) result = 'reference';
  else if (passedPillars === PILLARS.length) result = 'pass';
  else if (pillars.guidedCreation || pillars.shareable || passedPillars >= 2) result = 'needs-work';
  else result = 'fails';

  const missing = reference ? [] : CHECK_KEYS.filter(function (k) {
    if (k === 'steps') return !(steps || builderInteractive);
    if (k === 'title' || k === 'description' || k === 'mobile' || k === 'preview' || k === 'share' ||
        k === 'outcome' || k === 'stuck' || k === 'next' || k === 'finish' || k === 'quiz' || k === 'interactive') {
      return !checks[k];
    }
    return false;
  });

  return { checks, pillars, role, reference, score, result, missing };
}

function auditFile() {
  const raw = read(IN);
  if (!raw) {
    console.error('Cannot read workshop audit file: ' + IN);
    process.exit(2);
  }
  let data;
  try { data = JSON.parse(raw); } catch (e) {
    console.error('Invalid JSON in ' + IN + ': ' + e.message);
    process.exit(2);
  }
  const items = Array.isArray(data.workshops) ? data.workshops : [];
  const checkedAt = new Date().toISOString();
  const counts = { pass: 0, 'needs-work': 0, fails: 0, reference: 0 };
  const byEngine = {};
  const byType = {};

  const workshops = items.map(function (entry) {
    const file = path.join(WORKSHOPS, entry.file || '');
    const html = read(file);
    const w = Object.assign({}, entry);
    if (html == null) {
      w.checks = { exists: false };
      w.pillars = { guidedCreation: false, makesWhatItSays: false, shareable: false, clearInstructions: false };
      w.role = 'missing';
      w.result = 'fails';
      w.score = 0;
      w.missing = ['file'];
      w.checkedAt = checkedAt;
    } else {
      const d = detect(html, entry);
      w.checks = d.checks;
      w.checks.exists = true;
      w.pillars = d.pillars;
      w.role = d.role;
      w.result = d.result;
      w.score = d.score;
      w.missing = d.missing;
      w.checkedAt = checkedAt;
    }
    w.audit = w.result === 'pass' ? 'done'
      : w.result === 'needs-work' ? 'in-progress'
      : w.result === 'reference' ? 'n/a'
      : 'not-started';
    counts[w.result] = (counts[w.result] || 0) + 1;
    byEngine[w.engine || 'Unknown'] = byEngine[w.engine || 'Unknown'] || { pass: 0, 'needs-work': 0, fails: 0, reference: 0, total: 0 };
    byEngine[w.engine || 'Unknown'][w.result]++;
    byEngine[w.engine || 'Unknown'].total++;
    byType[w.type || 'Unknown'] = byType[w.type || 'Unknown'] || { pass: 0, 'needs-work': 0, fails: 0, reference: 0, total: 0 };
    byType[w.type || 'Unknown'][w.result]++;
    byType[w.type || 'Unknown'].total++;
    return w;
  });

  const graded = counts.pass + counts['needs-work'] + counts.fails;
  const out = {
    generated: checkedAt.slice(0, 10),
    checkedAt: checkedAt,
    description: data.description || 'Workshop audit tracker - guided creation standard',
    criteria: data.criteria || {
      'guided-creation': 'Workshop guides learner to create their own version, not copy-paste',
      'makes-what-it-says': 'End result matches what the title promises',
      shareable: 'Learner can share/export/show what they made',
      'clear-instructions': 'Steps are easy to follow for the target age group'
    },
    source: 'scripts/audit-workshops.js',
    stats: {
      total: workshops.length,
      graded: graded,
      pass: counts.pass,
      needsWork: counts['needs-work'],
      fails: counts.fails,
      reference: counts.reference,
      passPct: graded ? Math.round(counts.pass / graded * 100) : 0,
      engines: data.stats && data.stats.engines ? data.stats.engines : undefined,
      types: data.stats && data.stats.types ? data.stats.types : undefined,
      byEngine: byEngine,
      byType: byType
    },
    workshops: workshops
  };
  return out;
}

function main() {
  const out = auditFile();
  if (JSON_OUT) {
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  } else {
    const s = out.stats;
    console.log('Workshop audit: ' + s.total + ' entries (' + s.graded + ' graded, ' + s.reference + ' reference)');
    console.log('  Pass: ' + s.pass);
    console.log('  Needs work: ' + s.needsWork);
    console.log('  Fails: ' + s.fails);
    console.log('  Reference: ' + s.reference);
    console.log('  Pass rate on graded pages: ' + s.passPct + '%');
    if (WRITE) {
      const tmp = OUT + '.tmp-' + process.pid;
      fs.writeFileSync(tmp, JSON.stringify(out, null, 2) + '\n');
      fs.renameSync(tmp, OUT);
      console.log('Wrote ' + OUT);
    } else {
      console.log('Dry run. Add --write to update ' + OUT);
    }
  }
  if (STRICT && out.stats.fails > 0) process.exit(1);
}

main();
