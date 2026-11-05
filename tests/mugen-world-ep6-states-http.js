const { run } = require('./workshop-finish-check');
run('/workshops/mugen-world-ep6-states.html').catch((e) => { console.error(e); process.exit(1); });
