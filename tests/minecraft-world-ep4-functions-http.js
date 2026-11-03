const {run}=require('./workshop-page-check');
run('/workshops/minecraft-world-ep4-functions.html',{next:'minecraft-world-ep5-loot.html'}).catch(e=>{console.error(e);process.exit(1);});
