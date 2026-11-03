const {run}=require('./workshop-page-check');
run('/workshops/tinkercad-ep4-pattern.html',{next:'tinkercad-ep5-phonestand.html',challenge:false,reflect:true}).catch(e=>{console.error(e);process.exit(1);});
