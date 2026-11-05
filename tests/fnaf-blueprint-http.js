const { run } = require('./workshop-finish-check');
run('/workshops/fnaf-blueprint.html').catch((e) => { console.error(e); process.exit(1); });
