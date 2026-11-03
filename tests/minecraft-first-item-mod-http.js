const {run}=require('./workshop-page-check');
run('/workshops/minecraft-first-item-mod.html',{next:'minecraft-custom-block-mod.html'}).catch(e=>{console.error(e);process.exit(1);});
