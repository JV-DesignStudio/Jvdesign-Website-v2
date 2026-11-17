/**
 * compress-root-images.cjs
 * Converts PNG/JPG files in the site root to WebP using sharp.
 * Originals are preserved; .webp versions are written alongside them.
 * Pages still referencing .png/.jpg will continue to work — this is prep
 * for a follow-up pass that swaps <img src> and <source> tags.
 *
 * Usage: node scripts/compress-root-images.cjs [--replace]
 *   --replace  overwrite existing .webp files (default: skip if exists)
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REPLACE = process.argv.includes('--replace');

const EXTS = new Set(['.png', '.jpg', '.jpeg']);
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'assets', 'og', 'icons',
  'tests', 'scripts', '_archive', 'downloads',
]);

async function convertFile(src) {
  const ext = path.extname(src).toLowerCase();
  if (!EXTS.has(ext)) return;
  const dest = src.replace(/\.(png|jpg|jpeg)$/i, '.webp');
  if (!REPLACE && fs.existsSync(dest)) return;

  const before = fs.statSync(src).size;
  try {
    await sharp(src)
      .webp({ quality: 82, effort: 4 })
      .toFile(dest);
    const after = fs.statSync(dest).size;
    const saving = Math.round((1 - after / before) * 100);
    console.log(`✓ ${path.basename(src)} → ${path.basename(dest)}  ${(before/1024).toFixed(0)}KB → ${(after/1024).toFixed(0)}KB  (${saving}% smaller)`);
  } catch (err) {
    console.error(`✗ ${path.basename(src)}: ${err.message}`);
  }
}

async function main() {
  const entries = fs.readdirSync(ROOT);
  let count = 0;
  let totalBefore = 0;
  let totalAfter = 0;

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const fullPath = path.join(ROOT, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isFile()) {
      const ext = path.extname(entry).toLowerCase();
      if (EXTS.has(ext)) {
        const dest = fullPath.replace(/\.(png|jpg|jpeg)$/i, '.webp');
        const before = stat.size;
        totalBefore += before;
        await convertFile(fullPath);
        if (fs.existsSync(dest)) {
          totalAfter += fs.statSync(dest).size;
          count++;
        }
      }
    }
  }

  console.log(`\nDone. ${count} files converted.`);
  if (totalBefore > 0) {
    console.log(`Root images: ${(totalBefore/1024/1024).toFixed(1)} MB → ${(totalAfter/1024/1024).toFixed(1)} MB  (${Math.round((1 - totalAfter/totalBefore)*100)}% smaller)`);
  }
}

main().catch(console.error);
