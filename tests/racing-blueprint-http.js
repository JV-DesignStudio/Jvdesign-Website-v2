const { run } = require('./workshop-finish-check');
run('/workshops/racing-blueprint.html').catch((e) => { console.error(e); process.exit(1); });
