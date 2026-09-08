#!/usr/bin/env node
// generate-mascot-thumbs.mjs — badge (44px @2x) + hero (224px @2x) WebP/AVIF for mascots
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const SRC = path.join(import.meta.dirname, '../assets/mascots');
const OUT = SRC;

// Only optimize the 5 nav/hero sources (sheets stay as-is for zoom)
const TARGETS = [
  { file: 'lumo.jpg',       name: 'lumo' },
  { file: 'ember.jpg',      name: 'ember' },
  { file: 'echo.jpg',       name: 'echo' },
  { file: 'pip.png',        name: 'pip' },
  { file: 'stardust.png',   name: 'stardust' },
];

const SIZES = [
  { suffix: 'badge', size: 44 },   // 22px ×2
  { suffix: 'hero',  size: 224 },  // 112px ×2
];

let done = 0;
for (const t of TARGETS) {
  const src = path.join(SRC, t.file);
  if (!fs.existsSync(src)) { console.warn('skip missing', t.file); continue; }
  for (const s of SIZES) {
    const base = `${t.name}-${s.suffix}`;
    const webp = path.join(OUT, `${base}.webp`);
    const avif = path.join(OUT, `${base}.avif`);
    const buf = await sharp(src).resize(s.size, s.size, { fit: 'cover', position: 'attention' }).toBuffer();
    await sharp(buf).webp({ quality: s.suffix==='badge'?82:78, effort:4 }).toFile(webp);
    await sharp(buf).avif({ quality: s.suffix==='badge'?48:44, effort:4 }).toFile(avif);
    const ws = fs.statSync(webp).size, asz = fs.statSync(avif).size;
    console.log(`  ${base}.webp ${ws.toLocaleString()}  ${base}.avif ${asz.toLocaleString()}`);
    done += 2;
  }
}
console.log(`Done — ${done} thumbs`);
