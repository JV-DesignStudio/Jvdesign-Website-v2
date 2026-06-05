#!/usr/bin/env node
const fs   = require('fs');
const path = require('path');

const ROOT     = __dirname;
const PARTIALS = path.join(ROOT, 'partials');

// Load all partials once
const partials = {};
fs.readdirSync(PARTIALS).forEach(f => {
    if (!f.endsWith('.html')) return;
    const name = f.replace('.html', '');
    partials[name] = fs.readFileSync(path.join(PARTIALS, f), 'utf8');
});

// Regex: match <!-- BUILD:name --> ... <!-- /BUILD:name --> (including newlines)
function makeMarkerRegex(name) {
    return new RegExp(
        `<!--\\s*BUILD:${name}\\s*-->[\\s\\S]*?<!--\\s*/BUILD:${name}\\s*-->`,
        'g'
    );
}

let changed = 0;
let unchanged = 0;

const htmlFiles = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

htmlFiles.forEach(file => {
    const filePath = path.join(ROOT, file);
    let src = fs.readFileSync(filePath, 'utf8');
    const original = src;

    Object.entries(partials).forEach(([name, content]) => {
        const re = makeMarkerRegex(name);
        if (re.test(src)) {
            src = src.replace(re,
                `<!-- BUILD:${name} -->\n${content.trim()}\n<!-- /BUILD:${name} -->`
            );
        }
    });

    if (src !== original) {
        fs.writeFileSync(filePath, src, 'utf8');
        console.log('  updated:', file);
        changed++;
    } else {
        unchanged++;
    }
});

console.log(`\nDone. ${changed} file(s) updated, ${unchanged} unchanged.`);
