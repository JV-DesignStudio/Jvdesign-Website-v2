#!/usr/bin/env node
// Builds the Bug Hunter's Guide search dictionary from the cards in
// tools/error-guide.html. Each engine gets its own JSON chunk so the page only
// fetches the dictionary it needs. Run after editing a card:
//   node scripts/generate-error-guide-data.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PAGE = path.join(ROOT, 'tools', 'error-guide.html');
const OUT = path.join(ROOT, 'data', 'error-guide');

const meta = {
  'sprite-not-moving': {
    raw: /sprite.*(not moving|won'?t move|stays in the same place)|move \d+ steps.*nothing/i,
    ip: 'Echo',
    plain: 'The sprite has a move block, but nothing is telling it when to run. It needs a start event and a loop.',
    symptoms: ['logic-not-responding']
  },
  'costume-not-changing': {
    raw: /costume.*(not changing|won'?t change|doesn'?t change)/i,
    ip: 'Echo',
    plain: 'The costume name in your block does not match a costume on the sprite. Spelling and spaces matter.',
    symptoms: ['visual-wrong']
  },
  'variable-not-updating': {
    raw: /variable.*(not updating|stays at|same number)|score.*(stays at 0|not updating)/i,
    ip: 'Echo',
    plain: 'The score is being set back to zero, or the sprite changing it is not the one showing it.',
    symptoms: ['logic-score']
  },
  'clone-issues': {
    raw: /clone(s)?.*(not appearing|won'?t go away|same thing|issues?)/i,
    ip: 'Echo',
    plain: 'A clone needs its own start block and a delete block, or it keeps piling up and doing the same thing.',
    symptoms: ['logic-not-responding']
  },
  'script-not-running': {
    raw: /script.*(not running|won'?t run|doesn'?t execute)|no output.*console/i,
    ip: 'Echo',
    plain: 'The script is in the wrong place for its type, or it is disabled. A print at the top shows whether it starts.',
    symptoms: ['logic-not-responding']
  },
  'part-not-anchored': {
    raw: /part.*(fall|fly|anchor)|falls? through.*baseplate/i,
    ip: 'Echo',
    plain: 'Gravity is pulling the part down because Anchored is off. Turn it on for floors, walls and props.',
    symptoms: ['physics-fall']
  },
  'remote-event-not-firing': {
    raw: /remote.?event.*(not firing|never receives|nothing happens)/i,
    ip: 'Echo',
    plain: 'The client and server are not listening on the same event, or the event is not in ReplicatedStorage.',
    symptoms: ['logic-not-responding']
  },
  'leaderstats-not-saving': {
    raw: /leaderstats.*(not saving|reset|gone)|data ?store.*(not saving|error)/i,
    ip: 'Echo',
    plain: 'Leaderstats only shows the number. A DataStore has to save and load it when the player joins and leaves.',
    symptoms: ['logic-score']
  },
  'node-not-found': {
    raw: /node not found|get_node.*(null|invalid)|null instance/i,
    ip: 'Lumo',
    plain: 'The scene is looking for a node that is not there, or its name is spelled differently.',
    symptoms: ['logic-not-responding'],
    snippet: 'gd-spawn'
  },
  'signal-not-connected': {
    raw: /signal.*(not connected|non-existent|never runs)/i,
    ip: 'Lumo',
    plain: 'The signal name does not match, or the function was never connected to it.',
    symptoms: ['logic-not-responding'],
    snippet: 'gd-state'
  },
  'physics-not-working': {
    raw: /physics.*(not working|fall through)|(fall|pass).*through.*(floor|each other)|collision.*not (trigger|detect)/i,
    ip: 'Lumo',
    plain: 'The two objects are not set up to collide, so they pass through each other.',
    symptoms: ['physics-fall', 'physics-stuck'],
    snippet: 'gd-collide'
  },
  'scene-not-loading': {
    raw: /(invalid scene|can'?t load resource|scene.*not loading)/i,
    ip: 'Lumo',
    plain: 'The scene file has moved or its path is wrong, so Godot cannot load it.',
    symptoms: ['visual-blank']
  },
  'null-reference-exception': {
    raw: /nullreferenceexception|object reference not set to an instance/i,
    ip: 'Lumo',
    plain: 'Something you are using has not been set yet, so Unity has nothing to work with.',
    symptoms: ['logic-not-responding'],
    snippet: 'cs-singleton'
  },
  'component-not-assigned': {
    raw: /component.*(not assigned|none)|inspector.*none/i,
    ip: 'Lumo',
    plain: 'The Inspector field is empty. Drag the object in, or find it in code before using it.',
    symptoms: ['logic-not-responding']
  },
  'physics-jitter': {
    raw: /(physics|object|movement).*(jitter|shak|jerky)/i,
    ip: 'Lumo',
    plain: 'Physics is being moved in the wrong update, so the object fights itself every frame.',
    symptoms: ['visual-jitter', 'physics-stuck'],
    snippet: 'cs-move'
  },
  'module-not-found': {
    raw: /modulenotfounderror|no module named/i,
    ip: 'Lumo',
    plain: 'Python cannot find that package on this computer, so the import stops.',
    symptoms: ['logic-not-responding']
  },
  'window-not-showing': {
    raw: /(pygame|window).*(not showing|blank|white)|display.*not.*appear/i,
    ip: 'Lumo',
    plain: 'The display is created before Pygame starts, or the loop never flips the screen.',
    symptoms: ['visual-blank'],
    snippet: 'py-gameloop'
  },
  'collision-not-detecting': {
    raw: /collision.*(not detecting|doesn'?t|says.*don'?t)/i,
    ip: 'Lumo',
    plain: 'The rectangle used for collision is not moving with the sprite, so the game checks the old position.',
    symptoms: ['physics-stuck'],
    snippet: 'py-collide'
  },
  'sound-not-playing': {
    raw: /(sound|mixer|audio).*(not playing|silent|no sound)/i,
    ip: 'Lumo',
    plain: 'The mixer needs a click, a supported file, or a different format before it will play.',
    symptoms: ['visual-silent']
  },
  'typeerror-cannot-read-properties-of-undefined': {
    raw: /cannot read propert(?:y|ies) of undefined(?: \(reading ['"]?([^'")\s]+)['"]?\))?|cannot read property ['"]?([^'"\s]+)['"]? of undefined/i,
    kid: 'The Ghost Variable',
    ip: 'Lumo',
    plain: 'You told the game to use {value}, but it has not been created yet. The name is either spelled differently or it does not exist at this point.',
    symptoms: ['logic-not-responding'],
    snippet: 'js-emitter'
  },
  'referenceerror-x-is-not-defined': {
    raw: /referenceerror|is not defined/i,
    ip: 'Lumo',
    plain: 'JavaScript cannot find that name. It may be misspelled, in another scope, or never declared.',
    symptoms: ['logic-not-responding']
  },
  'canvas-not-drawing': {
    raw: /canvas.*(not drawing|blank|nothing appears)/i,
    ip: 'Lumo',
    plain: 'The drawing code is running, but it is drawing to the wrong place or before the canvas is ready.',
    symptoms: ['visual-blank']
  },
  'event-not-firing': {
    raw: /event.*(not firing|never runs|doesn'?t respond)/i,
    ip: 'Lumo',
    plain: 'The element is not there when the listener is added, or another element is catching the click.',
    symptoms: ['logic-not-responding'],
    snippet: 'js-emitter'
  },
  'image-not-loading': {
    raw: /image.*(not loading|broken)|onload.*never/i,
    ip: 'Lumo',
    plain: 'The image path is wrong, or the drawing happens before the image has loaded.',
    symptoms: ['visual-blank']
  }
};

function slugify(text) {
  return text
    .replace(/^🐛\s*/, '')
    .toLowerCase()
    .replace(/&[a-z]+;/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function divBlock(src, start) {
  let depth = 0;
  let i = start;
  while (i < src.length) {
    const open = src.indexOf('<div', i);
    const close = src.indexOf('</div>', i);
    if (close === -1) return null;
    if (open !== -1 && open < close) {
      depth++;
      i = open + 4;
    } else {
      depth--;
      i = close + 6;
      if (depth === 0) return src.slice(start, i);
    }
  }
  return null;
}

const html = fs.readFileSync(PAGE, 'utf8');
const engines = {};
const sectionRe = /<div class="engine-section[^"]*"[^>]*id="engine-([a-z]+)"[^>]*>/g;
const sections = [];
let sm;
while ((sm = sectionRe.exec(html))) {
  sections.push({ engine: sm[1], start: sm.index });
}
sections.forEach((section, index) => {
  const end = index + 1 < sections.length ? sections[index + 1].start : html.length;
  const body = html.slice(section.start, end);
  const cards = [];
  const cardRe = /<div class="error-card"/g;
  let cm;
  while ((cm = cardRe.exec(body))) {
    const block = divBlock(body, cm.index);
    if (!block) continue;
    const keywordMatch = block.match(/data-keywords="([^"]*)"/);
    const titleMatch = block.match(/<div class="error-title">([\s\S]*?)<\/div>/);
    const problemMatch = block.match(/<div class="box-problem">[\s\S]*?<div class="box-text">([\s\S]*?)<\/div>/);
    const stepsMatch = block.match(/<ol class="solution-steps">([\s\S]*?)<\/ol>/);
    const preventMatch = block.match(/<div class="box-prevent">[\s\S]*?<div class="box-text">([\s\S]*?)<\/div>/);
    const title = titleMatch ? stripTags(titleMatch[1]) : 'Untitled bug';
    const slug = slugify(title);
    const steps = [];
    if (stepsMatch) {
      const liRe = /<li>([\s\S]*?)<\/li>/g;
      let lm;
      while ((lm = liRe.exec(stepsMatch[1]))) steps.push(stripTags(lm[1]));
    }
    const info = meta[slug] || {};
    const id = section.engine + '-' + slug;
    cards.push({
      id,
      engine: section.engine,
      raw_signature: info.raw ? info.raw.source : '',
      kid_title: info.kid || title.replace(/^🐛\s*/, ''),
      ip_character: info.ip || 'Echo',
      plain_translation: info.plain || (problemMatch ? stripTags(problemMatch[1]) : ''),
      checklist_fixes: steps,
      snippet_handoff_id: info.snippet || null,
      problem_html: problemMatch ? problemMatch[1].trim() : '',
      prevention_html: preventMatch ? preventMatch[1].trim() : '',
      keywords: keywordMatch ? keywordMatch[1] : '',
      symptoms: info.symptoms || []
    });
  }
  engines[section.engine] = cards;
});

fs.mkdirSync(OUT, { recursive: true });
for (const [engine, cards] of Object.entries(engines)) {
  const file = path.join(OUT, 'errors-' + engine + '.json');
  fs.writeFileSync(file, JSON.stringify(cards, null, 2) + '\n', 'utf8');
  console.log('Wrote ' + path.relative(ROOT, file) + ' (' + cards.length + ' cards)');
}
