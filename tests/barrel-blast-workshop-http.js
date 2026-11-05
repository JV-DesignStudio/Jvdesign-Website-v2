const { run } = require('./workshop-finish-check');
run('/workshops/barrel-blast-workshop.html').catch((e) => { console.error(e); process.exit(1); });
