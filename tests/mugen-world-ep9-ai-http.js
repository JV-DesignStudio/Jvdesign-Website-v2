const { run } = require('./workshop-finish-check');
run('/workshops/mugen-world-ep9-ai.html').catch((e) => { console.error(e); process.exit(1); });
