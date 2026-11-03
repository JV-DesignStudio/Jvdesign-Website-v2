const {run}=require('./workshop-page-check');
run('/workshops/minecraft-custom-food-mod.html',{next:'minecraft-custom-tool-mod.html'}).catch(e=>{console.error(e);process.exit(1);});
