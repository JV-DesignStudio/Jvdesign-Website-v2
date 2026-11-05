const { run } = require('./workshop-finish-check');
run('/workshops/mugen-world-ep8-stage.html').catch((e) => { console.error(e); process.exit(1); });
