const {run}=require('./workshop-page-check');
run('/workshops/roblox-adventure-workshop.html',{next:'roblox-pirate-workshop.html'}).catch(e=>{console.error(e);process.exit(1);});
