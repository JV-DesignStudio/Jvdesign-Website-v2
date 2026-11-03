const {run}=require('./workshop-page-check');
run('/workshops/minecraft-custom-mob-mod.html',{next:'minecraft-lucky-mod.html'}).catch(e=>{console.error(e);process.exit(1);});
