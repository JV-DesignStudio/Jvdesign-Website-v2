const {run}=require('./workshop-page-check');
run('/workshops/unity-ui-workshop.html',{next:'unity-multiplayer-workshop.html',challenge:false}).catch(e=>{console.error(e);process.exit(1);});
