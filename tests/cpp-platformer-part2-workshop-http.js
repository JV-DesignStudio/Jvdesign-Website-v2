const {run}=require('./canvas-workshop-suite');
run('/workshops/cpp-platformer-part2-workshop.html',{steps:6}).catch(e=>{console.error(e);process.exit(1);});

