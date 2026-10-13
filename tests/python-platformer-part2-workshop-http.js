const {run}=require('./canvas-workshop-suite');
run('/workshops/python-platformer-part2-workshop.html',{steps:6}).catch(e=>{console.error(e);process.exit(1);});

