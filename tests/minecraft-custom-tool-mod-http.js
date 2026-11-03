const {run}=require('./workshop-page-check');
run('/workshops/minecraft-custom-tool-mod.html',{next:'minecraft-custom-mob-mod.html'}).catch(e=>{console.error(e);process.exit(1);});
