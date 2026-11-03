const {run}=require('./workshop-page-check');
run('/workshops/roblox-corruption-obby-workshop.html',{next:'my-first-roblox-studio-game.html'}).catch(e=>{console.error(e);process.exit(1);});
