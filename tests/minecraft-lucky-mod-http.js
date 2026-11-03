const {run}=require('./workshop-page-check');
run('/workshops/minecraft-lucky-mod.html',{next:'engine-minecraft.html'}).catch(e=>{console.error(e);process.exit(1);});
