const {run}=require('./workshop-page-check');
run('/workshops/tinkercad-ep5-phonestand.html',{next:'tinkercad-ep6-marblerun.html',challenge:false,reflect:true}).catch(e=>{console.error(e);process.exit(1);});
