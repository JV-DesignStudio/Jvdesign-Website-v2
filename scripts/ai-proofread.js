#!/usr/bin/env node
// scripts/ai-proofread.js — local CLI proofreader for dev log and newsletter drafts
// Pipes a markdown file into a local Ollama instance and prints concise editorial notes.
// Does NOT rewrite content. Flags structure, tone, and clarity only.
//
// Usage:
//   node scripts/ai-proofread.js social-posts/queue/2026-09-14-332-character-quests-integration.md
//   node scripts/ai-proofread.js --model llama3.2 social-posts/queue/2026-09-14-329-educational-licensing.md
//   node scripts/ai-proofread.js --list-models
//   node scripts/ai-proofread.js --dry-run social-posts/queue/2026-09-14-332-...md
//
// Env: OLLAMA_HOST=http://localhost:11434 (default)

'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const DEFAULT_MODEL = 'qwen2.5-coder:7b';
const MAX_CHARS = 6000;

// Strict non-rewrite system prompt
const SYSTEM_PROMPT = `You are an editorial proofreader for JVDesignStudio, a browser-based creative studio for young people (ages 8-16) and their parents and teachers.

RULES — follow these exactly:
1. Do NOT rewrite or suggest alternative wording. Flag issues only.
2. Do NOT comment on the content decisions, feature choices, or priorities.
3. Output a numbered list of issues only. Maximum 10 items.
4. Each item is one line: issue type + location + what is wrong. No elaboration.
5. Issue types you may flag: TONE (too technical / not parent-friendly), CLARITY (ambiguous sentence), STRUCTURE (missing intro/outro, orphan section), LENGTH (section too long for the channel), GRAMMAR, SPELLING, JARGON (unexplained acronym/term).
6. If the draft has no issues, output exactly: NO ISSUES FOUND
7. Never praise the writing. No summaries. No preamble. Start immediately with the numbered list or NO ISSUES FOUND.

Target tone: warm, clear, jargon-light. Parent and 12-year-old should both understand without confusion.`;

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { model: DEFAULT_MODEL, dryRun: false, listModels: false, file: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--model' && args[i + 1]) { opts.model = args[++i]; }
    else if (args[i] === '--dry-run') { opts.dryRun = true; }
    else if (args[i] === '--list-models') { opts.listModels = true; }
    else if (!args[i].startsWith('-')) { opts.file = args[i]; }
  }
  return opts;
}

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    const data = JSON.stringify(body);
    const req = mod.request({
      hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', c => buf += c);
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on('error', reject);
    req.setTimeout(120000, () => { req.destroy(); reject(new Error('Ollama request timed out after 120s')); });
    req.write(data); req.end();
  });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    mod.get({ hostname: u.hostname, port: u.port, path: u.pathname }, res => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', c => buf += c);
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    }).on('error', reject).setTimeout(5000, function() { this.destroy(); reject(new Error('timeout')); });
  });
}

async function listModels() {
  try {
    const r = await httpGet(OLLAMA_HOST + '/api/tags');
    const data = JSON.parse(r.body);
    const models = (data.models || []).map(m => m.name);
    if (!models.length) { console.log('No models found. Pull one with: ollama pull qwen2.5-coder:7b'); return; }
    console.log('Available Ollama models:');
    models.forEach(m => console.log(' ', m));
  } catch (e) {
    console.error('Cannot reach Ollama at ' + OLLAMA_HOST + '. Is it running?');
    console.error('Start with: ollama serve');
  }
}

