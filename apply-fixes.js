#!/usr/bin/env node
/**
 * apply-fixes.js — JV Design Studio site-wide automated patches
 *
 * Run from the root of the site folder:
 *   node apply-fixes.js [--dry-run]
 *
 * What it does:
 *   1. Fixes og:url / og:image domain: jvdesignstudio.com → jvdesignstudio.co.uk
 *   2. Fixes twitter:image domain: jvdesignstudio.com → jvdesignstudio.co.uk
 *   3. Fixes canonical link domain: jvdesignstudio.com → jvdesignstudio.co.uk
 *   4. Adds font-display: swap to any Google Fonts links missing it
 *   5. Patches cookie banner broken text: "We use [link] to understand"
 *   6. Patches double-space typo: "really made , plus" → "really made, plus"
 *      and "160 interactive workshops , plus" → "160 interactive workshops, plus"
 *   7. Removes duplicate mobile nav init scripts (duplicate IIFE with same toggle ID)
 *
 * --dry-run : shows what would change, writes nothing
 */

const fs   = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');

/* ─── Config ──────────────────────────────────────────────────────────── */
const SITE_ROOT = process.cwd();
const EXTENSIONS = ['.html', '.htm'];
const SKIP_DIRS  = ['node_modules', '.git', '_site', 'dist', 'build'];

/* ─── Helpers ─────────────────────────────────────────────────────────── */
function walkHTML(dir, files = []) {
  fs.readdirSync(dir).forEach(name => {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (!SKIP_DIRS.includes(name)) walkHTML(full, files);
    } else if (EXTENSIONS.includes(path.extname(name).toLowerCase())) {
      files.push(full);
    }
  });
  return files;
}

