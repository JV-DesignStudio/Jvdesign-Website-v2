const { run } = require('./workshop-finish-check');
run('/workshops/mugen-world-ep5-commands.html').catch((e) => { console.error(e); process.exit(1); });
