const {run}=require('./canvas-workshop-suite');
run('/workshops/js-platformer-builder.html',{steps:6}).catch(e=>{console.error(e);process.exit(1);});
