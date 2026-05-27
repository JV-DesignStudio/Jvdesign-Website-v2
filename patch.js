const fs = require('fs');
let c = fs.readFileSync('F:/Website/Jvdesign-Website-v2/arcade-game-maker.html', 'utf8');
const orig = c;

function rep(from, to, label) {
  const idx = c.indexOf(from);
  if (idx < 0) { console.error('NOT FOUND: ' + label); return; }
  c = c.slice(0, idx) + to + c.slice(idx + from.length);
  console.log('OK: ' + label);
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. MERGE CODE + EVENTS TABS
// ═══════════════════════════════════════════════════════════════════════════

// 1a. Remove Events tab button from the tab bar
rep(
  '\r\n            <button class="tab-btn"     onclick="switchTab(\'events\',this)" id="tab-btn-events"><span class="tab-icon">⚡</span><span class="tab-lbl">Events</span></button>',
  '',
  'Remove Events tab button'
);

// 1b. Update keyboard shortcut: key 7 → switch to Code tab
rep(
  'if (e.key === \'7\') { const eb=document.getElementById(\'tab-btn-events\'); if(eb&&eb.offsetParent) switchTab(\'events\',eb); }',
  'if (e.key === \'7\') switchTab(\'code\', document.querySelectorAll(\'.tab-btn\')[5]);',
  'Update key 7 shortcut'
);

// 1c. Update shortcuts modal text
rep(
  '<div class="sk-row"><kbd class="sk-key">1 – 7</kbd><span class="sk-label">Switch Build → Events tabs</span></div>',
  '<div class="sk-row"><kbd class="sk-key">1 – 6</kbd><span class="sk-label">Switch Build → Code tabs</span></div>',
  'Update shortcuts modal text'
);

// 1d. Remove the separate tab-events div
rep(
  '\r\n    <!-- ── EVENTS TAB CONTENT ── -->\r\n    <div class="tab-content" id="tab-events">\r\n        <div style="background:rgba(124,58,237,.08);border:1px solid rgba(124,58,237,.2);border-radius:10px;padding:10px 12px;font-size:.74rem;color:var(--muted);line-height:1.65;">\r\n            ⚡ <strong style="color:white;">Event Nodes</strong> make things happen during your game — no coding needed!<br>\r\n            Tap a <span style="color:#4ade80;font-weight:700;">🟢 WHEN</span> node to change the trigger. Tap a <span style="color:#f87171;font-weight:700;">🔴 THEN</span> node to change the action.\r\n        </div>\r\n        <span class="sec-label" style="margin-top:4px;">Rules</span>\r\n        <div class="evt-list" id="evtList">\r\n            <div class="evt-empty"><span class="evt-empty-icon">⚡</span>No rules yet!<br>Add one below — try "When score reaches 500 → Show message"</div>\r\n        </div>\r\n        <button class="btn-add-evt" onclick="evtAdd()">＋ Add New Rule</button>\r\n        <div class="evt-log" id="evtFiredLog" style="margin-top:8px;">— run game to see rules fire —</div>\r\n    </div>',
  '',
  'Remove standalone tab-events div'
);

// 1e. Add events section inside tab-code (after the reference wrapper)
rep(
  '            </div><!-- /reference wrapper -->\r\n        </div>\r\n    </div>',
  '            </div><!-- /reference wrapper -->\r\n\r\n            <!-- ── EVENT NODES (merged into Code tab) ── -->\r\n            <div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px;">\r\n                <span class="sec-label">⚡ Event Rules</span>\r\n                <div style="background:rgba(124,58,237,.08);border:1px solid rgba(124,58,237,.2);border-radius:10px;padding:10px 12px;font-size:.7rem;color:var(--muted);line-height:1.65;margin-bottom:7px;">\r\n                    <strong style="color:white;">Event Nodes</strong> make things happen during your game — no coding needed!<br>\r\n                    Tap <span style="color:#4ade80;font-weight:700;">🟢 WHEN</span> to set trigger. Tap <span style="color:#f87171;font-weight:700;">🔴 THEN</span> to set action.\r\n                </div>\r\n                <div class="evt-list" id="evtList">\r\n                    <div class="evt-empty"><span class="evt-empty-icon">⚡</span>No rules yet!<br>Add one below — try "When score reaches 500 → Show message"</div>\r\n                </div>\r\n                <button class="btn-add-evt" onclick="evtAdd()">+ Add New Rule</button>\r\n                <div class="evt-log" id="evtFiredLog" style="margin-top:8px;">— run game to see rules fire —</div>\r\n            </div>\r\n        </div>\r\n    </div>',
  'Add events section inside tab-code'
);

// ═══════════════════════════════════════════════════════════════════════════
// 2. MORE SOUND PACKS
// ═══════════════════════════════════════════════════════════════════════════

// 2a. Add more packs to SOUND_PACKS object
rep(
  'const SOUND_PACKS = {\r\n    chiptune: { _type:\'square\',  _detune:0    },   // default — square wave\r\n    retro:    { _type:\'sawtooth\',_detune:0    },   // buzzier\r\n    minimal:  { _type:\'sine\',    _detune:0    },   // clean sine\r\n    synth:    { _type:\'triangle\',_detune:12   },   // warm triangle + slight detune\r\n};',
  'const SOUND_PACKS = {\r\n    chiptune:   { _type:\'square\',  _detune:0    },   // default — square wave\r\n    retro:      { _type:\'sawtooth\',_detune:0    },   // buzzier\r\n    minimal:    { _type:\'sine\',    _detune:0    },   // clean sine\r\n    synth:      { _type:\'triangle\',_detune:12   },   // warm triangle + slight detune\r\n    arcade:     { _type:\'square\',  _detune:7    },   // punchy 8-bit with punch\r\n    cartoon:    { _type:\'triangle\',_detune:0    },   // bouncy smooth triangle\r\n    spooky:     { _type:\'sawtooth\',_detune:-14  },   // dark detuned sawtooth\r\n    fantasy:    { _type:\'sine\',    _detune:24   },   // ethereal detuned sine\r\n    electronic: { _type:\'sawtooth\',_detune:7    },   // bright synth buzz\r\n};',
  'Expand SOUND_PACKS'
);

// 2b. Make _osc() respect the active sound pack type + detune
rep(
  '    _osc(type, freq0, freq1, dur, vol) {\r\n        const ac = this.getCtx(), t = ac.currentTime + 0.01;\r\n        const o = ac.createOscillator(), g = ac.createGain();\r\n        o.type = type; o.connect(g); g.connect(ac.destination);',
  '    _osc(type, freq0, freq1, dur, vol) {\r\n        const ac = this.getCtx(), t = ac.currentTime + 0.01;\r\n        const o = ac.createOscillator(), g = ac.createGain();\r\n        o.type = window._soundPackType || type;\r\n        o.detune.value = window._soundPackDetune || 0;\r\n        o.connect(g); g.connect(ac.destination);',
  'Patch _osc to use sound pack'
);

// 2c. Add new pill buttons in the Sound Pack UI row
rep(
  '                    <button class="pill active" onclick="activePill(\'pillSoundPack\',this);applySoundPack(\'chiptune\');">🎮 Chiptune</button>\r\n                    <button class="pill" onclick="activePill(\'pillSoundPack\',this);applySoundPack(\'retro\');">📻 Retro</button>\r\n                    <button class="pill" onclick="activePill(\'pillSoundPack\',this);applySoundPack(\'minimal\');">🔇 Minimal</button>\r\n                    <button class="pill" onclick="activePill(\'pillSoundPack\',this);applySoundPack(\'synth\');">🌊 Synth</button>',
  '                    <button class="pill active" onclick="activePill(\'pillSoundPack\',this);applySoundPack(\'chiptune\');">🎮 Chiptune</button>\r\n                    <button class="pill" onclick="activePill(\'pillSoundPack\',this);applySoundPack(\'retro\');">📻 Retro</button>\r\n                    <button class="pill" onclick="activePill(\'pillSoundPack\',this);applySoundPack(\'minimal\');">🔇 Minimal</button>\r\n                    <button class="pill" onclick="activePill(\'pillSoundPack\',this);applySoundPack(\'synth\');">🌊 Synth</button>\r\n                    <button class="pill" onclick="activePill(\'pillSoundPack\',this);applySoundPack(\'arcade\');">🕹 Arcade</button>\r\n                    <button class="pill" onclick="activePill(\'pillSoundPack\',this);applySoundPack(\'cartoon\');">🦄 Cartoon</button>\r\n                    <button class="pill" onclick="activePill(\'pillSoundPack\',this);applySoundPack(\'spooky\');">👻 Spooky</button>\r\n                    <button class="pill" onclick="activePill(\'pillSoundPack\',this);applySoundPack(\'fantasy\');">✨ Fantasy</button>\r\n                    <button class="pill" onclick="activePill(\'pillSoundPack\',this);applySoundPack(\'electronic\');">⚡ Electric</button>',
  'Add sound pack pills'
);

// ═══════════════════════════════════════════════════════════════════════════
// 3. MORE SFX SLOTS
// ═══════════════════════════════════════════════════════════════════════════

// 3a. Extend GameAudio.sounds and customBuffers defaults
rep(
  '    sounds: { shoot:\'laser\', jump:\'boing\', hit:\'boom\', score:\'coin\' },\r\n    customBuffers: { shoot:null, jump:null, hit:null, score:null },',
  '    sounds: { shoot:\'laser\', jump:\'boing\', hit:\'boom\', score:\'coin\', levelup:\'fanfare\', death:\'lose\', powerup:\'powerup\', victory:\'victory\' },\r\n    customBuffers: { shoot:null, jump:null, hit:null, score:null, levelup:null, death:null, powerup:null, victory:null },',
  'Extend GameAudio sounds and customBuffers'
);

// 3b. Add _snd_ methods for new slots (before _playBuffer)
rep(
  '    _playBuffer(dataUrl) {',
  '    // LEVEL UP sounds\r\n    _snd_fanfare() {\r\n        const ac = this.getCtx(), t = ac.currentTime + 0.01;\r\n        [523,659,784,1047].forEach((f,i) => {\r\n            const o = ac.createOscillator(), g = ac.createGain();\r\n            o.type = window._soundPackType||\'square\'; o.detune.value=window._soundPackDetune||0;\r\n            o.connect(g); g.connect(ac.destination);\r\n            o.frequency.value = f;\r\n            const st = t + i * 0.09;\r\n            g.gain.setValueAtTime(this.volume*0.22, st);\r\n            g.gain.exponentialRampToValueAtTime(0.001, st+0.22);\r\n            o.start(st); o.stop(st+0.25);\r\n        });\r\n    },\r\n    _snd_jingle() { this._osc(\'square\', 784, 1568, 0.35, 0.2); },\r\n    _snd_ascend() {\r\n        const ac = this.getCtx(), t = ac.currentTime + 0.01;\r\n        [330,392,494,659].forEach((f,i) => {\r\n            const o = ac.createOscillator(), g = ac.createGain();\r\n            o.type = window._soundPackType||\'square\'; o.detune.value=window._soundPackDetune||0;\r\n            o.connect(g); g.connect(ac.destination);\r\n            o.frequency.value = f;\r\n            const st = t + i*0.07;\r\n            g.gain.setValueAtTime(this.volume*0.2, st);\r\n            g.gain.exponentialRampToValueAtTime(0.001, st+0.18);\r\n            o.start(st); o.stop(st+0.2);\r\n        });\r\n    },\r\n\r\n    // DEATH / GAME OVER sounds\r\n    _snd_lose() {\r\n        const ac = this.getCtx(), t = ac.currentTime + 0.01;\r\n        [440,350,280,220].forEach((f,i) => {\r\n            const o = ac.createOscillator(), g = ac.createGain();\r\n            o.type = window._soundPackType||\'sawtooth\'; o.detune.value=window._soundPackDetune||0;\r\n            o.connect(g); g.connect(ac.destination);\r\n            o.frequency.value = f;\r\n            const st = t + i*0.1;\r\n            g.gain.setValueAtTime(this.volume*0.2, st);\r\n            g.gain.exponentialRampToValueAtTime(0.001, st+0.18);\r\n            o.start(st); o.stop(st+0.22);\r\n        });\r\n    },\r\n    _snd_wah() { this._osc(\'sawtooth\', 300, 100, 0.5, 0.25); },\r\n    _snd_splat() { this._noise(0.35, 0.4); this._osc(\'sine\', 100, 40, 0.4, 0.2); },\r\n\r\n    // POWERUP sounds\r\n    _snd_powerup() {\r\n        const ac = this.getCtx(), t = ac.currentTime + 0.01;\r\n        [392,523,659,784].forEach((f,i) => {\r\n            const o = ac.createOscillator(), g = ac.createGain();\r\n            o.type = window._soundPackType||\'triangle\'; o.detune.value=window._soundPackDetune||0;\r\n            o.connect(g); g.connect(ac.destination);\r\n            o.frequency.value = f;\r\n            const st = t + i*0.065;\r\n            g.gain.setValueAtTime(this.volume*0.2, st);\r\n            g.gain.exponentialRampToValueAtTime(0.001, st+0.15);\r\n            o.start(st); o.stop(st+0.18);\r\n        });\r\n    },\r\n    _snd_sparkle() { this._osc(\'sine\', 1200, 2400, 0.18, 0.18); },\r\n    _snd_shield()  { this._osc(\'triangle\', 500, 800, 0.22, 0.2); },\r\n\r\n    // VICTORY / WIN sounds\r\n    _snd_victory() {\r\n        const ac = this.getCtx(), t = ac.currentTime + 0.01;\r\n        [523,659,784,880,1047].forEach((f,i) => {\r\n            const o = ac.createOscillator(), g = ac.createGain();\r\n            o.type = window._soundPackType||\'square\'; o.detune.value=window._soundPackDetune||0;\r\n            o.connect(g); g.connect(ac.destination);\r\n            o.frequency.value = f;\r\n            const st = t + i*0.1;\r\n            g.gain.setValueAtTime(this.volume*0.22, st);\r\n            g.gain.exponentialRampToValueAtTime(0.001, st+0.25);\r\n            o.start(st); o.stop(st+0.28);\r\n        });\r\n    },\r\n    _snd_tada()    { this._osc(\'square\', 784, 1568, 0.4, 0.28); },\r\n    _snd_triumph() {\r\n        const ac = this.getCtx(), t = ac.currentTime + 0.01;\r\n        [392,494,587,784,987].forEach((f,i) => {\r\n            const o = ac.createOscillator(), g = ac.createGain();\r\n            o.type = window._soundPackType||\'square\'; o.detune.value=window._soundPackDetune||0;\r\n            o.connect(g); g.connect(ac.destination);\r\n            o.frequency.value = f;\r\n            const st = t + i*0.08;\r\n            g.gain.setValueAtTime(this.volume*0.2, st);\r\n            g.gain.exponentialRampToValueAtTime(0.001, st+0.2);\r\n            o.start(st); o.stop(st+0.22);\r\n        });\r\n    },\r\n\r\n    _playBuffer(dataUrl) {',
  'Add new SFX _snd_ methods'
);

// 3c. Add UI rows for new SFX slots (after the Score row)
rep(
  '                    <span class="sound-custom-badge" id="sfxScoreBadge" style="display:none;">✓ Custom</span>\r\n                </div>\r\n            </div>\r\n\r\n            <button class="btn-run" style="background:#7c3aed;box-shadow:0 3px 0 #5b21b6;" onclick="GameAudio.previewSlot(\'shoot\');setTimeout(()=>GameAudio.previewSlot(\'jump\'),300);setTimeout(()=>GameAudio.previewSlot(\'hit\'),600);setTimeout(()=>GameAudio.previewSlot(\'score\'),900);">▶ Preview All Sounds</button>',
  '                    <span class="sound-custom-badge" id="sfxScoreBadge" style="display:none;">✓ Custom</span>\r\n                </div>\r\n                <!-- Level Up -->\r\n                <div class="sound-row">\r\n                    <span class="sound-event-icon">🌟</span>\r\n                    <span class="sound-event">Level Up</span>\r\n                    <select class="sound-pick" id="sfxLevelup" onchange="clearSfxCustom(\'levelup\');GameAudio.sounds.levelup=this.value;GameAudio.previewSlot(\'levelup\');">\r\n                        <option value="fanfare">Fanfare</option>\r\n                        <option value="jingle">Jingle</option>\r\n                        <option value="ascend">Ascend</option>\r\n                        <option value="off">Off</option>\r\n                    </select>\r\n                    <button class="sound-import-btn" onclick="GameAudio.previewSlot(\'levelup\')" title="Preview">▶</button>\r\n                    <button class="sound-import-btn" onclick="importSfxSlot(\'levelup\')" title="Import last SFX">⬇ Studio</button>\r\n                    <span class="sound-custom-badge" id="sfxLevelupBadge" style="display:none;">✓ Custom</span>\r\n                </div>\r\n                <!-- Death -->\r\n                <div class="sound-row">\r\n                    <span class="sound-event-icon">💀</span>\r\n                    <span class="sound-event">Death</span>\r\n                    <select class="sound-pick" id="sfxDeath" onchange="clearSfxCustom(\'death\');GameAudio.sounds.death=this.value;GameAudio.previewSlot(\'death\');">\r\n                        <option value="lose">Lose</option>\r\n                        <option value="wah">Sad Wah</option>\r\n                        <option value="splat">Splat</option>\r\n                        <option value="off">Off</option>\r\n                    </select>\r\n                    <button class="sound-import-btn" onclick="GameAudio.previewSlot(\'death\')" title="Preview">▶</button>\r\n                    <button class="sound-import-btn" onclick="importSfxSlot(\'death\')" title="Import last SFX">⬇ Studio</button>\r\n                    <span class="sound-custom-badge" id="sfxDeathBadge" style="display:none;">✓ Custom</span>\r\n                </div>\r\n                <!-- Power-up -->\r\n                <div class="sound-row">\r\n                    <span class="sound-event-icon">⚡</span>\r\n                    <span class="sound-event">Power-up</span>\r\n                    <select class="sound-pick" id="sfxPowerup" onchange="clearSfxCustom(\'powerup\');GameAudio.sounds.powerup=this.value;GameAudio.previewSlot(\'powerup\');">\r\n                        <option value="powerup">Power-up</option>\r\n                        <option value="sparkle">Sparkle</option>\r\n                        <option value="shield">Shield</option>\r\n                        <option value="off">Off</option>\r\n                    </select>\r\n                    <button class="sound-import-btn" onclick="GameAudio.previewSlot(\'powerup\')" title="Preview">▶</button>\r\n                    <button class="sound-import-btn" onclick="importSfxSlot(\'powerup\')" title="Import last SFX">⬇ Studio</button>\r\n                    <span class="sound-custom-badge" id="sfxPowerupBadge" style="display:none;">✓ Custom</span>\r\n                </div>\r\n                <!-- Victory -->\r\n                <div class="sound-row">\r\n                    <span class="sound-event-icon">🏆</span>\r\n                    <span class="sound-event">Victory</span>\r\n                    <select class="sound-pick" id="sfxVictory" onchange="clearSfxCustom(\'victory\');GameAudio.sounds.victory=this.value;GameAudio.previewSlot(\'victory\');">\r\n                        <option value="victory">Victory</option>\r\n                        <option value="tada">Ta-da!</option>\r\n                        <option value="triumph">Triumph</option>\r\n                        <option value="off">Off</option>\r\n                    </select>\r\n                    <button class="sound-import-btn" onclick="GameAudio.previewSlot(\'victory\')" title="Preview">▶</button>\r\n                    <button class="sound-import-btn" onclick="importSfxSlot(\'victory\')" title="Import last SFX">⬇ Studio</button>\r\n                    <span class="sound-custom-badge" id="sfxVictoryBadge" style="display:none;">✓ Custom</span>\r\n                </div>\r\n            </div>\r\n\r\n            <button class="btn-run" style="background:#7c3aed;box-shadow:0 3px 0 #5b21b6;" onclick="GameAudio.previewSlot(\'shoot\');setTimeout(()=>GameAudio.previewSlot(\'jump\'),300);setTimeout(()=>GameAudio.previewSlot(\'hit\'),600);setTimeout(()=>GameAudio.previewSlot(\'score\'),900);setTimeout(()=>GameAudio.previewSlot(\'levelup\'),1200);setTimeout(()=>GameAudio.previewSlot(\'powerup\'),1500);">▶ Preview All Sounds</button>',
  'Add new SFX slot rows'
);

// 3d. Update save/load to include new slots
rep(
  '    [\'shoot\',\'jump\',\'hit\',\'score\'].forEach(slot => {\r\n            const sel=document.getElementById(\'sfx\'+slot.charAt(0).toUpperCase()+slot.slice(1));\r\n            if(sel && d.sounds[slot] && d.sounds[slot]!==\'custom\') sel.value=d.sounds[slot];\r\n        });\r\n    }\r\n    if(d.customBuffers) {\r\n        Object.assign(GameAudio.customBuffers, d.customBuffers);\r\n        [\'shoot\',\'jump\',\'hit\',\'score\'].forEach(slot => {\r\n            if(d.customBuffers[slot]) { const b=document.getElementById(\'sfx\'+slot.charAt(0).toUpperCase()+slot.slice(1)+\'Badge\'); if(b) b.style.display=\'inline\'; }\r\n        });\r\n    }',
  '    [\'shoot\',\'jump\',\'hit\',\'score\',\'levelup\',\'death\',\'powerup\',\'victory\'].forEach(slot => {\r\n            const sel=document.getElementById(\'sfx\'+slot.charAt(0).toUpperCase()+slot.slice(1));\r\n            if(sel && d.sounds[slot] && d.sounds[slot]!==\'custom\') sel.value=d.sounds[slot];\r\n        });\r\n    }\r\n    if(d.customBuffers) {\r\n        Object.assign(GameAudio.customBuffers, d.customBuffers);\r\n        [\'shoot\',\'jump\',\'hit\',\'score\',\'levelup\',\'death\',\'powerup\',\'victory\'].forEach(slot => {\r\n            if(d.customBuffers[slot]) { const b=document.getElementById(\'sfx\'+slot.charAt(0).toUpperCase()+slot.slice(1)+\'Badge\'); if(b) b.style.display=\'inline\'; }\r\n        });\r\n    }',
  'Update save/load SFX slots list'
);

// ═══════════════════════════════════════════════════════════════════════════
// 4. MORE EXTRAS CARDS
// ═══════════════════════════════════════════════════════════════════════════

// 4a. Add new card buttons to the extras-grid
rep(
  '                <button class="ec-btn" data-card="genre"        id="ec-genre"        onclick="toggleExtraCard(\'genre\')">        <span class="ec-icon">🎮</span><span class="ec-name">Genre Options</span></button>\r\n            </div>',
  '                <button class="ec-btn" data-card="genre"        id="ec-genre"        onclick="toggleExtraCard(\'genre\')">        <span class="ec-icon">🎮</span><span class="ec-name">Genre Options</span></button>\r\n                <button class="ec-btn" data-card="player"       id="ec-player"       onclick="toggleExtraCard(\'player\')">       <span class="ec-icon">👤</span><span class="ec-name">Player</span></button>\r\n                <button class="ec-btn" data-card="camera"       id="ec-camera"       onclick="toggleExtraCard(\'camera\')">       <span class="ec-icon">📷</span><span class="ec-name">Camera</span></button>\r\n                <button class="ec-btn" data-card="combat"       id="ec-combat"       onclick="toggleExtraCard(\'combat\')">       <span class="ec-icon">⚔</span><span class="ec-name">Combat</span></button>\r\n                <button class="ec-btn" data-card="hud"          id="ec-hud"          onclick="toggleExtraCard(\'hud\')">          <span class="ec-icon">📊</span><span class="ec-name">HUD</span></button>\r\n            </div>',
  'Add new extras card buttons'
);

// 4b. Add new extras panels after the last panel before tab-code
// Find the boundary: tab-custom closes then tab-code starts
const codeViewMarker = '        <!-- ── CODE VIEW ── -->';
const codeViewIdx = c.indexOf(codeViewMarker);
if (codeViewIdx < 0) {
  console.error('NOT FOUND: code view marker');
} else {
  // Find the closing </div>\r\n    </div> just before this marker
  // Walk backwards to find the closing of tab-custom
  const before = c.slice(0, codeViewIdx);
  // The tab-custom div closing is "</div>\r\n\r\n        <!-- ── CODE VIEW"
  const tabCustomClose = '</div>\r\n\r\n        <!-- ── CODE VIEW ── -->';
  const closeIdx = c.indexOf(tabCustomClose);
  if (closeIdx < 0) {
    console.error('NOT FOUND: tab-custom closing before code view');
    // Debug
    console.log('Context around code view:', JSON.stringify(c.slice(codeViewIdx-60, codeViewIdx)));
  } else {
    const newPanels = `\r\n\r\n            <!-- ── PLAYER panel ── -->\r\n            <div class="extra-panel" id="ep-player">\r\n                <span class="sec-label">Player Settings</span>\r\n                <div class="form-group">\r\n                    <label>Player Size</label>\r\n                    <div class="pill-row" id="pillPlayerSize">\r\n                        <button class="pill" onclick="activePill('pillPlayerSize',this);liveConfig.playerSize=0.7;">Tiny</button>\r\n                        <button class="pill active" onclick="activePill('pillPlayerSize',this);liveConfig.playerSize=1;">Normal</button>\r\n                        <button class="pill" onclick="activePill('pillPlayerSize',this);liveConfig.playerSize=1.4;">Big</button>\r\n                        <button class="pill" onclick="activePill('pillPlayerSize',this);liveConfig.playerSize=2;">Giant</button>\r\n                    </div>\r\n                </div>\r\n                <div class="form-group">\r\n                    <label>Starting Lives</label>\r\n                    <div class="range-row">\r\n                        <input type="range" min="1" max="9" value="3" id="startLivesSlider" oninput="liveConfig.startLives=+this.value;this.nextElementSibling.textContent=this.value;">\r\n                        <span class="range-val">3</span>\r\n                    </div>\r\n                </div>\r\n                <div class="form-group">\r\n                    <label>Player Colour</label>\r\n                    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">\r\n                        <input type="color" id="playerColourPick" value="#a78bfa" style="width:40px;height:32px;border:none;background:none;cursor:pointer;border-radius:6px;" oninput="liveConfig.playerColour=this.value;">\r\n                        <button class="btn-sm" onclick="liveConfig.playerColour=null;document.getElementById('playerColourPick').value='#a78bfa';">Reset</button>\r\n                        <span style="font-size:.62rem;color:var(--muted);">Tints the player sprite</span>\r\n                    </div>\r\n                </div>\r\n                <div class="form-group">\r\n                    <label>Invincibility Frames</label>\r\n                    <div class="pill-row" id="pillInvincFrames">\r\n                        <button class="pill" onclick="activePill('pillInvincFrames',this);liveConfig.invincFrames=0;">None</button>\r\n                        <button class="pill active" onclick="activePill('pillInvincFrames',this);liveConfig.invincFrames=800;">Short</button>\r\n                        <button class="pill" onclick="activePill('pillInvincFrames',this);liveConfig.invincFrames=1500;">Long</button>\r\n                        <button class="pill" onclick="activePill('pillInvincFrames',this);liveConfig.invincFrames=3000;">Very Long</button>\r\n                    </div>\r\n                </div>\r\n            </div>\r\n\r\n            <!-- ── CAMERA panel ── -->\r\n            <div class="extra-panel" id="ep-camera">\r\n                <span class="sec-label">Camera &amp; Feel</span>\r\n                <div class="form-group">\r\n                    <label>Screen Shake</label>\r\n                    <div class="pill-row" id="pillShake">\r\n                        <button class="pill" onclick="activePill('pillShake',this);liveConfig.screenShake=0;">Off</button>\r\n                        <button class="pill active" onclick="activePill('pillShake',this);liveConfig.screenShake=4;">Light</button>\r\n                        <button class="pill" onclick="activePill('pillShake',this);liveConfig.screenShake=10;">Heavy</button>\r\n                        <button class="pill" onclick="activePill('pillShake',this);liveConfig.screenShake=20;">Extreme</button>\r\n                    </div>\r\n                </div>\r\n                <div class="form-group">\r\n                    <label>Camera Zoom</label>\r\n                    <div class="pill-row" id="pillZoom">\r\n                        <button class="pill" onclick="activePill('pillZoom',this);liveConfig.cameraZoom=0.7;">Wide</button>\r\n                        <button class="pill active" onclick="activePill('pillZoom',this);liveConfig.cameraZoom=1;">Normal</button>\r\n                        <button class="pill" onclick="activePill('pillZoom',this);liveConfig.cameraZoom=1.3;">Zoomed In</button>\r\n                    </div>\r\n                </div>\r\n                <div class="form-group">\r\n                    <label>Hit Flash</label>\r\n                    <div class="pill-row" id="pillHitFlash">\r\n                        <button class="pill" onclick="activePill('pillHitFlash',this);liveConfig.hitFlash=false;">Off</button>\r\n                        <button class="pill active" onclick="activePill('pillHitFlash',this);liveConfig.hitFlash=true;">On</button>\r\n                    </div>\r\n                </div>\r\n                <div class="form-group">\r\n                    <label>Slow-Mo on Hit</label>\r\n                    <div class="pill-row" id="pillSlowMo">\r\n                        <button class="pill active" onclick="activePill('pillSlowMo',this);liveConfig.slowMoHit=false;">Off</button>\r\n                        <button class="pill" onclick="activePill('pillSlowMo',this);liveConfig.slowMoHit=true;">On</button>\r\n                    </div>\r\n                </div>\r\n            </div>\r\n\r\n            <!-- ── COMBAT panel ── -->\r\n            <div class="extra-panel" id="ep-combat">\r\n                <span class="sec-label">Combat Settings</span>\r\n                <div class="form-group">\r\n                    <label>Combo Window</label>\r\n                    <div class="range-row">\r\n                        <input type="range" min="0" max="5000" step="500" value="1500" id="comboWindowSlider" oninput="liveConfig.comboWindow=+this.value;this.nextElementSibling.textContent=this.value===0?'Off':(this.value/1000).toFixed(1)+'s';">\r\n                        <span class="range-val">1.5s</span>\r\n                    </div>\r\n                    <div style="font-size:.6rem;color:var(--muted);margin-top:2px;">Time window to build a combo streak</div>\r\n                </div>\r\n                <div class="form-group">\r\n                    <label>Score Multiplier</label>\r\n                    <div class="pill-row" id="pillScoreMult">\r\n                        <button class="pill" onclick="activePill('pillScoreMult',this);liveConfig.scoreMultiplier=0.5;">x0.5</button>\r\n                        <button class="pill active" onclick="activePill('pillScoreMult',this);liveConfig.scoreMultiplier=1;">x1</button>\r\n                        <button class="pill" onclick="activePill('pillScoreMult',this);liveConfig.scoreMultiplier=2;">x2</button>\r\n                        <button class="pill" onclick="activePill('pillScoreMult',this);liveConfig.scoreMultiplier=3;">x3</button>\r\n                    </div>\r\n                </div>\r\n                <div class="form-group">\r\n                    <label>Auto-fire</label>\r\n                    <div class="pill-row" id="pillAutoFire">\r\n                        <button class="pill active" onclick="activePill('pillAutoFire',this);liveConfig.autoFire=false;">Manual</button>\r\n                        <button class="pill" onclick="activePill('pillAutoFire',this);liveConfig.autoFire=true;">Auto</button>\r\n                    </div>\r\n                </div>\r\n                <div class="form-group">\r\n                    <label>Bullet Speed</label>\r\n                    <div class="range-row">\r\n                        <input type="range" min="200" max="1200" step="50" value="500" id="bulletSpeedSlider" oninput="liveConfig.bulletSpeed=+this.value;this.nextElementSibling.textContent=this.value;">\r\n                        <span class="range-val">500</span>\r\n                    </div>\r\n                </div>\r\n            </div>\r\n\r\n            <!-- ── HUD panel ── -->\r\n            <div class="extra-panel" id="ep-hud">\r\n                <span class="sec-label">HUD &amp; Display</span>\r\n                <div class="form-group">\r\n                    <label>Score Display</label>\r\n                    <div class="pill-row" id="pillScoreStyle">\r\n                        <button class="pill active" onclick="activePill('pillScoreStyle',this);liveConfig.scoreStyle='default';">Default</button>\r\n                        <button class="pill" onclick="activePill('pillScoreStyle',this);liveConfig.scoreStyle='big';">Big</button>\r\n                        <button class="pill" onclick="activePill('pillScoreStyle',this);liveConfig.scoreStyle='hidden';">Hidden</button>\r\n                    </div>\r\n                </div>\r\n                <div class="form-group">\r\n                    <label>Lives Display</label>\r\n                    <div class="pill-row" id="pillLivesStyle">\r\n                        <button class="pill active" onclick="activePill('pillLivesStyle',this);liveConfig.livesStyle='hearts';">Hearts</button>\r\n                        <button class="pill" onclick="activePill('pillLivesStyle',this);liveConfig.livesStyle='number';">Number</button>\r\n                        <button class="pill" onclick="activePill('pillLivesStyle',this);liveConfig.livesStyle='hidden';">Hidden</button>\r\n                    </div>\r\n                </div>\r\n                <div class="form-group">\r\n                    <label>Score Popups</label>\r\n                    <div class="pill-row" id="pillPopups">\r\n                        <button class="pill active" onclick="activePill('pillPopups',this);liveConfig.scorePopups=true;">On</button>\r\n                        <button class="pill" onclick="activePill('pillPopups',this);liveConfig.scorePopups=false;">Off</button>\r\n                    </div>\r\n                </div>\r\n                <div class="form-group">\r\n                    <label>Timer</label>\r\n                    <div class="pill-row" id="pillTimer">\r\n                        <button class="pill active" onclick="activePill('pillTimer',this);liveConfig.showTimer=false;">Off</button>\r\n                        <button class="pill" onclick="activePill('pillTimer',this);liveConfig.showTimer='countdown';">Countdown</button>\r\n                        <button class="pill" onclick="activePill('pillTimer',this);liveConfig.showTimer='up';">Count Up</button>\r\n                    </div>\r\n                </div>\r\n            </div>`;
    c = c.slice(0, closeIdx) + newPanels + '\r\n\r\n' + c.slice(closeIdx);
    console.log('OK: Add new extra panels');
  }
}

// 4c. Add new cards to _ALWAYS_EXTRAS
rep(
  "const _ALWAYS_EXTRAS   = ['theme','difficulty','world','story','effects','achievements'];",
  "const _ALWAYS_EXTRAS   = ['theme','difficulty','world','story','effects','achievements','player','camera','hud'];",
  'Add new cards to _ALWAYS_EXTRAS'
);

// 4d. Add combat to action genres
rep(
  "  SHOOTER:      ['enemies','boss','collectibles','powerups','levels'],",
  "  SHOOTER:      ['enemies','boss','collectibles','powerups','levels','combat'],",
  'Add combat to SHOOTER'
);
rep(
  "  PLATFORMER:   ['enemies','boss','collectibles','powerups','levels'],",
  "  PLATFORMER:   ['enemies','boss','collectibles','powerups','levels','combat'],",
  'Add combat to PLATFORMER'
);
rep(
  "  ROGUELIKE:    ['enemies','boss','collectibles','powerups','levels'],",
  "  ROGUELIKE:    ['enemies','boss','collectibles','powerups','levels','combat'],",
  'Add combat to ROGUELIKE'
);
rep(
  "  BEAT:         ['enemies','boss','collectibles','powerups'],",
  "  BEAT:         ['enemies','boss','collectibles','powerups','combat'],",
  'Add combat to BEAT'
);
rep(
  "  WAVESURVIVAL: ['enemies','boss','collectibles','powerups','levels'],",
  "  WAVESURVIVAL: ['enemies','boss','collectibles','powerups','levels','combat'],",
  'Add combat to WAVESURVIVAL'
);
rep(
  "  INVADERS:     ['enemies','boss','collectibles','levels'],",
  "  INVADERS:     ['enemies','boss','collectibles','levels','combat'],",
  'Add combat to INVADERS'
);

// ═══════════════════════════════════════════════════════════════════════════
// WRITE
// ═══════════════════════════════════════════════════════════════════════════
if (c === orig) {
  console.error('NO CHANGES MADE');
} else {
  fs.writeFileSync('F:/Website/Jvdesign-Website-v2/arcade-game-maker.html', c, 'utf8');
  console.log('Written. Size delta:', c.length - orig.length);
}
