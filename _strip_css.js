const fs = require('fs');

const files = {
  'scratch-catch-workshop.html': `/* page overrides */
.hero{background:linear-gradient(180deg,#120800 0%,#0a0b10 100%)}
.blocks-wrap{background:#1a0e00;border:1px solid rgba(255,119,0,.25);border-radius:12px;margin:12px 0;overflow:hidden}
.blocks-label{background:#2a1800;padding:6px 14px;font-size:.7rem;font-weight:800;color:rgba(255,119,0,.7);letter-spacing:.08em;text-transform:uppercase;border-bottom:1px solid rgba(255,119,0,.15);display:flex;align-items:center;gap:6px}
.blocks-body{padding:14px 16px;font-family:'JetBrains Mono','Courier New',monospace;font-size:.82rem;line-height:1.8;overflow-x:auto;white-space:pre;color:#ffe0b2}
.b-hat{color:#ffcc02;font-weight:700}
.b-motion{color:#4c97ff}
.b-looks{color:#9966ff}
.b-sound{color:#cf63cf}
.b-events{color:#ffab19}
.b-control{color:#ffab19}
.b-sensing{color:#5cb1d6}
.b-ops{color:#59c059}
.b-vars{color:#ff8c1a}
.print-btn{display:inline-flex;align-items:center;gap:6px;font-size:.82rem;font-weight:700;padding:10px 18px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:rgba(232,234,242,.6);cursor:pointer;text-decoration:none;transition:background .15s,color .15s}.print-btn:hover{background:rgba(255,255,255,.09);color:var(--text)}
.gallery-prompt{margin-top:20px;padding:18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;text-align:left}.gallery-prompt-label{font-family:'Fredoka',cursive;font-size:1rem;color:#fff;margin-bottom:10px}.gallery-input-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}.gallery-input{flex:1;min-width:200px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:9px 12px;font-size:.85rem;color:var(--text);outline:none}.gallery-input:focus{border-color:rgba(255,119,0,.5)}.gallery-copy-btn{background:linear-gradient(135deg,#ff7700,#cc5500);color:#fff;font-family:'Fredoka',cursive;font-size:.9rem;padding:9px 18px;border-radius:8px;border:none;cursor:pointer;white-space:nowrap;box-shadow:0 2px 0 #993300;transition:filter .15s}.gallery-copy-btn:hover{filter:brightness(1.1)}.gallery-hint{font-size:.78rem;color:var(--muted);line-height:1.5}
@media print{.site-header,.series-strip,.progress-wrap,.xp-wrap,.step-card.locked,.quiz-gate,.code-challenge,.finish-banner,.site-footer,.hero-btns,.print-btn,.skills-strip{display:none!important}.hero{padding:16px 0 10px;border:none}.step-card{border:1px solid #ccc;break-inside:avoid;margin-bottom:12px}.step-card.completed .step-body,.step-card.active-step .step-body{display:block!important}.blocks-body{white-space:pre-wrap}.step-body{display:block!important}body{background:#fff;color:#111}h1,h3,.step-title,.finish-title{color:#111}.hero-sub,.step-blurb,.big-goal-text p{color:#444}}`,

  'scratch-clicker-workshop.html': `/* page overrides */
.hero{background:linear-gradient(180deg,#1a0a00 0%,#0a0b10 100%)}
.hero-badge{background:rgba(249,115,22,.12);border:1px solid rgba(249,115,22,.3);color:#f97316}
h1 em{color:#f97316}
.blocks-wrap{background:#1a0e00;border:1px solid rgba(255,119,0,.25);border-radius:12px;margin:12px 0;overflow:hidden}
.blocks-label{background:#2a1800;padding:6px 14px;font-size:.7rem;font-weight:800;color:rgba(255,119,0,.7);letter-spacing:.08em;text-transform:uppercase;border-bottom:1px solid rgba(255,119,0,.15);display:flex;align-items:center;gap:6px}
.blocks-body{padding:14px 16px;font-family:'JetBrains Mono','Courier New',monospace;font-size:.82rem;line-height:1.8;overflow-x:auto;white-space:pre;color:#ffe0b2}
.b-hat{color:#ffcc02;font-weight:700}
.b-motion{color:#4c97ff}
.b-looks{color:#9966ff}
.b-sound{color:#cf63cf}
.b-events{color:#ffab19}
.b-control{color:#ffab19}
.b-sensing{color:#5cb1d6}
.b-ops{color:#59c059}
.b-vars{color:#ff8c1a}
.print-btn{display:inline-flex;align-items:center;gap:6px;font-size:.82rem;font-weight:700;padding:10px 18px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:rgba(232,234,242,.6);cursor:pointer;text-decoration:none;transition:background .15s,color .15s}.print-btn:hover{background:rgba(255,255,255,.09);color:var(--text)}
.gallery-prompt{margin-top:20px;padding:18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;text-align:left}.gallery-prompt-label{font-family:'Fredoka',cursive;font-size:1rem;color:#fff;margin-bottom:10px}.gallery-input-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}.gallery-input{flex:1;min-width:200px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:9px 12px;font-size:.85rem;color:var(--text);outline:none}.gallery-input:focus{border-color:rgba(255,119,0,.5)}.gallery-copy-btn{background:linear-gradient(135deg,#ff7700,#cc5500);color:#fff;font-family:'Fredoka',cursive;font-size:.9rem;padding:9px 18px;border-radius:8px;border:none;cursor:pointer;white-space:nowrap;box-shadow:0 2px 0 #993300;transition:filter .15s}.gallery-copy-btn:hover{filter:brightness(1.1)}.gallery-hint{font-size:.78rem;color:var(--muted);line-height:1.5}
@media print{.site-header,.series-strip,.progress-wrap,.xp-wrap,.step-card.locked,.quiz-gate,.code-challenge,.concept-fill,.tf-round,.order-challenge,.predict-challenge,.finish-banner,.site-footer,.hero-btns,.print-btn,.skills-strip{display:none!important}.hero{padding:16px 0 10px;border:none}.step-card{border:1px solid #ccc;break-inside:avoid;margin-bottom:12px}.step-card.completed .step-body,.step-card.active-step .step-body{display:block!important}.blocks-body{white-space:pre-wrap}.step-body{display:block!important}body{background:#fff;color:#111}h1,h3,.step-title,.finish-title{color:#111}.hero-sub,.step-blurb,.big-goal-text p{color:#444}}`,

  'scratch-maze-workshop.html': `/* page overrides */
.hero{background:linear-gradient(180deg,#0d0015 0%,#0a0b10 100%)}
.hero-badge{background:rgba(167,139,250,.12);border:1px solid rgba(167,139,250,.3);color:var(--purple)}
h1 em{color:var(--purple)}
.blocks-wrap{background:#1a0e00;border:1px solid rgba(255,119,0,.25);border-radius:12px;margin:12px 0;overflow:hidden}
.blocks-label{background:#2a1800;padding:6px 14px;font-size:.7rem;font-weight:800;color:rgba(255,119,0,.7);letter-spacing:.08em;text-transform:uppercase;border-bottom:1px solid rgba(255,119,0,.15);display:flex;align-items:center;gap:6px}
.blocks-body{padding:14px 16px;font-family:'JetBrains Mono','Courier New',monospace;font-size:.82rem;line-height:1.8;overflow-x:auto;white-space:pre;color:#ffe0b2}
.b-hat{color:#ffcc02;font-weight:700}
.b-motion{color:#4c97ff}
.b-looks{color:#9966ff}
.b-sound{color:#cf63cf}
.b-events{color:#ffab19}
.b-control{color:#ffab19}
.b-sensing{color:#5cb1d6}
.b-ops{color:#59c059}
.b-vars{color:#ff8c1a}
.print-btn{display:inline-flex;align-items:center;gap:6px;font-size:.82rem;font-weight:700;padding:10px 18px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:rgba(232,234,242,.6);cursor:pointer;text-decoration:none;transition:background .15s,color .15s}.print-btn:hover{background:rgba(255,255,255,.09);color:var(--text)}
.gallery-prompt{margin-top:20px;padding:18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;text-align:left}.gallery-prompt-label{font-family:'Fredoka',cursive;font-size:1rem;color:#fff;margin-bottom:10px}.gallery-input-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}.gallery-input{flex:1;min-width:200px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:9px 12px;font-size:.85rem;color:var(--text);outline:none}.gallery-input:focus{border-color:rgba(255,119,0,.5)}.gallery-copy-btn{background:linear-gradient(135deg,#ff7700,#cc5500);color:#fff;font-family:'Fredoka',cursive;font-size:.9rem;padding:9px 18px;border-radius:8px;border:none;cursor:pointer;white-space:nowrap;box-shadow:0 2px 0 #993300;transition:filter .15s}.gallery-copy-btn:hover{filter:brightness(1.1)}.gallery-hint{font-size:.78rem;color:var(--muted);line-height:1.5}
@media print{.site-header,.series-strip,.progress-wrap,.xp-wrap,.step-card.locked,.quiz-gate,.code-challenge,.finish-banner,.site-footer,.hero-btns,.print-btn,.skills-strip{display:none!important}.hero{padding:16px 0 10px;border:none}.step-card{border:1px solid #ccc;break-inside:avoid;margin-bottom:12px}.step-card.completed .step-body,.step-card.active-step .step-body{display:block!important}.blocks-body{white-space:pre-wrap}.step-body{display:block!important}body{background:#fff;color:#111}h1,h3,.step-title,.finish-title{color:#111}.hero-sub,.step-blurb,.big-goal-text p{color:#444}}`,

  'scratch-platformer-workshop.html': `/* page overrides */
.hero{background:linear-gradient(180deg,#000d1a 0%,#0a0b10 100%)}
.hero-badge{background:rgba(14,165,233,.12);border:1px solid rgba(14,165,233,.3);color:#0ea5e9}
h1 em{color:#0ea5e9}
.blocks-wrap{background:#1a0e00;border:1px solid rgba(255,119,0,.25);border-radius:12px;margin:12px 0;overflow:hidden}
.blocks-label{background:#2a1800;padding:6px 14px;font-size:.7rem;font-weight:800;color:rgba(255,119,0,.7);letter-spacing:.08em;text-transform:uppercase;border-bottom:1px solid rgba(255,119,0,.15);display:flex;align-items:center;gap:6px}
.blocks-body{padding:14px 16px;font-family:'JetBrains Mono','Courier New',monospace;font-size:.82rem;line-height:1.8;overflow-x:auto;white-space:pre;color:#ffe0b2}
.b-hat{color:#ffcc02;font-weight:700}
.b-motion{color:#4c97ff}
.b-looks{color:#9966ff}
.b-sound{color:#cf63cf}
.b-events{color:#ffab19}
.b-control{color:#ffab19}
.b-sensing{color:#5cb1d6}
.b-ops{color:#59c059}
.b-vars{color:#ff8c1a}
.print-btn{display:inline-flex;align-items:center;gap:6px;font-size:.82rem;font-weight:700;padding:10px 18px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:rgba(232,234,242,.6);cursor:pointer;text-decoration:none;transition:background .15s,color .15s}.print-btn:hover{background:rgba(255,255,255,.09);color:var(--text)}
.gallery-prompt{margin-top:20px;padding:18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;text-align:left}.gallery-prompt-label{font-family:'Fredoka',cursive;font-size:1rem;color:#fff;margin-bottom:10px}.gallery-input-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}.gallery-input{flex:1;min-width:200px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:9px 12px;font-size:.85rem;color:var(--text);outline:none}.gallery-input:focus{border-color:rgba(255,119,0,.5)}.gallery-copy-btn{background:linear-gradient(135deg,#ff7700,#cc5500);color:#fff;font-family:'Fredoka',cursive;font-size:.9rem;padding:9px 18px;border-radius:8px;border:none;cursor:pointer;white-space:nowrap;box-shadow:0 2px 0 #993300;transition:filter .15s}.gallery-copy-btn:hover{filter:brightness(1.1)}.gallery-hint{font-size:.78rem;color:var(--muted);line-height:1.5}
@media print{.site-header,.series-strip,.progress-wrap,.xp-wrap,.step-card.locked,.quiz-gate,.code-challenge,.finish-banner,.site-footer,.hero-btns,.print-btn,.skills-strip{display:none!important}.hero{padding:16px 0 10px;border:none}.step-card{border:1px solid #ccc;break-inside:avoid;margin-bottom:12px}.step-card.completed .step-body,.step-card.active-step .step-body{display:block!important}.blocks-body{white-space:pre-wrap}.step-body{display:block!important}body{background:#fff;color:#111}h1,h3,.step-title,.finish-title{color:#111}.hero-sub,.step-blurb,.big-goal-text p{color:#444}}`,

  'scratch-quiz-workshop.html': `/* page overrides */
.hero{background:linear-gradient(180deg,#0a1a06 0%,#0a0b10 100%)}
.hero-badge{background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.3);color:#22c55e}
h1 em{color:#22c55e}
.blocks-wrap{background:#1a0e00;border:1px solid rgba(255,119,0,.25);border-radius:12px;margin:12px 0;overflow:hidden}
.blocks-label{background:#2a1800;padding:6px 14px;font-size:.7rem;font-weight:800;color:rgba(255,119,0,.7);letter-spacing:.08em;text-transform:uppercase;border-bottom:1px solid rgba(255,119,0,.15);display:flex;align-items:center;gap:6px}
.blocks-body{padding:14px 16px;font-family:'JetBrains Mono','Courier New',monospace;font-size:.82rem;line-height:1.8;overflow-x:auto;white-space:pre;color:#ffe0b2}
.b-hat{color:#ffcc02;font-weight:700}
.b-motion{color:#4c97ff}
.b-looks{color:#9966ff}
.b-sound{color:#cf63cf}
.b-events{color:#ffab19}
.b-control{color:#ffab19}
.b-sensing{color:#5cb1d6}
.b-ops{color:#59c059}
.b-vars{color:#ff8c1a}
.print-btn{display:inline-flex;align-items:center;gap:6px;font-size:.82rem;font-weight:700;padding:10px 18px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:rgba(232,234,242,.6);cursor:pointer;text-decoration:none;transition:background .15s,color .15s}.print-btn:hover{background:rgba(255,255,255,.09);color:var(--text)}
.gallery-prompt{margin-top:20px;padding:18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;text-align:left}.gallery-prompt-label{font-family:'Fredoka',cursive;font-size:1rem;color:#fff;margin-bottom:10px}.gallery-input-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}.gallery-input{flex:1;min-width:200px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:9px 12px;font-size:.85rem;color:var(--text);outline:none}.gallery-input:focus{border-color:rgba(255,119,0,.5)}.gallery-copy-btn{background:linear-gradient(135deg,#ff7700,#cc5500);color:#fff;font-family:'Fredoka',cursive;font-size:.9rem;padding:9px 18px;border-radius:8px;border:none;cursor:pointer;white-space:nowrap;box-shadow:0 2px 0 #993300;transition:filter .15s}.gallery-copy-btn:hover{filter:brightness(1.1)}.gallery-hint{font-size:.78rem;color:var(--muted);line-height:1.5}
@media print{.site-header,.series-strip,.progress-wrap,.xp-wrap,.step-card.locked,.quiz-gate,.code-challenge,.finish-banner,.site-footer,.hero-btns,.print-btn,.skills-strip{display:none!important}.hero{padding:16px 0 10px;border:none}.step-card{border:1px solid #ccc;break-inside:avoid;margin-bottom:12px}.step-card.completed .step-body,.step-card.active-step .step-body{display:block!important}.blocks-body{white-space:pre-wrap}.step-body{display:block!important}body{background:#fff;color:#111}h1,h3,.step-title,.finish-title{color:#111}.hero-sub,.step-blurb,.big-goal-text p{color:#444}}`,
};

for (const [fname, newCss] of Object.entries(files)) {
  const content = fs.readFileSync(fname, 'utf8');
  const replaced = content.replace(/<style>\n[\s\S]*?\n<\/style>/, '<style>\n' + newCss + '\n</style>');
  fs.writeFileSync(fname, replaced, 'utf8');
  const styleLines = replaced.match(/<style>\n[\s\S]*?\n<\/style>/)[0].split('\n').length;
  console.log(`${fname}: style block now ${styleLines} lines`);
}
