const runSheetCheck = require('./run-sheet-check-lib');
runSheetCheck('workshops/run-sheets/my-first-scratch-game-run-sheet.html', 'my-first-scratch-game-run-sheet-http').catch((e) => { console.error(e); process.exit(1); });
