const { run } = require('./workshop-finish-check');
run('/workshops/nuclear-throne-guide.html').catch((e) => { console.error(e); process.exit(1); });
