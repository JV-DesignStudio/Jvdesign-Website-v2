// tool-io-labels.js (A959): reviewed create tools must share one save/export vocabulary.
// Convention: Save = keep in this browser, Restore = reopen the browser save,
// Export = download a file, Import = load a file. Also checks that the browser-local
// limit is explained and each export format has a short import note.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
let failures = 0;
const ok = (name, cond, extra) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond || !extra ? '' : ' :: ' + extra)); if (!cond) failures++; };

const pixel = read('tools/pixel-studio.html');
const build = read('tools/buildlab.html');

// Pixel Studio: browser save is Save/Restore, file moves are Export/Import.
ok('pixel: Save button is labelled Save', /onclick="saveProject\(\)"[^>]*title="Save in this browser only"[^>]*>[^<]*Save</.test(pixel));
ok('pixel: browser save reopens via Restore', /onclick="loadProject\(\)"[^>]*>[^<]*Restore</.test(pixel));
ok('pixel: project file loads via Import .json', /onclick="triggerImportProject\(\)"[^>]*>[^<]*Import \.json</.test(pixel));
ok('pixel: project file saves via Export .json', /onclick="exportProjectFile\(\)"[^>]*>[^<]*Export \.json</.test(pixel));
ok('pixel: no legacy "Load saved" label', !/Load saved/.test(pixel));
ok('pixel: no legacy "Open .json" label', !/Open \.json/.test(pixel));
ok('pixel: browser-local limit explained', /Save stays on\s*<strong>this device<\/strong>/.test(pixel) && /Export PNG\s*<\/strong>\s*to keep forever/.test(pixel));
ok('pixel: import note for the exported project/art', /Import a \.json to reopen a saved project/.test(pixel));

// BuildLab: project file is Export/Import; browser save is the Save Slot.
ok('buildlab: project file saves via Export .buildlab', /onclick="saveProjectFile\(\)"[^>]*>[^<]*Export \.buildlab</.test(build));
ok('buildlab: project file loads via Import .buildlab', /onclick="loadProjectFile\(\)"[^>]*>[^<]*Import \.buildlab</.test(build));
ok('buildlab: no legacy "Save .buildlab" label', !/onclick="saveProjectFile\(\)"[^>]*>[^<]*Save \.buildlab</.test(build));
ok('buildlab: no legacy "Load .buildlab" label', !/Load \.buildlab/.test(build));
ok('buildlab: browser-local limit explained', /Save Slot keeps a build in this browser/.test(build));
ok('buildlab: import note per export format', /open in Roblox Studio/.test(build) && /Blender, Unreal, Godot, Unity/.test(build));

if (failures) { console.log('\nFAIL tool-io-labels: ' + failures + ' check(s) failed'); process.exit(1); }
console.log('\nPASS tool-io-labels: Save/Restore/Export/Import vocabulary is consistent');
