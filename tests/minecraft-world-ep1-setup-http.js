const {run}=require('./workshop-page-check');
run('/workshops/minecraft-world-ep1-setup.html',{next:'minecraft-world-ep2-first-recipe.html'}).catch(e=>{console.error(e);process.exit(1);});
