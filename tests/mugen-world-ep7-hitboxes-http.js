const { run } = require('./workshop-finish-check');
run('/workshops/mugen-world-ep7-hitboxes.html').catch((e) => { console.error(e); process.exit(1); });