function extractReadableText(markdown) {
  return markdown
    .replace(/^---[\s\S]*?---\n/m, '')           // strip frontmatter
    .replace(/```[\s\S]*?```/g, '[code block]')    // collapse code blocks
    .replace(/^#+\s+/gm, '')                       // strip heading markers
    .replace(/\*\*(.+?)\*\*/g, '$1')               // bold
    .replace(/__(.+?)__/g, '$1')                   // underline
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')       // links -> text only
    .replace(/`([^`]+)`/g, '$1')                   // inline code
    .replace(/^\s*[>*\-]\s+/gm, '')                // blockquotes, bullets
    .replace(/\n{3,}/g, '\n\n')                    // collapse blank lines
    .trim();
}

async function proofread(file, model, dryRun) {
  const absPath = path.resolve(file);
  if (!fs.existsSync(absPath)) {
    console.error('File not found: ' + file);
    process.exit(1);
  }

  const raw = fs.readFileSync(absPath, 'utf8');
  const text = extractReadableText(raw);
  const truncated = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + '\n...[truncated]' : text;

  console.log('');
  console.log('Proofreading: ' + path.basename(file));
  console.log('Model:        ' + model);
  console.log('Length:       ' + text.length + ' chars' + (text.length > MAX_CHARS ? ' (truncated to ' + MAX_CHARS + ')' : ''));
  console.log('');

  if (dryRun) {
    console.log('--- DRY RUN: text that would be sent to Ollama ---');
    console.log(truncated.slice(0, 500) + (truncated.length > 500 ? '\n...' : ''));
    console.log('--- END DRY RUN ---');
    return;
  }

  // Check Ollama is reachable
  try {
    await httpGet(OLLAMA_HOST + '/api/tags');
  } catch {
    console.error('Cannot reach Ollama at ' + OLLAMA_HOST);
    console.error('Start Ollama with: ollama serve');
    console.error('Pull a model with:  ollama pull ' + model);
    process.exit(1);
  }

  console.log('Sending to Ollama... (may take 15-60s on first run)');
  console.log('');

  let result;
  try {
    const r = await httpPost(OLLAMA_HOST + '/api/generate', {
      model,
      system: SYSTEM_PROMPT,
      prompt: 'Proofread this draft:\n\n' + truncated,
      stream: false,
      options: { temperature: 0.1, num_predict: 512 }
    });
    if (r.status !== 200) {
      const err = JSON.parse(r.body || '{}');
      if (err.error && err.error.includes('not found')) {
        console.error('Model "' + model + '" not found. Pull it with: ollama pull ' + model);
        console.error('Or use --model <name> to pick a different model. List with: --list-models');
      } else {
        console.error('Ollama error (' + r.status + '): ' + (err.error || r.body));
      }
      process.exit(1);
    }
    result = JSON.parse(r.body);
  } catch (e) {
    console.error('Request failed: ' + e.message);
    process.exit(1);
  }

  const output = (result.response || '').trim();
  console.log('--- Editorial notes ---');
  console.log('');
  console.log(output || '(no response)');
  console.log('');
  console.log('--- End of notes ---');
  console.log('');
  console.log('File NOT modified. Make any edits yourself.');

  // Optionally write to temp file if stdout is redirected
  if (!process.stdout.isTTY) {
    const tmpFile = path.join(require('os').tmpdir(), 'jvds-proofread-' + Date.now() + '.txt');
    fs.writeFileSync(tmpFile, output + '\n');
    process.stderr.write('Notes saved to: ' + tmpFile + '\n');
  }
}

(async () => {
  const opts = parseArgs(process.argv);

  if (opts.listModels) { await listModels(); return; }

  if (!opts.file) {
    console.log('Usage: node scripts/ai-proofread.js [--model <name>] [--dry-run] <file.md>');
    console.log('       node scripts/ai-proofread.js --list-models');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/ai-proofread.js social-posts/queue/2026-09-14-332-character-quests-integration.md');
    console.log('  node scripts/ai-proofread.js --model llama3.2 social-posts/queue/2026-09-14-329-educational-licensing.md');
    console.log('  node scripts/ai-proofread.js --dry-run social-posts/queue/2026-09-14-332-character-quests-integration.md');
    console.log('');
    console.log('Default model: ' + DEFAULT_MODEL);
    console.log('Ollama host:   ' + OLLAMA_HOST + '  (override with OLLAMA_HOST=...)');
    process.exit(0);
  }

  await proofread(opts.file, opts.model, opts.dryRun);
})();
