const { run } = require('./workshop-finish-check');
run('/workshops/mugen-world-ep10-game.html').catch((e) => { console.error(e); process.exit(1); });
