const {run}=require('./workshop-page-check');
run('/workshops/roblox-horror-workshop.html',{next:'roblox-adventure-workshop.html'}).catch(e=>{console.error(e);process.exit(1);});
