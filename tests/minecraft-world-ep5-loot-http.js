const {run}=require('./workshop-page-check');
run('/workshops/minecraft-world-ep5-loot.html',{next:'minecraft-world-ep6-tags-advancements.html'}).catch(e=>{console.error(e);process.exit(1);});
