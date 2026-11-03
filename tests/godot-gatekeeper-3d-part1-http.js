const {run}=require('./workshop-page-check');
run('/workshops/godot-gatekeeper-3d-part1.html',{next:'godot-gatekeeper-3d-part2.html',challenge:false}).catch(e=>{console.error(e);process.exit(1);});
