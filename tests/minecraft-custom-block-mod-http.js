const {run}=require('./workshop-page-check');
run('/workshops/minecraft-custom-block-mod.html',{next:'minecraft-custom-food-mod.html'}).catch(e=>{console.error(e);process.exit(1);});
