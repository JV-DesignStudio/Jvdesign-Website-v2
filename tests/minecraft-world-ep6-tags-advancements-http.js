const {run}=require('./workshop-page-check');
run('/workshops/minecraft-world-ep6-tags-advancements.html',{next:'minecraft-world-ep7-debug.html'}).catch(e=>{console.error(e);process.exit(1);});
