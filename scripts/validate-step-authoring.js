'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WS_DIR = path.join(ROOT, 'workshops');

function pageSource(file) {
  const html = fs.readFileSync(path.join(WS_DIR, file), 'utf8');
  let all = html;
  const re = /\/assets\/js\/inline\/([A-Za-z0-9._-]+\.js)/g;
  let m;
  while ((m = re.exec(html))) {
    try { all += '\n' + fs.readFileSync(path.join(ROOT, 'assets', 'js', 'inline', m[1]), 'utf8'); } catch (_) {}
  }
  return all;
}

const ALL_FILES = fs.readdirSync(WS_DIR).filter(f => f.endsWith('.html')).sort();
const PUBLIC_FILES = ALL_FILES.filter(f => {
  const c = pageSource(f);
  return !/<meta\s+name=["']robots["'][^>]*noindex/i.test(c);
});

const STEP_CARD_RE = /<div\s+class="step-card[^"]*"[^>]*data-step="(\d+)"[^>]*>([\s\S]*?)(?=<div\s+class="step-card|<!-- STEPS-END|<\/main>|$)/g;
const GOAL_RE = /class="goal-box"|<strong>Goal for this step<\/strong>/;
const QUIZ_RE = /class="quiz-gate"/;
const FILL_RE = /class="concept-fill"/;
const ORDER_RE = /class="order-challenge"/;
const CODE_CHECK_RE = /class="predict-gate"|class="step-confirm"|CW\.check|checkCode/;
const COMPLETE_RE = /completeStep|data-on="completeStep"/;
const QUIZ_OPT_RE = /class="quiz-opt"/g;
const IMG_RE = /<img\s[^>]*>/g;
const ALT_RE = /\balt=("[^"]*"|'[^']*')/;
const INLINE_STYLE_RE = /\sstyle="/g;
const CODE_BLOCK_RE = /<pre[^>]*>([\s\S]*?)<\/pre>|<code[^>]*>([\s\S]*?)<\/code>/g;
const STEPS_LIST_RE = /<li[^>]*><span class="sn">/g;

const findings = { errors: [], warnings: [], info: [] };
let stepsChecked = 0;
let pagesChecked = 0;

function addFinding(severity, file, step, check, message) {
  findings[severity].push({ file, step, check, message });
}

function countWords(text) {
  return text.replace(/<[^>]+>/g, '').trim().split(/\s+/).filter(Boolean).length;
}

function codeBlockLines(match) {
  const content = match[1] || match[2] || '';
  return content.replace(/<[^>]+>/g, '').split('\n').length;
}

