const {run}=require('./workshop-page-check');
run('/workshops/minecraft-world-ep2-first-recipe.html',{next:'minecraft-world-ep3-namespace.html'}).catch(e=>{console.error(e);process.exit(1);});