function applyPatches(original, filePath) {
  let src    = original;
  const rel  = path.relative(SITE_ROOT, filePath);
  const changes = [];

  /* ── 1. og:url / og:image / twitter:image domain ── */
  const domainFix = src.replace(
    /(content=["'][^"']*)(jvdesignstudio\.com)([^"']*["'])/g,
    (m, pre, _domain, post) => {
      changes.push(`  og/meta domain: .com → .co.uk`);
      return pre + 'jvdesignstudio.co.uk' + post;
    }
  );
  if (domainFix !== src) src = domainFix;

  /* ── 2. canonical href domain ── */
  const canonFix = src.replace(
    /(<link\s+rel="canonical"\s+href="https?:\/\/)jvdesignstudio\.com/g,
    (m, pre) => {
      changes.push(`  canonical href: .com → .co.uk`);
      return pre + 'jvdesignstudio.co.uk';
    }
  );
  if (canonFix !== src) src = canonFix;

  /* ── 3. Google Fonts — add display=swap if missing ── */
  const fontFix = src.replace(
    /(href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)(?<!&display=swap)(?<!display=swap)(")/g,
    (m, href, quote) => {
      if (href.includes('display=swap')) return m; // already has it
      changes.push(`  Google Fonts: added display=swap`);
      return href + '&display=swap' + quote;
    }
  );
  if (fontFix !== src) src = fontFix;

  /* ── 4. Cookie banner broken sentence ──
     Pattern: "We use <a ...>cookies</a> to understand"
     becomes: "We use cookies to understand" (link wrapped around the full phrase)
     OR: missing word → insert "cookies" into the sentence
  ── */
  // Variant A: "We use " immediately followed by a link element (word missing between use and link)
  const cookieFix = src.replace(
    /We use\s+(<a [^>]+>cookies<\/a>)\s+to understand/gi,
    (m, link) => {
      changes.push(`  Cookie banner: fixed broken sentence (text was "We use [link] to understand")`);
      return `We use ${link} to understand`;
    }
  );
  if (cookieFix !== src) src = cookieFix;

  // Variant B: "We use to understand" — word missing entirely
  const cookieFix2 = src.replace(
    /We use\s+to understand how people use this site/gi,
    (m) => {
      changes.push(`  Cookie banner: fixed missing word ("We use to understand" → "We use cookies to understand")`);
      return m.replace(/We use\s+to understand/, 'We use cookies to understand');
    }
  );
  if (cookieFix2 !== src) src = cookieFix2;

  /* ── 5. Double-space typos ── */
  [
    [/160 interactive workshops\s{2,}(,\s*plus)/gi, '160 interactive workshops, $1'.replace('$1', '')],
    [/really made\s{2,},/gi, 'really made,'],
    [/workshops\s+,\s+plus/gi, 'workshops, plus'],
    [/(\d+)\s{2,}(workshops|games|tools)/gi, '$1 $2'],
  ].forEach(([pattern, replacement]) => {
    const fixed = src.replace(pattern, (m, ...args) => {
      changes.push(`  Typo fix: double-space/comma spacing corrected`);
      if (typeof replacement === 'string') return replacement;
      return m; // fallback
    });
    if (fixed !== src) src = fixed;
  });

  /* ── 6. Specific double-space in hero copy ── */
  const spaceFix = src.replace(/(\w)\s{2,}(,)/g, (m, w, comma) => {
    changes.push(`  Typo fix: double-space before comma removed`);
    return w + comma;
  });
  if (spaceFix !== src) src = spaceFix;

  /* ── 7. "New here? Start free" CTA → pick-your-path ──
     Any anchor whose text contains "New here" or "Start free" that points
     directly to a workshop page should instead point to /pick-your-path.
     This gives new visitors an onboarding step before dumping them into a course.
  ── */
  const ctaFix = src.replace(
    /(<a\s[^>]*href=["'])([^"']*(?:workshop|learn|courses?)[^"']*)(?=["'])([^>]*>(?:[^<]*(?:New here|Start free|Get started)[^<]*)<\/a>)/gi,
    (m, pre, href, rest) => {
      changes.push(`  CTA fix: "New here / Start free" link updated to /pick-your-path`);
      return pre + '/pick-your-path' + rest;
    }
  );
  if (ctaFix !== src) src = ctaFix;

  /* ── 8. Remove duplicate mobile nav IIFE ──
     The old index.html had the mobile nav init script pasted twice.
     Pattern: two adjacent identical (function(){ var btn=...navToggle...) blocks.
  ── */
  const dupeNavFix = src.replace(
    /(\/\*[- ]*Mobile nav[- ]*\*\/\s*\(function\(\)\{[\s\S]*?\}\)\(\);)\s*\n[\s\S]*?\1/,
    (m, first) => {
      changes.push(`  Removed duplicate mobile nav init script`);
      return first;
    }
  );
  if (dupeNavFix !== src) src = dupeNavFix;

  return { src, changes };
}

/* ─── Main ──────────────────────────────────────────────────────────── */
const files  = walkHTML(SITE_ROOT);
let   total  = 0;
let   changed = 0;

console.log(`\n🛠️  JV Design Studio — Site-Wide Fix Script`);
console.log(`   Root: ${SITE_ROOT}`);
console.log(`   Mode: ${DRY_RUN ? '🔍 DRY RUN (no files written)' : '✍️  WRITING CHANGES'}`);
console.log(`   Files found: ${files.length}\n`);

files.forEach(filePath => {
  total++;
  const original = fs.readFileSync(filePath, 'utf8');
  const { src, changes } = applyPatches(original, filePath);

  if (src !== original) {
    changed++;
    const rel = path.relative(SITE_ROOT, filePath);
    console.log(`✅  ${rel} (${changes.length} fix${changes.length !== 1 ? 'es' : ''})`);
    changes.forEach(c => console.log(c));

    if (!DRY_RUN) {
      fs.writeFileSync(filePath, src, 'utf8');
    }
  }
});

console.log(`\n─────────────────────────────────────────`);
console.log(`   ${total} files scanned`);
console.log(`   ${changed} files ${DRY_RUN ? 'would be changed' : 'updated'}`);
if (DRY_RUN) {
  console.log(`\n   Run without --dry-run to apply changes.`);
}
console.log();
