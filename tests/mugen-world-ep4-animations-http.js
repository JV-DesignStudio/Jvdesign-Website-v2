const { run } = require('./workshop-finish-check');
run('/workshops/mugen-world-ep4-animations.html').catch((e) => { console.error(e); process.exit(1); });
