const {run}=require('./workshop-page-check');
run('/workshops/unity-action-rpg-workshop.html',{next:'unity-ui-workshop.html',challenge:false}).catch(e=>{console.error(e);process.exit(1);});