PUBLIC_FILES.forEach(file => {
  const src = pageSource(file);

  const hasStepCards = /class="step-card/.test(src);
  if (!hasStepCards) return;

  pagesChecked++;
  const stepNumbers = [];
  let match;

  STEP_CARD_RE.lastIndex = 0;
  while ((match = STEP_CARD_RE.exec(src)) !== null) {
    const stepNum = parseInt(match[1], 10);
    const stepBody = match[2];
    stepNumbers.push(stepNum);
    stepsChecked++;

    // has-goal
    if (!GOAL_RE.test(stepBody)) {
      addFinding('errors', file, stepNum, 'has-goal', 'Step body has no goal box');
    }

    // checkpoint
    const hasQuiz = QUIZ_RE.test(stepBody);
    const hasFill = FILL_RE.test(stepBody);
    const hasOrder = ORDER_RE.test(stepBody);
    const hasCodeCheck = CODE_CHECK_RE.test(stepBody);
    if (!hasQuiz && !hasFill && !hasOrder && !hasCodeCheck) {
      addFinding('errors', file, stepNum, 'checkpoint', 'Step has no interactive checkpoint');
    }

    // quiz-options
    if (hasQuiz) {
      const quizBlocks = stepBody.match(/class="quiz-gate"[\s\S]*?(?=class="quiz-gate"|$)/g) || [stepBody];
      quizBlocks.forEach(qb => {
        if (!/class="quiz-gate"/.test(qb)) return;
        const opts = (qb.match(QUIZ_OPT_RE) || []).length;
        if ((opts < 3 || opts > 4) && opts > 0) {
          addFinding('errors', file, stepNum, 'quiz-options', `Quiz gate has ${opts} options (expected 3 or 4)`);
        }
      });
    }

    // action-count
    STEPS_LIST_RE.lastIndex = 0;
    const actionItems = (stepBody.match(STEPS_LIST_RE) || []).length;
    if (actionItems > 7) {
      addFinding('warnings', file, stepNum, 'action-count', `Action list has ${actionItems} items (max 7)`);
    }

    // title-length
    const titleMatch = stepBody.match(/class="step-title">([\s\S]*?)<\/div>/);
    if (titleMatch) {
      const words = countWords(titleMatch[1]);
      if (words > 7) {
        addFinding('warnings', file, stepNum, 'title-length', `Step title is ${words} words (max 7)`);
      }
    }

    // code-length
    CODE_BLOCK_RE.lastIndex = 0;
    let codeMatch;
    while ((codeMatch = CODE_BLOCK_RE.exec(stepBody)) !== null) {
      const lines = codeBlockLines(codeMatch);
      if (lines > 30) {
        addFinding('warnings', file, stepNum, 'code-length', `Code block is ${lines} lines (max 30)`);
      }
    }

    // complete-button
    if (!COMPLETE_RE.test(stepBody)) {
      addFinding('warnings', file, stepNum, 'complete-button', 'Step has no completion mechanism (completeStep)');
    }

    // alt-text
    IMG_RE.lastIndex = 0;
    let imgMatch;
    while ((imgMatch = IMG_RE.exec(stepBody)) !== null) {
      if (!ALT_RE.test(imgMatch[0])) {
        addFinding('warnings', file, stepNum, 'alt-text', 'Image missing alt attribute');
      }
    }

    // no-inline-style-step
    INLINE_STYLE_RE.lastIndex = 0;
    const inlineCount = (stepBody.match(INLINE_STYLE_RE) || []).length;
    if (inlineCount > 0) {
      addFinding('info', file, stepNum, 'no-inline-style-step', `Step has ${inlineCount} inline style attribute(s)`);
    }
  }

  // step-numbering
  for (let i = 0; i < stepNumbers.length; i++) {
    if (stepNumbers[i] !== i + 1) {
      addFinding('errors', file, null, 'step-numbering', `Step numbers are not sequential: found [${stepNumbers.join(',')}]`);
      break;
    }
  }
});

// Report
console.log(`Step Authoring Lint (A2340)`);
console.log(`Checked ${stepsChecked} steps across ${pagesChecked} pages\n`);

const total = findings.errors.length + findings.warnings.length + findings.info.length;

if (findings.errors.length) {
  console.log(`ERRORS (${findings.errors.length}):`);
  findings.errors.forEach(f => {
    const loc = f.step ? `${f.file} step ${f.step}` : f.file;
    console.log(`  [${f.check}] ${loc}: ${f.message}`);
  });
  console.log();
}

if (findings.warnings.length) {
  console.log(`WARNINGS (${findings.warnings.length}):`);
  findings.warnings.forEach(f => {
    const loc = f.step ? `${f.file} step ${f.step}` : f.file;
    console.log(`  [${f.check}] ${loc}: ${f.message}`);
  });
  console.log();
}

if (findings.info.length) {
  console.log(`INFO (${findings.info.length}):`);
  findings.info.forEach(f => {
    const loc = f.step ? `${f.file} step ${f.step}` : f.file;
    console.log(`  [${f.check}] ${loc}: ${f.message}`);
  });
  console.log();
}

if (findings.errors.length === 0) {
  console.log('All step authoring checks passed (no errors).');
} else {
  console.log(`${findings.errors.length} error(s) must be fixed before merge.`);
  process.exitCode = 1;
}
