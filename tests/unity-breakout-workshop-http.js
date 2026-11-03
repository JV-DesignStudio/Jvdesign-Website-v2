const {run}=require('./workshop-page-check');
run('/workshops/unity-breakout-workshop.html',{next:'unity-top-down-shooter.html',challenge:false}).catch(e=>{console.error(e);process.exit(1);});
