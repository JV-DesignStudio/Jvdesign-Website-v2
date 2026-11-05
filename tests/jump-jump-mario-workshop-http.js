const { run } = require('./workshop-finish-check');
run('/workshops/jump-jump-mario-workshop.html').catch((e) => { console.error(e); process.exit(1); });
