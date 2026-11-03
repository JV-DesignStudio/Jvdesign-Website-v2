const {run}=require('./workshop-page-check');
run('/workshops/tinkercad-ep6-marblerun.html',{next:'tinkercad-ep7-keychain.html',challenge:false,reflect:true}).catch(e=>{console.error(e);process.exit(1);});
