const { run } = require('./workshop-finish-check');
run('/workshops/mugen-basics-workshop.html').catch((e) => { console.error(e); process.exit(1); });
