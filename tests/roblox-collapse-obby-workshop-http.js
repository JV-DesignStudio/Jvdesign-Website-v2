const {run}=require('./workshop-page-check');
run('/workshops/roblox-collapse-obby-workshop.html',{next:'my-first-roblox-studio-game.html'}).catch(e=>{console.error(e);process.exit(1);});
