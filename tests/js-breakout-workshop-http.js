const {run}=require('./canvas-workshop-suite');
run('/workshops/js-breakout-workshop.html',{steps:6}).catch(e=>{console.error(e);process.exit(1);});
