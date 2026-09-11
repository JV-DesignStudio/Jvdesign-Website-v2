#!/usr/bin/env node
/**
 * scripts/build/index.js - New unified backend. One command, clear pipeline.
 *
 * Old:  npm run build  =  node scripts/generate-content-data.js
 *                     && node scripts/build-content-data.js
 *                     && node build.js
 *                     && node generate-latest-post.js
 *                     && node scripts/generate-board-data.js
 *      5 separate processes, 4 copies of walk(), 3 ROOT definitions, no timing.
 *
 * New:  npm run build  =  node scripts/build/index.js
 *      Orchestrated, timed, one ignore-list (lib/paths.js), one walk() (lib/walk.js).
 *
 * Flags:
 *   --only=partials|content|sitemap|latest|board   run single stage
 *   --skip-validate                                don't run validate:links after build
 *   --help                                         show this help
 */
const { performance } = require('perf_hooks');
const path = require('path');
const { execFileSync } = require('child_process');
const { ROOT } = require('../lib/paths');

const STEPS = [
  { id: 'content',  label: 'Content  (scan -> content/*.json -> content-data.js)', fn: () => require('./content').runContent() },
  { id: 'partials', label: 'Partials (inject nav/footer)',                        fn: () => require('./partials').runPartials() },
  { id: 'sitemap',  label: 'Sitemap  (sitemap.xml + search-index.json)',           fn: () => require('./sitemap').runSitemap() },
  { id: 'latest',   label: 'Latest   (latest-post.json)',                         fn: () => require('./latest').runLatest() },
  { id: 'board',    label: 'Board    (board-data.json KPIs)',                     fn: () => require('./board').runBoard() },
];

function help() {
  console.log(`
JVDS Build - unified pipeline

Usage: node scripts/build/index.js [flags]

Flags:
  --only=<id>       run one stage: ${STEPS.map(s => s.id).join(', ')}
  --skip-validate   skip the post-build validate:links check
  --help            show this help

Stages (in order):
${STEPS.map((s, i) => `  ${i + 1}. ${s.id.padEnd(10)} ${s.label}`).join('\n')}

Examples:
  node scripts/build/index.js
  node scripts/build/index.js --only=partials
  node scripts/build/index.js --only=sitemap --skip-validate
`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) return help();

  const only = (args.find(a => a.startsWith('--only=')) || '').split('=')[1] || null;
  const skipValidate = args.includes('--skip-validate');

  const plan = only ? STEPS.filter(s => s.id === only) : STEPS;
  if (only && plan.length === 0) {
    console.error(`Unknown --only=${only}. Valid: ${STEPS.map(s => s.id).join(', ')}`);
    process.exit(1);
  }

  console.log(`\n┌─ JVDS Build - ${plan.length}/${STEPS.length} stage(s) ─────────────────────`);
  const t0 = performance.now();
  const results = [];

  for (const step of plan) {
    const ts = performance.now();
    process.stdout.write(`│ ▶ ${step.id.padEnd(10)} ${step.label} ... `);
    try {
      await step.fn();
      const ms = Math.round(performance.now() - ts);
      console.log(`✓ ${ms}ms`);
      results.push({ id: step.id, ok: true, ms });
    } catch (e) {
      const ms = Math.round(performance.now() - ts);
      console.log(`✗ ${ms}ms`);
      console.error(`\n  Step "${step.id}" failed:\n  ${e.message}\n${e.stack || ''}`);
      process.exit(1);
    }
  }

  const total = Math.round(performance.now() - t0);
  console.log(`└─ Done in ${total}ms ─────────────────────────────────────`);
  results.forEach(r => console.log(`   ${r.ok ? '✓' : '✗'} ${r.id.padEnd(10)} ${r.ms}ms`));

  if (!skipValidate && !only) {
    console.log(`\n▶ Post-build check: validate:links`);
    try {
      execFileSync(process.execPath, [path.join(ROOT, 'validate-links.js')], { stdio: 'inherit' });
    } catch {
      console.log('\n⚠  validate-links reported broken links. Fix before deploying.');
      process.exit(1);
    }
  }
}

main();
