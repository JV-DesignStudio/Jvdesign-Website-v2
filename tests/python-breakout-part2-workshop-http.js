const {run}=require('./canvas-workshop-suite');
run('/workshops/python-breakout-part2-workshop.html',{steps:6}).catch(e=>{console.error(e);process.exit(1);});

