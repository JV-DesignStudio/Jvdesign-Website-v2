#!/usr/bin/env node
// validate-workshop-callouts.js - ensures every workshop with quiz has companion tool link (A44)
const fs=require('fs'), path=require('path');
const ROOT=path.resolve(__dirname,'..');
const { walk } = require('./lib/walk');
let fails=0;
for(const fp of walk(ROOT)){
  if(!fp.includes('workshops/') || !fp.endsWith('.html')) continue;
  const src=fs.readFileSync(fp,'utf8');
  if(!src.includes('quiz-opt') && !src.includes('STORAGE_KEY')) continue; // not a quiz workshop
  // Check for companion tool cheatsheet link before footer
  const hasCallout = /tools\/(pico8|defold|unity|unreal|gdevelop|gamemaker|cpp|java|python|javascript)-cheatsheet|pixel-studio/.test(src);
  if(!hasCallout){
    console.log(`WARN: ${path.relative(ROOT,fp)} has quiz but no companion tool callout before footer`);
    fails++;
  }
}
if(fails) console.log(`\n✗ ${fails} workshops missing callout (see A44)`), process.exit(1);
else console.log('✓ all quiz workshops have companion tool callout');
