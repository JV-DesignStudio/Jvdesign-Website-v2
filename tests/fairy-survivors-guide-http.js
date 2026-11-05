const { run } = require('./workshop-finish-check');
run('/workshops/fairy-survivors-guide.html').catch((e) => { console.error(e); process.exit(1); });
