const { run } = require('./workshop-finish-check');
run('/workshops/mugen-ai-workshop.html').catch((e) => { console.error(e); process.exit(1); });
