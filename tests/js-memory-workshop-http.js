const {run}=require('./canvas-workshop-suite');
run('/workshops/js-memory-workshop.html',{steps:6}).catch(e=>{console.error(e);process.exit(1);});
