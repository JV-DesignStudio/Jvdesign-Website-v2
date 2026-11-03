const {run}=require('./workshop-page-check');
run('/workshops/unity-pong-workshop.html',{next:'unity-2d-platformer.html',challenge:false}).catch(e=>{console.error(e);process.exit(1);});
