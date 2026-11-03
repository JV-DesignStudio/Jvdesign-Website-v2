const {run}=require('./workshop-page-check');
run('/workshops/minecraft-world-workshop.html',{next:'minecraft-world-ep1-setup.html'}).catch(e=>{console.error(e);process.exit(1);});
