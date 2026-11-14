const runSheetCheck = require('./run-sheet-check-lib');
runSheetCheck('workshops/run-sheets/my-first-video-game-run-sheet.html', 'my-first-video-game-run-sheet-http').catch((e) => { console.error(e); process.exit(1); });
