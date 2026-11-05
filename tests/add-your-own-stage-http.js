const { run } = require('./workshop-finish-check');
run('/workshops/add-your-own-stage.html').catch((e) => { console.error(e); process.exit(1); });
