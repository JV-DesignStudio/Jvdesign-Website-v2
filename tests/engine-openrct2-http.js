const { run } = require('./engine-readiness-check');
run('/workshops/engine-openrct2.html', { projects: ['OpenRCT2 JavaScript plugin', 'OpenRCT2 Python logic'] })
  .catch((e) => { console.error(e); process.exit(1); });
