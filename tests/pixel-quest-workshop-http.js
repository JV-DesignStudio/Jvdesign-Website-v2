const { run } = require('./workshop-finish-check');
run('/workshops/pixel-quest-workshop.html').catch((e) => { console.error(e); process.exit(1); });
