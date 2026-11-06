const { run } = require('./engine-readiness-check');
run('/workshops/engine-mugen.html', { projects: ['MUGEN fighting games'] })
  .catch((e) => { console.error(e); process.exit(1); });
