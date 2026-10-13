const {run}=require('./canvas-workshop-suite');
run('/workshops/cpp-tower-part1-workshop.html',{steps:6}).catch(e=>{console.error(e);process.exit(1);});

